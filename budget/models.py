# budget/models.py
from django.db import models
from django.utils.translation import gettext_lazy as _
from datetime import date
from django.conf import settings
from cryptography.fernet import Fernet
import os

class Account(models.Model):
    """Representa una cuenta bancaria, efectivo o tarjeta de crédito."""
    class Type(models.TextChoices):
        CHECKING = 'CHECKING', _('Cuenta Corriente / Vista')
        SAVINGS = 'SAVINGS', _('Ahorro')
        CREDIT_CARD = 'CREDIT', _('Tarjeta de Crédito')
        CASH = 'CASH', _('Efectivo')
        ASSET = 'ASSET', _('Activo (Inversión/Bien)')
        LOAN = 'LOAN', _('Pasivo (Deuda/Préstamo)')

    name = models.CharField(max_length=100)
    account_type = models.CharField(max_length=10, choices=Type.choices, default=Type.CHECKING)
    off_budget = models.BooleanField(
        default=False, 
        help_text="Si es True, el saldo no suma al presupuesto y las transferencias hacia aquí requieren categoría."
    )
    balance = models.DecimalField(max_digits=12, decimal_places=0, default=0) # CLP no usa decimales, pero es bueno dejarlos por si acaso
    identifier = models.CharField(max_length=50, blank=True, null=True, help_text="Identificador único en los correos (ej: últimos 4 dígitos de la tarjeta)")
    payment_category = models.OneToOneField(
        'Category',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='credit_account',
        help_text="Categoría interna para gestionar el pago de esta tarjeta"
    )
    
    def __str__(self):
        id_str = f" [...{self.identifier}]" if self.identifier else ""
        return f"{self.name}{id_str} ({self.get_account_type_display()})"

class CategoryGroup(models.Model):
    name = models.CharField(max_length=100)
    # is_active para soft delete de grupos también
    is_active = models.BooleanField(default=True)
    # Para ordenar los grupos visualmente (0, 1, 2...)
    order = models.PositiveIntegerField(default=0) 

    class Meta:
        ordering = ['order', 'name']

    def __str__(self):
        return self.name

class Category(models.Model):
    """
    Tus 'Sobres' o 'Baldes'. 
    Ej: 'Supermercado', 'Arriendo', 'Ahorro Vacaciones'.
    """
    name = models.CharField(max_length=100)
    group = models.ForeignKey(CategoryGroup, on_delete=models.CASCADE, related_name='categories')
    is_active = models.BooleanField(default=True)
    order = models.PositiveIntegerField(default=0)
    
    class GoalType(models.TextChoices):
        NONE = 'NONE', 'Sin Meta'
        MONTHLY = 'MONTHLY', 'Ahorro Mensual Fijo'
        TARGET_DATE = 'TARGET_DATE', 'Alcanzar Saldo para Fecha'
        TARGET_BALANCE = 'TARGET_BALANCE', 'Mantener Saldo Mínimo'

    goal_type = models.CharField(
        max_length=20, 
        choices=GoalType.choices, 
        default=GoalType.NONE
    )
    goal_amount = models.DecimalField(max_digits=12, decimal_places=0, default=0)
    goal_target_date = models.DateField(null=True, blank=True)

    class Meta:
        verbose_name_plural = "Categories"
        ordering = ['order', 'name']

    def __str__(self):
        return f"{self.group.name} - {self.name}"

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

    transfer_transaction = models.OneToOneField(
        'self',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='linked_transfer',
    )
    
    memo = models.TextField(blank=True, null=True)
    
    # Para evitar duplicados en importaciones automáticas
    import_id = models.CharField(max_length=100, unique=True, null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.date} - {self.payee}: ${self.amount}"
    
class EmailSource(models.Model):
    """
    Credenciales de conexión (La 'Llave').
    Ej: Mi Gmail Central, o El Outlook de mi Pareja.
    """
    name = models.CharField(max_length=100, help_text="Nombre identificativo (ej: Gmail Casa)")
    email_host = models.CharField(max_length=100, default='imap.gmail.com')
    email_port = models.IntegerField(default=993)
    email_user = models.CharField(max_length=100)
    email_password_encrypted = models.BinaryField()
    
    last_connection_check = models.DateTimeField(null=True, blank=True)
    status_message = models.TextField(blank=True, null=True)

    def set_password(self, raw_password):
        # ... (misma lógica de encriptación que tenías) ...
        key = os.environ.get('ENCRYPTION_KEY')
        f = Fernet(key)
        self.email_password_encrypted = f.encrypt(raw_password.encode())

    def get_password(self):
        # ... (misma lógica) ...
        key = os.environ.get('ENCRYPTION_KEY')
        f = Fernet(key)
        return f.decrypt(self.email_password_encrypted).decode()

    def __str__(self):
        return f"{self.name} ({self.email_user})"


class EmailRule(models.Model):
    """
    Reglas de procesamiento (La 'Lógica').
    Ej: Los correos del Banco Chile en esta fuente van a mi Cta Cte.
    """
    source = models.ForeignKey(EmailSource, on_delete=models.CASCADE, related_name='rules')
    account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name='email_rules')
    
    # Filtros
    search_criteria = models.CharField(max_length=200, default='UNSEEN')
    filter_recipient_email = models.CharField(
        max_length=150, 
        blank=True, 
        null=True,
        help_text="Procesar solo correos enviados originalmente a..."
    )
    
    # Parser
    PARSER_CHOICES = [
        ('BANCO_CHILE', 'Banco de Chile / Edwards'),
        ('GENERIC', 'Genérico'),
    ]
    parser_type = models.CharField(max_length=50, choices=PARSER_CHOICES, default='BANCO_CHILE')
    
    is_active = models.BooleanField(default=True)
    last_sync = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Regla: {self.source.name} -> {self.account.name}"