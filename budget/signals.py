from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Account, Category, CategoryGroup

@receiver(post_save, sender=Account)
def create_credit_card_category(sender, instance, created, **kwargs):
    """
    Si se crea una cuenta de Crédito, crear automáticamente su categoría de pago.
    """
    if created and instance.account_type == Account.Type.CREDIT_CARD:
        cc_group, _ = CategoryGroup.objects.get_or_create(
            name="Pagos de Tarjetas de Crédito",
            defaults={'order': 0, 'is_active': True}
        )

        cat_name = f"Pago: {instance.name}"
        category, _ = Category.objects.get_or_create(
            name=cat_name,
            group=cc_group,
            defaults={'is_active': True}
        )

        Account.objects.filter(pk=instance.pk).update(payment_category=category)