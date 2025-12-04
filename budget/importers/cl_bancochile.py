import re
import hashlib
import logging
from decimal import Decimal
from datetime import date, datetime
from bs4 import BeautifulSoup
import dateparser # Asegúrate de que esté en requirements.txt
from .base import BaseImporter, TransactionDTO

logger = logging.getLogger(__name__)

class BancoChileImporter(BaseImporter):
    def parse(self, raw_content: str, subject: str = "") -> list[TransactionDTO]:
        transactions = []
        soup = BeautifulSoup(raw_content, "html.parser")
        
        # Limpieza básica del asunto
        clean_subject = re.sub(r'^([\[\(] *)?(RE?|FWD?) *([-:)] *)?', '', subject, flags=re.IGNORECASE | re.MULTILINE).strip()
        
        lower_subject = clean_subject.lower()

        # --- Despachador de Lógica ---
        if "aviso de transferencia de fondos" in lower_subject:
            tx = self._parse_incoming_transfer(soup)
            if tx: transactions.append(tx)
            
        elif "transferencia a terceros" in lower_subject:
            tx = self._parse_outgoing_transfer(soup)
            if tx: transactions.append(tx)
            
        # Agrupamos Compra y Cargo porque la estructura narrativa es casi idéntica
        elif "compra" in lower_subject or "cargo en cuenta" in lower_subject:
            tx = self._parse_purchase_narrative(soup, clean_subject)
            if tx: transactions.append(tx)
            
        # Agrupamos pagos de tarjeta y línea de crédito
        elif "pago tarjeta" in lower_subject or "línea de crédito" in lower_subject:
            tx = self._parse_payment(soup, clean_subject)
            if tx: transactions.append(tx)
            
        else:
            logger.warning(f"Formato no reconocido: {clean_subject}")

        return transactions

    # --- Lógica Específica ---

    def _parse_incoming_transfer(self, soup):
        """Caso: Ingreso de dinero (Transferencia recibida)"""
        try:
            # Buscamos el nodo de texto "Monto" exacto para anclarnos
            amount_node = soup.find(string=re.compile("Monto"))
            if not amount_node: return None
            
            amount_str = amount_node.find_next("td").get_text(strip=True)
            amount = self._clean_amount(amount_str) # Positivo

            # El remitente está en el párrafo introductorio: "cliente NOMBRE ha efectuado..."
            # Usamos find() para ubicar ese párrafo específico ignorando headers de Fwd.
            intro_node = soup.find(string=re.compile(r"cliente\s+.*?\s+ha efectuado"))
            if intro_node:
                intro_text = intro_node.strip()
                sender_match = re.search(r"cliente\s+(.+?)\s+ha efectuado", intro_text)
                payee = sender_match.group(1).strip() if sender_match else "Transferencia Recibida"
            else:
                payee = "Transferencia Recibida"

            # Fecha
            date_node = soup.find(string=re.compile("Fecha"))
            date_str = date_node.find_next("td").get_text(strip=True)
            date_obj = datetime.strptime(date_str, "%d/%m/%Y").date()

            return self._create_dto(date_obj, payee, amount, "Transferencia Recibida")
        except Exception as e:
            logger.error(f"Error parseando Transferencia Entrante: {e}")
            return None

    def _parse_outgoing_transfer(self, soup):
        """Caso: Salida de dinero (Transferencia a terceros)"""
        try:
            # Monto
            amount_node = soup.find(string=re.compile("Monto"))
            if amount_node:
                amount_str = amount_node.find_next("td").get_text(strip=True)
            else:
                # Fallback por si la tabla cambia
                return None
            
            amount = self._clean_amount(amount_str) * -1 # Negativo

            # Destinatario
            payee_node = soup.find(string=re.compile("Nombre y Apellido"))
            if payee_node:
                payee = payee_node.find_next("td").get_text(strip=True)
            else:
                payee = "Transferencia Saliente"

            # Fecha (Footer)
            date_obj = self._extract_footer_date(soup)

            return self._create_dto(date_obj, payee, amount, "Transferencia Enviada")
        except Exception as e:
            logger.error(f"Error parseando Transferencia Saliente: {e}")
            return None

    def _parse_purchase_narrative(self, soup, subject):
        """Caso: Compra con Tarjeta o Cargo en Cuenta"""
        try:
            # ESTRATEGIA: Buscar el párrafo que contiene la historia, ignorando el resto.
            # Buscamos "Te informamos que"
            narrative_node = soup.find(string=re.compile("Te informamos que"))
            
            if not narrative_node:
                logger.warning("No se encontró el párrafo narrativo 'Te informamos que'")
                return None
            
            text = narrative_node.strip()
            # Normalizamos espacios (quita saltos de línea raros dentro del párrafo)
            text = " ".join(text.split())

            # Regex:
            # Busca "en [COMERCIO] el"
            # (?:\*{4}\d+)?: Opcionalmente busca los asteriscos de la cuenta "****1234" antes del "en"
            payee_match = re.search(r"\s+en\s+(.+?)\s+el\s+\d{2}/\d{2}/\d{4}", text)
            
            if payee_match:
                payee = payee_match.group(1).strip().rstrip('.')
            else:
                payee = subject # Fallback solo si falla el regex

            # Monto
            amount_match = re.search(r"\$\s*([\d\.]+)", text)
            amount = 0
            if amount_match:
                amount = self._clean_amount(amount_match.group(1)) * -1
            
            # Fecha
            date_match = re.search(r"el\s+(\d{2}/\d{2}/\d{4})", text)
            if date_match:
                date_obj = datetime.strptime(date_match.group(1), "%d/%m/%Y").date()
            else:
                date_obj = date.today()
            
            return self._create_dto(date_obj, payee, amount, subject)

        except Exception as e:
            logger.error(f"Error parseando Compra/Cargo: {e}")
            return None

    def _parse_payment(self, soup, subject):
        """Caso: Pago de Tarjeta o Línea de Crédito"""
        try:
            # Monto
            amount_node = soup.find(string=re.compile(r"Monto( Pagado)?"))
            if not amount_node: 
                logger.warning("No se encontró nodo Monto en Pago")
                return None
                
            amount_str = amount_node.find_next("td").get_text(strip=True)
            amount = self._clean_amount(amount_str) * -1

            payee = "Pago Tarjeta/Línea Crédito"
            
            # Fecha: Intentamos primero en tabla, luego en footer
            date_node = soup.find(string=re.compile(r"Fecha"))
            
            date_obj = None
            
            # Intento 1: Tabla simple "Fecha" (01/12/2025)
            if date_node:
                # Verificamos si es "Fecha y Hora" (footer) o "Fecha" (tabla)
                if "Fecha y Hora" in date_node:
                     # Es el footer, lo procesamos abajo
                     pass
                else:
                    try:
                        date_str = date_node.find_next("td").get_text(strip=True)
                        date_obj = datetime.strptime(date_str, "%d/%m/%Y").date()
                    except:
                        pass # Falló tabla, seguimos al footer

            # Intento 2: Footer
            if not date_obj:
                date_obj = self._extract_footer_date(soup)

            return self._create_dto(date_obj, payee, amount, subject)
        except Exception as e:
            logger.error(f"Error parseando Pago: {e}")
            return None

    # --- Utilidades ---

    def _extract_footer_date(self, soup):
        """Extrae fecha del footer 'miércoles 03 de diciembre...' de forma segura"""
        try:
            footer_node = soup.find(string=re.compile("Fecha y Hora"))
            if footer_node:
                # El texto suele estar en el siguiente párrafo <p>
                date_p = footer_node.find_next("p")
                if date_p:
                    date_str = date_p.get_text(strip=True)
                    # dateparser es mágico para "miércoles 03 de diciembre"
                    dt = dateparser.parse(date_str, languages=['es'])
                    if dt:
                        return dt.date()
        except Exception as e:
            logger.warning(f"Falló extracción fecha footer: {e}")
        
        return date.today() # Fallback final para no romper la importación

    def _clean_amount(self, amount_str: str) -> Decimal:
        clean = amount_str.replace('$', '').replace('.', '').strip()
        # Manejo de posibles decimales (CLP no usa, pero por robustez)
        return Decimal(clean)

    def _create_dto(self, date_obj, payee, amount, memo):
        raw_id = f"{date_obj}-{payee}-{abs(amount)}"
        import_id = hashlib.md5(raw_id.encode('utf-8')).hexdigest()
        
        return TransactionDTO(
            date=date_obj,
            payee=payee,
            amount=amount,
            memo=memo,
            import_id=import_id
        )