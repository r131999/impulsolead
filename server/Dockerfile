FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:20-alpine
WORKDIR /app

RUN apk add --no-cache openssl

COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY prisma ./prisma/
COPY src ./src/

RUN npx prisma generate

EXPOSE 3002

CMD ["sh", "-c", "node src/prisma/migrate.js && node src/app.js"]
