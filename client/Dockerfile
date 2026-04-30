# ---- Build ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Produção ----
FROM nginx:1.27-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
EXPOSE 80
# A imagem oficial nginx:alpine processa /etc/nginx/templates/ via envsubst automaticamente
CMD ["nginx", "-g", "daemon off;"]
