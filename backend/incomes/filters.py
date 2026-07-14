import django_filters
from .models import Income


class IncomeFilter(django_filters.FilterSet):
    # Date range
    start_date = django_filters.DateFilter(field_name='date', lookup_expr='gte')
    end_date = django_filters.DateFilter(field_name='date', lookup_expr='lte')

    # Amount range
    min_amount = django_filters.NumberFilter(field_name='amount', lookup_expr='gte')
    max_amount = django_filters.NumberFilter(field_name='amount', lookup_expr='lte')

    # Source exact-match
    source = django_filters.ChoiceFilter(choices=Income.SOURCE_CHOICES)

    # Year / Month convenience filters
    year = django_filters.NumberFilter(field_name='date', lookup_expr='year')
    month = django_filters.NumberFilter(field_name='date', lookup_expr='month')

    class Meta:
        model = Income
        fields = [
            'source', 'is_recurring',
            'start_date', 'end_date',
            'min_amount', 'max_amount',
            'year', 'month',
        ]
