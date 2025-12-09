from django.contrib import admin
from django import forms
from .models import Account, Category, CategoryGroup, Transaction, Payee, PayeeMatch, BudgetAssignment, EmailSource, EmailRule

# --- INLINES ---
class PayeeMatchInline(admin.TabularInline):
    model = PayeeMatch
    extra = 1

class CategoryInline(admin.TabularInline):
    model = Category
    extra = 1

# --- FORMS ---
class EmailSourceForm(forms.ModelForm):
    password = forms.CharField(widget=forms.PasswordInput, required=False, help_text="Dejar en blanco para no cambiar")
    
    class Meta:
        model = EmailSource
        fields = '__all__'
        exclude = ['email_password_encrypted']

    def save(self, commit=True):
        instance = super().save(commit=False)
        password = self.cleaned_data.get('password')
        if password:
            instance.set_password(password)
        if commit:
            instance.save()
        return instance

# --- ADMINS ---

@admin.register(EmailSource)
class EmailSourceAdmin(admin.ModelAdmin):
    form = EmailSourceForm
    list_display = ('name', 'email_user', 'last_connection_check', 'status_message')

@admin.register(EmailRule)
class EmailRuleAdmin(admin.ModelAdmin):
    list_display = ('source', 'account', 'parser_type', 'filter_recipient_email', 'last_sync')
    list_filter = ('source', 'parser_type')

@admin.register(CategoryGroup)
class CategoryGroupAdmin(admin.ModelAdmin):
    list_display = ('name', 'order', 'is_active')
    ordering = ['order', 'name']
    inlines = [CategoryInline]

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

admin.site.register(Account)
admin.site.register(BudgetAssignment)