from .models import Payee, PayeeMatch, Transaction

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
    Crea la transacción y trata de asignar Payee y Categoría automáticamente.
    """
    # 1. Buscar si ya existe la transacción (Idempotencia)
    if dto.import_id and Transaction.objects.filter(import_id=dto.import_id).exists():
        return None, False # Transaction, Created

    # 2. Intentar hacer match del Payee
    matched_payee = find_payee_for_text(dto.payee) # dto.payee es el texto raw del parser
    
    # 3. Si hay Payee, ver si tiene categoría por defecto
    assigned_category = None
    if matched_payee and matched_payee.default_category:
        assigned_category = matched_payee.default_category

    # 4. Crear la transacción
    transaction = Transaction.objects.create(
        account=account,
        date=dto.date,
        raw_payee=dto.payee, # Guardamos el texto original siempre
        payee=matched_payee, # Asignamos el objeto si lo encontramos
        category=assigned_category, # Asignamos categoría si el Payee la tenía
        amount=dto.amount,
        memo=dto.memo,
        import_id=dto.import_id
    )
    
    return transaction, True