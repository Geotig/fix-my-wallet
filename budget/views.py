from django.db.models import Sum, Value
from django.db.models.functions import Coalesce, TruncMonth
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import viewsets, views
from datetime import datetime, date
from decimal import Decimal

from rest_framework import viewsets
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

        # 1. Calcular saldo actual
        current_balance = account.transactions.aggregate(Sum('amount'))['amount__sum'] or 0
        
        # 2. Calcular diferencia
        diff = Decimal(target_balance) - current_balance

        if diff == 0:
            return Response({"status": "Saldo ya cuadrado", "balance": current_balance})

        # 3. Crear transacción de ajuste
        Transaction.objects.create(
            account=account,
            payee="Ajuste Manual de Saldo", # O "Saldo Inicial" si es la primera
            amount=diff,
            date=date.today(),
            memo="Reconciliación automática"
        )

        return Response({"status": "Ajustado", "adjustment": diff, "new_balance": target_balance})

class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer

class TransactionViewSet(viewsets.ModelViewSet):
    # Ordenamos por fecha descendente (lo más nuevo primero)
    queryset = Transaction.objects.all().order_by('-date', '-id')
    serializer_class = TransactionSerializer
    
    # Esto permite filtrar en la URL tipo: /api/transactions/?account=1
    filterset_fields = ['account', 'category', 'date']

class BudgetSummaryView(views.APIView):
    """
    Devuelve el estado del presupuesto para un mes específico.
    Calcula: Asignado, Actividad y Disponible por categoría.
    """
    
    def get(self, request):
        # 1. Obtener el mes solicitado (o usar el actual por defecto)
        month_param = request.query_params.get('month')
        if month_param:
            try:
                target_date = datetime.strptime(month_param, '%Y-%m-%d').date()
                # Forzar al día 1 del mes
                target_month = target_date.replace(day=1)
            except ValueError:
                return Response({"error": "Formato de fecha inválido. Use YYYY-MM-DD"}, status=400)
        else:
            today = date.today()
            target_month = today.replace(day=1)

        # 2. Obtener todas las categorías
        categories = Category.objects.all()
        summary = []
        
        total_assigned = 0
        total_activity = 0
        total_available = 0

        for cat in categories:
            # A. Obtener lo ASIGNADO (Assigned)
            # Buscamos si existe un BudgetAssignment para este mes y categoría
            assignment = BudgetAssignment.objects.filter(
                category=cat, 
                month=target_month
            ).first()
            
            assigned_amount = assignment.amount if assignment else 0

            # B. Calcular la ACTIVIDAD (Activity)
            # Sumar transacciones de este mes para esta categoría
            # Ojo: Gastos suelen ser negativos.
            activity_result = Transaction.objects.filter(
                category=cat,
                date__year=target_month.year,
                date__month=target_month.month
            ).aggregate(total=Sum('amount'))
            
            activity_amount = activity_result['total'] or 0

            # C. Calcular DISPONIBLE (Available)
            # En el método de sobres puro, el disponible se arrastra del mes anterior.
            # PARA SIMPLIFICAR en esta Fase 1: Disponible = Asignado + Actividad (si actividad es negativa)
            # Ejemplo: Asigné 100, gasté -20. Disponible = 80.
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
        month_str = request.data.get('month') # YYYY-MM-DD
        amount = request.data.get('amount')

        if not all([category_id, month_str, amount is not None]):
            return Response({"error": "Faltan datos"}, status=400)

        try:
            target_date = datetime.strptime(month_str, '%Y-%m-%d').date()
            target_month = target_date.replace(day=1)
            
            category = Category.objects.get(id=category_id)

            # update_or_create es un método mágico de Django para esto
            obj, created = BudgetAssignment.objects.update_or_create(
                category=category,
                month=target_month,
                defaults={'amount': amount}
            )
            
            return Response({"status": "success", "amount": obj.amount})
            
        except Category.DoesNotExist:
            return Response({"error": "Categoría no encontrada"}, status=404)
        except ValueError:
            return Response({"error": "Error de formato"}, status=400)