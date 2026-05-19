# payments/paystack.py
import requests
import hmac
import hashlib
from django.conf import settings

BASE_URL = "https://api.paystack.co"

def _headers():
    print("🔑 SECRET KEY BEING USED:", repr(settings.PAYSTACK_SECRET_KEY))
    return {
        "Authorization": f"Bearer {settings.PAYSTACK_SECRET_KEY}",
        "Content-Type": "application/json",
    }

def initialize_transaction(email, amount, reference, metadata=None, subaccount=None):
    """Amount in ZAR — converted to kobo internally."""
    payload = {
        "email": email,
        "amount": int(float(amount) * 100),
        "reference": reference,
        "metadata": metadata or {},
    }
    if subaccount:
        payload["subaccount"] = subaccount
        payload["bearer"] = "subaccount"

    res = requests.post(f"{BASE_URL}/transaction/initialize", json=payload, headers=_headers())
    res.raise_for_status()
    return res.json()

def verify_transaction(reference):
    res = requests.get(f"{BASE_URL}/transaction/verify/{reference}", headers=_headers())
    res.raise_for_status()
    return res.json()

def refund_transaction(transaction_id, amount=None):
    payload = {"transaction": transaction_id}
    if amount:
        payload["amount"] = int(float(amount) * 100)
    res = requests.post(f"{BASE_URL}/refund", json=payload, headers=_headers())
    res.raise_for_status()
    return res.json()

def create_subaccount(business_name, bank_code, account_number, percentage_charge=90):
    payload = {
        "business_name": business_name,
        "settlement_bank": bank_code,
        "account_number": account_number,
        "percentage_charge": percentage_charge,
    }
    res = requests.post(f"{BASE_URL}/subaccount", json=payload, headers=_headers())
    res.raise_for_status()
    return res.json()

def list_banks(country="south africa"):
    res = requests.get(f"{BASE_URL}/bank?country={country}", headers=_headers())
    res.raise_for_status()
    return res.json()

def verify_webhook_signature(payload_bytes, signature):
    expected = hmac.new(
        settings.PAYSTACK_SECRET_KEY.encode("utf-8"),
        payload_bytes,
        hashlib.sha512,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)