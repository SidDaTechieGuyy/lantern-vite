FROM node:20 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
RUN pip install --no-cache-dir flask gunicorn gevent psutil docker whitenoise

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY app.py .

EXPOSE 80

CMD ["gunicorn", "--worker-class", "gevent", "--workers", "1", "--bind", "0.0.0.0:80", "--timeout", "120", "app:app"]
