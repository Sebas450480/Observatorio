# Observatorio Empresarial

Plataforma web de Uniempresarial para la vigilancia tecnológica y empresarial: Flash Informativo,
Faro Empresarial, Empresas Coformadoras, Tendencias y Calendario de eventos.

## Fases de implementación

| Fase | Estado | Carpeta |
|---|---|---|
| 1. Base de datos (PostgreSQL en Supabase) | Lista | [`supabase/`](supabase/README.md) |
| 2. Backend (Node.js + TypeScript) | Lista | [`backend/`](backend/README.md) |
| 3. Frontend (React) | Pendiente | — |

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

Cada PR ejecuta en GitHub Actions las pruebas de la base de datos y del backend
([`.github/workflows/pruebas.yml`](.github/workflows/pruebas.yml)).
