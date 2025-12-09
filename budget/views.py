from django.db.models import Sum
from django.db import transaction
from django.core.management import call_command
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import viewsets, views
from datetime import datetime, date
from decimal import Decimal
from collections import defaultdict

# Importamos todos los modelos necesarios, incluyendo CategoryGroup
from .models import Transaction, Account, Category, CategoryGroup, BudgetAssignment, Payee, EmailSource, EmailRule
from .serializers import TransactionSerializer, AccountSerializer, CategorySerializer, CategoryGroupSerializer, PayeeSerializer, EmailSourceSerializer, EmailRuleSerializer

class AccountViewSet(viewsets.ModelViewSet):
    queryset = Account.objects.all()
    serializer_class = AccountSerializer

    @action(detail=True, methods=['post'])
    def reconcile(self, request, pk=None):
        account = self.get_object()
        target_balance = request.data.get('target_balance')

        if target_balance is None:
            return Response({"error": "Se requiere target_balance"}, status=400)

        current_balance = account.transactions.aggregate(Sum('amount'))['amount__sum'] or 0
        diff = Decimal(str(target_balance)) - Decimal(current_balance)

        if diff == 0:
            return Response({"status": "Saldo ya cuadrado", "balance": current_balance})

        Transaction.objects.create(
            account=account,
            payee=None,
            raw_payee="Ajuste Manual de Saldo",
            amount=diff,
            date=date.today(),
            memo="Reconciliación automática"
        )

        return Response({"status": "Ajustado", "adjustment": diff, "new_balance": target_balance})

# Agregamos el ViewSet para los grupos por si queremos gestionarlos vía API directa
class CategoryGroupViewSet(viewsets.ModelViewSet):
    queryset = CategoryGroup.objects.all()
    serializer_class = CategoryGroupSerializer

class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer

class PayeeViewSet(viewsets.ReadOnlyModelViewSet): # ReadOnly porque solo queremos listarlos para sugerencias
    queryset = Payee.objects.all().order_by('name')
    serializer_class = PayeeSerializer

class TransactionViewSet(viewsets.ModelViewSet):
    queryset = Transaction.objects.all().order_by('-date', '-id')
    serializer_class = TransactionSerializer
    filterset_fields = ['account', 'category', 'date'] 

    @action(detail=False, methods=['post'])
    def link_transfer(self, request):
        id1 = request.data.get('id_1')
        id2 = request.data.get('id_2')

        if not id1 or not id2:
            return Response({"error": "Faltan IDs"}, status=400)

        try:
            with transaction.atomic():
                tx1 = Transaction.objects.get(pk=id1)
                tx2 = Transaction.objects.get(pk=id2)

                if tx1.id == tx2.id:
                    return Response({"error": "No puedes vincular una transacción consigo misma"}, status=400)

                tx1.transfer_transaction = tx2
                tx2.transfer_transaction = tx1
                tx1.category = None
                tx2.category = None
                tx1.save()
                tx2.save()

            return Response({"status": "Transferencia vinculada exitosamente"})

        except Transaction.DoesNotExist:
            return Response({"error": "Transacción no encontrada"}, status=404)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    @action(detail=True, methods=['post'])
    def unlink_transfer(self, request, pk=None):
        tx = self.get_object()
        if tx.transfer_transaction:
            partner = tx.transfer_transaction
            tx.transfer_transaction = None
            partner.transfer_transaction = None
            tx.save()
            partner.save()
        return Response({"status": "Vínculo roto"})
    
    @action(detail=False, methods=['post'])
    def create_transfer(self, request):
        """
        Crea una transferencia completa (Salida + Entrada + Vínculo) en un paso.
        Payload: { 
            "source_account": 1, 
            "destination_account": 2, 
            "amount": 5000, 
            "date": "2025-12-09",
            "memo": "Pago tarjeta"
        }
        """
        source_id = request.data.get('source_account')
        dest_id = request.data.get('destination_account')
        amount = request.data.get('amount')
        date_str = request.data.get('date')
        memo = request.data.get('memo', '')

        if not all([source_id, dest_id, amount, date_str]):
            return Response({"error": "Faltan datos obligatorios"}, status=400)

        if source_id == dest_id:
            return Response({"error": "La cuenta de origen y destino deben ser distintas"}, status=400)

        try:
            with transaction.atomic():
                amount_val = abs(Decimal(str(amount))) # Aseguramos positivo para la lógica interna

                # 1. Crear Salida (Gasto)
                tx_out = Transaction.objects.create(
                    account_id=source_id,
                    amount=-amount_val, # Negativo
                    date=date_str,
                    memo=memo,
                    raw_payee="Transferencia Saliente",
                    payee=None,
                    category=None
                )

                # 2. Crear Entrada (Ingreso)
                tx_in = Transaction.objects.create(
                    account_id=dest_id,
                    amount=amount_val, # Positivo
                    date=date_str,
                    memo=memo,
                    raw_payee="Transferencia Entrante",
                    payee=None,
                    category=None
                )

                # 3. Vincular
                tx_out.transfer_transaction = tx_in
                tx_in.transfer_transaction = tx_out
                tx_out.save()
                tx_in.save()

            return Response({"status": "Transferencia creada", "ids": [tx_out.id, tx_in.id]})

        except Exception as e:
            return Response({"error": str(e)}, status=400)

