from rest_framework import serializers
from django.db.models import Sum
from .models import Transaction, Account, Category

class AccountSerializer(serializers.ModelSerializer):
    # Campo calculado: No existe en la tabla, se genera al vuelo
    current_balance = serializers.SerializerMethodField()

    class Meta:
        model = Account
        fields = ['id', 'name', 'account_type', 'current_balance']

    def get_current_balance(self, obj):
        # Sumar todas las transacciones de esta cuenta
        total = obj.transactions.aggregate(Sum('amount'))['amount__sum']
        return total or 0

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'

class TransactionSerializer(serializers.ModelSerializer):
    # Para mostrar el nombre de la cuenta en vez de solo el ID (opcional pero útil)
    account_name = serializers.ReadOnlyField(source='account.name')
    category_name = serializers.ReadOnlyField(source='category.name')

    class Meta:
        model = Transaction
        fields = ['id', 'date', 'payee', 'amount', 'memo', 'account', 'account_name', 'category', 'category_name']