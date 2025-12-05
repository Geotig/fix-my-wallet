# Roadmap del Proyecto: FixMyWallet

## Fase 1: Cimientos del Presupuesto (Estamos aquí)
- [x] Ingesta de correos (Parser Banco Chile).
- [x] Base de datos y Modelos (Transacciones, Cuentas, Categorías).
- [x] Frontend Básico (Lista de Transacciones).
- [x] Clasificación de Gastos (Category Select).
- [x] Vista de Presupuesto Mensual (Asignado/Actividad/Disponible).
- [ ] **Gestión de Cuentas:** Vista para crear cuentas y establecer **Saldo Inicial**.
- [ ] **Cálculo "Por Asignar":** Mostrar cuánto dinero real hay disponible para repartir en sobres (`Saldo Cuentas - Total Asignado`).
- [ ] **Validación:** Impedir (o advertir) si se asigna más dinero del que existe.

## Fase 2: Lógica Bancaria Avanzada
- [ ] **Transferencias:** Detectar y vincular movimientos entre cuentas propias (evita duplicar gastos/ingresos).
- [ ] **Manejo de Tarjetas de Crédito:**
    - Tratarlas como deuda.
    - Al gastar en TC con una categoría financiada, mover dinero del sobre "Supermercado" al sobre "Pago Tarjeta".
- [ ] **Conciliación:** Subir cartolas (PDF/CSV) para verificar que el saldo en la App coincida con el Banco.

## Fase 3: Colaboración y Hogar (Multi-user)
- [ ] **Modelo Household:** Agrupar usuarios en un "Hogar".
- [ ] **División de Gastos (Split):** Poder decir "Este gasto de $10.000 se divide 60/40 entre Usuario A y B".
- [ ] **Saldos entre Usuarios:** Calcular quién le debe a quién ("Cuentas Claras").

## Fase 4: Planificación y Reportes
- [ ] **Metas (Goals):** "Ahorrar $500.000 para vacaciones en Diciembre".
- [ ] **Forecast:** Proyección de saldo a futuro basado en gastos recurrentes.
- [ ] **Reportes:** Gráficos de Net Worth (Patrimonio) y Gastos por Categoría.

# FixMyWallet 💸

Una aplicación de finanzas personales *self-hosted* enfocada en la metodología de presupuesto de sobres (Envelope Budgeting), automatización vía correos bancarios y gestión colaborativa.

## 🚀 Características

- **Importación Automática:** Lee correos de notificación bancaria (IMAP) y extrae las transacciones.
- **Parser Modular:** Soporte actual para *Banco de Chile*. Fácilmente extensible.
- **Presupuesto Mensual:** Asigna fondos a categorías y monitorea tus gastos en tiempo real.
- **Full Stack Moderno:** Django (Backend) + React/Vite (Frontend) + PostgreSQL.

## 🛠️ Instalación y Despliegue

Este proyecto utiliza Docker Compose para todo. No necesitas instalar Python ni Node.js en tu máquina local.

### Prerrequisitos
- Docker Desktop
- Git

### Pasos Iniciales

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/tu-usuario/fix-my-wallet.git
   cd fix-my-wallet
   ```

2. **Configurar Variables de Entorno:**
   Edita `docker-compose.yml` para configurar tus credenciales de correo (IMAP) y base de datos.
   *Nota: Para Gmail, usa una "App Password".*

3. **Levantar el entorno:**
   ```bash
   docker-compose up -d
   ```

4. **Inicializar Base de Datos:**
   ```bash
   docker-compose exec web python manage.py migrate
   docker-compose exec web python manage.py createsuperuser
   ```

5. **Acceder:**
   - **Frontend:** http://localhost:5173
   - **Backend API:** http://localhost:8000/api/
   - **Admin Panel:** http://localhost:8000/admin/

## 💡 Comandos Útiles

**Cargar transacciones desde un archivo de texto (Pruebas):**
```bash
docker-compose exec web python manage.py import_email "ruta/al/archivo.txt" "NombreCuenta"
```

**Ejecutar fetch de correos manual (Dry Run):**
```bash
docker-compose exec web python manage.py fetch_emails "NombreCuenta" --dry-run
```

**Instalar nuevas dependencias (Backend):**
Agrega la librería a `requirements.txt` y ejecuta:
```bash
docker-compose build web
docker-compose up -d
```

**Instalar nuevas dependencias (Frontend):**
```bash
docker-compose exec frontend npm install nombre-paquete
```

## ⚠️ Notas de Desarrollo (Windows + Docker)

Si estás desarrollando en Windows con Docker Desktop y WSL2, ten en cuenta:

1. **Hot Reload en Frontend:**
   Vite está configurado con `usePolling: true` en `vite.config.js`. Esto es necesario porque el sistema de archivos de Windows a veces no notifica los cambios al contenedor Linux instantáneamente.

2. **Tailwind CSS:**
   Se utiliza Tailwind v4 con el plugin `@tailwindcss/vite`.
   Si tienes problemas con `node_modules` corruptos al cambiar de ramas o versiones, la solución más efectiva es:
   - Detener contenedores: `docker-compose stop frontend`
   - Borrar carpeta local: `rm -r frontend/node_modules`
   - Reconstruir: `docker-compose up -d --build`

## 🗺️ Roadmap Simplificado

- [x] Ingesta de Datos (Emails)
- [x] Clasificación de Categorías
- [x] Vista de Presupuesto
- [ ] Gestión de Saldos de Cuentas (Reconciliación)
- [ ] Lógica de "Dinero por Asignar"
- [ ] Módulo de Usuarios y División de Gastos
```

### ¿Cómo seguimos?

Para resolver tu inquietud de "No asignar lo que no tengo", el siguiente paso técnico es implementar la **Gestión de Cuentas**.

Necesitamos:
1.  Un endpoint en Django para editar cuentas (`AccountViewSet` ya existe, pero quizás necesitemos un método para ajustar saldo).
2.  Una vista en React (`AccountsView`) donde veas tus cuentas (Banco Estado, TC, Efectivo) y puedas ponerles su **Saldo Real Actual**.

Una vez tengamos el saldo real, podremos calcular:
`Dinero Total en Cuentas` - `Dinero ya asignado en sobres` = **To Be Budgeted**.

¿Te parece bien si en la próxima interacción construimos la vista de **Gestión de Cuentas** para cerrar la Fase 1?