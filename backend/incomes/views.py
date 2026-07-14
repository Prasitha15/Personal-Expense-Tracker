import datetime
from django.db.models import Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone
from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from .models import Income
from .serializers import IncomeSerializer
from .filters import IncomeFilter


class IncomeViewSet(viewsets.ModelViewSet):
    """
    Full CRUD for Income records.
    Extra actions:
      GET /api/incomes/summary/        — monthly + yearly totals, breakdown by source
      GET /api/incomes/monthly-trend/  — last 12 months income by month
      GET /api/incomes/yearly-summary/ — income totals grouped by year
    """
    serializer_class = IncomeSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = IncomeFilter
    search_fields = ['title', 'description']
    ordering_fields = ['date', 'amount', 'created_at']
    ordering = ['-date']

    def get_queryset(self):
        qs = Income.objects.filter(user=self.request.user)

        # Date range filters
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        year = self.request.query_params.get('year')
        month = self.request.query_params.get('month')

        if start_date:
            qs = qs.filter(date__gte=start_date)
        if end_date:
            qs = qs.filter(date__lte=end_date)
        if year:
            qs = qs.filter(date__year=year)
        if month:
            qs = qs.filter(date__month=month)

        return qs

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
        """Returns monthly income, yearly income, and breakdown by source."""
        user = request.user
        today = timezone.now().date()
        month_start = today.replace(day=1)
        year_start = today.replace(month=1, day=1)

        all_incomes = Income.objects.filter(user=user)

        # Monthly totals
        month_qs = all_incomes.filter(date__gte=month_start, date__lte=today)
        monthly_total = float(month_qs.aggregate(total=Sum('amount'))['total'] or 0)
        monthly_count = month_qs.count()

        # Yearly totals
        year_qs = all_incomes.filter(date__gte=year_start, date__lte=today)
        yearly_total = float(year_qs.aggregate(total=Sum('amount'))['total'] or 0)
        yearly_count = year_qs.count()

        # All-time total
        all_time_total = float(all_incomes.aggregate(total=Sum('amount'))['total'] or 0)

        # Breakdown by source (current year)
        SOURCE_META = {
            'salary':      {'icon': '💼', 'color': '#6366f1'},
            'business':    {'icon': '🏢', 'color': '#10b981'},
            'investment':  {'icon': '📈', 'color': '#f59e0b'},
            'freelancing': {'icon': '💻', 'color': '#06b6d4'},
            'other':       {'icon': '💰', 'color': '#ec4899'},
        }

        source_breakdown = (
            year_qs
            .values('source')
            .annotate(total=Sum('amount'))
            .order_by('-total')
        )

        breakdown_data = []
        for item in source_breakdown:
            src = item['source']
            meta = SOURCE_META.get(src, {'icon': '💰', 'color': '#6b7280'})
            total = float(item['total'])
            breakdown_data.append({
                'source': src,
                'source_display': dict(Income.SOURCE_CHOICES).get(src, src.title()),
                'icon': meta['icon'],
                'color': meta['color'],
                'total': total,
                'percentage': round((total / yearly_total) * 100, 1) if yearly_total > 0 else 0,
            })

        return Response({
            'monthly_total': monthly_total,
            'monthly_count': monthly_count,
            'yearly_total': yearly_total,
            'yearly_count': yearly_count,
            'all_time_total': all_time_total,
            'source_breakdown': breakdown_data,
        })

    @action(detail=False, methods=['get'], url_path='monthly-trend')
    def monthly_trend(self, request):
        """Returns income totals for the last 12 months."""
        user = request.user
        twelve_months_ago = timezone.now().date() - datetime.timedelta(days=365)

        trends = (
            Income.objects.filter(user=user, date__gte=twelve_months_ago)
            .annotate(month=TruncMonth('date'))
            .values('month')
            .annotate(total=Sum('amount'))
            .order_by('month')
        )

        data = [
            {
                'month': item['month'].strftime('%Y-%m') if item['month'] else '',
                'month_display': item['month'].strftime('%b %Y') if item['month'] else '',
                'total': float(item['total']),
            }
            for item in trends
        ]
        return Response(data)

    @action(detail=False, methods=['get'], url_path='yearly-summary')
    def yearly_summary(self, request):
        """Returns income totals grouped by year."""
        user = request.user

        from django.db.models.functions import ExtractYear
        year_data = (
            Income.objects.filter(user=user)
            .annotate(year=ExtractYear('date'))
            .values('year')
            .annotate(total=Sum('amount'))
            .order_by('year')
        )

        data = [
            {'year': item['year'], 'total': float(item['total'])}
            for item in year_data
        ]
        return Response(data)
