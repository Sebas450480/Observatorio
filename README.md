# Observatorio Empresarial

Plataforma web de Uniempresarial para la vigilancia tecnológica y empresarial: Flash Informativo,
Faro Empresarial, Empresas Coformadoras, Tendencias y Calendario de eventos.

## Fases de implementación

| Fase | Estado | Carpeta |
|---|---|---|
| 1. Base de datos (PostgreSQL en Supabase) | Lista | [`supabase/`](supabase/README.md) |
| 2. Backend (Node.js) | Pendiente | — |
| 3. Frontend (React) | Pendiente | — |

## Ramas

| Rama | Uso |
|---|---|
| `produccion` | Código estable, listo para desplegar. |
| `pruebas` | Integración y validación antes de pasar a producción. |

Flujo: rama de trabajo → PR a `pruebas` → validación → PR de `pruebas` a `produccion`.

## Variables de entorno

Copia `.env.example` como `.env` y completa los valores. El archivo `.env` nunca se sube a GitHub.
