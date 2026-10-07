# Base de datos — Observatorio Empresarial

PostgreSQL alojado en Supabase. Esta carpeta contiene todo lo necesario para crear la base de
datos desde cero, igual en cualquier equipo: en la nube, en Supabase local o en un PostgreSQL
propio (por ejemplo, el servidor de la universidad).

## Contenido de la carpeta

| Archivo | Qué es |
|---|---|
| `migrations/` | Cambios de la base de datos, uno por archivo y en orden. Es la fuente oficial. |
| `schema.sql` | Las migraciones unidas en un solo script, para pgAdmin o psql. Se genera con `generar_schema.sh`; no se edita a mano. |
| `seed.sql` | Datos iniciales: 7 roles, categorías y datos de ejemplo tomados del Figma. |
| `tests/pruebas_base_datos.sql` | Pruebas automáticas de permisos e integridad. No dejan datos. |
| `config.toml` | Configuración de Supabase CLI para levantar la base en tu equipo. |
| `generar_schema.sh` | Regenera `schema.sql` después de agregar o cambiar una migración. |

### Migraciones

| Archivo | Contenido |
|---|---|
| `…_tipos_enum.sql` | Listas cerradas de valores (modalidad, estado, tipo de evento…) y extensión `citext`. |
| `…_usuarios_y_acceso.sql` | `rol`, `usuario`, `categoria`, `usuario_interes`, `recuperacion_contrasena`. |
| `…_rls_tablas_usuarios.sql` | Cierra la API pública de Supabase sobre las tablas de usuarios. |
| `…_contenidos.sql` | Tablas de Flash, Faro, Empresas, Tendencias y Calendario + auditoría automática. |
| `…_estadisticas.sql` | `actividad` y `envio_alerta`. |
| `…_indices.sql` | Índices para filtros y llaves foráneas. |
| `…_seguridad_roles.sql` | Roles de PostgreSQL por perfil, permisos por tabla y políticas por fila. |
| `…_vistas_estadisticas.sql` | Vistas para el mapa de Tendencias y el Panel de estadísticas. |

## Cómo usarla

### Opción A — Supabase en tu equipo (recomendada para desarrollar)

