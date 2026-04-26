FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir opencc-python-reimplemented

COPY backend/ .

EXPOSE 8000

CMD ["sh", "-c", "alembic upgrade head && python run.py"]
