from .models import Payee, PayeeMatch, Transaction, Account

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

def create_transaction_from_dto(default_account, dto):
    """
    Crea la transacción.
    default_account: La cuenta configurada en la Regla (Fallback).
    dto: Los datos extraídos.
    """
    # 1. Determinar la cuenta real
    target_account = default_account
    
    if dto.account_identifier:
        # Buscamos si alguna cuenta tiene este identificador (ej: '6563')
        # ends_with ayuda si en la BD guardaste '00...6563' pero el parser trajo '6563'
        found_account = Account.objects.filter(identifier__endswith=dto.account_identifier).first()
        if found_account:
            target_account = found_account
            # Opcional: Logging debug
            # print(f"Enrutado dinámico a: {target_account.name}")

    # 2. Buscar si ya existe (Idempotencia) - Usando target_account
    if dto.import_id and Transaction.objects.filter(import_id=dto.import_id).exists():
        return None, False
    
    # 3.1. Intentar hacer match del Payee
    matched_payee = find_payee_for_text(dto.payee) # dto.payee es el texto raw del parser
    
    # 3.2. Si hay Payee, ver si tiene categoría por defecto
    assigned_category = None
    if matched_payee and matched_payee.default_category:
        assigned_category = matched_payee.default_category

    # 4. Crear la transacción
    transaction = Transaction.objects.create(
        account=target_account, # <--- Usamos la cuenta detectada
        date=dto.date,
        raw_payee=dto.payee,
        payee=matched_payee,
        category=assigned_category,
        amount=dto.amount,
        memo=dto.memo,
        import_id=dto.import_id
    )
    
    return transaction, True