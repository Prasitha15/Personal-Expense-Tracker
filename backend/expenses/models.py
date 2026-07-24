from django.db import models
from django.conf import settings

class Expense(models.Model):
    OCR_STATUS_CHOICES = [
        ('none', 'No Receipt'),
        ('pending', 'Pending OCR'),
        ('completed', 'OCR Completed'),
        ('failed', 'OCR Failed'),
    ]

    PAYMENT_METHOD_CHOICES = [
        ('cash', 'Cash'),
        ('credit_card', 'Credit Card'),
        ('debit_card', 'Debit Card'),
        ('bank_transfer', 'Bank Transfer'),
        ('others', 'Others'),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='expenses')
    group = models.ForeignKey('expense_groups.ExpenseGroup', on_delete=models.CASCADE, null=True, blank=True, related_name='expenses')
    title = models.CharField(max_length=200, default='Expense Outflow')
    category = models.ForeignKey('categories.Category', on_delete=models.SET_NULL, null=True, blank=True, related_name='expenses')
    payment_method = models.CharField(max_length=50, choices=PAYMENT_METHOD_CHOICES, default='cash')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    date = models.DateField()
    description = models.TextField(blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    receipt_image = models.ImageField(upload_to='receipts/', blank=True, null=True)
    ocr_status = models.CharField(max_length=15, choices=OCR_STATUS_CHOICES, default='none')
    ocr_text = models.TextField(blank=True, null=True)
    recurring_expense = models.ForeignKey(
        'RecurringExpense', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='generated_expenses',
        help_text='If auto-generated from a recurring rule, links back to it.',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date', '-created_at']

    def __str__(self):
        return f"{self.user.username} - {self.category.name if self.category else 'No Category'} - {self.amount} on {self.date}"


class RecurringExpense(models.Model):
    FREQUENCY_CHOICES = [
        ('daily',   'Daily'),
        ('weekly',  'Weekly'),
        ('monthly', 'Monthly'),
        ('yearly',  'Yearly'),
    ]

    user            = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='recurring_expenses')
    title           = models.CharField(max_length=200)
    category        = models.ForeignKey('categories.Category', on_delete=models.SET_NULL, null=True, blank=True, related_name='recurring_expenses')
    payment_method  = models.CharField(max_length=50, choices=Expense.PAYMENT_METHOD_CHOICES, default='cash')
    amount          = models.DecimalField(max_digits=12, decimal_places=2)
    description     = models.TextField(blank=True, null=True)
    notes           = models.TextField(blank=True, null=True)

    frequency       = models.CharField(max_length=10, choices=FREQUENCY_CHOICES, default='monthly')
    start_date      = models.DateField(help_text='When the recurrence begins.')
    end_date        = models.DateField(null=True, blank=True, help_text='Leave blank to repeat indefinitely.')
    next_due_date   = models.DateField(help_text='Next date the expense will be auto-generated.')
    is_active       = models.BooleanField(default=True)

    total_generated = models.PositiveIntegerField(default=0, help_text='How many expenses have been generated so far.')
    last_generated  = models.DateField(null=True, blank=True, help_text='The date of the most recently generated expense.')

    created_at      = models.DateTimeField(auto_now_add=True)
    updated_at      = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['next_due_date', '-created_at']

    def __str__(self):
        return f"[{self.get_frequency_display()}] {self.title} – {self.amount} (next: {self.next_due_date})"

    def compute_next_due(self, from_date=None):
        """
        Calculate the next due date after `from_date` based on frequency.
        Returns a date or None if past end_date.
        """
        from datetime import timedelta
        from dateutil.relativedelta import relativedelta

        base = from_date or self.next_due_date

        if self.frequency == 'daily':
            nxt = base + timedelta(days=1)
        elif self.frequency == 'weekly':
            nxt = base + timedelta(weeks=1)
        elif self.frequency == 'monthly':
            nxt = base + relativedelta(months=1)
        elif self.frequency == 'yearly':
            nxt = base + relativedelta(years=1)
        else:
            nxt = base + relativedelta(months=1)

        # If an end_date is set and next is past it, return None
        if self.end_date and nxt > self.end_date:
            return None
        return nxt