class BudgetSummaryView(views.APIView):
    def get(self, request):
        month_param = request.query_params.get('month')
        if month_param:
            try:
                target_date = datetime.strptime(month_param, '%Y-%m-%d').date()
                target_month = target_date.replace(day=1)
            except ValueError:
                return Response({"error": "Formato de fecha inválido"}, status=400)
        else:
            today = date.today()
            target_month = today.replace(day=1)

        # 1. RTA: Calcular Saldo Total de Cuentas Líquidas
        liquid_accounts = Account.objects.filter(
            account_type__in=['CHECKING', 'SAVINGS', 'CASH']
        )
        total_cash = 0
        for acc in liquid_accounts:
            balance = acc.transactions.aggregate(Sum('amount'))['amount__sum'] or 0
            total_cash += balance

        # 2. RTA: Calcular Total Asignado este mes
        total_assigned_month = BudgetAssignment.objects.filter(
            month=target_month
        ).aggregate(Sum('amount'))['amount__sum'] or 0

        ready_to_assign = total_cash - total_assigned_month

        # --- LÓGICA TC 1: Gasto con Tarjeta (Aumenta el sobre de pago) ---
        cc_spending_summary = Transaction.objects.filter(
            date__year=target_month.year,
            date__month=target_month.month,
            account__account_type=Account.Type.CREDIT_CARD,
            transfer_transaction__isnull=True, # No es transferencia, es compra
            category__isnull=False
        ).values('account').annotate(total_spent=Sum('amount'))

        cc_movement_map = { 
            entry['account']: abs(entry['total_spent']) 
            for entry in cc_spending_summary 
        }

        # --- LÓGICA TC 2: Pagos a la Tarjeta (Disminuye el sobre de pago) ---
        # Buscamos transferencias ENTRANTES (positivas) a cuentas de CRÉDITO
        cc_payments_summary = Transaction.objects.filter(
            date__year=target_month.year,
            date__month=target_month.month,
            account__account_type=Account.Type.CREDIT_CARD,
            transfer_transaction__isnull=False, # SÍ es transferencia (pago)
            amount__gt=0 # Es un abono (pago de la deuda)
        ).values('account').annotate(total_paid=Sum('amount'))

        cc_payment_map = {
            entry['account']: entry['total_paid']
            for entry in cc_payments_summary
        }

        # --- BUCLE PRINCIPAL ---
        total_assigned_global = 0
        total_activity_global = 0
        total_available_global = 0
        
        groups = CategoryGroup.objects.filter(is_active=True).order_by('order', 'name')
        grouped_data = []

        for group in groups:
            group_categories = []
            cats = group.categories.filter(is_active=True).order_by('order', 'name')
            
            for cat in cats:
                # A. Asignado
                assignment = BudgetAssignment.objects.filter(category=cat, month=target_month).first()
                assigned_amount = assignment.amount if assignment else 0

                # B. Actividad (Gasto real de efectivo o débito)
                activity_result = Transaction.objects.filter(
                    category=cat,
                    date__year=target_month.year,
                    date__month=target_month.month,
                    transfer_transaction__isnull=True 
                ).aggregate(total=Sum('amount'))
                
                activity_amount = activity_result['total'] or 0
                
                # C. Disponible Base
                available_amount = assigned_amount + activity_amount

                # D. Lógica TC Combinada
                if hasattr(cat, 'credit_account'): 
                    card_id = cat.credit_account.id
                    
                    # 1. Sumamos lo que gastamos con la tarjeta (movemos del sobre original a este)
                    funded_from_spending = cc_movement_map.get(card_id, 0)
                    available_amount += funded_from_spending
                    
                    # 2. Restamos lo que ya pagamos al banco (el dinero salió de la caja)
                    # Nota: En la vista de presupuesto, la columna "Actividad" para la categoría de pago
                    # suele mostrarse como el monto pagado negativo.
                    paid_amount = cc_payment_map.get(card_id, 0)
                    available_amount -= paid_amount
                    
                    # Ajuste visual: Para las categorías de pago de TC, la "Actividad" 
                    # debería reflejar los pagos realizados, para que el usuario entienda por qué bajó.
                    activity_amount -= paid_amount

                # E. Globales
                total_assigned_global += assigned_amount
                total_activity_global += activity_amount
                total_available_global += available_amount

                group_categories.append({
                    "category_id": cat.id,
                    "category_name": cat.name,
                    "assigned": assigned_amount,
                    "activity": activity_amount,
                    "available": available_amount
                })
            
            grouped_data.append({
                "group_id": group.id,
                "group_name": group.name,
                "categories": group_categories
            })

        return Response({
            "month": target_month.strftime('%Y-%m-%d'),
            "ready_to_assign": ready_to_assign,
            "groups": grouped_data,
            "totals": {
                "assigned": total_assigned_global,
                "activity": total_activity_global,
                "available": total_available_global
            }
        })

