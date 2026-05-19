# payments/views.py

from orders.utils import send_order_receipt_email
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.db import models as db_models
from .models import Payment, PaymentMethod, Transaction
from .serializers import (
    PaymentSerializer, PaymentCreateSerializer, PaymentMethodSerializer,
    PaymentMethodCreateSerializer, TransactionSerializer
)
from .paystack import (
    initialize_transaction, verify_transaction, refund_transaction,
    create_subaccount, list_banks, verify_webhook_signature
)
from orders.models import Order
import uuid
import json
import logging

logger = logging.getLogger(__name__)


class PaymentListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        payments = Payment.objects.filter(user=request.user).order_by('-created_at')

        if status_filter := request.query_params.get('status'):
            payments = payments.filter(payment_status=status_filter)
        if method_filter := request.query_params.get('method'):
            payments = payments.filter(payment_method=method_filter)
        if start_date := request.query_params.get('start_date'):
            payments = payments.filter(created_at__date__gte=start_date)
        if end_date := request.query_params.get('end_date'):
            payments = payments.filter(created_at__date__lte=end_date)
        if limit := request.query_params.get('limit'):
            try:
                payments = payments[:int(limit)]
            except ValueError:
                pass

        return Response(PaymentSerializer(payments, many=True).data)


class PaymentDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, payment_id):
        payment = get_object_or_404(Payment, payment_id=payment_id, user=request.user)
        return Response(PaymentSerializer(payment).data)


