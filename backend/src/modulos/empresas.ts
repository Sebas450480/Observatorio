import { z } from 'zod';
import { crearRecurso } from './recurso.js';
import { PREFIJO_NIT_PENDIENTE, VIGENCIA_DIAS, enviarInvitacion } from './invitaciones.js';
import { generarCodigoRecuperacion, huellaCodigo } from '../auth/tokens.js';
import { conAutenticacion, conRol } from '../db/contexto.js';
import { ErrorApi, noEncontrado } from '../errores.js';
import { cargaRecurso, type ErrorCarga } from '../servicios/cargaMasiva.js';
import { requiereRol } from '../middlewares/sesion.js';
import {
  ESTADOS, TAMANOS_EMPRESA, correo, enlace, idPositivo, textoObligatorio, textoOpcional,
} from '../utilidades/esquemas.js';

/** Empresas Coformadoras: catálogo de empresas aliadas y sus contactos. */
const esquema = z.object({
  nit: textoObligatorio(20),
  razon_social: textoObligatorio(150),
  nombre_comercial: textoOpcional(100),
  descripcion: textoOpcional(),
  sector_economico: textoObligatorio(50),
  tamano_empresa: z.enum(TAMANOS_EMPRESA).nullish(),
  tiempo_coformadora: textoOpcional(20),
  link: enlace.nullish(),
  estudiantes_recibidos: z.number().int().min(0).optional(),
  premios_recibidos: z.number().int().min(0).optional(),
  codigo_ciiu: textoOpcional(30),
  naturaleza_juridica: textoOpcional(50),
  departamento: textoObligatorio(50),
  municipio: textoObligatorio(60),
  direccion: textoOpcional(150),
  telefono: textoOpcional(20),
  correo: correo.nullish(),
  anio_constitucion: z.number().int().min(1800).max(2100).nullish(),
  estado_ec: z.enum(ESTADOS).optional(),
});

const esquemaContacto = z.object({
  nombre: textoObligatorio(100),
  cargo: textoOpcional(100),
  correo: correo.nullish(),
  telefono: textoOpcional(20),
  es_principal: z.boolean().optional(),
});

const esquemaFiltros = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  sector: z.string().trim().max(50).optional(),
  tamano: z.enum(TAMANOS_EMPRESA).optional(),
  departamento: z.string().trim().max(50).optional(),
  municipio: z.string().trim().max(60).optional(),
});

const soloGestor = requiereRol('obs_gestor_empresas');

// ----------------------------------------------------------------------------------
// Carga masiva: cada fila crea la empresa (inactiva, con la ficha pendiente) y su contacto
// principal. Con «Enviar invitación = Sí» también invita al contacto (sus datos pasan a ser
// obligatorios) y la empresa se publica cuando su cuenta completa la ficha desde Mi perfil.
// Sin invitación basta con la razón social o el nombre comercial; el gestor la activa.
// ----------------------------------------------------------------------------------
const esquemaCarga = z.object({
  razon_social: textoOpcional(150),
  nombre_comercial: textoOpcional(100),
  nit: textoOpcional(20),
  descripcion: textoOpcional(),
  sector_economico: textoOpcional(50),
  codigo_ciiu: textoOpcional(30),
  naturaleza_juridica: textoOpcional(50),
  tamano_empresa: z.enum(TAMANOS_EMPRESA).nullish(),
  anio_constitucion: z.number().int().min(1800, 'Año inválido').max(2100, 'Año inválido').nullish(),
  departamento: textoOpcional(50),
  municipio: textoOpcional(60),
  direccion: textoOpcional(150),
  telefono: textoOpcional(20),
  correo: correo.nullish(),
  link: enlace.nullish(),
  estudiantes_recibidos: z.number().int().min(0).optional(),
  contacto_nombre: textoOpcional(50),
  contacto_apellido: textoOpcional(50),
  contacto_cargo: textoOpcional(100),
  contacto_celular: textoOpcional(20),
  contacto_correo: correo.nullish(),
  invitar: z.boolean().optional(),
});
type FilaEmpresa = z.infer<typeof esquemaCarga>;

