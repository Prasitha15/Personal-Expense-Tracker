from rest_framework import serializers
from .models import Category

class CategorySerializer(serializers.ModelSerializer):
    user = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Category
        fields = ('id', 'user', 'name', 'color', 'icon', 'created_at', 'updated_at')
        read_only_fields = ('created_at', 'updated_at')

    def validate_name(self, value):
        user = self.context['request'].user
        # Exclude current category if updating
        queryset = Category.objects.filter(user=user, name__iexact=value)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("A category with this name already exists.")
        return value
