from django.db import models
from django.conf import settings
from django.utils import timezone

class AgentProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    home_address = models.TextField()
    has_internet = models.BooleanField(default=False)
    has_smartphone = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now)
    
    def __str__(self):
        return f"{self.user.full_name} - Agent"
    
    class Meta:
        db_table = 'agent_profiles'
        ordering = ['-created_at']

class AgentSMEAssignment(models.Model):
    agent = models.ForeignKey(AgentProfile, on_delete=models.CASCADE, related_name='assignments')
    sme = models.ForeignKey('smes.SMEProfile', on_delete=models.CASCADE, related_name='agent_assignments')
    active = models.BooleanField(default=True)
    assigned_at = models.DateTimeField(default=timezone.now)
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.agent.user.email} - {self.sme.business_name}"
    
    class Meta:
        db_table = 'agent_sme_assignments'
        unique_together = ['agent', 'sme']
        ordering = ['-assigned_at']