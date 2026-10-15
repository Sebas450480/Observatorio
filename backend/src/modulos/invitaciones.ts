import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { conAutenticacion, conRol } from '../db/contexto.js';
import { ErrorApi } from '../errores.js';
import { NOMBRE_COOKIE, firmarToken, generarCodigoRecuperacion, huellaCodigo, opcionesCookie } from '../auth/tokens.js';
import { requiereRol } from '../middlewares/sesion.js';
import type { Sesion } from '../auth/roles.js';
import { enviarCorreo, escaparHtml, plantillaCorreo } from '../servicios/correo.js';
import {
  contrasena, correo, idPositivo, textoObligatorio, textoOpcional,
} from '../utilidades/esquemas.js';
import { limiteIntentos, perfilPorId } from './auth.js';

/**
 * Empresas coformadoras por invitación:
 *   1. El SuperAdmin o el Gestor Empresas registra el contacto inicial y el sistema le envía un correo.
 *   2. Con el enlace del correo la empresa crea su contraseña y diligencia su información.
 *   3. La empresa queda publicada en el directorio y la cuenta queda con la sesión iniciada.
 */
export const rutasInvitaciones = Router();

const VIGENCIA_DIAS = 7;
export const ASUNTO_INVITACION = 'Estás a un paso de ser parte de nuestra familia Observatorio Empresarial';

const soloGestor = requiereRol('obs_gestor_empresas');

const COLUMNAS = `id_invitacion, nombre_contacto, apellido_contacto, correo, nombre_empresa, id_ec,
  fecha_creacion, fecha_envio, fecha_vencimiento, fecha_completada,
  case when estado = 'Pendiente' and fecha_vencimiento <= now() then 'Vencida' else estado::text end as estado`;

interface DatosCorreo {
  nombre_contacto: string;
  correo: string;
  nombre_empresa: string | null;
}

async function enviarInvitacion(datos: DatosCorreo, codigo: string): Promise<boolean> {
  const enlace = `${config.frontendUrl}/registro-empresa?codigo=${encodeURIComponent(codigo)}`;
  const empresa = datos.nombre_empresa ? ` de ${datos.nombre_empresa}` : '';
  try {
    await enviarCorreo({
      para: datos.correo,
      asunto: ASUNTO_INVITACION,
      texto: `Hola ${datos.nombre_contacto}:\n\n${ASUNTO_INVITACION}.\n\nTe invitamos a registrar la información${empresa} como empresa coformadora de Uniempresarial. En el formulario crearás tu contraseña y completarás los datos de la empresa.\n\nAbre este enlace (vence en ${VIGENCIA_DIAS} días):\n${enlace}`,
      html: plantillaCorreo(
        ASUNTO_INVITACION,
        `<p>Hola ${escaparHtml(datos.nombre_contacto)}:</p>
         <p>Te invitamos a registrar la información${escaparHtml(empresa)} como empresa coformadora de Uniempresarial.
            En el formulario crearás tu contraseña y completarás los datos de la empresa.</p>
         <p><a href="${escaparHtml(enlace)}" style="background:#C8102E;color:#fff;padding:10px 18px;border-radius:20px;text-decoration:none">Completar el registro</a></p>
         <p style="font-size:12px;color:#777">El enlace vence en ${VIGENCIA_DIAS} días.</p>`,
      ),
    });
    return true;
  } catch (error) {
    console.error('[correo] No se pudo enviar la invitación:', error instanceof Error ? error.message : error);
    return false;
  }
}

/** Ninguna invitación puede ir a un correo que ya tiene cuenta. */
async function verificarCorreoLibre(correoInvitado: string) {
  const existe = await conAutenticacion((c) => c.query('select 1 from usuario where correo = $1', [correoInvitado]));
  if (existe.rowCount) throw new ErrorApi(409, 'Ya existe una cuenta con ese correo');
}

// ---------------------------------------------------------------------- Gestión (SuperAdmin y Gestor Empresas)
const esquemaInvitacion = z.object({
  nombre_contacto: textoObligatorio(50),
  apellido_contacto: textoObligatorio(50),
  correo,
  nombre_empresa: textoOpcional(150),
});

rutasInvitaciones.get('/', soloGestor, async (req, res) => {
  const { rows } = await conRol(req.sesion, (c) =>
    c.query(`select ${COLUMNAS} from invitacion_empresa order by fecha_creacion desc, id_invitacion desc`));
  res.json(rows);
});

type DatosInvitacion = z.infer<typeof esquemaInvitacion>;

