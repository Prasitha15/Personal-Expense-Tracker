import django_filters
from .models import Expense


class ExpenseFilter(django_filters.FilterSet):
    # Date range
    start_date = django_filters.DateFilter(field_name='date', lookup_expr='gte')
    end_date = django_filters.DateFilter(field_name='date', lookup_expr='lte')

    # Amount range
    min_amount = django_filters.NumberFilter(field_name='amount', lookup_expr='gte')
    max_amount = django_filters.NumberFilter(field_name='amount', lookup_expr='lte')

    # Category filter (by id)
    category = django_filters.NumberFilter(field_name='category_id')

    # Group filter (by id)
    group = django_filters.NumberFilter(field_name='group_id')

    # Payment method exact-match
    payment_method = django_filters.ChoiceFilter(choices=Expense.PAYMENT_METHOD_CHOICES)

    # Year / Month convenience filters
    year = django_filters.NumberFilter(field_name='date', lookup_expr='year')
    month = django_filters.NumberFilter(field_name='date', lookup_expr='month')

    class Meta:
        model = Expense
        fields = [
            'category', 'payment_method',
            'start_date', 'end_date',
            'min_amount', 'max_amount',
            'year', 'month',
        ]
