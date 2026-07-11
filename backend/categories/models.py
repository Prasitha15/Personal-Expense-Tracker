from django.db import models
from django.conf import settings

class Category(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='categories')
    name = models.CharField(max_length=100)
    color = models.CharField(max_length=7, default='#6366f1')  # Hex code representation
    icon = models.CharField(max_length=50, default='📦')       # Emoji or icon key representation
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        unique_together = ('user', 'name')  # User cannot have duplicate categories

    def __str__(self):
        return f"{self.icon} {self.name}"
