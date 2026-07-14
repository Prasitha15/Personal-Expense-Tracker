from django.db import models
from django.conf import settings


class Income(models.Model):
    SOURCE_CHOICES = [
        ('salary', 'Salary'),
        ('business', 'Business'),
        ('investment', 'Investment'),
        ('freelancing', 'Freelancing'),
        ('other', 'Other'),
    ]

    RECURRENCE_CHOICES = [
        ('monthly', 'Monthly'),
        ('quarterly', 'Quarterly'),
        ('annually', 'Annually'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='incomes'
    )
    title = models.CharField(max_length=200)
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default='salary')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    date = models.DateField()
    description = models.TextField(blank=True, null=True)
    is_recurring = models.BooleanField(default=False)
    recurrence_period = models.CharField(
        max_length=20,
        choices=RECURRENCE_CHOICES,
        blank=True,
        null=True
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date', '-created_at']

    def __str__(self):
        return f"{self.user.username} - {self.get_source_display()} - {self.amount} on {self.date}"
