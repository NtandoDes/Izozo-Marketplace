from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from admin_dashboard.models import SystemSettings

User = get_user_model()


class Command(BaseCommand):
    help = 'Create default admin settings'
    
    def handle(self, *args, **kwargs):
        default_settings = [
            {
                'key': 'site_name',
                'value': 'Izozo Marketplace',
                'description': 'Site name displayed in the platform',
                'is_public': True
            },
            {
                'key': 'support_email',
                'value': 'support@izozo.com',
                'description': 'Customer support email address',
                'is_public': True
            },
            {
                'key': 'enable_registration',
                'value': True,
                'description': 'Allow new user registrations',
                'is_public': False
            },
            {
                'key': 'auto_approve_smes',
                'value': False,
                'description': 'Automatically approve SME registrations',
                'is_public': False
            },
            {
                'key': 'auto_approve_agents',
                'value': False,
                'description': 'Automatically approve agent registrations',
                'is_public': False
            },
            {
                'key': 'auto_approve_delivery',
                'value': False,
                'description': 'Automatically approve delivery partner registrations',
                'is_public': False
            },
            {
                'key': 'max_assignments_per_agent',
                'value': 10,
                'description': 'Maximum number of active assignments per agent',
                'is_public': False
            },
        ]
        
        for setting in default_settings:
            obj, created = SystemSettings.objects.get_or_create(
                key=setting['key'],
                defaults={
                    'value': setting['value'],
                    'description': setting['description'],
                    'is_public': setting['is_public']
                }
            )
            if created:
                self.stdout.write(
                    self.style.SUCCESS(f'Created setting: {setting["key"]}')
                )
            else:
                self.stdout.write(
                    self.style.WARNING(f'Setting already exists: {setting["key"]}')
                )
        
        self.stdout.write(
            self.style.SUCCESS('Successfully created admin settings')
        )