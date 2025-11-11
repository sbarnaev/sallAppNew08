# syntax=docker/dockerfile:1.7

############################
# 1) Base deps for install #
############################
FROM node:20-alpine AS deps
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# Ускоряем сборку: только файлы для зависимостей
COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --include=dev

############################
# 2) Build Next.js         #
############################
FROM node:20-alpine AS builder
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js standalone билд для продакшна
RUN --mount=type=cache,target=/root/.npm \
    npm run build

############################
# 3) Runtime (small image) #
############################
FROM node:20-alpine AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app

# Нужны только артефакты standalone
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

# Healthcheck: проверка, что сервер отвечает
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000 || exit 1

CMD ["node", "server.js"]


