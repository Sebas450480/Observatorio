import bcrypt from 'bcryptjs';
import { Router, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { config } from '../config.js';
import { conAutenticacion, conRol, type Cliente } from '../db/contexto.js';
import { ErrorApi, noAutenticado } from '../errores.js';
import {
  NOMBRE_COOKIE, generarCodigoRecuperacion, guardarSesion, huellaCodigo, opcionesCookie,
} from '../auth/tokens.js';
import { botonCorreo, enviarCorreo, escaparHtml, plantillaCorreo, recuadroCorreo } from '../servicios/correo.js';
import { FRECUENCIAS_ALERTA, contrasena, correo, esquemaPreferencias, interesesFaro, textoObligatorio, textoOpcional, type Preferencias } from '../utilidades/esquemas.js';
import { nombreRolCanonico, nombreRolPrincipal, type Sesion } from '../auth/roles.js';
import { nombresDeRolesValidos, requiereSesion } from '../middlewares/sesion.js';

export const rutasAuth = Router();

/** Limita los intentos para frenar ataques de fuerza bruta. */
export const limiteIntentos = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.esPrueba ? 1000 : config.limiteIntentosAuth,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' },
});

/** Hash usado cuando el correo no existe, para que la respuesta tarde lo mismo. */
const HASH_FALSO = bcrypt.hashSync('contraseña-que-no-existe', 10);

export const COLUMNAS_PERFIL = `u.id_usuario, u.apodo_usuario, u.nombre_usuario, u.apellido_usuario, u.correo,
  u.ciudad, u.frecuencia_alertas, u.recordatorios_eventos, u.fecha_registro, u.estado_usuario, u.id_rol, r.nombre_rol,
  coalesce((select json_agg(json_build_object('id_rol', rr.id_rol, 'nombre_rol', rr.nombre_rol) order by rr.id_rol)
              from usuario_rol ur join rol rr on rr.id_rol = ur.id_rol
             where ur.id_usuario = u.id_usuario), '[]'::json) as roles,
  coalesce((select json_agg(json_build_object('id_categoria', c.id_categoria, 'nombre', c.nombre_categoria)
                            order by c.nombre_categoria)
              from usuario_interes ui join categoria c on c.id_categoria = ui.id_categoria
             where ui.id_usuario = u.id_usuario), '[]'::json) as intereses,
  coalesce((select json_object_agg(p.modulo, p.valores)
              from (select modulo, json_agg(valor order by valor) as valores
                      from usuario_preferencia where id_usuario = u.id_usuario group by modulo) p), '{}'::json) as preferencias`;

/** Perfil del usuario de la sesión (con sus roles, el rol con el que entró y sus intereses). */
export async function obtenerPerfil(sesion: Sesion) {
  return conRol(sesion, async (c) => {
    const { rows } = await c.query(
      `select ${COLUMNAS_PERFIL} from usuario u join rol r on r.id_rol = u.id_rol where u.id_usuario = $1`,
      [sesion.idUsuario],
    );
    return rows[0] && { ...rows[0], rol_activo: sesion.rolActivo };
  });
}

/** Nombres oficiales de los roles de un perfil. */
const nombresDelPerfil = (perfil: { roles: { nombre_rol: string }[] }) => nombresDeRolesValidos(perfil.roles.map((r) => r.nombre_rol));

/** Guarda en la cookie el token de sesión (con el rol elegido) respetando "Recordar sesión". */
function guardarCookieSesion(res: Response, idUsuario: number, rol: string | null, recordar: boolean) {
  guardarSesion(res, idUsuario, { rol, recordar });
}

/** Intereses de Faro (categorías). */
export async function guardarIntereses(c: Cliente, idUsuario: number, intereses: number[]) {
  if (!intereses.length) return;
  await c.query(
    `insert into usuario_interes (id_usuario, id_categoria)
     select $1, id_categoria from categoria where id_categoria = any($2::int[])
     on conflict do nothing`,
    [idUsuario, intereses],
  );
}

/**
 * Intereses de Flash, Empresas y Tendencias: reemplaza los de cada módulo que venga en
 * `preferencias`. En una cuenta nueva no hay nada que borrar (y el rol de autenticación no borra).
 */
export async function guardarPreferencias(c: Cliente, idUsuario: number, preferencias: Preferencias, cuentaNueva = false) {
  for (const [modulo, valores] of Object.entries(preferencias)) {
    if (!valores) continue;
    if (!cuentaNueva) await c.query('delete from usuario_preferencia where id_usuario = $1 and modulo = $2', [idUsuario, modulo]);
    if (valores.length) {
      await c.query(
        `insert into usuario_preferencia (id_usuario, modulo, valor)
         select $1, $2, v from unnest($3::text[]) v on conflict do nothing`,
        [idUsuario, modulo, [...new Set(valores)]],
      );
    }
  }
}

