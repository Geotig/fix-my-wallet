from django.contrib import admin
from .models import Account, Category, CategoryGroup, Transaction, Payee, PayeeMatch, BudgetAssignment

# --- INLINES ---
# Esto permite agregar reglas de Payee dentro de la pantalla de Payee
class PayeeMatchInline(admin.TabularInline):
    model = PayeeMatch
    extra = 1

# Esto permite agregar Categorías dentro de la pantalla del Grupo
class CategoryInline(admin.TabularInline):
    model = Category
    extra = 1

# --- ADMINS ---

@admin.register(CategoryGroup)
class CategoryGroupAdmin(admin.ModelAdmin):
    list_display = ('name', 'order', 'is_active')
    ordering = ['order', 'name']
    inlines = [CategoryInline] # <--- ¡Esto es muy útil!

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'group', 'order', 'is_active')
    list_filter = ('group',)
    ordering = ['group__order', 'order', 'name']

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

# --- REGISTROS SIMPLES ---
admin.site.register(Account)
admin.site.register(BudgetAssignment)