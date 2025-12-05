# budget/management/commands/fetch_emails.py
import os
import imaplib
import email
from email.header import decode_header
from django.core.management.base import BaseCommand
from budget.models import Account, Transaction
from budget.importers.cl_bancochile import BancoChileImporter
from budget.services import create_transaction_from_dto

class Command(BaseCommand):
    help = 'Conecta al IMAP, descarga correos no leídos y crea transacciones'

    def add_arguments(self, parser):
        parser.add_argument('account_name', type=str, help='Nombre de la cuenta en Django')
        parser.add_argument('--dry-run', action='store_true', help='No guardar cambios en BD ni marcar como leídos')

    def handle(self, *args, **options):
        account_name = options['account_name']
        dry_run = options['dry_run']

        # 1. Obtener Credenciales
        EMAIL_HOST = os.environ.get('EMAIL_HOST')
        EMAIL_USER = os.environ.get('EMAIL_USER')
        EMAIL_PASS = os.environ.get('EMAIL_PASS')

        if not all([EMAIL_HOST, EMAIL_USER, EMAIL_PASS]):
            self.stdout.write(self.style.ERROR("Faltan variables de entorno de correo"))
            return

        # 2. Buscar la cuenta en BD
        try:
            account = Account.objects.get(name=account_name)
        except Account.DoesNotExist:
            self.stdout.write(self.style.ERROR(f"No existe la cuenta '{account_name}'"))
            return

        # 3. Conexión IMAP
        self.stdout.write(f"Conectando a {EMAIL_HOST} como {EMAIL_USER}...")
        try:
            mail = imaplib.IMAP4_SSL(EMAIL_HOST)
            mail.login(EMAIL_USER, EMAIL_PASS)
            mail.select("INBOX") # O la carpeta que uses, ej: "INBOX/Bancos"
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error de conexión: {e}"))
            return

        # 4. Buscar correos NO LEÍDOS (UNSEEN) de tu Banco
        # Ajusta el criterio FROM según el remitente real de tu banco
        # Ej: '(UNSEEN FROM "notificaciones@banco.cl")'
        criteria = 'UNSEEN' 
        typ, data = mail.search(None, criteria)
        
        email_ids = data[0].split()
        self.stdout.write(f"Se encontraron {len(email_ids)} correos nuevos.")

        importer = BancoChileImporter()
        count_saved = 0

        for e_id in email_ids:
            # Fetch del cuerpo del correo
            typ, msg_data = mail.fetch(e_id, '(RFC822)')
            for response_part in msg_data:
                if isinstance(response_part, tuple):
                    msg = email.message_from_bytes(response_part[1])
                    
                    # Decodificar el asunto (para logs)
                    subject, encoding = decode_header(msg["Subject"])[0]
                    if isinstance(subject, bytes):
                        subject = subject.decode(encoding if encoding else "utf-8")
                    
                    self.stdout.write(f"Procesando: {subject}")

                    # Extraer cuerpo (Texto o HTML)
                    body = ""
                    if msg.is_multipart():
                        for part in msg.walk():
                            content_type = part.get_content_type()
                            content_disposition = str(part.get("Content-Disposition"))
                            try:
                                # Preferimos HTML si hay, si no texto plano
                                if "attachment" not in content_disposition:
                                    if content_type == "text/html":
                                        body = part.get_payload(decode=True).decode()
                                        break # Encontré HTML, me quedo con este
                                    elif content_type == "text/plain":
                                        body = part.get_payload(decode=True).decode()
                            except:
                                pass
                    else:
                        body = msg.get_payload(decode=True).decode()

                    # --- USAR EL IMPORTER ---
                    dtos = importer.parse(body, subject=subject)

                    if dtos:
                        for dto in dtos:
                            if dry_run:
                                self.stdout.write(self.style.WARNING(f"[DRY RUN] Se guardaría: {dto.payee} | {dto.amount}"))
                            else:
                                tx, created = create_transaction_from_dto(account, dto)
                                
                                if created:
                                    self.stdout.write(self.style.SUCCESS(f"  -> Guardado: {tx.raw_payee} (Payee: {tx.payee})"))
                                    count_saved += 1
                                else:
                                    self.stdout.write(f"  -> Duplicado: {dto.payee}")
                    else:
                        self.stdout.write("  -> No se extrajeron datos (posiblemente formato desconocido)")

        mail.close()
        mail.logout()
        self.stdout.write(self.style.SUCCESS(f"Proceso finalizado. {count_saved} transacciones importadas."))