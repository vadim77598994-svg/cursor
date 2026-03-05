# Сборка бэкенда dogovor с поддержкой xhtml2pdf (нужны cairo/pango).
# В Railway: Root Directory = dogovor/backend; сборка по этому Dockerfile.

FROM python:3.12-slim

# Системные пакеты: pycairo для xhtml2pdf + шрифты с кириллицей для видимого текста в PDF
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libpangocairo-1.0-0 \
    libgirepository1.0-dev \
    libglib2.0-dev \
    pkg-config \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
# Шрифт с кириллицей для видимого текста в PDF (xhtml2pdf ищет по пути fonts/ от рабочей директории)
RUN mkdir -p /app/fonts && cp /usr/share/fonts/truetype/dejavu/DejaVuSans.ttf /app/fonts/

EXPOSE 8080
ENV PORT=8080
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
