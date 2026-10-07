#!/usr/bin/env bash
# Genera supabase/schema.sql: un solo script con toda la estructura de la base
# de datos, uniendo las migraciones en orden. Ejecutar después de agregar o
# cambiar una migración:
#   bash supabase/generar_schema.sh
set -euo pipefail
cd "$(dirname "$0")"

{
  echo "-- ============================================================================="
  echo "-- Observatorio Empresarial - Estructura completa de la base de datos"
  echo "--"
  echo "-- ARCHIVO GENERADO: no editar a mano. Se crea con supabase/generar_schema.sh"
  echo "-- uniendo los archivos de supabase/migrations en orden."
  echo "--"
  echo "-- Uso en cualquier PostgreSQL 15 o superior (pgAdmin, psql, servidor propio):"
  echo "--   psql \"\$DATABASE_URL\" -v ON_ERROR_STOP=1 -f supabase/schema.sql"
  echo "--   psql \"\$DATABASE_URL\" -v ON_ERROR_STOP=1 -f supabase/seed.sql   # datos iniciales (opcional)"
  echo "-- El usuario que lo ejecute necesita permiso para crear roles (CREATEROLE)."
  echo "-- ============================================================================="
  for f in migrations/*.sql; do
    echo
    echo
    echo "-- >>> $f"
    cat "$f"
  done
} > schema.sql

echo "schema.sql generado ($(wc -l < schema.sql) líneas)"
