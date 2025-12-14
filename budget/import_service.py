import pandas as pd
from datetime import datetime
from decimal import Decimal
import io
import hashlib
import re

def detect_header_row(file_obj, filename, keywords=['fecha', 'date', 'monto', 'amount', 'descripcion', 'descripción', 'description', 'cargo', 'abono', 'retiro', 'deposito']):
    try:
        # Leemos sin header para encontrar la fila correcta
        if filename.endswith('.csv'):
            df_preview = pd.read_csv(file_obj, sep=None, engine='python', header=None, nrows=50)
        else:
            df_preview = pd.read_excel(file_obj, header=None, nrows=50)
        
        best_row_idx = 0
        max_matches = 0
        
        for idx, row in df_preview.iterrows():
            row_text = " ".join(row.astype(str).tolist()).lower()
            current_matches = sum(1 for k in keywords if k in row_text)
            if current_matches > max_matches:
                max_matches = current_matches
                best_row_idx = idx
                
        return best_row_idx
    except Exception as e:
        print(f"Error detectando header: {e}")
        return 0

def preview_file(file_obj, filename):
    try:
        header_idx = detect_header_row(file_obj, filename)
        file_obj.seek(0)
        
        if filename.endswith('.csv'):
            df = pd.read_csv(file_obj, sep=None, engine='python', header=header_idx)
        else:
            df = pd.read_excel(file_obj, header=header_idx)
            
        # CAMBIO: NO filtramos las columnas Unnamed. 
        # Permitimos que el usuario las vea por si ahí está el dato real.
        # df = df.loc[:, ~df.columns.str.contains('^Unnamed')] 
        
        # Renombrar columnas vacías para que sean seleccionables en el frontend
        df.columns = [str(col) if 'Unnamed' not in str(col) else f"Columna {i+1} (Sin Título)" for i, col in enumerate(df.columns)]

        columns = df.columns.tolist()
        sample_data = df.head(5).astype(object).where(pd.notnull(df), None).to_dict(orient='records')
        
        return {
            "columns": columns,
            "sample": sample_data,
            "detected_header_row": header_idx
        }
    except Exception as e:
        raise ValueError(f"Error procesando archivo: {str(e)}")

def process_import(file_obj, filename, mapping, account, dry_run=False):
    header_idx = mapping.get('header_row', 0)
    file_obj.seek(0)
    
    if filename.endswith('.csv'):
        df = pd.read_csv(file_obj, sep=None, engine='python', header=header_idx)
    else:
        df = pd.read_excel(file_obj, header=header_idx)

    # Renombrar igual que en el preview para que el mapeo coincida
    df.columns = [str(col) if 'Unnamed' not in str(col) else f"Columna {i+1} (Sin Título)" for i, col in enumerate(df.columns)]
    df.columns = df.columns.str.strip()
    
    from budget.services import create_transaction_from_dto
    from budget.importers.base import TransactionDTO
    
    imported_count = 0
    duplicated_count = 0
    date_col = mapping.get('date_col')
    
    # Parser de fecha estándar (sin inyectar años mágicos)
    df['parsed_date'] = pd.to_datetime(df[date_col], dayfirst=True, errors='coerce')
    df_clean = df.dropna(subset=['parsed_date'])

    def clean_decimal(val):
        if pd.isnull(val) or val == '': return Decimal(0)
        if isinstance(val, (int, float)): return Decimal(val)
        
        val_str = str(val).strip()
        
        # Limpieza robusta de texto
        # 1. Quitamos moneda
        val_str = val_str.replace('$', '').replace('CLP', '').strip()
        
        # 2. Si viene formato "1 / 0" (TC Banco Chile), intentamos tomar el primero
        if '/' in val_str:
            parts = val_str.split('/')
            val_str = parts[0].strip()

        # 3. Formato numérico
        val_str = val_str.replace('.', '').replace(',', '.')
        
        # 4. Quitar cualquier caracter que no sea número, punto o menos
        val_str = re.sub(r'[^\d.-]', '', val_str)

        try:
            return Decimal(val_str)
        except:
            return Decimal(0)

    should_invert = mapping.get('invert_amount', False)

    for _, row in df_clean.iterrows():
        try:
            amount = Decimal(0)
            
            if mapping.get('amount_mode') == 'single' and mapping.get('amount_col'):
                amount = clean_decimal(row[mapping['amount_col']])
                if should_invert:
                    amount = amount * -1
            else:
                inc_val = Decimal(0)
                out_val = Decimal(0)
                if mapping.get('amount_in_col'): inc_val = clean_decimal(row[mapping['amount_in_col']])
                if mapping.get('amount_out_col'): out_val = clean_decimal(row[mapping['amount_out_col']])
                amount = abs(inc_val) - abs(out_val)

            if amount == 0:
                continue

            payee_text = "Sin descripción"
            if mapping.get('payee_col'):
                val = row[mapping['payee_col']]
                if pd.notnull(val):
                    payee_text = str(val).strip()

            tx_date = row['parsed_date'].date()
            raw_id_string = f"{tx_date}-{payee_text}-{abs(amount)}"
            import_id = hashlib.md5(raw_id_string.encode('utf-8')).hexdigest()

            dto = TransactionDTO(
                date=tx_date,
                payee=payee_text,
                amount=amount,
                memo="Importado manual",
                import_id=import_id
            )
            
            if not dry_run:
                _, created = create_transaction_from_dto(account, dto)
                if created:
                    imported_count += 1
                else:
                    duplicated_count += 1
            
        except Exception:
            continue

    return {
        "imported": imported_count,
        "duplicated": duplicated_count
    }