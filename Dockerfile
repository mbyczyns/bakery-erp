# ETAP 1: Budowanie (Build) / Środowisko deweloperskie
FROM node:20-slim AS builder
WORKDIR /app

# Instalujemy OpenSSL i certyfikaty - niezbędne dla silnika Prismy
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Kopiujemy pliki definicji pakietów
COPY package.json package-lock.json ./
COPY prisma ./prisma/ 

# Instalujemy zależności
RUN npm ci

# Kopiujemy resztę kodu
COPY . .

# Generujemy Prisma Client (niezbędne, by dev widział typy bazy danych)
RUN npx prisma generate

# Budujemy aplikację Next.js (zostanie wywołane tylko przy budowaniu wersji PROD)
RUN npm run build


# ETAP 2: Uruchamianie (Production Runner)
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Kopiujemy tylko to, co niezbędne z etapu builder
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma

COPY entrypoint.sh ./
RUN chmod +x ./entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["./entrypoint.sh"]
CMD ["npm", "start"]