import imaplib
import email
from email.header import decode_header
from django.core.management.base import BaseCommand
from django.utils import timezone
from budget.models import EmailSource
from budget.services import create_transaction_from_dto
from budget.importers.cl_bancochile import BancoChileImporter

class Command(BaseCommand):
    help = 'Se conecta a las fuentes de correo y procesa las reglas configuradas'

    def handle(self, *args, **options):
        sources = EmailSource.objects.all()
        self.stdout.write(f"Iniciando proceso para {sources.count()} fuentes...")
        
        for source in sources:
            self.process_source(source)

    def process_source(self, source):
        self.stdout.write(f"🔌 Conectando a fuente: {source.name} ({source.email_user})")
        
        # Obtenemos reglas activas primero, si no hay, no vale la pena conectar
        rules = source.rules.filter(is_active=True)
        if not rules.exists():
            self.stdout.write("   No hay reglas activas. Saltando.")
            return

        try:
            password = source.get_password()
            mail = imaplib.IMAP4_SSL(source.email_host, source.email_port)
            mail.login(source.email_user, password)
            mail.select("INBOX")
            
            self.stdout.write(f"   Conexión exitosa. Procesando {rules.count()} reglas.")

            for rule in rules:
                self.process_rule(mail, rule)
                
            mail.close()
            mail.logout()
            
            source.status_message = f"OK - Última ejecución: {timezone.now().strftime('%Y-%m-%d %H:%M')}"
            source.last_connection_check = timezone.now()
            source.save()

        except Exception as e:
            msg = f"Error conexión {source.name}: {e}"
            self.stdout.write(self.style.ERROR(msg))
            source.status_message = str(e)
            source.save()

    def process_rule(self, mail, rule):
        self.stdout.write(f"   Regla: {rule.parser_type} -> {rule.account.name}")
        
        try:
            # 1. Construir Criterio de Búsqueda IMAP
            # Empezamos con el criterio base (ej: UNSEEN)
            search_terms = [rule.search_criteria]
            
            # Si hay filtro de destinatario, agregamos la cláusula TO
            # Importante: Las comillas escapadas son vitales para direcciones con puntos
            if rule.filter_recipient_email:
                search_terms.append(f'TO "{rule.filter_recipient_email}"')
            
            # Unimos los términos. IMAP requiere paréntesis si hay múltiples condiciones
            # Ej: '(UNSEEN TO "tomas@gmail.com")'
            if len(search_terms) > 1:
                final_criteria = f"({' '.join(search_terms)})"
            else:
                final_criteria = search_terms[0]
            
            # 2. Ejecutar búsqueda
            typ, data = mail.search(None, final_criteria)
            email_ids = data[0].split()
            
            self.stdout.write(f"     Encontrados: {len(email_ids)} correos.")

            if len(email_ids) == 0:
                rule.last_sync = timezone.now()
                rule.save()
                return

            # 3. Seleccionar Parser
            importer = None
            if rule.parser_type == 'BANCO_CHILE':
                importer = BancoChileImporter()
            else:
                self.stdout.write(self.style.WARNING(f"     Parser {rule.parser_type} no implementado."))
                return

            count_saved = 0
            
            # 4. Procesar correos encontrados
            for e_id in email_ids:
                try:
                    typ, msg_data = mail.fetch(e_id, '(RFC822)')
                    for response_part in msg_data:
                        if isinstance(response_part, tuple):
                            msg = email.message_from_bytes(response_part[1])
                            
                            # Decodificar Subject
                            subject, encoding = decode_header(msg["Subject"])[0]
                            if isinstance(subject, bytes):
                                subject = subject.decode(encoding if encoding else "utf-8")
                            
                            # Extraer Body
                            body = ""
                            if msg.is_multipart():
                                for part in msg.walk():
                                    if part.get_content_type() == "text/html":
                                        try:
                                            body = part.get_payload(decode=True).decode()
                                            break
                                        except: pass
                            else:
                                try:
                                    body = msg.get_payload(decode=True).decode()
                                except: pass

                            # Parsear
                            dtos = importer.parse(body, subject=subject)

                            # Guardar Transacciones
                            if dtos:
                                for dto in dtos:
                                    tx, created = create_transaction_from_dto(rule.account, dto)
                                    if created:
                                        self.stdout.write(self.style.SUCCESS(f"       + {tx.raw_payee} | ${tx.amount}"))
                                        count_saved += 1
                                    else:
                                        self.stdout.write(f"       . Duplicado")
                            
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f"     Error leyendo email ID {e_id}: {e}"))

            # 5. Actualizar timestamp de la regla
            rule.last_sync = timezone.now()
            rule.save()
            
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"     Error en regla {rule.id}: {e}"))