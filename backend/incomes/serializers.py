from rest_framework import serializers
from .models import Income


class IncomeSerializer(serializers.ModelSerializer):
    source_display = serializers.CharField(source='get_source_display', read_only=True)
    recurrence_period_display = serializers.CharField(
        source='get_recurrence_period_display', read_only=True
    )

    class Meta:
        model = Income
        fields = [
            'id', 'title', 'source', 'source_display',
            'amount', 'date', 'description',
            'is_recurring', 'recurrence_period', 'recurrence_period_display',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Amount must be greater than zero.")
        return value
