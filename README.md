# FixMyWallet 💸

Una aplicación de finanzas personales *self-hosted* enfocada en la metodología de presupuesto de sobres (Envelope Budgeting), automatización vía correos bancarios y gestión colaborativa.

> **Filosofía:** "Tener la menor fricción posible para tomar decisiones rápidas al gastar tu dinero".

## 🚀 Características Actuales

- **Presupuesto de Sobres (Envelope Budgeting):** Asigna cada peso un trabajo. Lógica de "Rollover" (arrastre de saldos) mensual.
- **Automatización de Ingesta:**
    - **Correos:** Lee automáticamente notificaciones bancarias (IMAP) y extrae gastos.
    - **Archivos:** Importador universal de Excel/CSV con mapeo de columnas inteligente y detección de duplicados.
- **Gestión de Cuentas:**
    - Soporte para Cuentas Corrientes, Efectivo y Ahorro.
    - **Tarjetas de Crédito:** Lógica avanzada de movimiento de fondos (al gastar con TC, el dinero se mueve automáticamente al sobre de pago).
    - **Tracking Accounts:** Cuentas de seguimiento (Inversiones, Hipotecarios) que suman al patrimonio pero no afectan el presupuesto diario.
- **Metas (Goals):** Configuración de objetivos de ahorro mensual, saldo objetivo o fecha límite con barras de progreso.
- **Transferencias:** Detección y vinculación de movimientos entre cuentas propias.
- **Reportes:** Gráficos de Patrimonio Neto (Net Worth) y Distribución de Gastos.
- **UX Móvil:** Interfaz responsiva con navegación optimizada para teléfonos.
- **Full Stack Moderno:** Django (Backend) + React/Vite (Frontend) + PostgreSQL + Docker.

## 🛠️ Instalación y Despliegue

Este proyecto utiliza Docker Compose. No necesitas instalar Python ni Node.js en tu máquina local.

### Prerrequisitos
- Docker Desktop (o Docker Engine + Compose Plugin en Linux)
- Git

### Pasos Iniciales

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/tu-usuario/fix-my-wallet.git
   cd fix-my-wallet
   ```

2. **Configurar Variables de Entorno:**
   Crea un archivo `.env` en la raíz (basado en `.env.example` si existiera) o edita `docker-compose.yml`:
   ```env
   VITE_API_URL=http://localhost:8000
   ENCRYPTION_KEY=Tu_Clave_Generada_Con_Fernet
   ```

3. **Levantar el entorno:**
   ```bash
   docker compose up -d --build
   ```

4. **Inicializar Base de Datos:**
   ```bash
   docker compose exec web python manage.py migrate
   docker compose exec web python manage.py createsuperuser
   ```

5. **Acceder:**
   - **Frontend:** http://localhost:5173
   - **Backend API:** http://localhost:8000/api/
   - **Admin Panel:** http://localhost:8000/admin/

## 💡 Comandos Útiles

**Cargar transacciones desde archivo de texto (Debug):**
```bash
docker compose exec web python manage.py import_email "ruta/al/archivo.txt" "NombreCuenta"
```

**Ejecutar fetch de correos manual (Terminal):**
```bash
docker compose exec web python manage.py fetch_emails
```

**Generar clave de encriptación (Para .env):**
```bash
docker compose exec web python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

## 🗺️ Roadmap del Proyecto

### Fase 1, 2 y 3: Core & Lógica Financiera (Completado ✅)
- [x] **Ingesta:** Parser de correos (Banco Chile) y Archivos (Excel/CSV).
- [x] **Modelos:** Transacciones, Cuentas (On/Off Budget), Categorías (Grupos).
- [x] **Presupuesto:** Lógica RTA (Ready to Assign), Rollover mensual, Metas.
- [x] **Tarjetas de Crédito:** Gestión automática de deuda y sobres de pago.
- [x] **UI/UX:** Diseño responsivo (Mobile First), UI Kit (Tailwind), Configuración Regional.
- [x] **Automatización:** Scheduler interno para correos, Configuración de Reglas/Fuentes.
- [x] **Reportes Básicos:** Patrimonio y Gastos.

### Fase 4: Gestión y Automatización Fina (Próximos Pasos) 🛠️
*Mejorar la calidad de vida y reducir el trabajo manual.*

- [ ] **Gestión de Payees (Comercios):**
    - Interfaz para ver lista de comercios, fusionarlos y asignar reglas de renombrado.
    - Asignación automática de categorías basada en historial o reglas.
    - *Esfuerzo: Medio (2-3 días)*.
- [ ] **Notificaciones en UI:**
    - Avisos visuales: "3 transacciones sin categoría", "Cuenta nueva detectada en correos".
    - *Esfuerzo: Bajo (1 día)*.
- [ ] **Temas Visuales:**
    - Implementar Modo Oscuro y selector de temas.
    - *Esfuerzo: Bajo (1-2 días)*.

### Fase 5: Planificación Financiera (Forecasting) 🔮
*Pasar de registrar el pasado a diseñar el futuro.*

- [ ] **Transacciones Recurrentes:**
    - Sistema para programar ingresos/gastos fijos (Sueldo, Arriendo).
    - *Esfuerzo: Medio/Alto (Requiere lógica en scheduler y proyección)*.
- [ ] **Vista de Planificación (Forecasting):**
    - Tabla/Gráfico proyectando el saldo a 6-12 meses.
    - *Esfuerzo: Alto (Lógica compleja de proyección)*.
- [ ] **Simulador de Deuda:**
    - Herramienta para calcular fechas de pago de créditos según capacidad de ahorro (Snowball/Avalanche).
    - *Esfuerzo: Alto*.

### Fase 6: Expansión y Colaboración (SaaS Vision) 🚀
*Funcionalidades para escalar a múltiples usuarios.*

- [ ] **Multi-Presupuesto:**
    - Capacidad de tener presupuestos separados (Ej: Personal vs Emprendimiento) bajo un mismo usuario.
    - *Esfuerzo: Alto (Requiere refactorizar modelos para incluir `budget_id`)*.
- [ ] **Colaboración (Multi-usuario):**
    - Invitaciones por correo para compartir un presupuesto.
    - Gestión de permisos (Ver/Editar).
    - *Esfuerzo: Alto*.
- [ ] **División de Gastos (Split Transactions):**
    - Dividir una transacción en múltiples categorías o asignarla parcialmente a otro usuario.
    - *Esfuerzo: Medio*.
- [ ] **Traducciones (i18n):**
    - Soporte Inglés/Español completo.
    - *Esfuerzo: Medio (Trabajo mecánico de refactorización)*.
- [ ] **Seguridad Avanzada (E2EE):**
    - Encriptación de datos del lado del cliente (Opcional).
    - *Esfuerzo: Muy Alto (Arquitectura completamente distinta)*.

---

## ⚠️ Notas de Desarrollo (Windows + Docker)

1. **Hot Reload en Frontend:** Vite usa `usePolling: true` para compatibilidad con WSL2/Windows.
2. **Tailwind CSS v4:** Se usa el plugin `@tailwindcss/vite`. Si hay problemas con dependencias, borrar `node_modules` y reconstruir el contenedor suele solucionarlo.
3. **Migraciones:** Si cambias modelos críticos (como Payee o Transaction), asegúrate de revisar si los datos existentes son compatibles o requieren un script de migración.