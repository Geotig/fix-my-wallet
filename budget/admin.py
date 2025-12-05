# budget/admin.py
from django.contrib import admin
from .models import Account, Category, Transaction, Payee, PayeeMatch, BudgetAssignment

class PayeeMatchInline(admin.TabularInline):
    model = PayeeMatch
    extra = 1

@admin.register(Payee)
class PayeeAdmin(admin.ModelAdmin):
    list_display = ('name', 'default_category')
    inlines = [PayeeMatchInline]

@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ('date', 'display_payee_admin', 'amount', 'category', 'account')
    list_filter = ('account', 'category', 'date', 'payee')
    search_fields = ('raw_payee', 'payee__name', 'memo')

    def display_payee_admin(self, obj):
        return obj.payee.name if obj.payee else f"(Raw) {obj.raw_payee}"
    display_payee_admin.short_description = 'Payee'

@admin.register(Account)
class AccountAdmin(admin.ModelAdmin):
    list_display = ('name', 'account_type', 'balance')

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name',)
