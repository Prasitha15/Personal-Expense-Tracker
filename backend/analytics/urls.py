from django.urls import path
from .views import CategoryBreakdownView, MonthlyTrendView, BudgetVsActualView

urlpatterns = [
    path('category-breakdown/', CategoryBreakdownView.as_view(), name='analytics_category_breakdown'),
    path('monthly-trend/', MonthlyTrendView.as_view(), name='analytics_monthly_trend'),
    path('budget-vs-actual/', BudgetVsActualView.as_view(), name='analytics_budget_vs_actual'),
]
