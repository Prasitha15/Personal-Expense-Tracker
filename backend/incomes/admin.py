from django.contrib import admin
from .models import Income


@admin.register(Income)
class IncomeAdmin(admin.ModelAdmin):
    list_display = ('user', 'title', 'source', 'amount', 'date', 'is_recurring', 'created_at')
    list_filter = ('source', 'is_recurring', 'date')
    search_fields = ('title', 'description', 'user__username')
    ordering = ('-date',)
    date_hierarchy = 'date'
