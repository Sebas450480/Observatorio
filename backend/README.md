# Backend — Observatorio Empresarial

API REST en **Node.js + TypeScript + Express** sobre la base de datos PostgreSQL de la Fase 1
([`supabase/`](../supabase/README.md)).

- Documentación interactiva de todos los endpoints: `http://localhost:3000/api/docs`
- Especificación OpenAPI: [`docs/openapi.yaml`](docs/openapi.yaml)

## Cómo funciona la seguridad

1. El backend se conecta a PostgreSQL con el usuario **`obs_backend`**.
2. Cada petición identifica a la persona por su cookie de sesión (JWT HttpOnly). Sin sesión es **invitado**.
3. Todas las consultas de la petición corren en una transacción con el rol de PostgreSQL de esa persona
   ([`src/db/contexto.ts`](src/db/contexto.ts)):

   ```sql
   begin;
   set local role obs_gestor_flash;    -- rol del usuario
   set local app.id_usuario = '15';    -- su id
   -- consultas...
   commit;
   ```

   Así la base de datos aplica los permisos y las políticas de la Fase 1: invitados y usuarios solo ven
   registros activos, cada gestor solo modifica su módulo, nadie ve perfiles ajenos, etc.
   El backend además valida los datos (Zod) y responde 401/403 antes de llegar a la base.
4. El rol y el estado del usuario se consultan en cada petición: un cambio de rol, un bloqueo o un cambio
   de contraseña aplican de inmediato.

| Rol en la tabla `rol` | Rol de PostgreSQL |
|---|---|
| (sin sesión) | `obs_invitado` |
| Usuario | `obs_usuario` |
| Gestor Faro Empresarial / Flash Informativo / Empresas Coformadoras / Tendencias / Calendario | `obs_gestor_faro` / `_flash` / `_empresas` / `_tendencias` / `_calendario` |
| SuperAdmin | `obs_superadmin` |
| (login, registro, recuperar contraseña) | `obs_autenticacion` |

## Puesta en marcha

Requisitos: Node.js 20 o superior y la base de datos de la Fase 1 (Supabase local, la nube o PostgreSQL propio).

```bash
cd backend
npm install
cp .env.example .env        # y completa los valores (ver abajo)
npm run dev                 # servidor con recarga automática en http://localhost:3000
```

### 1. Contraseña del usuario `obs_backend`

Se define una sola vez en la base de datos y se guarda solo en tu `.env` (nunca en GitHub).
En Supabase: **SQL Editor** → ejecuta (con una contraseña larga y aleatoria):

```sql
alter role obs_backend with login password 'pega-aqui-una-contraseña-larga';
```

Genera una contraseña con `node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"`.

### 2. `DATABASE_URL`

| Dónde está la base | Valor |
|---|---|
| Supabase local (`supabase start`) | `postgresql://obs_backend:<contraseña>@127.0.0.1:54322/postgres` |
| Supabase en la nube | Panel → **Connect** → *Session pooler*. Usuario `obs_backend.<id-del-proyecto>`, con `DATABASE_SSL=true`. |
| PostgreSQL propio | `postgresql://obs_backend:<contraseña>@<servidor>:5432/<base>` |

### 3. Primer SuperAdmin

```bash
npm run crear-superadmin -- --correo admin@uniempresarial.edu.co --nombre Ana --apellido Pérez
```

Pide la contraseña por consola y la guarda cifrada. Si el correo ya existe, lo convierte en SuperAdmin.
Desde ahí, el SuperAdmin crea las cuentas de los gestores con `POST /api/usuarios`.

### 4. Correos (alertas y recuperar contraseña)