// ---------------------------------------------------------------------- Registro
const esquemaRegistro = z.object({
  // Paso 1: datos
  nombre_usuario: textoObligatorio(50),
  apellido_usuario: textoObligatorio(50),
  apodo_usuario: textoOpcional(20),
  correo,
  contrasena,
  ciudad: textoOpcional(60),
  acepta_tratamiento_datos: z.literal(true, { message: 'Debes aceptar el tratamiento de datos personales (Ley 1581 de 2012)' }),
  // Paso 2: intereses
  intereses: interesesFaro.default([]),
  preferencias: esquemaPreferencias.default({}),
  frecuencia_alertas: z.enum(FRECUENCIAS_ALERTA).optional(),
});

rutasAuth.post('/registro', limiteIntentos, async (req, res) => {
  const datos = esquemaRegistro.parse(req.body);
  const hash = await bcrypt.hash(datos.contrasena, config.bcryptCosto);

  const idUsuario = await conAutenticacion(async (c) => {
    const existe = await c.query('select 1 from usuario where correo = $1', [datos.correo]);
    if (existe.rowCount) throw new ErrorApi(409, 'Ya existe una cuenta con ese correo');

    const { rows } = await c.query<{ id_usuario: number }>(
      `insert into usuario (nombre_usuario, apellido_usuario, apodo_usuario, correo, contrasena_hash, ciudad,
                            frecuencia_alertas, acepta_tratamiento_datos, fecha_aceptacion_datos, id_rol)
       values ($1, $2, $3, $4, $5, $6, coalesce($7::frecuencia_alertas, 'Semanal'), true, now(),
               (select id_rol from rol where nombre_rol = 'Usuario'))
       returning id_usuario`,
      [
        datos.nombre_usuario,
        datos.apellido_usuario,
        datos.apodo_usuario ?? null,
        datos.correo,
        hash,
        datos.ciudad ?? null,
        datos.frecuencia_alertas ?? null,
      ],
    );
    const id = rows[0]!.id_usuario;
    await guardarIntereses(c, id, datos.intereses);
    await guardarPreferencias(c, id, datos.preferencias, true);
    return id;
  });

  guardarSesion(res, idUsuario);
  res.status(201).json(await perfilPorId(idUsuario));
});

// ---------------------------------------------------------------------- Inicio de sesión
const esquemaLogin = z.object({
  correo,
  contrasena: z.string().min(1).max(200),
  /** "Recordar sesión": si es false, la cookie se borra al cerrar el navegador. */
  recordar: z.boolean().default(true),
});

rutasAuth.post('/login', limiteIntentos, async (req, res) => {
  const datos = esquemaLogin.parse(req.body);
  const usuario = await conAutenticacion(async (c) => {
    const { rows } = await c.query<{ id_usuario: number; contrasena_hash: string; estado_usuario: string }>(
      'select id_usuario, contrasena_hash, estado_usuario from usuario where correo = $1',
      [datos.correo],
    );
    return rows[0];
  });

  const correcta = await bcrypt.compare(datos.contrasena, usuario?.contrasena_hash ?? HASH_FALSO);
  if (!usuario || !correcta) throw new ErrorApi(401, 'Correo o contraseña incorrectos');
  if (usuario.estado_usuario !== 'Activo') throw new ErrorApi(403, 'Tu cuenta está inactiva. Contacta al administrador.');

  // Con varios roles entra con el principal; la pantalla le pide elegir con cuál seguir (POST /auth/rol).
  const perfil = await perfilPorId(usuario.id_usuario);
  const nombres = nombresDelPerfil(perfil);
  const rolActivo = nombres.length > 1 ? nombreRolPrincipal(nombres) : null;
  guardarCookieSesion(res, usuario.id_usuario, rolActivo, datos.recordar);
  res.json({ ...perfil, rol_activo: rolActivo });
});

// ---------------------------------------------------------------------- Rol con el que actúa
/** Cuentas con varios roles: elegir (o cambiar) el rol con el que se usa la plataforma. */
rutasAuth.post('/rol', requiereSesion, async (req, res) => {
  const datos = z.object({ rol: z.string().trim().min(1).max(60) }).parse(req.body);
  const idUsuario = req.sesion.idUsuario!;
  const perfil = await perfilPorId(idUsuario);
  const nombres = nombresDelPerfil(perfil);
  const elegido = nombreRolCanonico(datos.rol);
  if (!nombres.includes(elegido)) throw new ErrorApi(400, 'Tu cuenta no tiene ese rol');

  const rolActivo = nombres.length > 1 ? elegido : null;
  guardarCookieSesion(res, idUsuario, rolActivo, req.sesion.recordar);
  res.json({ ...perfil, rol_activo: rolActivo });
});

export async function perfilPorId(idUsuario: number) {
  return conAutenticacion(async (c) => {
    const { rows } = await c.query(
      `select ${COLUMNAS_PERFIL} from usuario u join rol r on r.id_rol = u.id_rol where u.id_usuario = $1`,
      [idUsuario],
    );
    return rows[0];
  });
}

