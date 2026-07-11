import django_filters
from .models import Expense

class ExpenseFilter(django_filters.FilterSet):
    start_date = django_filters.DateFilter(field_name='date', lookup_expr='gte')
    end_date = django_filters.DateFilter(field_name='date', lookup_expr='lte')
    min_amount = django_filters.NumberFilter(field_name='amount', lookup_expr='gte')
    max_amount = django_filters.NumberFilter(field_name='amount', lookup_expr='lte')
    category = django_filters.NumberFilter(field_name='category_id')
    payment_method = django_filters.ChoiceFilter(choices=Expense.PAYMENT_METHOD_CHOICES)

    class Meta:
        model = Expense
        fields = ['category', 'payment_method', 'start_date', 'end_date', 'min_amount', 'max_amount']
