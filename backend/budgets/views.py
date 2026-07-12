from django.db.models import Sum
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Budget
from .serializers import BudgetSerializer

class BudgetViewSet(viewsets.ModelViewSet):
    queryset = Budget.objects.all()
    serializer_class = BudgetSerializer

    def get_queryset(self):
        qs = self.queryset.filter(user=self.request.user)
        # Optional: filter active budgets only
        status = self.request.query_params.get('status')
        if status == 'active':
            today = timezone.now().date()
            qs = qs.filter(start_date__lte=today, end_date__gte=today)
        return qs

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class BudgetSummaryView(APIView):
    """Returns aggregated budget summary for the current user's active budgets."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        today = timezone.now().date()

        active_budgets = Budget.objects.filter(
            user=user, start_date__lte=today, end_date__gte=today
        )

        total_limit = float(active_budgets.aggregate(total=Sum('limit'))['total'] or 0)

        # Compute per-budget details
        budget_details = []
        total_spent = 0
        status_counts = {'safe': 0, 'warning': 0, 'exceeded': 0}

        for budget in active_budgets:
            spent = float(budget.get_total_spent())
            limit = float(budget.limit)
            total_spent += spent
            progress = round((spent / limit) * 100, 2) if limit > 0 else 0
            remaining = round(limit - spent, 2)

            if progress >= 100:
                status = 'exceeded'
            elif progress >= 75:
                status = 'warning'
            else:
                status = 'safe'

            status_counts[status] += 1

            budget_details.append({
                'id': budget.id,
                'category_name': budget.category.name if budget.category else 'Monthly Overall',
                'category_color': budget.category.color if budget.category else '#6366f1',
                'category_icon': budget.category.icon if budget.category else '📅',
                'limit': limit,
                'spent': spent,
                'remaining': remaining,
                'progress': progress,
                'status': status,
            })

        remaining = round(total_limit - total_spent, 2)
        overall_progress = round((total_spent / total_limit) * 100, 2) if total_limit > 0 else 0

        return Response({
            'total_limit': total_limit,
            'total_spent': total_spent,
            'remaining': remaining,
            'overall_progress': overall_progress,
            'budget_count': active_budgets.count(),
            'status_counts': status_counts,
            'budgets': budget_details,
        })
