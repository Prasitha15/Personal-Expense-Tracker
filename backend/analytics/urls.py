from django.urls import path
from .views import (
    CategoryBreakdownView, MonthlyTrendView, BudgetVsActualView,
    WeeklyTrendView, DashboardSummaryView, AIInsightsView
)

urlpatterns = [
    path('category-breakdown/', CategoryBreakdownView.as_view(), name='analytics_category_breakdown'),
    path('monthly-trend/', MonthlyTrendView.as_view(), name='analytics_monthly_trend'),
    path('budget-vs-actual/', BudgetVsActualView.as_view(), name='analytics_budget_vs_actual'),
    path('weekly-trend/', WeeklyTrendView.as_view(), name='analytics_weekly_trend'),
    path('dashboard-summary/', DashboardSummaryView.as_view(), name='analytics_dashboard_summary'),
    path('insights/', AIInsightsView.as_view(), name='analytics_insights'),
]
