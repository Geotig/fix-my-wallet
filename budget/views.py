from django.db.models import Sum
from django.db.models.functions import Coalesce
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import viewsets, views
from datetime import datetime, date
from decimal import Decimal

from .models import Transaction, Account, Category, BudgetAssignment
from .serializers import TransactionSerializer, AccountSerializer, CategorySerializer

class AccountViewSet(viewsets.ModelViewSet):
    queryset = Account.objects.all()
    serializer_class = AccountSerializer

    @action(detail=True, methods=['post'])
    def reconcile(self, request, pk=None):
        """
        Ajusta el saldo de la cuenta creando una transacción de ajuste.
        Payload: { "target_balance": 500000 }
        """
        account = self.get_object()
        target_balance = request.data.get('target_balance')

        if target_balance is None:
            return Response({"error": "Se requiere target_balance"}, status=400)

        # 1. Calcular saldo actual (Manejo seguro de None)
        current_balance = account.transactions.aggregate(Sum('amount'))['amount__sum'] or 0
        
        # 2. Calcular diferencia (Convertimos todo a Decimal para evitar errores de tipo)
        diff = Decimal(str(target_balance)) - Decimal(current_balance)

        if diff == 0:
            return Response({"status": "Saldo ya cuadrado", "balance": current_balance})

        # 3. Crear transacción de ajuste
        Transaction.objects.create(
            account=account,
            payee="Ajuste Manual de Saldo",
            amount=diff,
            date=date.today(),
            memo="Reconciliación automática"
        )

        return Response({"status": "Ajustado", "adjustment": diff, "new_balance": target_balance})

class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer

class TransactionViewSet(viewsets.ModelViewSet):
    queryset = Transaction.objects.all().order_by('-date', '-id')
    serializer_class = TransactionSerializer
    filterset_fields = ['account', 'category', 'date'] 

class BudgetSummaryView(views.APIView):
    """
    Devuelve el estado del presupuesto para un mes específico.
    """
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

        categories = Category.objects.all()
        summary = []
        
        total_assigned = 0
        total_activity = 0
        total_available = 0

        for cat in categories:
            # A. Asignado
            assignment = BudgetAssignment.objects.filter(category=cat, month=target_month).first()
            assigned_amount = assignment.amount if assignment else 0

            # B. Actividad
            activity_result = Transaction.objects.filter(
                category=cat,
                date__year=target_month.year,
                date__month=target_month.month
            ).aggregate(total=Sum('amount'))
            activity_amount = activity_result['total'] or 0

            # C. Disponible
            available_amount = assigned_amount + activity_amount

            summary.append({
                "category_id": cat.id,
                "category_name": cat.name,
                "assigned": assigned_amount,
                "activity": activity_amount,
                "available": available_amount
            })

            total_assigned += assigned_amount
            total_activity += activity_amount
            total_available += available_amount

        return Response({
            "month": target_month.strftime('%Y-%m-%d'),
            "categories": summary,
            "totals": {
                "assigned": total_assigned,
                "activity": total_activity,
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