from .models import Payee, PayeeMatch, Transaction, Account
from decimal import Decimal

def find_payee_for_text(raw_text):
    """
    Busca en las reglas de PayeeMatch si alguna coincide con raw_text.
    Retorna el objeto Payee encontrado o None.
    """
    # Convertimos a minúsculas para búsqueda insensible a mayúsculas
    text_lower = raw_text.lower()
    
    # Obtenemos todas las reglas (Idealmente esto se cachea si son muchas)
    matches = PayeeMatch.objects.select_related('payee').all()
    
    for match in matches:
        # Búsqueda simple de subcadena (contains)
        # Ej: si pattern es "Uber", matchea con "Uber Eats Trip..."
        if match.pattern.lower() in text_lower:
            return match.payee
            
    return None

def create_transaction_from_dto(account, dto):
    """
    Crea la transacción con chequeo de duplicados robusto.
    """
    # 1. CHECK FUERTE: Por import_id (Hash MD5)
    if dto.import_id and Transaction.objects.filter(import_id=dto.import_id).exists():
        return None, False

    # 2. CHECK DE CONTENIDO (Para datos legacy o manuales sin ID)
    # Buscamos si ya existe algo idéntico en esa cuenta, fecha y monto.
    # Opcional: comparar también raw_payee, pero a veces los espacios varían.
    # Siendo conservadores: Si fecha, monto y cuenta coinciden, Y el payee se parece, es duplicado.
    
    potential_dupes = Transaction.objects.filter(
        account=account,
        date=dto.date,
        amount=dto.amount
    )

    for tx in potential_dupes:
        # Comparamos el texto del Payee (limpiando espacios y mayúsculas)
        db_payee = (tx.raw_payee or "").strip().lower()
        dto_payee = (dto.payee or "").strip().lower()
        
        # Si los textos son iguales o muy similares, asumimos duplicado
        if db_payee == dto_payee:
            # ACTUALIZACIÓN INTELIGENTE:
            # Si la transacción existente no tenía import_id, se lo ponemos ahora
            # para que la próxima vez el Check 1 la atrape rápido.
            if not tx.import_id and dto.import_id:
                tx.import_id = dto.import_id
                tx.save(update_fields=['import_id'])
            
            return tx, False # Encontrado, no creado

    # ... (Resto de la lógica de Payee Match igual que antes) ...
    matched_payee = find_payee_for_text(dto.payee)
    
    assigned_category = None
    if matched_payee and matched_payee.default_category:
        assigned_category = matched_payee.default_category

    transaction = Transaction.objects.create(
        account=account,
        date=dto.date,
        raw_payee=dto.payee,
        payee=matched_payee,
        category=assigned_category,
        amount=dto.amount,
        memo=dto.memo,
        import_id=dto.import_id
    )
    
    return transaction, True