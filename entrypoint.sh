#!/bin/sh
set -e

echo "[entrypoint] Uruchamiam kontener aplikacji..."

# Inicjalizacja/Aktualizacja bazy danych Prisma
echo "[entrypoint] Wykonuję Prisma db push oraz generate..."
npx prisma db push
npx prisma generate

echo "[entrypoint] Gotowe! Startuję serwer Next.js: $@"
exec "$@"