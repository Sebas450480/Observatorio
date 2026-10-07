import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { conRol } from '../db/contexto.js';
import { ErrorApi } from '../errores.js';
import { requiereSesion } from '../middlewares/sesion.js';
import { NOMBRE_COOKIE, firmarToken, opcionesCookie } from '../auth/tokens.js';
import { FRECUENCIAS_ALERTA, contrasena, correo, listaIds, textoObligatorio, textoOpcional } from '../utilidades/esquemas.js';
import { obtenerPerfil } from './auth.js';

/** Mi perfil: cada usuario registrado consulta y edita sus propios datos. */
export const rutasPerfil = Router();
rutasPerfil.use(requiereSesion);

rutasPerfil.get('/', async (req, res) => {
  res.json(await obtenerPerfil(req.sesion));
});

const esquemaPerfil = z.object({
  apodo_usuario: textoOpcional(20),
  nombre_usuario: textoObligatorio(50),
  apellido_usuario: textoObligatorio(50),
  correo,
  ciudad: textoOpcional(60),
  frecuencia_alertas: z.enum(FRECUENCIAS_ALERTA),
}).partial();

rutasPerfil.patch('/', async (req, res) => {
  const datos = esquemaPerfil.parse(req.body);
  const entradas = Object.entries(datos).filter(([, v]) => v !== undefined);
  if (!entradas.length) throw new ErrorApi(400, 'No se enviaron cambios');

  await conRol(req.sesion, async (c) => {
    await c.query(
      `update usuario set ${entradas.map(([col], i) => `${col} = $${i + 2}`).join(', ')} where id_usuario = $1`,
      [req.sesion.idUsuario, ...entradas.map(([, v]) => v)],
    );
  });
  res.json(await obtenerPerfil(req.sesion));
});

rutasPerfil.put('/intereses', async (req, res) => {
  const { intereses } = z.object({ intereses: listaIds }).parse(req.body);
  await conRol(req.sesion, async (c) => {
    await c.query('delete from usuario_interes where id_usuario = $1', [req.sesion.idUsuario]);
    if (intereses.length) {
      await c.query(
        `insert into usuario_interes (id_usuario, id_categoria)
         select $1, id_categoria from categoria where id_categoria = any($2::int[])`,
        [req.sesion.idUsuario, intereses],
      );
    }
  });
  res.json(await obtenerPerfil(req.sesion));
});

rutasPerfil.put('/contrasena', async (req, res) => {
  const datos = z.object({ actual: z.string().min(1).max(200), nueva: contrasena }).parse(req.body);

  await conRol(req.sesion, async (c) => {
    const { rows } = await c.query<{ contrasena_hash: string }>(
      'select contrasena_hash from usuario where id_usuario = $1',
      [req.sesion.idUsuario],
    );
    if (!rows[0] || !(await bcrypt.compare(datos.actual, rows[0].contrasena_hash))) {
      throw new ErrorApi(400, 'La contraseña actual no es correcta');
    }
    const hash = await bcrypt.hash(datos.nueva, config.bcryptCosto);
    await c.query('update usuario set contrasena_hash = $1, fecha_cambio_contrasena = now() where id_usuario = $2', [
      hash,
      req.sesion.idUsuario,
    ]);
  });

  // Las demás sesiones abiertas quedan cerradas; esta recibe un token nuevo.
  res.cookie(NOMBRE_COOKIE, firmarToken(req.sesion.idUsuario!), opcionesCookie());
  res.json({ mensaje: 'Contraseña actualizada' });
});
