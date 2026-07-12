from django.db import models
from django.conf import settings
from django.db.models import Sum

class Budget(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='budgets')
    category = models.ForeignKey('categories.Category', on_delete=models.CASCADE, null=True, blank=True, related_name='budgets')
    limit = models.DecimalField(max_digits=12, decimal_places=2)
    start_date = models.DateField()
    end_date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-start_date']

    def __str__(self):
        category_name = self.category.name if self.category else "Monthly Overall"
        return f"{self.user.username} - {category_name} budget of {self.limit} ({self.start_date} to {self.end_date})"

    def get_total_spent(self):
        # Import here to avoid circular import with expenses app
        from expenses.models import Expense
        if self.category:
            total = Expense.objects.filter(
                user=self.user,
                category=self.category,
                date__gte=self.start_date,
                date__lte=self.end_date
            ).aggregate(total=Sum('amount'))['total']
        else:
            total = Expense.objects.filter(
                user=self.user,
                date__gte=self.start_date,
                date__lte=self.end_date
            ).aggregate(total=Sum('amount'))['total']
        return total or 0.00
