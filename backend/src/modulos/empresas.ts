import { z } from 'zod';
import { crearRecurso } from './recurso.js';
import { conRol } from '../db/contexto.js';
import { noEncontrado } from '../errores.js';
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
