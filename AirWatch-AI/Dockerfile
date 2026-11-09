# Multi-stage production Dockerfile for AirWatch AI
FROM python:3.12-slim AS backend

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app ./app

ENV DATABASE_URL=sqlite:///./airwatch.db
ENV FRONTEND_ORIGIN=*
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