class PaymentCreateView(APIView):
    """
    Initializes a Paystack transaction.
    Returns an authorization_url to redirect/popup on the frontend.
    """
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        serializer = PaymentCreateSerializer(
            data=request.data,
            context={'request': request}
        )
        if not serializer.is_valid():
            print("❌ Serializer errors:", serializer.errors)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        payment = serializer.save()

        # Only card payments go through Paystack; others handled separately
        payment_method = request.data.get('payment_method')

        if payment_method == 'card':
            try:
                order = payment.order
                # Use seller subaccount if available (marketplace split pay)
                subaccount = getattr(
                    getattr(order, 'seller', None),
                    'paystack_subaccount_code',
                    None
                )

                result = initialize_transaction(
                    email=request.user.email,
                    amount=payment.amount,
                    reference=payment.payment_id,
                    metadata={
                        "order_id": str(order.id),
                        "payment_id": str(payment.payment_id),
                        "buyer_id": str(request.user.id),
                    },
                    subaccount=subaccount,
                )

                if not result.get("status"):
                    payment.mark_as_failed()
                    return Response(
                        {"error": result.get("message", "Paystack initialization failed")},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                payment.payment_status = 'processing'
                payment.gateway_response = result["data"]
                payment.save()

                Transaction.objects.create(
                    payment=payment,
                    transaction_type='authorization',
                    amount=payment.amount,
                    status='pending',
                    gateway_response=result["data"],
                )

                return Response({
                    "message": "Payment initialized",
                    "authorization_url": result["data"]["authorization_url"],
                    "reference": payment.payment_id,
                    "payment": PaymentSerializer(payment).data,
                }, status=status.HTTP_201_CREATED)

            except Exception as e:
                logger.error(f"Paystack initialization error: {e}")
                payment.mark_as_failed()
                return Response(
                    {"error": "Payment initialization failed"},
                    status=status.HTTP_400_BAD_REQUEST
                )

        elif payment_method == 'cash_on_delivery':
            payment.payment_status = 'processing'
            payment.gateway_response = {'method': 'cash_on_delivery'}
            payment.save()
            Transaction.objects.create(
                payment=payment,
                transaction_type='sale',
                amount=payment.amount,
                status='pending',
                gateway_response={'method': 'cash_on_delivery'},
            )
            return Response({
                "message": "Order placed with Cash on Delivery",
                "payment": PaymentSerializer(payment).data,
            }, status=status.HTTP_201_CREATED)

        elif payment_method == 'eft':
            payment.payment_status = 'processing'
            eft_details = {
                'bank': 'FNB',
                'account_name': 'Izozo Marketplace',
                'account_number': '123456789',
                'branch_code': '250655',
                'reference': payment.payment_id,
            }
            payment.gateway_response = {'bank_details': eft_details}
            payment.save()
            Transaction.objects.create(
                payment=payment,
                transaction_type='sale',
                amount=payment.amount,
                status='pending',
                gateway_response={'bank_details': eft_details},
            )
            return Response({
                "message": "Please complete EFT payment",
                "bank_details": eft_details,
                "payment": PaymentSerializer(payment).data,
            }, status=status.HTTP_201_CREATED)

        payment.mark_as_failed()
        return Response({"error": "Unsupported payment method"}, status=status.HTTP_400_BAD_REQUEST)


class PaymentConfirmView(APIView):
    """
    Called by the frontend after Paystack popup closes successfully.
    Verifies the transaction with Paystack before marking complete.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, payment_id):
        payment = get_object_or_404(Payment, payment_id=payment_id, user=request.user)

        if payment.payment_status == 'completed':
            return Response({"message": "Payment already processed"})

        if payment.payment_status != 'processing':
            return Response(
                {"error": "Payment cannot be confirmed"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # For card payments, verify with Paystack
        if payment.payment_method == 'card':
            try:
                result = verify_transaction(payment.payment_id)

                if not (result.get("status") and result["data"]["status"] == "success"):
                    payment.mark_as_failed()
                    Transaction.objects.create(
                        payment=payment,
                        transaction_type='capture',
                        amount=payment.amount,
                        status='failed',
                        gateway_response=result.get("data", {}),
                        error_message=result.get("message", "Verification failed"),
                    )
                    return Response(
                        {"error": "Payment verification failed"},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                payment.transaction_id = result["data"].get("id")
                payment.gateway_response = result["data"]
                payment.mark_as_completed()

                Transaction.objects.create(
                    payment=payment,
                    transaction_type='capture',
                    amount=payment.amount,
                    status='success',
                    gateway_transaction_id=str(result["data"].get("id")),
                    gateway_response=result["data"],
                )

            except Exception as e:
                logger.error(f"Paystack verification error: {e}")
                return Response(
                    {"error": "Verification request failed"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
        else:
            # Non-card methods (COD, EFT) confirmed manually
            payment.mark_as_completed()

        # Update order
        order = payment.order
        order.payment_status = 'paid'
        order.status = 'processing'
        order.save()
        send_order_receipt_email(order)

        return Response({
            "message": "Payment confirmed successfully",
            "payment": PaymentSerializer(payment).data,
        })


@method_decorator(csrf_exempt, name='dispatch')
class PaystackWebhookView(APIView):
    """
    Receives async events from Paystack.
    Register this URL in your Paystack dashboard.
    Must be publicly accessible over HTTPS.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        signature = request.headers.get("x-paystack-signature", "")

        if not verify_webhook_signature(request.body, signature):
            return Response({"error": "Invalid signature"}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            event = json.loads(request.body)
        except json.JSONDecodeError:
            return Response({"error": "Invalid JSON"}, status=status.HTTP_400_BAD_REQUEST)

        event_type = event.get("event")
        data = event.get("data", {})

        if event_type == "charge.success":
            reference = data.get("reference")
            try:
                payment = Payment.objects.get(payment_id=reference, payment_status='processing')
                payment.transaction_id = str(data.get("id"))
                payment.gateway_response = data
                payment.mark_as_completed()

                Transaction.objects.get_or_create(
                    payment=payment,
                    transaction_type='capture',
                    defaults={
                        'amount': payment.amount,
                        'status': 'success',
                        'gateway_transaction_id': str(data.get("id")),
                        'gateway_response': data,
                    }
                )

                payment.order.payment_status = 'paid'
                payment.order.status = 'processing'
                payment.order.save()

                send_order_receipt_email(order)

            except Payment.DoesNotExist:
                pass  # Already processed or not found — safe to ignore

        elif event_type == "refund.processed":
            reference = data.get("transaction_reference")
            Payment.objects.filter(payment_id=reference).update(payment_status='refunded')

        return Response({"status": "ok"})


class PaymentRefundView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, payment_id):
        payment = get_object_or_404(
            Payment, payment_id=payment_id, user=request.user, payment_status='completed'
        )
        try:
            amount = request.data.get('amount')  # None = full refund
            result = refund_transaction(payment.transaction_id, amount)

            if result.get("status"):
                payment.mark_as_refunded()
                Transaction.objects.create(
                    payment=payment,
                    transaction_type='refund',
                    amount=amount or payment.amount,
                    status='success',
                    gateway_response=result.get("data", {}),
                )
                return Response({"message": "Refund initiated successfully"})

            return Response({"error": result.get("message", "Refund failed")}, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            logger.error(f"Refund error: {e}")
            return Response({"error": "Refund request failed"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class PaymentMethodListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        methods = PaymentMethod.objects.filter(user=request.user, is_active=True)
        return Response(PaymentMethodSerializer(methods, many=True).data)

    def post(self, request):
        serializer = PaymentMethodCreateSerializer(
            data=request.data, context={'request': request}
        )
        if serializer.is_valid():
            return Response(
                PaymentMethodSerializer(serializer.save()).data,
                status=status.HTTP_201_CREATED
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PaymentMethodDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        method = get_object_or_404(PaymentMethod, pk=pk, user=request.user)
        return Response(PaymentMethodSerializer(method).data)

    def delete(self, request, pk):
        method = get_object_or_404(PaymentMethod, pk=pk, user=request.user)
        method.is_active = False
        method.save()
        return Response({"message": "Payment method deleted successfully"})


class PaymentMethodDefaultView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        method = get_object_or_404(PaymentMethod, pk=pk, user=request.user)
        PaymentMethod.objects.filter(user=request.user, is_default=True).update(is_default=False)
        method.is_default = True
        method.save()
        return Response({"message": "Payment method set as default"})


class TransactionListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, payment_id):
        payment = get_object_or_404(Payment, payment_id=payment_id, user=request.user)
        transactions = payment.transactions.all().order_by('-created_at')
        return Response(TransactionSerializer(transactions, many=True).data)


class PaymentStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        payments = Payment.objects.filter(user=request.user)
        total_spent = payments.filter(
            payment_status='completed'
        ).aggregate(total=db_models.Sum('amount'))['total'] or 0

        by_method = payments.values('payment_method').annotate(
            count=db_models.Count('id'),
            total=db_models.Sum('amount')
        ).order_by('-total')

        return Response({
            'total_spent': total_spent,
            'completed_payments': payments.filter(payment_status='completed').count(),
            'pending_payments': payments.filter(payment_status='pending').count(),
            'failed_payments': payments.filter(payment_status='failed').count(),
            'by_method': list(by_method),
        })


class BankListView(APIView):
    """Returns South African banks for seller onboarding forms."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            result = list_banks()
            return Response({"banks": result.get("data", [])})
        except Exception as e:
            logger.error(f"Bank list fetch failed: {e}")
            return Response({"banks": []})


class SellerOnboardingView(APIView):
    """Creates a Paystack subaccount for a seller to receive split payments."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        required = ['business_name', 'bank_code', 'account_number']
        if missing := [f for f in required if not request.data.get(f)]:
            return Response(
                {"error": f"Missing fields: {', '.join(missing)}"},
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            result = create_subaccount(
                business_name=request.data['business_name'],
                bank_code=request.data['bank_code'],
                account_number=request.data['account_number'],
                percentage_charge=request.data.get('percentage_charge', 90),
            )
            if result.get("status"):
                # Save subaccount code on the seller's profile
                profile = request.user.seller_profile
                profile.paystack_subaccount_code = result["data"]["subaccount_code"]
                profile.save()
                return Response({
                    "message": "Seller account created",
                    "subaccount_code": result["data"]["subaccount_code"],
                })
            return Response({"error": result.get("message")}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Subaccount creation failed: {e}")
            return Response({"error": "Onboarding failed"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)