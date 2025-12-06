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
    display_payee = serializers.SerializerMethodField()
    payee_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    is_transfer = serializers.SerializerMethodField()
    is_adjustment = serializers.SerializerMethodField()
    transfer_account_name = serializers.SerializerMethodField()

    class Meta:
        model = Transaction
        fields = [
            'id', 'date', 'raw_payee', 'payee', 'payee_name',  'display_payee',
            'amount', 'memo', 'account', 'account_name',
            'category', 'category_name',
            'is_transfer', 'is_adjustment', 'transfer_account_name'
            ]

        extra_kwargs = {
            'raw_payee': {'required': False}
        }

    def get_is_transfer(self, obj):
        return obj.transfer_transaction is not None
    
    def get_is_adjustment(self, obj):
        return obj.raw_payee == "Ajuste Manual de Saldo"
    
    def get_transfer_account_name(self, obj):
        if obj.transfer_transaction:
            return obj.transfer_transaction.account.name
        return None

    def get_display_payee(self, obj):
        if obj.payee:
            return obj.payee.name
        return obj.raw_payee

    def create(self, validated_data):
        """
        Lógica inteligente al crear una transacción manual.
        """
        payee_name_input = validated_data.pop('payee_name', None)
        
        if 'raw_payee' not in validated_data:
            if validated_data.get('payee'):
                validated_data['raw_payee'] = validated_data['payee'].name
            elif payee_name_input:
                validated_data['raw_payee'] = payee_name_input
            else:
                validated_data['raw_payee'] = "Transacción Manual"
        
        return super().create(validated_data)