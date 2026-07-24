from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ExpenseViewSet, RecurringExpenseViewSet

router = DefaultRouter()
router.register(r'', ExpenseViewSet, basename='expense')

recurring_router = DefaultRouter()
recurring_router.register(r'', RecurringExpenseViewSet, basename='recurring-expense')

urlpatterns = [
    path('', include(router.urls)),
    path('recurring/', include(recurring_router.urls)),
]
