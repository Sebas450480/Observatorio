import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { CONTRASENA, app, crearUsuario, invitado, sesion } from './ayudas.js';

describe('Mi perfil', () => {
  it('cada usuario ve y edita su perfil e intereses', async () => {
    const { agente } = await sesion('Usuario');
    const editado = await agente.patch('/api/perfil').send({ ciudad: 'Medellín', apodo_usuario: 'Ana', frecuencia_alertas: 'Inmediata' });
    expect(editado.status).toBe(200);
    expect(editado.body).toMatchObject({ ciudad: 'Medellín', apodo_usuario: 'Ana', frecuencia_alertas: 'Inmediata' });

    const intereses = await agente.put('/api/perfil/intereses').send({ intereses: [1, 3, 9999] });
    expect(intereses.status).toBe(200);
    expect(intereses.body.intereses.map((i: { id_categoria: number }) => i.id_categoria).sort()).toEqual([1, 3]);
  });

  it('no permite cambiar el rol ni el estado desde Mi perfil', async () => {
    const { agente } = await sesion('Usuario');
    const r = await agente.patch('/api/perfil').send({ id_rol: 1, estado_usuario: 'Activo' });
    expect(r.status).toBe(400);
    expect((await agente.get('/api/perfil')).body.nombre_rol).toBe('Usuario');
  });

  it('cambia la contraseña verificando la actual', async () => {
    const { agente, usuario } = await sesion('Gestor Calendario');
    expect((await agente.put('/api/perfil/contrasena').send({ actual: 'mala', nueva: 'Nueva-clave-123' })).status).toBe(400);
    await new Promise((r) => setTimeout(r, 1100));
    expect((await agente.put('/api/perfil/contrasena').send({ actual: CONTRASENA, nueva: 'Nueva-clave-123' })).status).toBe(200);
    // La sesión actual recibe un token nuevo y sigue funcionando.
    expect((await agente.get('/api/perfil')).status).toBe(200);
    const login = await invitado().post('/api/auth/login').send({ correo: usuario.correo, contrasena: 'Nueva-clave-123' });
    expect(login.status).toBe(200);
  });

  it('exige sesión', async () => {
    expect((await invitado().get('/api/perfil')).status).toBe(401);
  });
});

