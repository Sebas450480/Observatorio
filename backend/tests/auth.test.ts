import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { correosDePrueba } from '../src/servicios/correo.js';
import { CONTRASENA, app, crearUsuario, db, invitado } from './ayudas.js';

describe('Salud', () => {
  it('responde con el estado de la base de datos', async () => {
    const r = await invitado().get('/api/salud');
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ estado: 'ok', baseDeDatos: 'ok' });
  });

  it('publica la documentación OpenAPI', async () => {
    const r = await invitado().get('/api/docs.json');
    expect(r.status).toBe(200);
    expect(r.body.openapi).toBe('3.0.3');
  });

  it('responde 404 en rutas que no existen', async () => {
    const r = await invitado().get('/api/no-existe');
    expect(r.status).toBe(404);
  });
});

describe('Registro', () => {
  it('crea la cuenta con rol Usuario, guarda los intereses e inicia sesión', async () => {
    const agente = request.agent(app);
    const r = await agente.post('/api/auth/registro').send({
      nombre_usuario: 'Ana',
      apellido_usuario: 'Pérez',
      correo: 'Ana.Perez@Test.co',
      contrasena: 'Clave-segura-1',
      ciudad: 'Bogotá',
      acepta_tratamiento_datos: true,
      intereses: [1, 2],
    });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ nombre_rol: 'Usuario', correo: 'ana.perez@test.co', frecuencia_alertas: 'Semanal' });
    expect(r.body.intereses).toHaveLength(2);
    expect(r.body).not.toHaveProperty('contrasena_hash');

    const yo = await agente.get('/api/auth/yo');
    expect(yo.status).toBe(200);
    expect(yo.body.correo).toBe('ana.perez@test.co');
  });

  it('rechaza un correo ya registrado (sin distinguir mayúsculas)', async () => {
    const datos = {
      nombre_usuario: 'Ana', apellido_usuario: 'Dos', correo: 'ANA.PEREZ@test.co',
      contrasena: 'Clave-segura-1', acepta_tratamiento_datos: true,
    };
    const r = await invitado().post('/api/auth/registro').send(datos);
    expect(r.status).toBe(409);
  });

  it('exige aceptar el tratamiento de datos y una contraseña de 8 caracteres', async () => {
    const r = await invitado().post('/api/auth/registro').send({
      nombre_usuario: 'X', apellido_usuario: 'Y', correo: 'x@test.co', contrasena: 'corta', acepta_tratamiento_datos: false,
    });
    expect(r.status).toBe(400);
    const campos = r.body.detalles.map((d: { campo: string }) => d.campo);
    expect(campos).toEqual(expect.arrayContaining(['contrasena', 'acepta_tratamiento_datos']));
  });

  it('no permite elegir el rol al registrarse', async () => {
    const r = await invitado().post('/api/auth/registro').send({
      nombre_usuario: 'X', apellido_usuario: 'Y', correo: 'intruso@test.co', contrasena: 'Clave-segura-1',
      acepta_tratamiento_datos: true, id_rol: 1,
    });
    expect(r.status).toBe(201);
    expect(r.body.nombre_rol).toBe('Usuario');
  });
});

describe('Inicio de sesión', () => {
  it('rechaza una contraseña incorrecta', async () => {
    const u = await crearUsuario('Usuario');
    const r = await invitado().post('/api/auth/login').send({ correo: u.correo, contrasena: 'incorrecta' });
    expect(r.status).toBe(401);
  });

  it('rechaza un correo que no existe con el mismo mensaje', async () => {
    const r = await invitado().post('/api/auth/login').send({ correo: 'nadie@test.co', contrasena: 'x' });
    expect(r.status).toBe(401);
    expect(r.body.error).toBe('Correo o contraseña incorrectos');
  });

  it('bloquea una cuenta inactiva, también si ya tenía sesión', async () => {
    const u = await crearUsuario('Usuario');
    const agente = request.agent(app);
    expect((await agente.post('/api/auth/login').send({ correo: u.correo, contrasena: CONTRASENA })).status).toBe(200);

    await db().query("update usuario set estado_usuario = 'Inactivo' where id_usuario = $1", [u.id]);
    expect((await agente.get('/api/auth/yo')).status).toBe(401);
    expect((await invitado().post('/api/auth/login').send({ correo: u.correo, contrasena: CONTRASENA })).status).toBe(403);
  });

  it('acepta el token como Bearer y cierra sesión', async () => {
    const u = await crearUsuario('Usuario');
    const agente = request.agent(app);
    const login = await agente.post('/api/auth/login').send({ correo: u.correo, contrasena: CONTRASENA });
    const token = /obs_sesion=([^;]+)/.exec(String(login.headers['set-cookie']))?.[1];
    expect(token).toBeTruthy();
    expect((await invitado().get('/api/auth/yo').set('Authorization', `Bearer ${token}`)).status).toBe(200);

    expect((await agente.post('/api/auth/logout')).status).toBe(204);
    expect((await agente.get('/api/auth/yo')).status).toBe(401);
  });

  it('un token inválido se atiende como invitado', async () => {
    const r = await invitado().get('/api/flash').set('Authorization', 'Bearer token-falso');
    expect(r.status).toBe(200);
  });
});

describe('Recuperar contraseña', () => {
  it('envía el enlace, permite cambiar la contraseña una sola vez e invalida las sesiones anteriores', async () => {
    const u = await crearUsuario('Usuario');
    const sesionAnterior = request.agent(app);
    await sesionAnterior.post('/api/auth/login').send({ correo: u.correo, contrasena: CONTRASENA });

    correosDePrueba.length = 0;
    const r = await invitado().post('/api/auth/recuperar').send({ correo: u.correo });
    expect(r.status).toBe(200);
    expect(correosDePrueba).toHaveLength(1);
    const codigo = decodeURIComponent(/codigo=([^\s"&]+)/.exec(correosDePrueba[0]!.texto)![1]!);

    // El token emitido en el mismo segundo que el cambio sigue siendo válido; se espera un segundo.
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const cambio = await invitado().post('/api/auth/restablecer').send({ codigo, contrasena: 'Nueva-clave-456' });
    expect(cambio.status).toBe(200);

    expect((await invitado().post('/api/auth/restablecer').send({ codigo, contrasena: 'Otra-clave-789' })).status).toBe(400);
    expect((await invitado().post('/api/auth/login').send({ correo: u.correo, contrasena: 'Nueva-clave-456' })).status).toBe(200);
    expect((await sesionAnterior.get('/api/auth/yo')).status).toBe(401);
  });

  it('responde igual si el correo no existe y no envía nada', async () => {
    correosDePrueba.length = 0;
    const r = await invitado().post('/api/auth/recuperar').send({ correo: 'no-existe@test.co' });
    expect(r.status).toBe(200);
    expect(correosDePrueba).toHaveLength(0);
  });
});
