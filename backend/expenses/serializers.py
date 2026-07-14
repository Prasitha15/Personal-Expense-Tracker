from rest_framework import serializers
from .models import Expense


class ExpenseSerializer(serializers.ModelSerializer):
    user = serializers.PrimaryKeyRelatedField(read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True, default='Uncategorized')
    category_display = serializers.CharField(source='category.name', read_only=True, default='Uncategorized')
    category_color = serializers.CharField(source='category.color', read_only=True, default='#6b7280')
    category_icon = serializers.CharField(source='category.icon', read_only=True, default='📦')
    payment_method_display = serializers.CharField(source='get_payment_method_display', read_only=True)
    ocr_status_display = serializers.CharField(source='get_ocr_status_display', read_only=True)

    class Meta:
        model = Expense
        fields = (
            'id', 'user', 'title',
            'category', 'category_name', 'category_display', 'category_color', 'category_icon',
            'payment_method', 'payment_method_display', 'amount', 'date',
            'description', 'notes', 'receipt_image', 'ocr_status',
            'ocr_status_display', 'ocr_text', 'created_at', 'updated_at',
        )
        read_only_fields = ('ocr_status', 'ocr_text', 'created_at', 'updated_at')
