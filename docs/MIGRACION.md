# Migración al servidor de Uniempresarial

Guía para llevar el Observatorio Empresarial de su alojamiento actual (Vercel + Supabase) al
servidor oficial de la universidad, con todos los datos e imágenes.

## 1. Qué hay hoy y a dónde va

| Pieza | Hoy | En el servidor de la universidad |
|---|---|---|
| Página web (React) | Vercel | La sirve la misma aplicación Node (variable `FRONTEND_DIR`) |
| API (Express) | Función de Vercel (`api/index.mjs`) | Proceso Node 22 permanente (`node dist/servidor.js`) |
| Base de datos | Supabase (PostgreSQL 17, proyecto `brobinraqmjepzqnumrq`) | PostgreSQL 15 o superior propio |
| Imágenes subidas | Vercel Blob | Carpeta del servidor (`UPLOADS_DIR`), servida en `/uploads/...` |
| Alertas programadas | Vercel Cron | Integradas en el proceso Node (cada 15 min y lunes 8:00) |
| Correo | Sin configurar | SMTP institucional (opcional) |
| Código | GitHub `Sebas450480/Observatorio` | Mismo repositorio, o transferido a la organización de la universidad |
| Dominio | `www.observatorioempresarial.com` → Vercel | El dominio que defina la universidad, con HTTPS |

El código ya está listo para las dos formas de trabajo: en Vercel sigue funcionando igual, y en un
servidor propio basta con definir las variables de entorno. No hay que modificar código para migrar.

## 2. Requisitos del servidor (para la reunión con el ingeniero)

**Opción recomendada — Docker** (todo en contenedores, la más fácil de instalar y mantener):

- Linux (Ubuntu 22.04/24.04, Debian 12, RHEL 9 o similar) con **Docker Engine** y **Docker Compose v2**.
- 2 vCPU, 2 GB de RAM, 20 GB de disco (la base de datos actual pesa menos de 50 MB).
- Un nombre de dominio o subdominio (por ejemplo `observatorio.uniempresarial.edu.co`) apuntando al servidor.
- **HTTPS obligatorio**: la sesión usa una cookie segura que el navegador solo envía por HTTPS.
  Puede ser nginx/Apache del servidor con Let's Encrypt, o el proxy/balanceador de la universidad.
- Salida a internet por el puerto 443 (mapa de Google en el navegador, descarga de la imagen de Docker)
  y, si se configuran correos, al servidor SMTP.

**Opción sin Docker:** Node.js 22, PostgreSQL 15+ (con permiso para crear roles), nginx o Apache
como proxy HTTPS y un gestor de procesos (systemd o PM2). Ver la sección 6.

### Preguntas para el ingeniero

