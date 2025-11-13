# syntax=docker/dockerfile:1.7

############################
# 1) Base deps for install #
############################
FROM node:20-alpine AS deps
WORKDIR /app

# Отключаем кэш npm полностью для экономии места
ENV npm_config_cache=/tmp/.npm

# Устанавливаем все зависимости (включая dev для сборки)
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --prefer-offline --cache=/tmp/.npm && \
    rm -rf /tmp/.npm && \
    npm cache clean --force

############################
# 2) Build Next.js         #
############################
FROM node:20-alpine AS builder
WORKDIR /app

# Копируем зависимости
COPY --from=deps /app/node_modules ./node_modules
# Копируем весь код
COPY . .

# Собираем Next.js
ENV NEXT_TELEMETRY_DISABLED=1
ENV npm_config_cache=/tmp/.npm
RUN npm run build && \
    rm -rf /tmp/.npm && \
    npm cache clean --force

############################
# 3) Runtime (small image) #
############################
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Копируем только необходимые файлы из сборки
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) })" || exit 1

CMD ["node", "server.js"]
