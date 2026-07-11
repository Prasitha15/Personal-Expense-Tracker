from rest_framework import serializers
from .models import Budget

class BudgetSerializer(serializers.ModelSerializer):
    user = serializers.PrimaryKeyRelatedField(read_only=True)
    category_name = serializers.SerializerMethodField()
    category_color = serializers.SerializerMethodField()
    category_icon = serializers.SerializerMethodField()
    total_spent = serializers.SerializerMethodField()
    progress = serializers.SerializerMethodField()

    class Meta:
        model = Budget
        fields = (
            'id', 'user', 'category', 'category_name', 'category_color', 
            'category_icon', 'limit', 'start_date', 'end_date', 
            'total_spent', 'progress', 'created_at', 'updated_at'
        )
        read_only_fields = ('created_at', 'updated_at')

    def get_category_name(self, obj):
        return obj.category.name if obj.category else "Monthly Budget"

    def get_category_color(self, obj):
        return obj.category.color if obj.category else "#6366f1"

    def get_category_icon(self, obj):
        return obj.category.icon if obj.category else "📅"

    def get_total_spent(self, obj):
        return float(obj.get_total_spent())

    def get_progress(self, obj):
        spent = float(obj.get_total_spent())
        limit = float(obj.limit)
        if limit <= 0:
            return 0.0
        return round((spent / limit) * 100, 2)

    def validate(self, attrs):
        user = self.context['request'].user
        category = attrs.get('category')
        start_date = attrs.get('start_date')
        end_date = attrs.get('end_date')

        if start_date and end_date and start_date > end_date:
            raise serializers.ValidationError("Start date cannot be after end date.")

        # Check overlapping budgets
        queryset = Budget.objects.filter(
            user=user,
            category=category,
            start_date__lte=end_date,
            end_date__gte=start_date
        )
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)

        if queryset.exists():
            category_str = category.name if category else "Monthly overall"
            raise serializers.ValidationError(f"An overlapping budget for '{category_str}' already exists in this period.")

        return attrs
