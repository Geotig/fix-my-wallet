from django.db.models import Sum
from django.db import transaction
from django.core.management import call_command
from django.db.models import Sum, Q
from django.core.files.storage import default_storage
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import viewsets, views
from datetime import datetime, date, timedelta
from decimal import Decimal
from collections import defaultdict
from .import_service import preview_file, process_import

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
                
                # --- LÓGICA INTELIGENTE DE CATEGORÍAS ---
                # Regla: Solo borramos la categoría si AMBAS cuentas son On-Budget.
                # Si una es Off-Budget, esa transferencia es un gasto/ingreso real para el presupuesto.
                
                # Chequeamos si es una transferencia interna pura (ambas on-budget)
                is_pure_internal = (not tx1.account.off_budget) and (not tx2.account.off_budget)

                if is_pure_internal:
                    tx1.category = None
                    tx2.category = None
                else:
                    # Es una transferencia mixta (On -> Off). 
                    # No forzamos borrar categoría. 
                    # El usuario deberá asignarle una (ej: "Pago Hipoteca") en la interfaz.
                    pass

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
        source_id = request.data.get('source_account')
        dest_id = request.data.get('destination_account')
        amount = request.data.get('amount')
        date_str = request.data.get('date')
        memo = request.data.get('memo', '')
        category_id = request.data.get('category') # <--- RECIBIR CATEGORÍA

        if not all([source_id, dest_id, amount, date_str]):
            return Response({"error": "Faltan datos obligatorios"}, status=400)

        if source_id == dest_id:
            return Response({"error": "La cuenta de origen y destino deben ser distintas"}, status=400)

        try:
            with transaction.atomic():
                amount_val = abs(Decimal(str(amount)))
                
                # Obtener objetos cuenta para verificar tipos
                source_acc = Account.objects.get(pk=source_id)
                dest_acc = Account.objects.get(pk=dest_id)

                # Lógica de Categoría:
                # Solo asignamos categoría a la salida si el destino es Off-Budget
                final_category_id = None
                if dest_acc.off_budget and not source_acc.off_budget:
                    final_category_id = category_id

                # 1. Crear Salida (Gasto)
                tx_out = Transaction.objects.create(
                    account=source_acc,
                    amount=-amount_val,
                    date=date_str,
                    memo=memo,
                    raw_payee=f"Transferencia a {dest_acc.name}",
                    payee=None,
                    category_id=final_category_id # <--- ASIGNAR
                )

                # 2. Crear Entrada (Ingreso)
                tx_in = Transaction.objects.create(
                    account=dest_acc,
                    amount=amount_val,
                    date=date_str,
                    memo=memo,
                    raw_payee=f"Transferencia de {source_acc.name}",
                    payee=None,
                    category=None # La entrada en off-budget no suele llevar categoría
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
                target_month_start = target_date.replace(day=1)
            except ValueError:
                return Response({"error": "Formato de fecha inválido"}, status=400)
        else:
            today = date.today()
            target_month_start = today.replace(day=1)

        next_month = (target_month_start.replace(day=28) + timedelta(days=4)).replace(day=1)
        
        # --- 1. RTA ACUMULATIVO ---
        # CAMBIO TRACKING: Solo sumamos cuentas que NO son off_budget
        liquid_accounts = Account.objects.filter(
            account_type__in=['CHECKING', 'SAVINGS', 'CASH'],
            off_budget=False 
        )
        
        total_cash = 0
        for acc in liquid_accounts:
            total_cash += acc.transactions.aggregate(Sum('amount'))['amount__sum'] or 0

        total_assigned_all_time = BudgetAssignment.objects.aggregate(Sum('amount'))['amount__sum'] or 0
        ready_to_assign = total_cash - total_assigned_all_time

        # --- 2. DATOS TARJETAS ---
        # (Esta parte se mantiene igual, calculando gastos y pagos de TC)
        cc_spending_all_time = Transaction.objects.filter(
            date__lt=next_month,
            account__account_type=Account.Type.CREDIT_CARD,
            transfer_transaction__isnull=True,
            category__isnull=False
        ).values('account').annotate(total_spent=Sum('amount'))
        
        cc_spending_map = { e['account']: abs(e['total_spent']) for e in cc_spending_all_time }

        cc_payments_all_time = Transaction.objects.filter(
            date__lt=next_month,
            account__account_type=Account.Type.CREDIT_CARD,
            transfer_transaction__isnull=False,
            amount__gt=0
        ).values('account').annotate(total_paid=Sum('amount'))
        
        cc_payment_map = { e['account']: e['total_paid'] for e in cc_payments_all_time }

        # --- 3. BUCLE PRINCIPAL ---
        total_assigned_month = 0
        total_activity_month = 0
        total_available = 0
        
        groups = CategoryGroup.objects.filter(is_active=True).order_by('order', 'name')
        grouped_data = []

        for group in groups:
            group_categories = []
            cats = group.categories.filter(is_active=True).order_by('order', 'name')
            
            for cat in cats:
                # A. Asignado
                assignment_this_month = BudgetAssignment.objects.filter(
                    category=cat, month=target_month_start
                ).first()
                val_assigned_this_month = assignment_this_month.amount if assignment_this_month else 0

                val_assigned_cumulative = BudgetAssignment.objects.filter(
                    category=cat, month__lte=target_month_start
                ).aggregate(Sum('amount'))['amount__sum'] or 0

                # B. Actividad ESTE MES
                # CAMBIO TRACKING: Usamos Q objects para incluir transferencias a Off-Budget
                activity_month_result = Transaction.objects.filter(
                    category=cat,
                    date__year=target_month_start.year,
                    date__month=target_month_start.month
                ).filter(
                    # Condición: O es gasto normal (sin transfer) O es transfer hacia Off-Budget
                    Q(transfer_transaction__isnull=True) | 
                    Q(transfer_transaction__account__off_budget=True)
                ).aggregate(total=Sum('amount'))
                
                val_activity_month = activity_month_result['total'] or 0

                # C. Actividad ACUMULADA (Para Rollover)
                # CAMBIO TRACKING: Mismo filtro Q aquí
                activity_cumulative_result = Transaction.objects.filter(
                    category=cat,
                    date__lt=next_month
                ).filter(
                    Q(transfer_transaction__isnull=True) | 
                    Q(transfer_transaction__account__off_budget=True)
                ).aggregate(total=Sum('amount'))
                
                val_activity_cumulative = activity_cumulative_result['total'] or 0

                # D. Cálculo Disponible
                available_amount = val_assigned_cumulative + val_activity_cumulative

                # E. Lógica TC
                if hasattr(cat, 'credit_account'): 
                    card_id = cat.credit_account.id
                    funded = cc_spending_map.get(card_id, 0)
                    paid = cc_payment_map.get(card_id, 0)
                    available_amount = funded - paid
                    
                    monthly_payments = Transaction.objects.filter(
                        category=None,
                        account__id=card_id,
                        date__year=target_month_start.year,
                        date__month=target_month_start.month,
                        transfer_transaction__isnull=False,
                        amount__gt=0
                    ).aggregate(Sum('amount'))['amount__sum'] or 0
                    
                    if monthly_payments > 0:
                        val_activity_month = -monthly_payments

                # Globales
                total_assigned_month += val_assigned_this_month
                total_activity_month += val_activity_month
                total_available += available_amount

                group_categories.append({
                    "category_id": cat.id,
                    "category_name": cat.name,
                    "assigned": val_assigned_this_month,
                    "activity": val_activity_month,
                    "available": available_amount
                })
            
            grouped_data.append({
                "group_id": group.id,
                "group_name": group.name,
                "categories": group_categories
            })

        return Response({
            "month": target_month_start.strftime('%Y-%m-%d'),
            "ready_to_assign": ready_to_assign,
            "groups": grouped_data,
            "totals": {
                "assigned": total_assigned_month,
                "activity": total_activity_month,
                "available": total_available
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

class ImportFileView(views.APIView):
    def post(self, request):
        """
        Paso 1: Recibe archivo, devuelve columnas detectadas.
        """
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({"error": "No se envió archivo"}, status=400)
        
        try:
            # Leemos en memoria para preview
            # (Si el archivo es gigante, esto podría optimizarse, pero para excels personales está bien)
            data = preview_file(file_obj, file_obj.name)
            return Response(data)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

class ExecuteImportView(views.APIView):
    def post(self, request):
        """
        Paso 2: Recibe archivo + mapeo y procesa.
        """
        file_obj = request.FILES.get('file')
        # El mapeo viene como string JSON dentro del form-data
        import json
        mapping = json.loads(request.data.get('mapping')) 
        account_id = request.data.get('account_id')
        
        if not all([file_obj, mapping, account_id]):
            return Response({"error": "Datos incompletos"}, status=400)

        try:
            account = Account.objects.get(pk=account_id)
            report = process_import(file_obj, file_obj.name, mapping, account)
            
            return Response({
                "status": "success", 
                "imported": report['imported'],
                "duplicated": report['duplicated'] # <--- ENVIAMOS AL FRONT
            })
        except Exception as e:
            return Response({"error": str(e)}, status=500)