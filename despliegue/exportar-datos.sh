#!/usr/bin/env bash
# =============================================================================
# Exporta los datos actuales (Supabase) y las imágenes (Supabase Storage y Vercel Blob) para
# llevarlos al servidor de la universidad. Ejecútalo el día de la migración,
# justo antes de apagar la versión de Vercel, para no perder datos recientes.
#
# Uso (desde la raíz del repositorio):
#   bash despliegue/exportar-datos.sh "<cadena de conexión de Supabase: Connect > Session pooler>"
#
# La cadena de conexión está en Supabase: Connect > Session pooler (usuario postgres).
# Necesita psql (cualquier versión) y curl.
#
# Resultado, en despliegue/datos/ (carpeta que NO se sube a GitHub: tiene correos
# y contraseñas cifradas de los usuarios):
#   datos.sql   todos los registros, listos para cargar sobre supabase/schema.sql
#   uploads/    las imágenes subidas, con las rutas que espera el servidor
# =============================================================================
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Uso: bash despliegue/exportar-datos.sh \"<cadena de conexión de Supabase>\"" >&2
  exit 1
fi
ORIGEN="$1"
AQUI="$(cd "$(dirname "$0")" && pwd)"
DESTINO="$AQUI/datos"
mkdir -p "$DESTINO/uploads"

echo "1/3 Exportando registros..."
psql "$ORIGEN" -X -q -At -v ON_ERROR_STOP=1 -f "$AQUI/bd/volcado.sql" -o "$DESTINO/datos.sql"
echo "    $DESTINO/datos.sql ($(wc -c < "$DESTINO/datos.sql") bytes)"

echo "2/3 Descargando imágenes (Supabase Storage y Vercel Blob)..."
psql "$ORIGEN" -X -q -At -v ON_ERROR_STOP=1 -c "
  select u from (
    select imagen u from public.flash_informativo
    union select imagen from public.faro_empresarial
    union select logo_ec from public.empresa_coformadora
    union select imagen_portada from public.empresa_coformadora
  ) x where u like 'https://%.blob.vercel-storage.com/%' or u like 'https://%.supabase.co/storage/v1/object/public/%'" |
while read -r url; do
  ruta="${url#https://*.blob.vercel-storage.com/}"
  ruta="${ruta#https://*.supabase.co/storage/v1/object/public/*/}"
  mkdir -p "$DESTINO/uploads/$(dirname "$ruta")"
  if curl -fsSL "$url" -o "$DESTINO/uploads/$ruta"; then
    echo "    uploads/$ruta"
  else
    echo "    AVISO: no se pudo descargar $url (la imagen se verá vacía)" >&2
  fi
done

echo "3/3 Resumen de registros exportados:"
psql "$ORIGEN" -X -q -v ON_ERROR_STOP=1 -c "
  select c.relname as tabla,
         (xpath('/row/n/text()', query_to_xml('select count(*) as n from public.' || quote_ident(c.relname), false, true, '')))[1]::text::int as filas
    from pg_class c join pg_namespace s on s.oid = c.relnamespace
   where s.nspname = 'public' and c.relkind = 'r' order by 1"

echo "Listo. Copia la carpeta despliegue/datos al servidor (por ejemplo con scp) y sigue docs/MIGRACION.md."
