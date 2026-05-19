from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from products.models import Product
from smes.models import SMEProfile
from agents.models import AgentProfile

class PublicStatsView(APIView):
    """
    Public endpoint for site statistics
    GET /api/stats/
    """
    permission_classes = [AllowAny]

    def get(self, request):
        # Get counts from database
        total_products = Product.objects.filter(status='active', is_active=True).count()
        total_smes = SMEProfile.objects.filter(user__status='active').count()
        total_agents = AgentProfile.objects.filter(user__status='active').count()
        
        return Response({
            'activeSMEs': total_smes,
            'verifiedAgents': total_agents,
            'totalProducts': total_products
        })