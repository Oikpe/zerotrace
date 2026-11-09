FROM node:22.23.4-bookworm-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund
COPY . .

FROM node:22.23.4-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3000

COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package.json /app/app.js /app/roulette.js /app/db.js ./
COPY --from=builder --chown=node:node /app/bin ./bin
COPY --from=builder --chown=node:node /app/routes ./routes
COPY --from=builder --chown=node:node /app/views ./views
COPY --from=builder --chown=node:node /app/public ./public

USER node
EXPOSE 3000
CMD ["node", "./bin/www"]