En desarrollo se usa [Mailpit](https://mailpit.axllent.org/), un buzón de prueba: los correos no salen a internet
y se ven en `http://localhost:8025`.

```bash
docker run -d --name mailpit -p 8025:8025 -p 1025:1025 axllent/mailpit
```

Con `SMTP_HOST=localhost` y `SMTP_PUERTO=1025` (valores del `.env.example`). Si dejas `SMTP_HOST` vacío,
los correos solo se muestran en la consola. Para producción, configura el SMTP institucional.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con recarga automática. |
| `npm run build` / `npm start` | Compila a `dist/` y ejecuta la versión compilada (producción). |
| `npm test` | Pruebas de integración (ver abajo). |
| `npm run lint` / `npm run typecheck` | Revisión de estilo y de tipos. |
| `npm run crear-superadmin` | Crea o promueve el primer SuperAdmin. |

## Pruebas

Las pruebas crean una base de datos nueva (`obs_pruebas_backend`) con `supabase/schema.sql` y `supabase/seed.sql`,
y prueban cada endpoint con cada perfil contra PostgreSQL real, conectándose como `obs_backend`.

```bash
TEST_ADMIN_URL=postgresql://postgres:<contraseña>@localhost:5432/postgres npm test
```

`TEST_ADMIN_URL` debe ser un usuario administrador de un PostgreSQL 15+ **de desarrollo** (no el de producción).
En GitHub Actions se ejecutan automáticamente en cada PR ([`.github/workflows/pruebas.yml`](../.github/workflows/pruebas.yml)).

## Endpoints

Todos bajo `/api`. Detalle de parámetros y cuerpos en `/api/docs`.

| Módulo | Rutas | Quién modifica |
|---|---|---|
| Autenticación | `POST /auth/registro`, `/auth/login`, `/auth/logout`, `/auth/recuperar`, `/auth/restablecer` · `GET /auth/yo` | — |
| Mi perfil | `GET/PATCH /perfil` · `PUT /perfil/intereses` · `PUT /perfil/contrasena` | El propio usuario |
| Usuarios | `GET/POST /usuarios` · `GET/PATCH/DELETE /usuarios/:id` | SuperAdmin |
| Catálogos | `GET /roles` · `GET/POST /categorias` · `PATCH/DELETE /categorias/:id` | SuperAdmin |
| Flash Informativo | `/flash` | Gestor Flash Informativo |
| Faro Empresarial | `/faro` (por defecto solo vigentes; `?vigentes=false` para todas) | Gestor Faro Empresarial |
| Empresas | `/empresas` · `/empresas/resumen` · `/empresas/:id/contactos` | Gestor Empresas Coformadoras |
| Tendencias | `/tendencias` · `/tendencias/mapa` · `/top5` · `/megatendencias` · `/plantilla` · `/importar` · `/:id/menciones` | Gestor Tendencias |
| Calendario | `/calendario` (`?desde=&hasta=` para la vista semanal o mensual) | Gestor Calendario |
| Estadísticas | `POST /actividad` (todos) · `GET /estadisticas/panel`, `/resumen`, `/top-contenidos`, `/modulos`, `/ciudades`, `/intereses` | — (consulta: SuperAdmin) |
| Búsqueda global | `GET /buscar?q=` (Flash, Faro, Empresas, Tendencias y Eventos a la vez) | — |
| Alertas | `POST /alertas/ejecutar` · `GET /alertas/abierto/:id/:firma` | SuperAdmin |

Cada módulo de contenido tiene las mismas rutas base
([`src/modulos/recurso.ts`](src/modulos/recurso.ts)):

| Ruta | Qué hace |
|---|---|
| `GET /` | Listado con filtros, `pagina`, `limite` (máx. 100), `orden`, `direccion`, `categoria`, `estado` (solo gestor). |
| `GET /exportar?formato=xlsx\|pdf` | El mismo listado en Excel o PDF (máx. 5000 registros). |
| `GET /:id` | Detalle. |
| `POST /` · `PATCH /:id` · `DELETE /:id` | Crear, editar (campos parciales) y eliminar. |
| `POST /:id/imagen/:campo` · `DELETE /:id/imagen/:campo` | Subir (JPG/PNG, máx. 4 MB) o quitar una imagen. |

Fechas: con hora en ISO 8601 con zona (`2026-10-20T08:00:00-05:00`); sin hora como `AAAA-MM-DD`.

### Respuestas de error

```json
{ "error": "Datos inválidos", "detalles": [{ "campo": "titulo", "mensaje": "Es obligatorio" }] }
```

| Código | Cuándo |
|---|---|
| 400 | Datos inválidos o que rompen una regla de la base de datos. |
| 401 | Hace falta iniciar sesión. |
| 403 | La sesión no tiene permiso para esa acción. |
| 404 | No existe o la sesión no puede verlo (p. ej. un registro inactivo para un invitado). |
| 409 | Duplicado (correo, NIT, tendencia) o registro relacionado. |
| 413 / 415 | Archivo muy grande o de un tipo no permitido. |
| 422 | Importación de Excel con errores (detalle por fila; no se importa nada). |

## Alertas por correo

Tareas programadas en [`src/servicios/alertas.ts`](src/servicios/alertas.ts):

- **Inmediata:** cada 15 minutos, lo publicado desde la última alerta.
- **Semanal:** lunes 8:00 (hora de Bogotá), lo publicado en la semana.

Incluyen Flash, Faro y Tendencias que coinciden con los intereses del usuario (todo si no marcó intereses)
y los eventos institucionales nuevos. Cada envío queda en `envio_alerta`; una imagen invisible marca la apertura
para el panel de estadísticas. Se desactivan con `ALERTAS_ACTIVAS=false`.

## Estructura

```
backend/
├── docs/openapi.yaml        Documentación de la API
├── src/
│   ├── app.ts               Configuración de Express y rutas
│   ├── servidor.ts          Arranque del servidor y tareas programadas
│   ├── config.ts            Variables de entorno (validadas)
│   ├── errores.ts           Errores HTTP y traducción de errores de PostgreSQL
│   ├── auth/                Roles, tokens de sesión
│   ├── db/                  Conexión y transacción con el rol del usuario
│   ├── middlewares/         Sesión y control de roles
│   ├── modulos/             Rutas de cada módulo
│   ├── servicios/           Imágenes, Excel/PDF, correo, alertas
│   ├── utilidades/          Validaciones y filtros
│   └── scripts/             crear-superadmin
└── tests/                   Pruebas de integración (Vitest + Supertest)
```

## Despliegue (producción)

- Usa `npm run build` y `npm start` con `NODE_ENV=production`.
- **HTTPS obligatorio:** en producción la cookie de sesión es `Secure` y el navegador solo la envía por HTTPS.
- **Mismo sitio:** sirve el frontend y la API bajo el mismo dominio (por ejemplo `observatorio.uniempresarial.edu.co`
  y `/api` detrás de un proxy como Nginx). La cookie es `SameSite=Lax` y no viaja entre dominios distintos.
- Configura `FRONTEND_URL` y `API_URL_PUBLICA` con las direcciones reales (se usan en CORS y en los enlaces de los correos).
- La carpeta `UPLOADS_DIR` debe conservarse entre despliegues (ahí están las imágenes subidas) y tener copia de seguridad.
- En **Vercel** el backend corre como función (`api/index.mjs` en la raíz), las imágenes van a **Vercel Blob**
  (`BLOB_STORE_ID` o `BLOB_READ_WRITE_TOKEN`) y las alertas las dispara **Vercel Cron** (`CRON_SECRET`). Ver el
  [README principal](../README.md#publicación-en-vercel).