/** Registra una invitación y envía el correo. Lanza ErrorApi si el correo ya tiene cuenta o invitación pendiente. */
async function crearInvitacion(sesion: Sesion, datos: DatosInvitacion) {
  await verificarCorreoLibre(datos.correo);
  const codigo = generarCodigoRecuperacion();
  const invitacion = await conRol(sesion, async (c) => {
    const pendiente = await c.query(
      "select 1 from invitacion_empresa where correo = $1 and estado = 'Pendiente'",
      [datos.correo],
    );
    if (pendiente.rowCount) throw new ErrorApi(409, 'Ese correo ya tiene una invitación pendiente. Puedes reenviarla.');
    const { rows } = await c.query(
      `insert into invitacion_empresa (nombre_contacto, apellido_contacto, correo, nombre_empresa, token_hash,
                                       fecha_vencimiento, creado_por)
       values ($1, $2, $3, $4, $5, now() + make_interval(days => $6), $7)
       returning ${COLUMNAS}`,
      [datos.nombre_contacto, datos.apellido_contacto, datos.correo, datos.nombre_empresa ?? null,
        huellaCodigo(codigo), VIGENCIA_DIAS, sesion.idUsuario],
    );
    return rows[0];
  });
  const correoEnviado = await enviarInvitacion(invitacion, codigo);
  return { ...invitacion, correo_enviado: correoEnviado };
}

rutasInvitaciones.post('/', soloGestor, async (req, res) => {
  const datos = esquemaInvitacion.parse(req.body);
  res.status(201).json(await crearInvitacion(req.sesion, datos));
});

/**
 * Varias invitaciones a la vez (una por empresa). Cada una se procesa por separado:
 * si una falla (correo con cuenta, repetido...) las demás se envían igual.
 */
export const MAXIMO_LOTE = 50;
rutasInvitaciones.post('/lote', soloGestor, async (req, res) => {
  const { invitaciones } = z
    .object({ invitaciones: z.array(esquemaInvitacion).min(1, 'Agrega al menos una invitación').max(MAXIMO_LOTE, `Máximo ${MAXIMO_LOTE} invitaciones a la vez`) })
    .parse(req.body);
  const vistos = new Set<string>();
  const resultados = [];
  for (const datos of invitaciones) {
    if (vistos.has(datos.correo)) {
      resultados.push({ correo: datos.correo, ok: false, error: 'El correo está repetido en la lista' });
      continue;
    }
    vistos.add(datos.correo);
    try {
      resultados.push({ correo: datos.correo, ok: true, invitacion: await crearInvitacion(req.sesion, datos) });
    } catch (error) {
      if (!(error instanceof ErrorApi)) throw error;
      resultados.push({ correo: datos.correo, ok: false, error: error.message });
    }
  }
  res.json({ enviadas: resultados.filter((r) => r.ok).length, resultados });
});

/** Envía un enlace nuevo (el anterior deja de servir) y renueva el plazo. */
rutasInvitaciones.post('/:id/reenviar', soloGestor, async (req, res) => {
  const id = idPositivo.parse(req.params.id);
  const codigo = generarCodigoRecuperacion();
  const invitacion = await conRol(req.sesion, async (c) => {
    const { rows } = await c.query(
      `update invitacion_empresa
          set token_hash = $2, fecha_envio = now(), fecha_vencimiento = now() + make_interval(days => $3)
        where id_invitacion = $1 and estado = 'Pendiente'
        returning ${COLUMNAS}`,
      [id, huellaCodigo(codigo), VIGENCIA_DIAS],
    );
    if (!rows[0]) throw new ErrorApi(409, 'Solo se pueden reenviar las invitaciones pendientes');
    return rows[0];
  });
  const correoEnviado = await enviarInvitacion(invitacion, codigo);
  res.json({ ...invitacion, correo_enviado: correoEnviado });
});

rutasInvitaciones.post('/:id/anular', soloGestor, async (req, res) => {
  const id = idPositivo.parse(req.params.id);
  const invitacion = await conRol(req.sesion, async (c) => {
    const { rows } = await c.query(
      `update invitacion_empresa set estado = 'Anulada'
        where id_invitacion = $1 and estado = 'Pendiente'
        returning ${COLUMNAS}`,
      [id],
    );
    if (!rows[0]) throw new ErrorApi(409, 'Solo se pueden anular las invitaciones pendientes');
    return rows[0];
  });
  res.json(invitacion);
});

// ---------------------------------------------------------------------- Registro de la empresa (enlace del correo)
const codigoInvitacion = z.string().min(20).max(200);
const ENLACE_INVALIDO = 'El enlace de invitación no es válido, ya se usó o venció. Pide al Observatorio que te envíe uno nuevo.';