class BudgetAssignmentView(views.APIView):
    def post(self, request):
        category_id = request.data.get('category_id')
        month_str = request.data.get('month')
        amount = request.data.get('amount')

        if not all([category_id, month_str, amount is not None]):
            return Response({"error": "Faltan datos"}, status=400)

        try:
            target_date = datetime.strptime(month_str, '%Y-%m-%d').date()
            target_month = target_date.replace(day=1)
            category = Category.objects.get(id=category_id)

            obj, created = BudgetAssignment.objects.update_or_create(
                category=category,
                month=target_month,
                defaults={'amount': amount}
            )
            return Response({"status": "success", "amount": obj.amount})
            
        except Category.DoesNotExist:
            return Response({"error": "Categoría no encontrada"}, status=404)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

class TriggerSyncView(views.APIView):
    """
    Endpoint para disparar la sincronización manual.
    """
    def post(self, request):
        try:
            # Ejecuta el comando igual que en la terminal
            # stdout captura la salida para ver qué pasó
            call_command('fetch_emails')
            return Response({"status": "Sincronización completada"})
        except Exception as e:
            return Response({"error": str(e)}, status=500)

class EmailSourceViewSet(viewsets.ModelViewSet):
    queryset = EmailSource.objects.all()
    serializer_class = EmailSourceSerializer

class EmailRuleViewSet(viewsets.ModelViewSet):
    queryset = EmailRule.objects.all()
    serializer_class = EmailRuleSerializer