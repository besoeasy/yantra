FROM docker.io/library/node:lts AS builder

WORKDIR /app

COPY package.json package-lock.json* ./

RUN npm ci --prefer-offline --no-audit || npm install

COPY . .

RUN VITE_BUILD_TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ) npm run build

RUN rm -rf node_modules .npm

FROM docker.io/library/node:alpine

RUN apk add --no-cache docker-cli docker-cli-compose wget restic

WORKDIR /app

COPY package.json package-lock.json* ./

RUN npm ci --prefer-offline --no-audit --omit=dev || npm install --omit=dev

RUN npm cache clean --force

COPY --from=builder /app/dist ./dist

COPY daemon/ ./daemon/
COPY apps/ ./apps/

EXPOSE 5252

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
	CMD wget -qO- http://127.0.0.1:5252/api/health >/dev/null 2>&1 || exit 1

ENV PORT=5252
ENV NODE_ENV=production

CMD ["node", "daemon/main.js"]
