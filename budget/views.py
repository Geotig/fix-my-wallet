from django.db.models import Sum
from django.db import transaction
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import viewsets, views
from datetime import datetime, date
from decimal import Decimal

# Importamos todos los modelos necesarios, incluyendo CategoryGroup
from .models import Transaction, Account, Category, CategoryGroup, BudgetAssignment
from .serializers import TransactionSerializer, AccountSerializer, CategorySerializer, CategoryGroupSerializer

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

        # 2. RTA: Calcular Total Asignado este mes (Desde la base de datos)
        total_assigned_month = BudgetAssignment.objects.filter(
            month=target_month
        ).aggregate(Sum('amount'))['amount__sum'] or 0

        ready_to_assign = total_cash - total_assigned_month

        # --- AQUÍ ESTABA EL ERROR: Inicialización de variables globales ---
        total_assigned_global = 0
        total_activity_global = 0
        total_available_global = 0
        
        # 3. Datos Agrupados
        groups = CategoryGroup.objects.filter(is_active=True).order_by('order', 'name')
        grouped_data = []

        for group in groups:
            group_categories = []
            cats = group.categories.filter(is_active=True).order_by('order', 'name')
            
            for cat in cats:
                assignment = BudgetAssignment.objects.filter(category=cat, month=target_month).first()
                assigned_amount = assignment.amount if assignment else 0

                activity_result = Transaction.objects.filter(
                    category=cat,
                    date__year=target_month.year,
                    date__month=target_month.month,
                    transfer_transaction__isnull=True 
                ).aggregate(total=Sum('amount'))
                
                activity_amount = activity_result['total'] or 0
                available_amount = assigned_amount + activity_amount

                # Acumulamos en los globales para el footer
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
            
            # Solo añadimos el grupo si tiene categorías (opcional, aquí lo añadimos siempre)
            grouped_data.append({
                "group_id": group.id,
                "group_name": group.name,
                "categories": group_categories
            })

        # Si hay categorías "huérfanas" (sin grupo), podríamos manejarlas aquí,
        # pero por ahora asumimos que todas tienen grupo gracias al Admin.

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