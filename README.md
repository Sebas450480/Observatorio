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
