from rest_framework import mixins, viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Notification
from .serializers import NotificationSerializer


class NotificationViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """
    Notifications are created only by the system (Celery tasks).
    Users can list, read, mark as read, and delete notifications.

    Endpoints:
      GET    /api/notifications/               — paginated list (newest first)
      GET    /api/notifications/{id}/          — single notification
      PATCH  /api/notifications/{id}/          — update is_read
      DELETE /api/notifications/{id}/          — delete one
      POST   /api/notifications/mark-all-read/ — mark all as read
      POST   /api/notifications/mark-read/{id}/ — mark one as read
      DELETE /api/notifications/delete-all/    — clear all notifications
      GET    /api/notifications/unread-count/  — { count: N }
    """
    queryset          = Notification.objects.all()
    serializer_class  = NotificationSerializer
    http_method_names = ['get', 'patch', 'delete', 'post', 'head', 'options']

    def get_queryset(self):
        qs = self.queryset.filter(user=self.request.user)
        # Optional filter by type
        ntype = self.request.query_params.get('type')
        if ntype:
            qs = qs.filter(notification_type=ntype)
        # Optional unread-only filter
        if self.request.query_params.get('unread') == 'true':
            qs = qs.filter(is_read=False)
        return qs

    # ── Bulk actions ─────────────────────────────────────────────────────

    @action(detail=False, methods=['post'], url_path='mark-all-read')
    def mark_all_read(self, request):
        updated = self.get_queryset().filter(is_read=False).update(is_read=True)
        return Response({'status': 'ok', 'updated': updated}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['delete'], url_path='delete-all')
    def delete_all(self, request):
        deleted, _ = self.get_queryset().delete()
        return Response({'status': 'ok', 'deleted': deleted}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='unread-count')
    def unread_count(self, request):
        count = self.get_queryset().filter(is_read=False).count()
        return Response({'count': count}, status=status.HTTP_200_OK)

    # ── Single-notification mark-read ─────────────────────────────────────

    @action(detail=True, methods=['post'], url_path='mark-read')
    def mark_read(self, request, pk=None):
        notif = self.get_object()
        notif.is_read = True
        notif.save(update_fields=['is_read'])
        return Response(NotificationSerializer(notif).data, status=status.HTTP_200_OK)