describe('Gestión de usuarios (SuperAdmin)', () => {
  it('lista y filtra usuarios sin exponer contraseñas', async () => {
    await crearUsuario('Usuario', { ciudad: 'Cali' });
    const { agente } = await sesion('SuperAdmin');
    const r = await agente.get('/api/usuarios?ciudad=cali');
    expect(r.status).toBe(200);
    expect(r.body.total).toBeGreaterThanOrEqual(1);
    expect(r.body.datos[0]).not.toHaveProperty('contrasena_hash');
  });

  it('crea un gestor y le cambia el rol; el cambio aplica de inmediato', async () => {
    const { agente: admin } = await sesion('SuperAdmin');
    const roles = await admin.get('/api/roles');
    const idRol = (nombre: string) => roles.body.find((r: { nombre_rol: string }) => r.nombre_rol === nombre).id_rol;

    const creado = await admin.post('/api/usuarios').send({
      nombre_usuario: 'Gestora', apellido_usuario: 'Faro', correo: 'gestora.faro@test.co', contrasena: 'Clave-segura-1',
      id_rol: idRol('Gestor Faro Empresarial'), acepta_tratamiento_datos: true,
    });
    expect(creado.status).toBe(201);
    expect(creado.body.nombre_rol).toBe('Gestor Faro Empresarial');

    const gestora = request.agent(app);
    await gestora.post('/api/auth/login').send({ correo: 'gestora.faro@test.co', contrasena: 'Clave-segura-1' });
    expect((await gestora.post('/api/faro').send({ titulo: 'Beca', tipo: 'Becas' })).status).toBe(201);

    await admin.patch(`/api/usuarios/${creado.body.id_usuario}`).send({ id_rol: idRol('Usuario') });
    expect((await gestora.post('/api/faro').send({ titulo: 'Beca 2', tipo: 'Becas' })).status).toBe(403);
  });

  it('el SuperAdmin no puede quitarse su rol ni eliminarse', async () => {
    const { agente, usuario } = await sesion('SuperAdmin');
    expect((await agente.patch(`/api/usuarios/${usuario.id}`).send({ estado_usuario: 'Inactivo' })).status).toBe(400);
    expect((await agente.delete(`/api/usuarios/${usuario.id}`)).status).toBe(400);
  });

  it('un SuperAdmin no puede cambiarle el rol a un SuperAdmin Superior, eliminarlo ni asignar ese rol', async () => {
    const { agente: admin } = await sesion('SuperAdmin');
    const { agente: superior } = await sesion('SuperAdmin Superior');
    const protegido = await crearUsuario('SuperAdmin Superior');
    const roles = (await admin.get('/api/roles')).body as { id_rol: number; nombre_rol: string }[];
    const idRol = (nombre: string) => roles.find((r) => r.nombre_rol === nombre)!.id_rol;

    expect((await admin.patch(`/api/usuarios/${protegido.id}`).send({ id_rol: idRol('Usuario') })).status).toBe(403);
    expect((await admin.patch(`/api/usuarios/${protegido.id}`).send({ estado_usuario: 'Inactivo' })).status).toBe(403);
    expect((await admin.delete(`/api/usuarios/${protegido.id}`)).status).toBe(403);
    const otro = await crearUsuario('Usuario');
    expect((await admin.patch(`/api/usuarios/${otro.id}`).send({ id_rol: idRol('SuperAdmin Superior') })).status).toBe(403);

    // El SuperAdmin Superior sí puede, y tiene las funciones del SuperAdmin.
    expect((await superior.patch(`/api/usuarios/${otro.id}`).send({ id_rol: idRol('SuperAdmin Superior') })).status).toBe(200);
    expect((await superior.patch(`/api/usuarios/${protegido.id}`).send({ estado_usuario: 'Inactivo' })).status).toBe(200);
    expect((await superior.get('/api/usuarios')).status).toBe(200);
  });

  it('otros perfiles no acceden a la gestión de usuarios', async () => {
    const { agente } = await sesion('Gestor Tendencias');
    expect((await agente.get('/api/usuarios')).status).toBe(403);
    expect((await invitado().get('/api/usuarios')).status).toBe(401);
  });
});

describe('Catálogos', () => {
  it('roles y categorías son públicos; los gestores crean categorías y solo el SuperAdmin las modifica', async () => {
    expect((await invitado().get('/api/roles')).body).toHaveLength(8);
    expect((await invitado().get('/api/categorias')).body.length).toBeGreaterThanOrEqual(18);

    const { agente: usuario } = await sesion('Usuario');
    expect((await usuario.post('/api/categorias').send({ nombre_categoria: 'Robótica' })).status).toBe(403);

    const { agente: gestor } = await sesion('Gestor Tendencias');
    const deGestor = await gestor.post('/api/categorias').send({ nombre_categoria: 'Biotecnología' });
    expect(deGestor.status).toBe(201);
    expect((await gestor.delete(`/api/categorias/${deGestor.body.id_categoria}`)).status).toBe(403);

    const { agente: admin } = await sesion('SuperAdmin');
    const creada = await admin.post('/api/categorias').send({ nombre_categoria: 'Robótica' });
    expect(creada.status).toBe(201);
    expect((await admin.post('/api/categorias').send({ nombre_categoria: 'Robótica' })).status).toBe(409);
    // Sin distinguir mayúsculas, minúsculas ni tildes.
    const variante = await admin.post('/api/categorias').send({ nombre_categoria: '  ROBOTICA ' });
    expect(variante.status).toBe(409);
    expect(variante.body.error).toContain('ya está creada');
    expect((await admin.patch(`/api/categorias/${creada.body.id_categoria}`).send({ nombre_categoria: 'Robótica industrial' })).status).toBe(200);
    expect((await admin.delete(`/api/categorias/${creada.body.id_categoria}`)).status).toBe(204);
  });
});