rutasAuth.post('/logout', (_req, res) => {
  const { maxAge: _maxAge, ...opciones } = opcionesCookie();
  res.clearCookie(NOMBRE_COOKIE, opciones);
  res.status(204).end();
});

rutasAuth.get('/yo', async (req, res) => {
  if (req.sesion.idUsuario === null) throw noAutenticado();
  res.json(await obtenerPerfil(req.sesion));
});

// ---------------------------------------------------------------------- Recuperar contraseña
const VIGENCIA_CODIGO_MINUTOS = 60;

/** Correo para restablecer la contraseña (también se usa en los correos de prueba). */
export function correoRecuperacion(nombre: string, enlace: string) {
  return {
    asunto: 'Restablece tu contraseña del Observatorio Empresarial',
    texto: `Hola ${nombre}:\n\nPara crear una nueva contraseña abre este enlace (vence en ${VIGENCIA_CODIGO_MINUTOS} minutos):\n${enlace}\n\nSi no lo solicitaste, ignora este correo.`,
    html: plantillaCorreo(
      'Restablece tu contraseña',
      `<p style="margin:0 0 12px">Hola ${escaparHtml(nombre)}:</p>
       <p style="margin:0 0 12px">Recibimos una solicitud para restablecer la contraseña de tu cuenta del Observatorio Empresarial.</p>
       ${recuadroCorreo(`<strong>Vigencia:</strong> el enlace vence en ${VIGENCIA_CODIGO_MINUTOS} minutos y solo se puede usar una vez.`)}
       ${botonCorreo('Crear nueva contraseña', enlace)}
       <p style="margin:16px 0 0;font-size:13px;color:#6b7280">Si no lo solicitaste, ignora este correo: tu contraseña actual sigue funcionando.</p>`,
      {
        motivo: 'Recibes este correo porque se pidió restablecer la contraseña de tu cuenta en el Observatorio Empresarial.',
        resumen: 'Crea una nueva contraseña para tu cuenta.',
      },
    ),
  };
}

rutasAuth.post('/recuperar', limiteIntentos, async (req, res) => {
  const datos = z.object({ correo }).parse(req.body);

  const envio = await conAutenticacion(async (c) => {
    const { rows } = await c.query<{ id_usuario: number; nombre_usuario: string; correo: string }>(
      "select id_usuario, nombre_usuario, correo from usuario where correo = $1 and estado_usuario = 'Activo'",
      [datos.correo],
    );
    const usuario = rows[0];
    if (!usuario) return null;

    // Solo el último enlace solicitado es válido.
    await c.query('update recuperacion_contrasena set usado = true where id_usuario = $1 and not usado', [usuario.id_usuario]);
    const codigo = generarCodigoRecuperacion();
    await c.query(
      `insert into recuperacion_contrasena (id_usuario, token_hash, fecha_vencimiento)
       values ($1, $2, now() + make_interval(mins => $3))`,
      [usuario.id_usuario, huellaCodigo(codigo), VIGENCIA_CODIGO_MINUTOS],
    );
    return { ...usuario, codigo };
  });

  if (envio) {
    // Si el correo falla se registra el motivo; la respuesta sigue siendo la misma para no revelar qué cuentas existen.
    const enlace = `${config.frontendUrl}/restablecer-contrasena?codigo=${encodeURIComponent(envio.codigo)}`;
    try {
      await enviarCorreo({ para: envio.correo, ...correoRecuperacion(envio.nombre_usuario, enlace) });
    } catch (error) {
      console.error('[correo] No se pudo enviar el enlace de recuperación:', error instanceof Error ? error.message : error);
    }
  }

  // La respuesta es la misma exista o no el correo, para no revelar qué cuentas existen.
  res.json({ mensaje: 'Si el correo está registrado, te enviamos un enlace para restablecer la contraseña.' });
});

rutasAuth.post('/restablecer', limiteIntentos, async (req, res) => {
  const datos = z.object({ codigo: z.string().min(20).max(200), contrasena }).parse(req.body);
  const hash = await bcrypt.hash(datos.contrasena, config.bcryptCosto);

  await conAutenticacion(async (c) => {
    const { rows } = await c.query<{ id_recuperacion: number; id_usuario: number }>(
      `select id_recuperacion, id_usuario from recuperacion_contrasena
        where token_hash = $1 and not usado and fecha_vencimiento > now()
        for update`,
      [huellaCodigo(datos.codigo)],
    );
    const solicitud = rows[0];
    if (!solicitud) throw new ErrorApi(400, 'El enlace no es válido o ya venció. Solicita uno nuevo.');

    await c.query('update usuario set contrasena_hash = $1, fecha_cambio_contrasena = now() where id_usuario = $2', [
      hash,
      solicitud.id_usuario,
    ]);
    await c.query('update recuperacion_contrasena set usado = true where id_recuperacion = $1', [solicitud.id_recuperacion]);
  });

  res.json({ mensaje: 'Contraseña actualizada. Ya puedes iniciar sesión.' });
});