1. ¿El servidor es Linux? ¿Tiene o se puede instalar Docker?
2. ¿Qué dominio o subdominio tendrá la plataforma? ¿Quién gestiona el DNS?
3. ¿Quién pone el certificado HTTPS: el servidor (nginx + Let's Encrypt) o un proxy de la universidad?
4. ¿La base de datos va en el mismo servidor o hay un PostgreSQL institucional?
5. ¿Hay un servidor SMTP institucional (o una cuenta de correo) para los correos de la plataforma?
6. ¿Cómo se harán las copias de seguridad de la base de datos y de la carpeta de imágenes?
7. ¿El repositorio de GitHub pasa a una cuenta u organización de la universidad?
8. ¿Cómo accederemos para desplegar actualizaciones (SSH, VPN, un responsable de TI)?

## 3. Archivos de la migración (carpeta `despliegue/`)

| Archivo | Para qué |
|---|---|
| `Dockerfile` | Construye una sola imagen con la API y la página web compilada. |
| `docker-compose.yml` | Levanta PostgreSQL 17 + la aplicación, con volúmenes para datos e imágenes. |
| `.env.ejemplo` | Variables a completar (secretos, dominio, correo). Se copia como `.env`. |
| `bd/inicializar.sh` | La primera vez crea la estructura (`supabase/schema.sql`) y carga los datos. |
| `bd/volcado.sql` | Genera el script con todos los registros de la base actual. |
| `exportar-datos.sh` | Exporta los registros de Supabase y descarga las imágenes de Vercel Blob. |
| `nginx.conf.ejemplo` | Proxy HTTPS de ejemplo delante de la aplicación. |

## 4. Paso a paso con Docker

### 4.1 Exportar los datos (el día de la migración)

Hazlo justo antes del cambio para no perder registros recientes. Desde la raíz del repositorio, en
cualquier equipo con `psql` y `curl`:

```bash
bash despliegue/exportar-datos.sh "<cadena de conexión de Supabase>"
```

La cadena está en Supabase → botón **Connect** → *Session pooler*: tiene la forma
`postgresql://postgres.brobinraqmjepzqnumrq:<CONTRASEÑA>@<servidor>.pooler.supabase.com:5432/postgres`. Si no recuerdas la
contraseña, se cambia en **Project Settings → Database → Reset database password** (no afecta a la
plataforma, que entra con el usuario `obs_backend`).

Resultado en `despliegue/datos/`:

- `datos.sql`: todos los registros (usuarios, contenidos, empresas, tendencias, eventos, estadísticas).
  Las contraseñas van cifradas (bcrypt): **cada persona sigue entrando con su misma contraseña**.
- `uploads/`: las imágenes subidas, ya con las rutas que espera el servidor.

Esta carpeta **no se sube a GitHub** (está en `.gitignore`) porque contiene datos personales.
Trasládala al servidor por un canal seguro (`scp`, USB cifrada, carpeta institucional).

### 4.2 Preparar el servidor

```bash
git clone https://github.com/Sebas450480/Observatorio.git observatorio
cd observatorio/despliegue
# Copiar aquí la carpeta datos/ exportada (datos/datos.sql y datos/uploads/)
mkdir -p datos/uploads
sudo chown -R 1000:1000 datos/uploads      # la aplicación corre como usuario 1000 y guarda imágenes ahí
cp .env.ejemplo .env
nano .env                                   # completar (ver 4.3)
```

### 4.3 Variables de `.env`

| Variable | Valor |
|---|---|
| `POSTGRES_PASSWORD` | Contraseña del administrador de la base. `openssl rand -hex 24` |
| `OBS_BACKEND_PASSWORD` | Contraseña del usuario de la aplicación. `openssl rand -hex 24` |
| `JWT_SECRETO` | Firma de las sesiones, 32+ caracteres. `openssl rand -base64 36` |
| `FRONTEND_URL` y `API_URL_PUBLICA` | La dirección pública con `https://`, por ejemplo `https://observatorio.uniempresarial.edu.co` |
| `PUERTO_PUBLICO` | Puerto local al que apunta el proxy HTTPS (por defecto `3000`) |
| `SMTP_*`, `CORREO_REMITENTE` | Opcional: datos del servidor de correo. Sin `SMTP_HOST` no se envían correos. |

### 4.4 Arrancar

```bash
docker compose up -d --build
docker compose logs -f bd     # debe terminar con "[observatorio] Base de datos lista."
curl http://localhost:3000/api/salud
# {"estado":"ok","baseDeDatos":"ok","correo":"..."}
```

La base de datos se crea y se carga **solo la primera vez** (volumen vacío). Si no hay
`datos/datos.sql`, arranca con los datos de ejemplo de `supabase/seed.sql`.

Luego configura el proxy HTTPS (ver `nginx.conf.ejemplo`) para que el dominio apunte a
`http://127.0.0.1:3000`.

### 4.5 Verificar

- [ ] `https://<dominio>/api/salud` responde `"estado":"ok"`.
- [ ] La página carga y se puede iniciar sesión con una cuenta existente.
- [ ] Flash, Faro, Empresas, Tendencias y Eventos muestran los mismos registros que en Vercel.
- [ ] Las imágenes de Flash/Empresas se ven, y se puede subir una nueva.
- [ ] El perfil de una empresa muestra el mapa.
- [ ] El Panel de estadísticas muestra la actividad.
- [ ] (Si hay correo) "¿Olvidaste tu contraseña?" envía el mensaje.

### 4.6 Cambio de dominio y apagado de Vercel

1. Con todo verificado, apunta el dominio al servidor nuevo (registro DNS `A`/`CNAME`). Si se conserva
   `www.observatorioempresarial.com`, se quita el dominio del proyecto en Vercel → *Settings → Domains*.
2. Deja Vercel y Supabase encendidos (en solo lectura de hecho) una o dos semanas como respaldo.
3. Después: en Vercel, *Settings → Git → Disconnect* (deja de desplegar) o elimina el proyecto;
   en Supabase, pausa o elimina el proyecto; en Vercel Blob, elimina el almacenamiento.

> Importante: si alguien crea o edita registros en Vercel después de exportar, esos cambios no
> pasan al servidor nuevo. Avisa a los gestores o haz la exportación y el cambio de DNS el mismo día.

## 5. Mantenimiento con Docker

```bash
# Actualizar a la última versión del código (rama produccion)
cd observatorio && git pull origin produccion
cd despliegue && docker compose up -d --build

# Copia de seguridad de la base (guardar fuera del servidor)
docker compose exec -T bd pg_dump -U postgres -d observatorio -Fc > respaldo-$(date +%F).dump
# y de las imágenes
tar czf imagenes-$(date +%F).tgz datos/uploads

# Restaurar una copia sobre una base vacía
docker compose exec -T bd pg_restore -U postgres -d observatorio --clean --if-exists < respaldo-AAAA-MM-DD.dump

# Crear o recuperar un SuperAdmin
docker compose exec -e SUPERADMIN_CONTRASENA='<contraseña>' app node dist/scripts/crear-superadmin.js --correo <correo>

# Ver registros de la aplicación
docker compose logs -f app
```

Cambios futuros en la base de datos: cada migración nueva de `supabase/migrations/` se aplica a mano
con `docker compose exec -T bd psql -U postgres -d observatorio -v ON_ERROR_STOP=1 < supabase/migrations/<archivo>.sql`.

## 6. Instalación sin Docker

```bash
# 1. Base de datos (como superusuario de PostgreSQL)
createdb observatorio
psql -d observatorio -v ON_ERROR_STOP=1 -f supabase/schema.sql
echo "alter role obs_backend with login password :'clave'" | psql -d observatorio -v clave="<contraseña obs_backend>"
psql -d observatorio -v ON_ERROR_STOP=1 -f despliegue/datos/datos.sql      # o supabase/seed.sql

# 2. Compilar
npm ci --prefix backend && npm ci --prefix frontend
npm run build --prefix backend && npm run build --prefix frontend
npm prune --omit=dev --prefix backend

# 3. Imágenes
sudo mkdir -p /var/lib/observatorio/uploads
sudo cp -r despliegue/datos/uploads/. /var/lib/observatorio/uploads/
```

Variables de entorno en `backend/.env` (las mismas de la sección 4.3, más):

```ini
NODE_ENV=production
PUERTO=3000
DATABASE_URL=postgresql://obs_backend:<contraseña>@localhost:5432/observatorio
DATABASE_SSL=false
FRONTEND_DIR=../frontend/dist
UPLOADS_DIR=/var/lib/observatorio/uploads
```

Servicio systemd (`/etc/systemd/system/observatorio.service`):

```ini
[Unit]
Description=Observatorio Empresarial
After=network.target postgresql.service

[Service]
WorkingDirectory=/opt/observatorio/backend
ExecStart=/usr/bin/node dist/servidor.js
Restart=always
User=observatorio
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload && sudo systemctl enable --now observatorio
```

Y el proxy HTTPS igual que en `despliegue/nginx.conf.ejemplo`.

## 7. GitHub

El código vive en `github.com/Sebas450480/Observatorio`, con las ramas `pruebas` y `produccion` y
pruebas automáticas (GitHub Actions) en cada cambio. Opciones:

- **Transferir el repositorio** a la organización de la universidad: *Settings → General → Danger Zone →
  Transfer ownership*. Conserva historial, ramas, PRs y Actions; GitHub redirige la dirección vieja.
- **O** dejarlo donde está y dar acceso de lectura al equipo de TI (*Settings → Collaborators*).

Después de la migración, la integración de Vercel ya no hace falta: `vercel.json` y `api/` se pueden
dejar (no estorban) o borrar cuando Vercel se apague.

## 8. Qué se lleva de Vercel

| En Vercel | En el servidor |
|---|---|
| Variables de entorno (`DATABASE_URL`, `JWT_SECRETO`, `FRONTEND_URL`, `CRON_SECRET`, `BLOB_*`…) | Se generan nuevas en `.env`. No hace falta copiar ninguna: `JWT_SECRETO` nuevo solo obliga a iniciar sesión otra vez. `CRON_SECRET` y `BLOB_*` ya no se usan. |
| Vercel Blob (imágenes) | Lo descarga `exportar-datos.sh` a `datos/uploads/`. |
| Vercel Cron (alertas) | Lo hace el propio servidor (`ALERTAS_ACTIVAS=true`). |
| Dominio `www.observatorioempresarial.com` | Se apunta por DNS al servidor nuevo, o se usa el dominio de la universidad. |
