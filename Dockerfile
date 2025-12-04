# 1. Usar una imagen base oficial de Python (ligera)
FROM python:3.12-slim

# 2. Establecer variables de entorno para optimizar Python en Docker
# Evita que Python genere archivos .pyc
ENV PYTHONDONTWRITEBYTECODE 1
# Asegura que los logs de Python se vean en la consola de Docker inmediatamente
ENV PYTHONUNBUFFERED 1

# 3. Establecer el directorio de trabajo dentro del contenedor
WORKDIR /app

# 4. Instalar dependencias del sistema necesarias (opcional, pero recomendado para Postgres)
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# 5. Copiar el archivo de requerimientos e instalarlos
COPY requirements.txt /app/
RUN pip install --upgrade pip
RUN pip install -r requirements.txt

# 6. Copiar el resto del código del proyecto al contenedor
COPY . /app/

# 7. (Opcional por ahora) Comando por defecto al iniciar
# CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]