Requisitos: [Docker Desktop](https://www.docker.com/products/docker-desktop/) y
[Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started).

```bash
supabase start      # levanta la base de datos y el panel web (http://127.0.0.1:54323)
supabase db reset   # aplica las migraciones y carga seed.sql
```

Cadena de conexión local: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`.

### Opción B — Proyecto en la nube

El entorno de pruebas es el proyecto `observatorio-pruebas` de Supabase (región `us-east-1`).
Para aplicar migraciones nuevas desde tu equipo:

```bash
supabase link --project-ref brobinraqmjepzqnumrq
supabase db push    # aplica solo las migraciones que falten
```

### Opción C — Cualquier PostgreSQL sin Supabase (pgAdmin, servidor propio)

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/schema.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/seed.sql      # opcional
```

En pgAdmin: abre `schema.sql` en la herramienta de consultas y ejecútalo; luego `seed.sql`.

### Ejecutar las pruebas

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/pruebas_base_datos.sql
```

Si todo está bien, el resultado final es `OK: todas las pruebas pasaron`. Las pruebas corren en una
transacción que se deshace al final, así que no dejan datos.

### Agregar un cambio a la base de datos

1. Crea un archivo nuevo en `migrations/` (`supabase migration new nombre_del_cambio`). Nunca edites una migración ya aplicada.
2. Pruébalo en local con `supabase db reset` y ejecuta las pruebas.
3. Regenera el script único: `bash supabase/generar_schema.sh`.
4. Sube el cambio en una rama y abre un PR hacia `pruebas`.

## Diagrama entidad-relación

```mermaid
erDiagram
    rol ||--o{ usuario : "tiene"
    usuario ||--o{ usuario_interes : "marca"
    categoria ||--o{ usuario_interes : "es interés de"
    usuario ||--o{ recuperacion_contrasena : "solicita"
    usuario ||--o{ actividad : "genera"
    usuario ||--o{ envio_alerta : "recibe"

    flash_informativo ||--o{ flash_informativo_categoria : "etiquetado"
    categoria ||--o{ flash_informativo_categoria : ""
    faro_empresarial ||--o{ faro_empresarial_categoria : "etiquetado"
    categoria ||--o{ faro_empresarial_categoria : ""
    tendencia_empresarial ||--o{ tendencia_categoria : "etiquetado"
    categoria ||--o{ tendencia_categoria : ""

    empresa_coformadora ||--o{ contacto_empresa : "tiene"
    tendencia_empresarial ||--o{ fuente_tendencia : "cita"
    tendencia_empresarial ||--o{ mencion_tendencia : "acumula"

    usuario |o--o{ flash_informativo : "creado_por"
    usuario |o--o{ faro_empresarial : "creado_por"
    usuario |o--o{ empresa_coformadora : "creado_por"
    usuario |o--o{ tendencia_empresarial : "creado_por"
    usuario |o--o{ calendario_eventos : "creado_por"

    rol { int id_rol PK
          varchar nombre_rol UK }
    usuario { int id_usuario PK
              citext correo UK
              varchar contrasena_hash
              int id_rol FK
              estado_usuario estado_usuario }
    categoria { int id_categoria PK
                varchar nombre_categoria UK }
    flash_informativo { int id_fi PK
                        varchar titulo
                        timestamptz fecha_inicio
                        tipo_evento tipo_evento
                        estado_registro estado_fi }
    faro_empresarial { int id_fe PK
                       varchar titulo
                       tipo_faro tipo
                       date fecha_cierre
                       estado_registro estado_fe }
    empresa_coformadora { int id_ec PK
                          varchar nit UK
                          varchar razon_social
                          tamano_empresa tamano_empresa
                          estado_registro estado_ec }
    contacto_empresa { int id_contacto PK
                       int id_ec FK
                       boolean es_principal }
    tendencia_empresarial { int id_te PK
                            varchar megatendencia
                            varchar tendencia
                            estado_registro estado_te }
    fuente_tendencia { int id_fuente PK
                       int id_te FK }
    mencion_tendencia { int id_mencion PK
                        int id_te FK
                        date fecha }
    calendario_eventos { int id_evento PK
                         varchar titulo
                         timestamptz fecha_inicio
                         tipo_evento tipo_evento }
    actividad { int id_actividad PK
                int id_usuario FK
                tipo_contenido tipo_contenido
                int id_contenido
                accion_actividad accion }
    envio_alerta { int id_envio PK
                   int id_usuario FK
                   timestamptz fecha_apertura }
    recuperacion_contrasena { int id_recuperacion PK
                              int id_usuario FK
                              varchar token_hash UK }
```

## Las 18 tablas

| Grupo | Tabla | Para qué sirve |
|---|---|---|
| Usuarios | `rol` | Los 7 roles del sistema. |
| | `usuario` | Cuentas registradas. Correo único sin distinguir mayúsculas; contraseña cifrada; aceptación de datos (Ley 1581) obligatoria. |
| | `categoria` | Temas y sectores para etiquetar contenidos e intereses. |
| | `usuario_interes` | Intereses de cada usuario; personaliza las alertas. |
| | `recuperacion_contrasena` | Códigos temporales cifrados para "¿Olvidaste tu contraseña?". |
| Flash Informativo | `flash_informativo`, `flash_informativo_categoria` | Eventos externos y sus categorías. |
| Faro Empresarial | `faro_empresarial`, `faro_empresarial_categoria` | Becas, convocatorias, cursos y talleres. El campo `tipo` es el tipo de registro; la tabla puente guarda los temas. |
| Empresas | `empresa_coformadora`, `contacto_empresa` | Catálogo de empresas; máximo un contacto principal por empresa. |
| Tendencias | `tendencia_empresarial`, `tendencia_categoria`, `fuente_tendencia`, `mencion_tendencia` | Tendencias por megatendencia, sus fuentes y sus menciones con fecha (tamaño en el mapa). |
| Calendario | `calendario_eventos` | Eventos institucionales. Sin estado. |
| Estadísticas | `actividad`, `envio_alerta` | Vistas, clics, compartidos y correos de alerta. |

### Vistas

| Vista | Quién la consulta | Qué entrega |
|---|---|---|
| `v_tendencia_menciones` | Todos | Menciones por tendencia en la semana, mes, año y total. |
| `v_megatendencia_menciones` | Todos | Lo mismo agrupado por megatendencia (mapa de árbol). |
| `v_tendencia_top5_crecimiento` | Todos | Las 5 tendencias que más crecieron (30 días vs. 30 anteriores). |
| `v_estadisticas_resumen_mes` | SuperAdmin | Usuarios, nuevos del mes, visitas, clics, compartidos, suscriptores y apertura de alertas. |
| `v_estadisticas_top5_contenidos` | SuperAdmin | Los 5 contenidos más vistos en 30 días. |
| `v_estadisticas_actividad_modulo` | SuperAdmin | Actividad por módulo (módulo más consultado). |
| `v_estadisticas_usuarios_ciudad` | SuperAdmin | Usuarios por ciudad. |
| `v_estadisticas_intereses` | SuperAdmin | Usuarios y porcentaje por interés. |

## Seguridad

1. **API pública de Supabase cerrada.** Todas las tablas tienen RLS activado y los roles `anon` y
   `authenticated` no tienen permisos. Nadie con la llave pública del proyecto puede leer ni escribir.
2. **Un rol de PostgreSQL por perfil:**

   | Rol | Perfil | Puede |
   |---|---|---|
   | `obs_invitado` | Visitante sin cuenta | Ver registros activos; registrar actividad sin usuario. |
   | `obs_usuario` | Usuario registrado | Lo del invitado + ver y editar su perfil e intereses. |
   | `obs_gestor_*` (5) | Gestor de módulo | CRUD de su módulo y ver su estado; ver los demás módulos como un usuario. |
   | `obs_superadmin` | SuperAdmin | Todo, incluidas estadísticas, usuarios, roles y categorías. |
   | `obs_autenticacion` | Uso interno | Login, registro (solo con rol Usuario) y recuperación de contraseña. |
   | `obs_backend` | Conexión del backend | Único con inicio de sesión; toma uno de los roles anteriores en cada petición. |

3. **Cómo lo usa el backend (Fase 2).** En cada petición:

   ```sql
   begin;
   set local role obs_gestor_flash;      -- rol del usuario autenticado
   set local app.id_usuario = '15';      -- su id (vacío para invitados)
   -- consultas...
   commit;
   ```

   `app.id_usuario` alimenta las políticas ("solo su propio perfil") y la auditoría (`creado_por`).

4. **Contraseña de `obs_backend`.** No está en el repositorio. Se define una sola vez desde el
   editor SQL de Supabase y se guarda en el `.env` del backend:

   ```sql
   alter role obs_backend with password 'una-contraseña-larga-y-aleatoria';
   ```

## Convenciones y decisiones

- **Nombres en minúscula** (`id_usuario`, `flash_informativo`); son los mismos del documento de base de datos.
- **Fechas con zona horaria** (`timestamptz`); montos en `numeric(12,2)`; textos largos en `text`.
- **Imágenes:** se guarda la ruta del archivo en el servidor (`imagen`, `logo_ec`, `imagen_portada`).
- **Auditoría automática:** `creado_por`, `fecha_creacion` y `fecha_actualizacion` se llenan solos y no se pueden alterar.
- **Ajustes frente al Word:**
  - `nombre_rol` y `nombre_categoria` de 20 a 50 caracteres ("Gestor Empresas Coformadoras" tiene 28).
  - Correos sin distinguir mayúsculas (`citext`).
  - Faro: el campo `Categoria` del Word se llama `tipo`.
  - `contacto_empresa.cargo`, porque el Figma lo muestra en la ficha de contacto principal.
  - Restricciones nuevas: tendencia única por megatendencia, un solo contacto principal, costos no negativos, fecha de fin posterior a la de inicio, gratuito sin costo.
- **Gestores:** pueden ver los demás módulos como un usuario (solo registros activos), porque el
  Figma les muestra todas las pantallas. El Word decía que no tenían acceso a otras tablas.
- **Datos de ejemplo:** `seed.sql` no crea usuarios. El SuperAdmin inicial se crea en la Fase 2 con
  un script del backend, para que ninguna contraseña quede en el repositorio. Las empresas distintas
  de TecnoSoluciones y sus NIT son ficticios.
