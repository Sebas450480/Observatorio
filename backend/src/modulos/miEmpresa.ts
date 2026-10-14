import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { conRol } from '../db/contexto.js';
import { ErrorApi, noAutenticado, prohibido } from '../errores.js';
import { borrarImagen, guardarImagen, recibirArchivo } from '../servicios/archivos.js';
import {
  TAMANOS_EMPRESA, correo, enlace, textoObligatorio, textoOpcional,
} from '../utilidades/esquemas.js';

/**
 * Mi empresa (rol Empresa Coformadora): la cuenta que se registró por invitación
 * consulta y edita la ficha de su propia empresa. La base de datos solo le deja
 * ver y modificar la empresa ligada a su cuenta.
 */
export const rutasMiEmpresa = Router();

const soloEmpresa: RequestHandler = (req, _res, next) => {
  if (req.sesion.idUsuario === null) return next(noAutenticado());
  // Solo con el rol Empresa Coformadora (aunque la cuenta tenga además otros roles).
  if (!req.sesion.roles.includes('obs_empresa')) return next(prohibido('Solo las cuentas de empresas coformadoras tienen esta sección'));
  req.sesion = { ...req.sesion, rol: 'obs_empresa' };
  next();
};
rutasMiEmpresa.use(soloEmpresa);

const SIN_EMPRESA = 'Tu cuenta aún no está ligada a una empresa. Escribe al Observatorio para que la vinculen.';

const COLUMNAS = `e.id_ec, e.razon_social, e.nombre_comercial, e.nit, e.sector_economico, e.descripcion, e.tamano_empresa,
  e.naturaleza_juridica, e.codigo_ciiu, e.link, e.estudiantes_recibidos, e.departamento, e.municipio, e.direccion,
  e.telefono, e.correo, e.anio_constitucion, e.logo_ec, e.imagen_portada, e.estado_ec, e.fecha_actualizacion,
  (select u.correo from usuario u where u.id_usuario = e.id_usuario) as correo_cuenta`;

rutasMiEmpresa.get('/', async (req, res) => {
  const empresa = await conRol(req.sesion, async (c) => {
    const { rows } = await c.query(`select ${COLUMNAS} from empresa_coformadora e where e.id_usuario = $1`, [req.sesion.idUsuario]);
    return rows[0];
  });
  if (!empresa) throw new ErrorApi(404, SIN_EMPRESA);
  res.json(empresa);
});

const esquema = z.object({
  razon_social: textoObligatorio(150),
  nombre_comercial: textoOpcional(100),
  nit: textoObligatorio(20),
  sector_economico: textoObligatorio(50),
  descripcion: textoOpcional(),
  tamano_empresa: z.enum(TAMANOS_EMPRESA).nullish(),
  naturaleza_juridica: textoOpcional(50),
  codigo_ciiu: textoOpcional(30),
  link: enlace.nullish(),
  estudiantes_recibidos: z.number().int().min(0).max(1_000_000),
  departamento: textoObligatorio(50),
  municipio: textoObligatorio(60),
  direccion: textoOpcional(150),
  telefono: textoOpcional(20),
  correo: correo.nullish(),
  anio_constitucion: z.number().int().min(1800).max(2100).nullish(),
}).partial();

rutasMiEmpresa.patch('/', async (req, res) => {
  const datos = esquema.parse(req.body);
  const entradas = Object.entries(datos).filter(([, v]) => v !== undefined);
  const empresa = await conRol(req.sesion, async (c) => {
    if (entradas.length) {
      const asignaciones = entradas.map(([col], i) => `${col} = $${i + 2}`);
      const { rowCount } = await c.query(
        `update empresa_coformadora set ${asignaciones.join(', ')} where id_usuario = $1`,
        [req.sesion.idUsuario, ...entradas.map(([, v]) => v)],
      );
      if (!rowCount) throw new ErrorApi(404, SIN_EMPRESA);
    }
    const { rows } = await c.query(`select ${COLUMNAS} from empresa_coformadora e where e.id_usuario = $1`, [req.sesion.idUsuario]);
    if (!rows[0]) throw new ErrorApi(404, SIN_EMPRESA);
    return rows[0];
  });
  res.json(empresa);
});

const CAMPOS_IMAGEN = ['logo_ec', 'imagen_portada'];
function campoImagen(campo: string | undefined) {
  if (!campo || !CAMPOS_IMAGEN.includes(campo)) throw new ErrorApi(400, `Campo de imagen inválido. Usa: ${CAMPOS_IMAGEN.join(', ')}`);
  return campo;
}

/** Cambia una imagen y devuelve la anterior para borrarla. */
async function reemplazarImagen(req: Parameters<RequestHandler>[0], campo: string, nueva: string | null) {
  return conRol(req.sesion, async (c) => {
    const actual = await c.query<Record<string, string | null>>(
      `select ${campo} from empresa_coformadora where id_usuario = $1 for update`,
      [req.sesion.idUsuario],
    );
    if (!actual.rows[0]) throw new ErrorApi(404, SIN_EMPRESA);
    await c.query(`update empresa_coformadora set ${campo} = $1 where id_usuario = $2`, [nueva, req.sesion.idUsuario]);
    return actual.rows[0][campo];
  });
}

rutasMiEmpresa.post('/imagen/:campo', recibirArchivo('imagen'), async (req, res) => {
  const campo = campoImagen(req.params.campo as string);
  const nueva = await guardarImagen(req.file, 'empresas');
  try {
    await borrarImagen(await reemplazarImagen(req, campo, nueva));
  } catch (error) {
    await borrarImagen(nueva);
    throw error;
  }
  res.status(201).json({ [campo]: nueva });
});

rutasMiEmpresa.delete('/imagen/:campo', async (req, res) => {
  const campo = campoImagen(req.params.campo as string);
  await borrarImagen(await reemplazarImagen(req, campo, null));
  res.status(204).end();
});
