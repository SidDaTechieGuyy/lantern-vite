FROM node:20 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    supervisor \
    nginx \
    && rm -rf /var/lib/apt/lists/*

RUN /usr/local/bin/pip install "glances[web]" docker python-dateutil

COPY --from=builder /app/dist /usr/share/nginx/html
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY nginx.conf /etc/nginx/sites-enabled/default

EXPOSE 80

CMD ["/usr/bin/supervisord", "-n"]
