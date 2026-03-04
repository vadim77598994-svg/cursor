# Сборка бэкенда dogovor с поддержкой xhtml2pdf (нужны cairo/pango).
# В Railway: Root Directory = dogovor/backend; сборка по этому Dockerfile.

FROM python:3.12-slim

# Системные пакеты для сборки pycairo (зависимость xhtml2pdf)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libpangocairo-1.0-0 \
    libgirepository1.0-dev \
    libglib2.0-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8080
ENV PORT=8080
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
