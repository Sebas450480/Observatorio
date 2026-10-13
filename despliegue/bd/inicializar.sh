#!/usr/bin/env bash
# Se ejecuta UNA sola vez, cuando el contenedor de PostgreSQL arranca con el volumen vacío
# (docker-entrypoint-initdb.d). Crea la estructura, la contraseña de obs_backend y carga
# los datos exportados (datos/datos.sql) o, si no hay, los datos iniciales de ejemplo.
set -euo pipefail
psql=(psql -v ON_ERROR_STOP=1 -q -U "$POSTGRES_USER" -d "$POSTGRES_DB")

echo "[observatorio] Creando la estructura (schema.sql)..."
"${psql[@]}" -f /estructura/schema.sql

echo "[observatorio] Contraseña del usuario obs_backend..."
"${psql[@]}" -v clave="$OBS_BACKEND_PASSWORD" <<'SQL'
alter role obs_backend with login password :'clave';
SQL

if [ -f /datos/datos.sql ]; then
  echo "[observatorio] Cargando los datos exportados (datos.sql)..."
  "${psql[@]}" -f /datos/datos.sql > /dev/null
else
  echo "[observatorio] No hay datos/datos.sql: se cargan los datos iniciales (seed.sql)."
  "${psql[@]}" -f /estructura/seed.sql
fi
echo "[observatorio] Base de datos lista."
