# Observatorio Empresarial

Plataforma web de Uniempresarial para la vigilancia tecnológica y empresarial: Flash Informativo,
Faro Empresarial, Empresas Coformadoras, Tendencias y Calendario de eventos.

## Fases de implementación

| Fase | Estado | Carpeta |
|---|---|---|
| 1. Base de datos (PostgreSQL en Supabase) | Lista | [`supabase/`](supabase/README.md) |
| 2. Backend (Node.js + TypeScript) | Lista | [`backend/`](backend/README.md) |
| 3. Frontend (React + Tailwind CSS) | Lista | [`frontend/`](frontend/README.md) |

## Ramas

| Rama | Uso |
|---|---|
| `produccion` | Código estable, listo para desplegar. |
| `pruebas` | Integración y validación antes de pasar a producción. |

Flujo: rama de trabajo → PR a `pruebas` → validación → PR de `pruebas` a `produccion`.

## Variables de entorno

Cada parte tiene su `.env.example` (por ejemplo [`backend/.env.example`](backend/.env.example)). Cópialo como `.env`
y completa los valores. Los archivos `.env` nunca se suben a GitHub.

## Pruebas automáticas

Cada PR ejecuta en GitHub Actions ([`.github/workflows/pruebas.yml`](.github/workflows/pruebas.yml)):

- Base de datos: el esquema se crea desde cero y se prueban permisos e integridad.
- Backend: lint, tipos, pruebas de la API contra PostgreSQL y build.
- Frontend: lint, tipos, pruebas de componentes y build.
- E2E: el frontend y el backend reales en un navegador, con un recorrido por cada perfil
  (invitado, usuario, gestores y SuperAdmin).

## Ejecutar todo en local

1. Base de datos: ver [`supabase/README.md`](supabase/README.md).
2. Backend: `cd backend && npm install && npm run dev` (puerto 3000).
3. Frontend: `cd frontend && npm install && npm run dev` y abre `http://localhost:5173`.

## Publicación en Vercel

La rama `produccion` se publica en Vercel como **un solo proyecto** ([`vercel.json`](vercel.json)):

| Parte | En Vercel |
|---|---|
| Frontend (`frontend/dist`) | Archivos estáticos; las rutas de la aplicación responden `index.html`. |
| API (`/api/*`) | Función de Vercel [`api/index.mjs`](api/index.mjs) con la aplicación Express del backend. |
| Imágenes subidas | Vercel Blob (almacenamiento público). |
| Alertas por correo | Vercel Cron: inmediatas a diario a las 8:00 a. m. y semanal los lunes a las 8:00 a. m. (hora de Bogotá). En el plan Hobby un cron solo puede correr una vez al día. |
| Base de datos | Supabase, por el *pooler* en modo transacción (puerto 6543), usuario `obs_backend.<id-del-proyecto>`. |

Variables de entorno del proyecto en Vercel (*Settings → Environment Variables*):

| Variable | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | `postgresql://obs_backend.<id-del-proyecto>:<contraseña>@<host-del-pooler>:6543/postgres` |
| `DATABASE_SSL` | `true` |
| `JWT_SECRETO` | Texto aleatorio de 48 caracteres o más. |
| `FRONTEND_URL`, `API_URL_PUBLICA` | La dirección pública del sitio, por ejemplo `https://observatorio.vercel.app`. |
| `CRON_SECRET` | Texto aleatorio; Vercel lo envía al ejecutar los cron. |
| `BLOB_STORE_ID` | Lo agrega Vercel al conectar el almacenamiento Blob al proyecto (autenticación OIDC). También sirve `BLOB_READ_WRITE_TOKEN`. |
| `SMTP_*`, `CORREO_REMITENTE` | Datos del servidor de correo. Sin `SMTP_HOST` los correos no se envían (solo se registran). |
