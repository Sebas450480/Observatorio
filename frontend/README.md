# Frontend — Observatorio Empresarial

Aplicación web en **React 19 + TypeScript + Vite**, con estilos en **Tailwind CSS 4**, basada en el diseño de
Figma *Observatorio Empresarial*. Consume la API del [backend](../backend/README.md) (Fase 2).

| Necesidad | Librería |
|---|---|
| Rutas | React Router |
| Datos del backend (caché, recarga) | TanStack Query |
| Formularios y validación | React Hook Form + Zod |
| Calendario semanal y mensual | FullCalendar |
| Mapa de tendencias | Recharts (Treemap) |
| Íconos | lucide-react |
| Pruebas | Vitest + Testing Library (componentes), Playwright (de extremo a extremo) |

## Puesta en marcha

Requisitos: Node.js 20 o superior y el backend funcionando (por defecto en `http://localhost:3000`).

```bash
cd frontend
npm install
npm run dev            # http://localhost:5173
```

En desarrollo Vite reenvía `/api` y `/uploads` al backend, así el navegador ve un solo sitio y la cookie de
sesión funciona sin configurar CORS. Si el backend está en otra dirección: `BACKEND_URL=http://localhost:4000 npm run dev`.

## Scripts

| Script | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con recarga automática. |
| `npm run build` | Revisa los tipos y genera la versión de producción en `dist/`. |
| `npm run preview` | Sirve `dist/` para revisarlo localmente. |
| `npm run lint` | ESLint (incluye las reglas de React Hooks). |
| `npm run typecheck` | Revisión de tipos de TypeScript. |
| `npm test` | Pruebas de componentes y utilidades (Vitest). |
| `npm run e2e` | Pruebas de extremo a extremo por perfil (ver abajo). |

## Pantallas y permisos

| Ruta | Pantalla | Quién |
|---|---|---|
| `/inicio` | Inicio: evento destacado, próximos eventos, noticias y oportunidades | Todos |
| `/flash-informativo/:id?` | Flash Informativo (el `:id` abre el detalle) | Todos; crea/edita el Gestor Flash |
| `/faro-empresarial/:id?` | Becas, convocatorias, cursos y talleres | Todos; crea/edita el Gestor Faro |
| `/empresas`, `/empresas/:id` | Directorio y perfil de Empresas Coformadoras | Todos; crea/edita el Gestor Empresas |
| `/empresas/nueva`, `/empresas/:id/editar` | Formulario de empresa con contacto principal, logo y portada | Gestor Empresas |
| `/tendencias/:id?` | Tendencias (tarjetas, compactas, tabla), mapa y Top 5; importar Excel | Todos; gestiona el Gestor Tendencias |
| `/eventos/:id?` | Calendario de eventos semanal y mensual | Todos; gestiona el Gestor Calendario |
| `/usuarios` | Gestión de usuarios y roles | SuperAdmin |
| `/estadisticas` | Panel de estadísticas | SuperAdmin |
| `/mi-perfil` | Datos personales, intereses, alertas y contraseña | Con sesión |
| `/iniciar-sesion`, `/registro`, `/recuperar-contrasena`, `/restablecer-contrasena` | Acceso | Todos |

El SuperAdmin puede gestionar todos los módulos. El frontend solo oculta botones: **los permisos reales los
aplica el backend y la base de datos** en cada petición.

La barra superior tiene la **búsqueda global** (`/api/buscar`) en los cinco módulos; cada resultado abre su detalle.
Los listados tienen **Exportar** a PDF y Excel con los filtros aplicados.

## Pruebas de extremo a extremo (Playwright)

Las pruebas de [`e2e/`](e2e) usan el backend real y una base de datos de pruebas, con una cuenta por perfil
(invitado, usuario, Gestor Flash, Gestor Empresas y SuperAdmin):

1. `e2e/preparar-bd.mjs` crea la base `obs_pruebas_e2e` desde `supabase/schema.sql` y `supabase/seed.sql`.
2. Playwright levanta el backend (puerto 3100) y el frontend (puerto 5174).
3. Se prueban los flujos de cada perfil y se guardan capturas de cada pantalla en `test-results/capturas/`
   para compararlas con el Figma (escritorio 1440 px y celular 390 px, sin scroll horizontal).

```bash
cd backend && npm install && cd ../frontend
npx playwright install chromium          # solo la primera vez
TEST_ADMIN_URL=postgresql://postgres:<clave>@localhost:5432/postgres npm run e2e
```

`TEST_ADMIN_URL` es un usuario administrador de un PostgreSQL **de pruebas** (15 o superior). El script le cambia la
contraseña al rol `obs_backend` de ese servidor: no lo uses contra la base de producción. Si ya tienes un Chromium
instalado que no coincide con la versión de Playwright, indica su ruta en `PW_CHROMIUM`.

## Estructura

```
src/
  api/            cliente HTTP, tipos de datos y consultas reutilizables (TanStack Query)
  sesion/         sesión actual, rol y permisos por módulo
  componentes/
    ui/           botones, campos, modales, paginación, insignias...
    estructura/   barra lateral, barra superior con búsqueda y menú de sesión
    contenido/    flujo crear/editar/eliminar, filtros, imágenes, compartir
  paginas/        una carpeta por módulo
  utilidades/     formatos de fecha (hora de Bogotá), dinero y listas de Colombia
e2e/              pruebas Playwright por perfil
```

## Producción

`npm run build` genera archivos estáticos en `dist/`. Sírvelos **en el mismo dominio que la API** (por ejemplo,
el servidor web entrega `dist/` y reenvía `/api` y `/uploads` al backend) y con **HTTPS**, porque la cookie de
sesión es `Secure` y `SameSite`. Todas las rutas que no sean archivos deben responder `index.html`
(la aplicación maneja las rutas en el navegador). Ver también [Despliegue del backend](../backend/README.md#despliegue-producción).
