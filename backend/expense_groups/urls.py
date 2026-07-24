from django.urls import path, include
from rest_framework_nested import routers
from .views import ExpenseGroupViewSet, ExpenseGroupMemberViewSet, ExpenseGroupInvitationViewSet

router = routers.DefaultRouter()
router.register(r'', ExpenseGroupViewSet, basename='expense_group')

# Nested router for members and invitations under a group
group_router = routers.NestedDefaultRouter(router, r'', lookup='group')
group_router.register(r'members', ExpenseGroupMemberViewSet, basename='group-members')
group_router.register(r'invitations', ExpenseGroupInvitationViewSet, basename='group-invitations')

urlpatterns = [
    path('', include(router.urls)),
    path('', include(group_router.urls)),
]
