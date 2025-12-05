# budget/models.py
from django.db import models
from django.utils.translation import gettext_lazy as _
from datetime import date

class Account(models.Model):
    """Representa una cuenta bancaria, efectivo o tarjeta de crédito."""
    class Type(models.TextChoices):
        CHECKING = 'CHECKING', _('Cuenta Corriente / Vista')
        SAVINGS = 'SAVINGS', _('Ahorro')
        CREDIT_CARD = 'CREDIT', _('Tarjeta de Crédito')
        CASH = 'CASH', _('Efectivo')

    name = models.CharField(max_length=100)
    account_type = models.CharField(max_length=10, choices=Type.choices, default=Type.CHECKING)
    balance = models.DecimalField(max_digits=12, decimal_places=0, default=0) # CLP no usa decimales, pero es bueno dejarlos por si acaso
    
    def __str__(self):
        return f"{self.name} ({self.get_account_type_display()})"

class Category(models.Model):
    """
    Tus 'Sobres' o 'Baldes'. 
    Ej: 'Supermercado', 'Arriendo', 'Ahorro Vacaciones'.
    """
    name = models.CharField(max_length=100)
    # A futuro aquí pondremos metas de presupuesto, grupos, etc.
    
    class Meta:
        verbose_name_plural = "Categories"

    def __str__(self):
        return self.name

class BudgetAssignment(models.Model):
    """
    Define cuánto dinero asignas a una categoría en un mes específico.
    Ej: En 2025-12, asigné 200.000 a Supermercado.
    """
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name='assignments')
    month = models.DateField() # Guardaremos siempre el día 1 del mes. Ej: 2025-12-01
    amount = models.DecimalField(max_digits=12, decimal_places=0, default=0)

    class Meta:
        unique_together = ('category', 'month') # Solo una asignación per categoría por mes
        indexes = [
            models.Index(fields=['month', 'category']),
        ]

    def __str__(self):
        return f"{self.month.strftime('%Y-%m')} - {self.category.name}: {self.amount}"
    
class Payee(models.Model):
    """
    El comercio normalizado.
    Ej: 'Lider', 'Uber', 'Shell'.
    """
    name = models.CharField(max_length=200, unique=True)
    
    # Categoría por defecto: Si detectamos este Payee, asignamos esta categoría automáticamente.
    default_category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True)

    def __str__(self):
        return self.name

class PayeeMatch(models.Model):
    """
    Reglas para detectar un Payee en el texto sucio del banco.
    Ej: Si el texto contiene "TRBK LID", asigna al Payee "Lider".
    """
    payee = models.ForeignKey(Payee, on_delete=models.CASCADE, related_name='match_rules')
    pattern = models.CharField(max_length=200, help_text="Texto o Regex para buscar en la importación")
    
    def __str__(self):
        return f"Pattern '{self.pattern}' -> {self.payee.name}"
    
class Transaction(models.Model):
    """Cada movimiento de dinero."""
    account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name='transactions')
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True, related_name='transactions')
    # Si category es Null, significa que requiere clasificación (Inbox de YNAB)
    
    date = models.DateField(default=date.today)
    payee = models.ForeignKey(Payee, on_delete=models.SET_NULL, null=True, blank=True, related_name='transactions')
    amount = models.DecimalField(max_digits=12, decimal_places=0) 
    raw_payee = models.CharField(max_length=200) 
    # Convención: Gastos son negativos, Ingresos positivos. O puedes usar un campo booleano 'is_expense'.
    # Por ahora usemos: Negativo = Gasto, Positivo = Ingreso.
    
    memo = models.TextField(blank=True, null=True)
    
    # Para evitar duplicados en importaciones automáticas
    import_id = models.CharField(max_length=100, unique=True, null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.date} - {self.payee}: ${self.amount}"