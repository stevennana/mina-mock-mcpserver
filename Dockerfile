FROM node:22-bookworm-slim AS app

WORKDIR /app

ENV PORT=3000
ENV HOST=0.0.0.0

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run db:prepare
RUN npm run build

ENV NODE_ENV=production

EXPOSE 3000

CMD ["sh", "-c", "npm run db:prepare && npm run start:logged"]