const POR_DEFINIR = 'Por definir';

const cargaEmpresas = cargaRecurso<FilaEmpresa>({
  archivo: 'plantilla-empresas-coformadoras',
  hoja: 'Empresas',
  instrucciones: [
    'Cada fila crea la empresa (inactiva) con su contacto. El gestor la activa cuando su ficha esté lista.',
    'Sin invitación, solo es obligatoria la razón social o el nombre comercial.',
    'Con «Enviar invitación = Sí», los datos del contacto son obligatorios: el contacto recibe un correo para crear su contraseña y completar la ficha.',
    'El correo de un contacto invitado no puede tener ya una cuenta ni una invitación pendiente.',
  ],
  columnas: [
    { clave: 'invitar', titulo: 'Enviar invitación', tipo: 'sino', ayuda: 'Sí = el contacto recibe la invitación por correo. Vacío = No.', ejemplo: 'No' },
    { clave: 'contacto_nombre', titulo: 'Nombres del contacto', ayuda: 'Nombres de la persona de contacto. Obligatorio si se envía la invitación.', ejemplo: 'Sandra Milena', ancho: 22 },
    { clave: 'contacto_apellido', titulo: 'Apellidos del contacto', ayuda: 'Apellidos de la persona. Obligatorio si se envía la invitación.', ejemplo: 'Guerrero Rojas', ancho: 22 },
    { clave: 'contacto_correo', titulo: 'Correo del contacto', ayuda: 'Correo de la persona; si se invita, será el usuario de la cuenta.', ejemplo: 'contacto@empresa.com', ancho: 28 },
    { clave: 'contacto_celular', titulo: 'Celular del contacto', ayuda: 'Celular o teléfono de la persona. Obligatorio si se envía la invitación.', ejemplo: '3001234567', ancho: 18 },
    { clave: 'contacto_cargo', titulo: 'Cargo del contacto', ayuda: 'Cargo o área de la persona.', ejemplo: 'Jefe de Gestión Humana', ancho: 24 },
    { clave: 'razon_social', titulo: 'Razón social', ayuda: 'Nombre legal de la empresa.', ejemplo: 'Meltec Comunicaciones S.A.', ancho: 30 },
    { clave: 'nombre_comercial', titulo: 'Nombre comercial', ayuda: 'Nombre con el que se conoce.', ejemplo: 'Meltec' },
    { clave: 'nit', titulo: 'NIT', ayuda: 'Sin dígito de verificación ni puntos.', ejemplo: '830079015' },
    { clave: 'descripcion', titulo: 'Actividad económica', ayuda: 'A qué se dedica la empresa.', ejemplo: 'Comercio al por mayor de equipos de telecomunicaciones.', ancho: 40 },
    { clave: 'sector_economico', titulo: 'Sector económico', ayuda: 'Sector o clúster (máx. 50 caracteres).', ejemplo: 'Software y TI' },
    { clave: 'codigo_ciiu', titulo: 'Código CIIU', ayuda: 'Código de la actividad económica.', ejemplo: '4652' },
    { clave: 'naturaleza_juridica', titulo: 'Tipo de sociedad', ayuda: 'Privada, Pública, Mixta, S.A.S., etc.', ejemplo: 'Privada' },
    { clave: 'tamano_empresa', titulo: 'Tamaño', tipo: 'lista', opciones: [...TAMANOS_EMPRESA.map((t) => ({ texto: t })), { texto: 'Microempresa', valor: 'Micro' }], ayuda: 'Tamaño de la empresa.', ejemplo: 'Grande' },
    { clave: 'anio_constitucion', titulo: 'Año de constitución', tipo: 'entero', ayuda: 'Año en que se constituyó.', ejemplo: '2001' },
    { clave: 'departamento', titulo: 'Departamento', ayuda: 'Departamento de la sede principal.', ejemplo: 'Cundinamarca' },
    { clave: 'municipio', titulo: 'Municipio', ayuda: 'Municipio de la sede principal.', ejemplo: 'Bogotá' },
    { clave: 'direccion', titulo: 'Dirección', ayuda: 'Dirección de la sede principal.', ejemplo: 'Cl. 130a #58a-29' },
    { clave: 'telefono', titulo: 'Teléfono de la empresa', ayuda: 'Teléfono general.', ejemplo: '6017654321' },
    { clave: 'correo', titulo: 'Correo de la empresa', ayuda: 'Correo general. Vacío = el del contacto.', ejemplo: 'info@empresa.com' },
    { clave: 'link', titulo: 'Página web', tipo: 'enlace', ayuda: 'Sitio web de la empresa.', ejemplo: 'https://www.meltec.com.co' },
    { clave: 'logo', titulo: 'Logo', tipo: 'imagen', campoImagen: 'logo_ec', ayuda: 'Logo de la empresa.', ejemplo: 'logo-meltec.png' },
    { clave: 'portada', titulo: 'Portada', tipo: 'imagen', campoImagen: 'imagen_portada', ayuda: 'Imagen de portada del perfil.', ejemplo: 'portada-meltec.jpg' },
    { clave: 'estudiantes_recibidos', titulo: 'Estudiantes recibidos', tipo: 'entero', ayuda: 'Estudiantes de Uniempresarial que ha recibido. Vacío = 0.', ejemplo: '4' },
  ],
  armar: (f) => ({ ...f, anio_constitucion: f.anio_constitucion ?? null }),
  esquema: esquemaCarga,
  resumen: (d) => {
    const contacto = [d.contacto_nombre, d.contacto_apellido].filter(Boolean).join(' ');
    return [d.razon_social ?? d.nombre_comercial ?? 'Sin razón social', contacto && `${contacto}${d.contacto_correo ? ` (${d.contacto_correo})` : ''}`, d.invitar && 'con invitación']
      .filter(Boolean).join(' · ');
  },
  clave: (d) => d.contacto_correo ?? d.nit ?? (d.razon_social ?? d.nombre_comercial ?? '').toLowerCase(),
  mensajeRepetido: 'Empresa repetida en el archivo (mismo correo de contacto, NIT o razón social)',
  revisar: async (c, filas) => {
    const errores: ErrorCarga[] = [];
    for (const { fila, datos } of filas) {
      if (!datos.razon_social && !datos.nombre_comercial && !datos.invitar) {
        errores.push({ fila, columna: 'Razón social', mensaje: 'Escribe la razón social o el nombre comercial' });
      }
      if (datos.invitar) {
        const faltan = ([['contacto_nombre', 'Nombres del contacto'], ['contacto_apellido', 'Apellidos del contacto'],
          ['contacto_correo', 'Correo del contacto'], ['contacto_celular', 'Celular del contacto']] as const)
          .filter(([clave]) => !datos[clave]);
        for (const [, columna] of faltan) errores.push({ fila, columna, mensaje: 'Es obligatorio para enviar la invitación' });
      }
    }
    const nits = filas.filter((f) => f.datos.nit).map((f) => f.datos.nit!);
    const nitsExistentes = new Set(
      (await c.query<{ nit: string }>('select nit from empresa_coformadora where nit = any($1::text[])', [nits])).rows.map((r) => r.nit),
    );
    const nitsVistos = new Map<string, number>();
    for (const { fila, datos } of filas) {
      if (!datos.nit) continue;
      if (nitsExistentes.has(datos.nit)) errores.push({ fila, columna: 'NIT', mensaje: 'Ya existe una empresa con ese NIT' });
      else if (nitsVistos.has(datos.nit)) errores.push({ fila, columna: 'NIT', mensaje: `NIT repetido en el archivo (igual a la fila ${nitsVistos.get(datos.nit)})` });
      else nitsVistos.set(datos.nit, fila);
    }
    const correos = filas.filter((f) => f.datos.invitar && f.datos.contacto_correo).map((f) => f.datos.contacto_correo!);
    const conCuenta = new Set(
      (await conAutenticacion((a) => a.query<{ correo: string }>('select lower(correo::text) as correo from usuario where lower(correo::text) = any($1::text[])', [correos])))
        .rows.map((r) => r.correo),
    );
    const invitados = new Set(
      (await c.query<{ correo: string }>(
        "select lower(correo::text) as correo from invitacion_empresa where estado = 'Pendiente' and lower(correo::text) = any($1::text[])",
        [correos],
      )).rows.map((r) => r.correo),
    );
    for (const { fila, datos } of filas) {
      if (!datos.invitar || !datos.contacto_correo) continue;
      if (conCuenta.has(datos.contacto_correo)) {
        errores.push({ fila, columna: 'Correo del contacto', mensaje: 'Ya existe una cuenta con ese correo' });
      } else if (invitados.has(datos.contacto_correo)) {
        errores.push({ fila, columna: 'Correo del contacto', mensaje: 'Ese correo ya tiene una invitación pendiente' });
      }
    }
    return errores;
  },
  guardar: async (c, filas, sesion) => {
    const envios: { nombre_contacto: string; correo: string; nombre_empresa: string | null; codigo: string }[] = [];
    const creados: { fila: number; id: number }[] = [];
    for (const { fila, datos } of filas) {
      try {
        const codigo = generarCodigoRecuperacion();
        const nombreEmpresa = datos.razon_social ?? datos.nombre_comercial ?? null;
        const idInvitacion = datos.invitar
          ? (await c.query<{ id_invitacion: number }>(
            `insert into invitacion_empresa (nombre_contacto, apellido_contacto, correo, nombre_empresa, token_hash,
                                             fecha_vencimiento, creado_por)
             values ($1, $2, $3, $4, $5, now() + make_interval(days => $6), $7)
             returning id_invitacion`,
            [datos.contacto_nombre, datos.contacto_apellido, datos.contacto_correo, nombreEmpresa, huellaCodigo(codigo),
              VIGENCIA_DIAS, sesion.idUsuario],
          )).rows[0]!.id_invitacion
          : null;
        // Sin invitación ni NIT, un NIT provisional único (la empresa queda inactiva hasta corregirlo).
        const nitProvisional = `${PREFIJO_NIT_PENDIENTE}${idInvitacion ?? `C${Date.now().toString(36)}${fila}`}`;
        const contacto = [datos.contacto_nombre, datos.contacto_apellido].filter(Boolean).join(' ');
        const empresa = await c.query<{ id_ec: number }>(
          `insert into empresa_coformadora (razon_social, nombre_comercial, nit, descripcion, sector_economico, codigo_ciiu,
                                            naturaleza_juridica, tamano_empresa, anio_constitucion, departamento, municipio,
                                            direccion, telefono, correo, link, estudiantes_recibidos, estado_ec, ficha_pendiente)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'Inactivo', true)
           returning id_ec`,
          [
            (nombreEmpresa ?? `Empresa de ${contacto}`).slice(0, 150), datos.nombre_comercial ?? null,
            datos.nit ?? nitProvisional, datos.descripcion ?? null,
            datos.sector_economico ?? POR_DEFINIR, datos.codigo_ciiu ?? null, datos.naturaleza_juridica ?? null,
            datos.tamano_empresa ?? null, datos.anio_constitucion ?? null, datos.departamento ?? POR_DEFINIR,
            datos.municipio ?? POR_DEFINIR, datos.direccion ?? null, datos.telefono ?? null,
            datos.correo ?? datos.contacto_correo ?? null, datos.link ?? null, datos.estudiantes_recibidos ?? 0,
          ],
        );
        const idEc = empresa.rows[0]!.id_ec;
        if (contacto) {
          await c.query(
            `insert into contacto_empresa (id_ec, nombre, cargo, correo, telefono, es_principal)
             values ($1, $2, $3, $4, $5, true)`,
            [idEc, contacto.slice(0, 100), datos.contacto_cargo ?? null, datos.contacto_correo ?? null, datos.contacto_celular ?? null],
          );
        }
        creados.push({ fila, id: idEc });
        if (idInvitacion !== null) {
          await c.query('update invitacion_empresa set id_ec = $2 where id_invitacion = $1', [idInvitacion, idEc]);
          envios.push({ nombre_contacto: datos.contacto_nombre!, correo: datos.contacto_correo!, nombre_empresa: nombreEmpresa, codigo });
        }
      } catch (error) {
        const codigo = (error as { code?: string }).code;
        const mensaje = codigo === '23505' ? 'Ya existe una empresa o una invitación con esos datos' : 'No se pudo guardar esta empresa';
        if (!codigo && !(error instanceof ErrorApi)) throw error;
        throw new ErrorApi(422, 'El archivo tiene errores. No se guardó ningún registro.', { errores: [{ fila, mensaje }] });
      }
    }
    return { creados, envios };
  },
  // Los correos se envían después de guardar (si uno falla, la invitación se puede reenviar).
  despues: async (resultado) => {
    const envios = (resultado as unknown as { envios: { nombre_contacto: string; correo: string; nombre_empresa: string | null; codigo: string }[] }).envios;
    const fallidos: string[] = [];
    for (const { codigo, ...datos } of envios) {
      if (!(await enviarInvitacion(datos, codigo))) fallidos.push(datos.correo);
    }
    return { invitaciones_enviadas: envios.length - fallidos.length, correos_fallidos: fallidos };
  },
});

