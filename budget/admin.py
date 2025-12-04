# budget/admin.py
from django.contrib import admin
from .models import Account, Category, Transaction

@admin.register(Account)
class AccountAdmin(admin.ModelAdmin):
    list_display = ('name', 'account_type', 'balance')

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name',)

@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ('date', 'payee', 'amount', 'category', 'account')
    list_filter = ('account', 'category', 'date')
    search_fields = ('payee', 'memo')