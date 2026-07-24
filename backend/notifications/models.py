from django.db import models
from django.conf import settings


class Notification(models.Model):
    TYPE_CHOICES = [
        ('budget_alert',     'Budget Alert'),
        ('weekly_summary',   'Weekly Summary'),
        ('monthly_summary',  'Monthly Summary'),
        ('system',           'System'),
    ]

    user              = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notifications')
    notification_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='system')
    title             = models.CharField(max_length=120, default='Notification')
    message           = models.TextField()
    is_read           = models.BooleanField(default=False)
    email_sent        = models.BooleanField(default=False)
    created_at        = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.notification_type}] {self.user.username}: {self.title}"
