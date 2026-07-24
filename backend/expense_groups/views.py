from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import ExpenseGroup, ExpenseGroupMember, ExpenseGroupInvitation
from .serializers import ExpenseGroupSerializer, ExpenseGroupMemberSerializer, ExpenseGroupInvitationSerializer
from django.core.mail import send_mail
from django.conf import settings

class ExpenseGroupViewSet(viewsets.ModelViewSet):
    serializer_class = ExpenseGroupSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Users can see groups they created OR are members of
        return ExpenseGroup.objects.filter(
            members__user=self.request.user
        ).distinct()

    def perform_create(self, serializer):
        group = serializer.save(created_by=self.request.user)
        ExpenseGroupMember.objects.create(
            group=group,
            user=self.request.user,
            role='admin'
        )

    @action(detail=False, methods=['post'], url_path='join')
    def join_group(self, request):
        token = request.data.get('token')
        if not token:
            return Response({'error': 'Token is required.'}, status=status.HTTP_400_BAD_REQUEST)
        
        invitation = get_object_or_404(ExpenseGroupInvitation, token=token, status='pending')
        
        # Add user to group
        member, created = ExpenseGroupMember.objects.get_or_create(
            group=invitation.group,
            user=request.user,
            defaults={'role': 'member'}
        )
        
        invitation.status = 'accepted'
        invitation.save()
        
        return Response({'message': f'Successfully joined {invitation.group.name}'}, status=status.HTTP_200_OK)


class ExpenseGroupMemberViewSet(viewsets.ModelViewSet):
    serializer_class = ExpenseGroupMemberSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        group_id = self.kwargs.get('group_pk')
        if group_id:
            return ExpenseGroupMember.objects.filter(
                group_id=group_id,
                group__members__user=self.request.user
            ).distinct()
        return ExpenseGroupMember.objects.none()
        
    def perform_create(self, serializer):
        group_id = self.kwargs.get('group_pk')
        group = get_object_or_404(ExpenseGroup, pk=group_id)
        
        # Only admins can add members directly via this endpoint
        if not ExpenseGroupMember.objects.filter(group=group, user=self.request.user, role='admin').exists():
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You must be an admin to add members.")
            
        serializer.save(group=group)


class ExpenseGroupInvitationViewSet(viewsets.ModelViewSet):
    serializer_class = ExpenseGroupInvitationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        group_id = self.kwargs.get('group_pk')
        if group_id:
            return ExpenseGroupInvitation.objects.filter(
                group_id=group_id,
                group__members__user=self.request.user
            ).distinct()
        return ExpenseGroupInvitation.objects.none()

    def perform_create(self, serializer):
        group_id = self.kwargs.get('group_pk')
        group = get_object_or_404(ExpenseGroup, pk=group_id)
        
        if not ExpenseGroupMember.objects.filter(group=group, user=self.request.user, role='admin').exists():
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You must be an admin to invite members.")
            
        invitation = serializer.save(group=group, invited_by=self.request.user)
        
        # Generate invite link and send email
        invite_link = f"{settings.FRONTEND_URL}/groups/join?token={invitation.token}"
        try:
            send_mail(
                subject=f"You have been invited to join {group.name}",
                message=f"You've been invited to {group.name} on Personal Expense Tracker.\n\nClick the link below to join:\n{invite_link}",
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[invitation.email],
                fail_silently=True,
            )
        except Exception as e:
            # We don't want to fail the request if email fails, as we'll return the token anyway
            pass
