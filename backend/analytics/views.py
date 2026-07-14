import datetime
from django.db.models import Sum, Max, Min, Count
from django.db.models.functions import TruncMonth
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from expenses.models import Expense
from budgets.models import Budget
from incomes.models import Income


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


class WeeklyTrendView(APIView):
    """Returns expense totals grouped by week for the current month."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        today = timezone.now().date()
        month_start = today.replace(day=1)

        expenses = Expense.objects.filter(
            user=user, date__gte=month_start, date__lte=today
        ).order_by('date')

        # Group into weeks of the month
        weeks = {}
        for exp in expenses:
            week_num = (exp.date.day - 1) // 7 + 1
            week_label = f"Week {week_num}"
            weeks[week_label] = weeks.get(week_label, 0) + float(exp.amount)

        # Return up to 5 weeks (a month can span at most 5 weeks)
        data = []
        for i in range(1, 6):
            label = f"Week {i}"
            total = round(weeks.get(label, 0), 2)
            # Only include weeks that have started
            week_start_day = (i - 1) * 7 + 1
            if week_start_day <= today.day:
                data.append({'week': label, 'total': total})

        return Response(data)


class DashboardSummaryView(APIView):
    """Returns all summary card data the dashboard needs in a single API call."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        today = timezone.now().date()
        month_start = today.replace(day=1)

        # Current month expenses
        month_expenses = Expense.objects.filter(
            user=user, date__gte=month_start, date__lte=today
        )
        total_expenses = float(month_expenses.aggregate(total=Sum('amount'))['total'] or 0)
        expense_count = month_expenses.count()

        # Active budgets
        active_budgets = Budget.objects.filter(
            user=user, start_date__lte=today, end_date__gte=today
        )
        total_budget = float(active_budgets.aggregate(total=Sum('limit'))['total'] or 0)
        remaining = round(total_budget - total_expenses, 2)
        savings_rate = round((remaining / total_budget) * 100, 1) if total_budget > 0 else 0

        # Highest and lowest expenses this month
        highest = month_expenses.order_by('-amount').first()
        lowest = month_expenses.order_by('amount').first()

        def serialize_expense(exp):
            if not exp:
                return None
            return {
                'id': exp.id,
                'title': exp.title,
                'amount': float(exp.amount),
                'date': exp.date.isoformat(),
                'category_name': exp.category.name if exp.category else 'Uncategorized',
                'category_icon': exp.category.icon if exp.category else '📦',
                'category_color': exp.category.color if exp.category else '#6b7280',
            }

        # Top categories this month (top 5)
        top_categories = (
            month_expenses
            .values('category__name', 'category__color', 'category__icon')
            .annotate(total=Sum('amount'), count=Count('id'))
            .order_by('-total')[:5]
        )

        top_cats = [
            {
                'name': tc['category__name'] or 'Uncategorized',
                'color': tc['category__color'] or '#6b7280',
                'icon': tc['category__icon'] or '📦',
                'total': float(tc['total']),
                'count': tc['count'],
                'percentage': round((float(tc['total']) / total_expenses) * 100, 1) if total_expenses > 0 else 0,
            }
            for tc in top_categories
        ]

        # Recent expenses (latest 5)
        recent = month_expenses.select_related('category').order_by('-date', '-created_at')[:5]
        recent_list = [serialize_expense(e) for e in recent]

        return Response({
            'total_budget': total_budget,
            'total_expenses': total_expenses,
            'remaining': remaining,
            'savings_rate': savings_rate,
            'expense_count': expense_count,
            'highest_expense': serialize_expense(highest),
            'lowest_expense': serialize_expense(lowest),
            'top_categories': top_cats,
            'recent_expenses': recent_list,
        })
