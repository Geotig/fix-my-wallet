import email
from email.header import decode_header
from django.core.management.base import BaseCommand
from budget.models import Account, Transaction
from budget.importers.cl_bancochile import BancoChileImporter # Ojo con el nombre

class Command(BaseCommand):
    help = 'Importa desde archivo .txt crudo (con headers)'

    def add_arguments(self, parser):
        parser.add_argument('file_path', type=str)
        parser.add_argument('account_name', type=str)

    def handle(self, *args, **options):
        file_path = options['file_path']
        account_name = options['account_name']
        
        # Buscar cuenta... (igual que antes)
        try:
            account = Account.objects.get(name=account_name)
        except Account.DoesNotExist:
            self.stdout.write(self.style.ERROR("Cuenta no encontrada"))
            return

        # Leer archivo como email raw
        with open(file_path, 'rb') as f: # Leer bytes
            msg = email.message_from_binary_file(f)

        # Extraer Asunto
        subject, encoding = decode_header(msg["Subject"])[0]
        if isinstance(subject, bytes):
            subject = subject.decode(encoding if encoding else "utf-8")
            
        # Extraer HTML (lógica simplificada)
        body = ""
        if msg.is_multipart():
            for part in msg.walk():
                if part.get_content_type() == "text/html":
                    body = part.get_payload(decode=True).decode()
                    break
        else:
            body = msg.get_payload(decode=True).decode()

        # Parsear
        importer = BancoChileImporter()
        dtos = importer.parse(body, subject=subject)

        # Guardar (Loop igual que antes)
        if dtos:
            for dto in dtos:
                 # ... lógica de guardar ...
                 self.stdout.write(self.style.SUCCESS(f"Detectado: {dto.payee} | {dto.amount}"))