/** Datos de la invitación para el formulario (sin sesión). */
rutasInvitaciones.get('/codigo/:codigo', limiteIntentos, async (req, res) => {
  const codigo = codigoInvitacion.parse(req.params.codigo);
  const invitacion = await conAutenticacion(async (c) => {
    const { rows } = await c.query(
      `select nombre_contacto, apellido_contacto, correo, nombre_empresa, fecha_vencimiento
         from invitacion_empresa
        where token_hash = $1 and estado = 'Pendiente' and fecha_vencimiento > now()`,
      [huellaCodigo(codigo)],
    );
    return rows[0];
  });
  if (!invitacion) throw new ErrorApi(404, ENLACE_INVALIDO);
  res.json(invitacion);
});

/** NIT provisional de la empresa mientras completa su ficha (ver la migración del registro corto). */
export const PREFIJO_NIT_PENDIENTE = 'PENDIENTE-';

const esquemaRegistroEmpresa = z.object({
  codigo: codigoInvitacion,
  contrasena,
  acepta_tratamiento_datos: z.literal(true, { message: 'Debes aceptar el tratamiento de datos personales (Ley 1581 de 2012)' }),
});

/**
 * Registro corto: con el enlace del correo la empresa solo crea su contraseña.
 * La ficha nace pendiente (inactiva, con NIT provisional) y la cuenta la completa
 * desde Mi perfil; al guardar el NIT real se publica en el directorio.
 */
rutasInvitaciones.post('/completar', limiteIntentos, async (req, res) => {
  const datos = esquemaRegistroEmpresa.parse(req.body);
  const hash = await bcrypt.hash(datos.contrasena, config.bcryptCosto);

  const resultado = await conAutenticacion(async (c) => {
    const { rows } = await c.query<{
      id_invitacion: number; nombre_contacto: string; apellido_contacto: string; correo: string; nombre_empresa: string | null;
    }>(
      `select id_invitacion, nombre_contacto, apellido_contacto, correo, nombre_empresa from invitacion_empresa
        where token_hash = $1 and estado = 'Pendiente' and fecha_vencimiento > now()
        for update`,
      [huellaCodigo(datos.codigo)],
    );
    const invitacion = rows[0];
    if (!invitacion) throw new ErrorApi(400, ENLACE_INVALIDO);

    const cuenta = await c.query('select 1 from usuario where correo = $1', [invitacion.correo]);
    if (cuenta.rowCount) throw new ErrorApi(409, 'Ya existe una cuenta con el correo de esta invitación. Inicia sesión o recupera tu contraseña.');

    const usuario = await c.query<{ id_usuario: number }>(
      `insert into usuario (nombre_usuario, apellido_usuario, correo, contrasena_hash,
                            acepta_tratamiento_datos, fecha_aceptacion_datos, id_rol)
       values ($1, $2, $3, $4, true, now(), (select id_rol from rol where nombre_rol = 'Empresa Coformadora'))
       returning id_usuario`,
      [invitacion.nombre_contacto, invitacion.apellido_contacto, invitacion.correo, hash],
    );
    const idUsuario = usuario.rows[0]!.id_usuario;

    const contacto = `${invitacion.nombre_contacto} ${invitacion.apellido_contacto}`;
    const empresa = await c.query<{ id_ec: number }>(
      `insert into empresa_coformadora (razon_social, nit, sector_economico, departamento, municipio,
                                        correo, estado_ec, id_usuario, creado_por)
       values ($1, $2, 'Por definir', 'Por definir', 'Por definir', $3, 'Inactivo', $4, $4)
       returning id_ec`,
      [(invitacion.nombre_empresa || `Empresa de ${contacto}`).slice(0, 150), `${PREFIJO_NIT_PENDIENTE}${invitacion.id_invitacion}`,
        invitacion.correo, idUsuario],
    );
    const idEc = empresa.rows[0]!.id_ec;

    await c.query(
      `insert into contacto_empresa (id_ec, nombre, correo, es_principal) values ($1, $2, $3, true)`,
      [idEc, contacto.slice(0, 100), invitacion.correo],
    );
    await c.query(
      `update invitacion_empresa set estado = 'Completada', id_ec = $2, id_usuario = $3, fecha_completada = now()
        where id_invitacion = $1`,
      [invitacion.id_invitacion, idEc, idUsuario],
    );
    return { idUsuario, idEc };
  });

  res.cookie(NOMBRE_COOKIE, firmarToken(resultado.idUsuario), opcionesCookie());
  res.status(201).json({ id_ec: resultado.idEc, usuario: await perfilPorId(resultado.idUsuario) });
});

