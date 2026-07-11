from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model
from .models import Category

User = get_user_model()

@receiver(post_save, sender=User)
def create_default_categories(sender, instance, created, **kwargs):
    if created:
        default_categories = [
            {'name': 'Food & Dining', 'color': '#10b981', 'icon': '🍔'},
            {'name': 'Transportation', 'color': '#3b82f6', 'icon': '🚗'},
            {'name': 'Utilities', 'color': '#f59e0b', 'icon': '⚡'},
            {'name': 'Entertainment', 'color': '#8b5cf6', 'icon': '🎬'},
            {'name': 'Housing', 'color': '#ef4444', 'icon': '🏠'},
            {'name': 'Others', 'color': '#6b7280', 'icon': '📦'},
        ]
        for cat in default_categories:
            Category.objects.get_or_create(
                user=instance,
                name=cat['name'],
                defaults={'color': cat['color'], 'icon': cat['icon']}
            )
