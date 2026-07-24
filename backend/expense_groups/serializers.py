from rest_framework import serializers
from .models import ExpenseGroup, ExpenseGroupMember, ExpenseGroupInvitation
from django.contrib.auth import get_user_model

User = get_user_model()

class UserBasicSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email']

class ExpenseGroupMemberSerializer(serializers.ModelSerializer):
    user_details = UserBasicSerializer(source='user', read_only=True)

    class Meta:
        model = ExpenseGroupMember
        fields = ['id', 'group', 'user', 'user_details', 'role', 'joined_at']
        read_only_fields = ['group', 'joined_at']

class ExpenseGroupInvitationSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpenseGroupInvitation
        fields = ['id', 'group', 'email', 'invited_by', 'status', 'created_at']
        read_only_fields = ['group', 'invited_by', 'status', 'created_at']

class ExpenseGroupSerializer(serializers.ModelSerializer):
    members = ExpenseGroupMemberSerializer(many=True, read_only=True)
    invitations = ExpenseGroupInvitationSerializer(many=True, read_only=True)
    created_by_details = UserBasicSerializer(source='created_by', read_only=True)

    class Meta:
        model = ExpenseGroup
        fields = ['id', 'name', 'description', 'created_by', 'created_by_details', 'created_at', 'members', 'invitations']
        read_only_fields = ['created_by', 'created_at']
