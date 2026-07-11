import datetime
from django.db.models import Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from expenses.models import Expense
from budgets.models import Budget

class CategoryBreakdownView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        # Allow optional date range filtering
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')

        expenses = Expense.objects.filter(user=user)
        if start_date:
            expenses = expenses.filter(date__gte=start_date)
        if end_date:
            expenses = expenses.filter(date__lte=end_date)

        breakdown = (
            expenses.values('category_id', 'category__name', 'category__color', 'category__icon')
            .annotate(total=Sum('amount'))
            .order_by('-total')
        )

        data = [
            {
                'category': item['category_id'],
                'category_display': item['category__name'] or 'Uncategorized',
                'color': item['category__color'] or '#6b7280',
                'icon': item['category__icon'] or '📦',
                'total': float(item['total'])
            }
            for item in breakdown
        ]

        return Response(data)

class MonthlyTrendView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        # Get past 6 months
        six_months_ago = timezone.now().date() - datetime.timedelta(days=180)
        
        trends = (
            Expense.objects.filter(user=user, date__gte=six_months_ago)
            .annotate(month=TruncMonth('date'))
            .values('month')
            .annotate(total=Sum('amount'))
            .order_by('month')
        )

        data = [
            {
                'month': item['month'].strftime('%Y-%m') if item['month'] else "",
                'month_display': item['month'].strftime('%b %Y') if item['month'] else "",
                'total': float(item['total'])
            }
            for item in trends
        ]

        return Response(data)

class BudgetVsActualView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        # Get all budgets current or active in the latest context
        today = timezone.now().date()
        budgets = Budget.objects.filter(user=user, start_date__lte=today, end_date__gte=today)
        
        data = []
        for budget in budgets:
            actual = budget.get_total_spent()
            data.append({
                'category': budget.category.id if budget.category else None,
                'category_display': budget.category.name if budget.category else 'No Category',
                'color': budget.category.color if budget.category else '#6b7280',
                'icon': budget.category.icon if budget.category else '📦',
                'limit': float(budget.limit),
                'actual': float(actual),
                'difference': float(budget.limit - actual)
            })
            
        return Response(data)