export const rutasEmpresas = crearRecurso({
  nombre: 'empresas',
  titulo: 'Empresas Coformadoras',
  tabla: 'empresa_coformadora',
  id: 'id_ec',
  rolGestor: 'obs_gestor_empresas',
  columnaEstado: 'estado_ec',
  esquema,
  selectExtra: [
    `coalesce((select json_agg(c order by c.es_principal desc, c.id_contacto)
                 from contacto_empresa c where c.id_ec = t.id_ec), '[]'::json) as contactos`,
  ],
  esquemaFiltros,
  aplicarFiltros: (f, v) => {
    if (v.q) f.texto(['t.razon_social', 't.nombre_comercial', 't.nit', 't.descripcion'], v.q as string);
    if (v.sector) f.y(`t.sector_economico ilike ${f.param(v.sector)}`);
    if (v.tamano) f.y(`t.tamano_empresa = ${f.param(v.tamano)}`);
    if (v.departamento) f.y(`t.departamento ilike ${f.param(v.departamento)}`);
    if (v.municipio) f.y(`t.municipio ilike ${f.param(v.municipio)}`);
  },
  ordenes: { nombre: 'coalesce(t.nombre_comercial, t.razon_social)', creacion: 't.fecha_creacion', estudiantes: 't.estudiantes_recibidos' },
  ordenDefecto: 'nombre',
  camposImagen: ['logo_ec', 'imagen_portada'],
  // Datos sensibles de las empresas y sus contactos: no se descargan.
  sinDescargas: true,
  cargaMasiva: cargaEmpresas,
  columnasExportar: [
    { campo: 'id_ec', titulo: 'ID', ancho: 0.4 },
    { campo: 'razon_social', titulo: 'Razón social', ancho: 1.6 },
    { campo: 'nombre_comercial', titulo: 'Nombre comercial', ancho: 1.2 },
    { campo: 'nit', titulo: 'NIT', ancho: 0.9 },
    { campo: 'sector_economico', titulo: 'Sector', ancho: 0.9 },
    { campo: 'tamano_empresa', titulo: 'Tamaño', ancho: 0.7 },
    { campo: 'departamento', titulo: 'Departamento', ancho: 1.1 },
    { campo: 'municipio', titulo: 'Municipio', ancho: 0.9 },
    { campo: 'estudiantes_recibidos', titulo: 'Estudiantes', ancho: 0.6 },
    { campo: 'premios_recibidos', titulo: 'Premios', ancho: 0.5 },
    { campo: 'tiempo_coformadora', titulo: 'Tiempo coformadora', ancho: 0.8 },
    { campo: 'correo', titulo: 'Correo', ancho: 1.3 },
    { campo: 'telefono', titulo: 'Teléfono', ancho: 0.8 },
    { campo: 'estado_ec', titulo: 'Estado', ancho: 0.6 },
  ],
  rutasExtra: (router) => {
    // Contadores del dashboard junto a la galería (respeta lo que cada perfil puede ver).
    router.get('/resumen', async (req, res) => {
      const resumen = await conRol(req.sesion, async (c) => {
        const totales = await c.query<{ total: number; activas: number; inactivas: number }>(
          `select count(*)::int as total,
                  count(*) filter (where estado_ec = 'Activo')::int as activas,
                  count(*) filter (where estado_ec = 'Inactivo')::int as inactivas
             from empresa_coformadora`,
        );
        const porSector = await c.query(
          `select sector_economico as sector, count(*)::int as empresas
             from empresa_coformadora group by sector_economico order by empresas desc, sector`,
        );
        const porTamano = await c.query(
          `select tamano_empresa as tamano, count(*)::int as empresas
             from empresa_coformadora where tamano_empresa is not null
            group by tamano_empresa order by tamano_empresa`,
        );
        const estudiantes = await c.query<{ estudiantes: number }>(
          'select coalesce(sum(estudiantes_recibidos), 0)::int as estudiantes from empresa_coformadora',
        );
        return {
          ...totales.rows[0],
          estudiantes_recibidos: estudiantes.rows[0]?.estudiantes ?? 0,
          por_sector: porSector.rows,
          por_tamano: porTamano.rows,
        };
      });
      if (req.sesion.rol !== 'obs_gestor_empresas' && req.sesion.rol !== 'obs_superadmin') {
        delete (resumen as { inactivas?: number }).inactivas;
      }
      res.json(resumen);
    });

    // Contactos de una empresa.
    router.post('/:id/contactos', soloGestor, async (req, res) => {
      const idEmpresa = idPositivo.parse(req.params.id);
      const datos = esquemaContacto.parse(req.body);
      const contacto = await conRol(req.sesion, async (c) => {
        const existe = await c.query('select 1 from empresa_coformadora where id_ec = $1', [idEmpresa]);
        if (!existe.rowCount) throw noEncontrado('Empresa');
        // Si el nuevo contacto es el principal, el anterior deja de serlo.
        if (datos.es_principal) {
          await c.query('update contacto_empresa set es_principal = false where id_ec = $1 and es_principal', [idEmpresa]);
        }
        const { rows } = await c.query(
          `insert into contacto_empresa (id_ec, nombre, cargo, correo, telefono, es_principal)
           values ($1, $2, $3, $4, $5, coalesce($6, false)) returning *`,
          [idEmpresa, datos.nombre, datos.cargo ?? null, datos.correo ?? null, datos.telefono ?? null, datos.es_principal ?? null],
        );
        return rows[0];
      });
      res.status(201).json(contacto);
    });

    router.patch('/:id/contactos/:idContacto', soloGestor, async (req, res) => {
      const idEmpresa = idPositivo.parse(req.params.id);
      const idContacto = idPositivo.parse(req.params.idContacto);
      const datos = esquemaContacto.partial().parse(req.body);
      const entradas = Object.entries(datos).filter(([, v]) => v !== undefined);
      const contacto = await conRol(req.sesion, async (c) => {
        if (datos.es_principal) {
          await c.query(
            'update contacto_empresa set es_principal = false where id_ec = $1 and es_principal and id_contacto <> $2',
            [idEmpresa, idContacto],
          );
        }
        const asignaciones = entradas.map(([col], i) => `${col} = $${i + 3}`);
        const { rows } = await c.query(
          `update contacto_empresa set ${asignaciones.length ? asignaciones.join(', ') : 'id_ec = id_ec'}
            where id_ec = $1 and id_contacto = $2 returning *`,
          [idEmpresa, idContacto, ...entradas.map(([, v]) => v)],
        );
        if (!rows[0]) throw noEncontrado('Contacto');
        return rows[0];
      });
      res.json(contacto);
    });

    router.delete('/:id/contactos/:idContacto', soloGestor, async (req, res) => {
      const idEmpresa = idPositivo.parse(req.params.id);
      const idContacto = idPositivo.parse(req.params.idContacto);
      await conRol(req.sesion, async (c) => {
        const { rowCount } = await c.query('delete from contacto_empresa where id_ec = $1 and id_contacto = $2', [
          idEmpresa,
          idContacto,
        ]);
        if (!rowCount) throw noEncontrado('Contacto');
      });
      res.status(204).end();
    });
  },
});
