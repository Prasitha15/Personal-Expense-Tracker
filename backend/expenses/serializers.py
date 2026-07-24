from rest_framework import serializers
from .models import Expense, RecurringExpense


class ExpenseSerializer(serializers.ModelSerializer):
    user = serializers.PrimaryKeyRelatedField(read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True, default='Uncategorized')
    category_display = serializers.CharField(source='category.name', read_only=True, default='Uncategorized')
    category_color = serializers.CharField(source='category.color', read_only=True, default='#6b7280')
    category_icon = serializers.CharField(source='category.icon', read_only=True, default='📦')
    payment_method_display = serializers.CharField(source='get_payment_method_display', read_only=True)
    ocr_status_display = serializers.CharField(source='get_ocr_status_display', read_only=True)
    group_name = serializers.CharField(source='group.name', read_only=True)

    class Meta:
        model = Expense
        fields = (
            'id', 'user', 'group', 'group_name', 'title',
            'category', 'category_name', 'category_display', 'category_color', 'category_icon',
            'payment_method', 'payment_method_display', 'amount', 'date',
            'description', 'notes', 'receipt_image', 'ocr_status',
            'ocr_status_display', 'ocr_text', 'created_at', 'updated_at',
        )
        read_only_fields = ('ocr_status', 'ocr_text', 'created_at', 'updated_at')


class RecurringExpenseSerializer(serializers.ModelSerializer):
    user = serializers.PrimaryKeyRelatedField(read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True, default='Uncategorized')
    category_display = serializers.CharField(source='category.name', read_only=True, default='Uncategorized')
    category_color = serializers.CharField(source='category.color', read_only=True, default='#6b7280')
    category_icon = serializers.CharField(source='category.icon', read_only=True, default='📦')
    payment_method_display = serializers.CharField(source='get_payment_method_display', read_only=True)
    frequency_display = serializers.CharField(source='get_frequency_display', read_only=True)

    class Meta:
        model = RecurringExpense
        fields = (
            'id', 'user', 'title',
            'category', 'category_name', 'category_display', 'category_color', 'category_icon',
            'payment_method', 'payment_method_display',
            'amount', 'description', 'notes',
            'frequency', 'frequency_display',
            'start_date', 'end_date', 'next_due_date', 'is_active',
            'total_generated', 'last_generated',
            'created_at', 'updated_at',
        )
        read_only_fields = ('total_generated', 'last_generated', 'created_at', 'updated_at')

    def create(self, validated_data):
        # Default next_due_date to start_date if not explicitly provided
        if 'next_due_date' not in validated_data or validated_data['next_due_date'] is None:
            validated_data['next_due_date'] = validated_data.get('start_date')
        return super().create(validated_data)
