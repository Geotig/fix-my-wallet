# budget/importers/base.py
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

@dataclass
class TransactionDTO:
    """
    Data Transfer Object.
    Es un formato intermedio estandarizado. El parser convierte el email 
    a esto, y luego el sistema convierte esto a un modelo Transaction de Django.
    """
    date: date
    payee: str
    amount: Decimal
    memo: str = ""
    import_id: Optional[str] = None # Clave única para evitar duplicados
    account_identifier: Optional[str] = None # Identificador de la cuenta (últimos cuatro dígitos)

class BaseImporter:
    """Clase abstracta que define cómo debe comportarse cualquier importador."""
    
    def parse(self, source: str, subject: str = "") -> List[TransactionDTO]:
        """
        Recibe una fuente (texto del email, ruta de archivo, etc.)
        y devuelve una lista de transacciones estandarizadas.
        """
        raise NotImplementedError("Cada importador debe implementar su propio método parse")