import { describe, expect, it } from 'vitest';
import { CONTRASENA, app, crearUsuario, db, invitado, sesion } from './ayudas.js';
import request from 'supertest';

const nuevoFlash = (titulo: string) => ({
  titulo,
  fecha_inicio: '2026-11-20T08:00:00-05:00',
  modalidad: 'Virtual',
  tipo_evento: 'Foro',
  es_gratuito: true,
});

async function idRol(nombre: string) {
  const { rows } = await db().query<{ id_rol: number }>('select id_rol from rol where nombre_rol = $1', [nombre]);
  return rows[0]!.id_rol;
}

async function entrar(correo: string) {
  const agente = request.agent(app);
  const r = await agente.post('/api/auth/login').send({ correo, contrasena: CONTRASENA });
  if (r.status !== 200) throw new Error(r.text);
  return { agente, perfil: r.body };
}

describe('Varios roles por cuenta', () => {
  it('el administrador asigna varios roles y la cuenta entra con uno y puede cambiar a otro', async () => {
    const { agente: admin } = await sesion('Gestor Observatorio');
    const cuenta = await crearUsuario('Usuario');
    const roles = [await idRol('Gestor Flash Informativo'), await idRol('Gestor Faro'), await idRol('Usuario')];
    const editado = await admin.patch(`/api/usuarios/${cuenta.id}`).send({ roles });
    expect(editado.status).toBe(200);
    expect(editado.body.roles.map((r: { nombre_rol: string }) => r.nombre_rol).sort()).toEqual(['Gestor Faro', 'Gestor Flash Informativo', 'Usuario']);
    // El principal es el de más alcance.
    expect(editado.body.nombre_rol).toBe('Gestor Faro');

    const { agente, perfil } = await entrar(cuenta.correo);
    expect(perfil.roles).toHaveLength(3);
    // Entra con el rol principal y actúa solo con él.
    expect(perfil.rol_activo).toBe('Gestor Faro');
    expect((await agente.post('/api/faro').send({ titulo: 'Beca de gestor doble', tipo: 'Becas' })).status).toBe(201);
    expect((await agente.post('/api/flash').send(nuevoFlash('Sin el rol elegido'))).status).toBe(403);

    // Cambia al rol Gestor Flash: ahora gestiona Flash y ya no Faro.
    const cambio = await agente.post('/api/auth/rol').send({ rol: 'Gestor Flash Informativo' });
    expect(cambio.status).toBe(200);
    expect(cambio.body.rol_activo).toBe('Gestor Flash Informativo');
    expect((await agente.get('/api/auth/yo')).body.rol_activo).toBe('Gestor Flash Informativo');
    expect((await agente.post('/api/flash').send(nuevoFlash('Flash de gestor doble'))).status).toBe(201);
    expect((await agente.post('/api/faro').send({ titulo: 'Ya no', tipo: 'Becas' })).status).toBe(403);
    // Solo lectura en los módulos que no gestiona.
    expect((await agente.get('/api/tendencias')).status).toBe(200);
    expect((await agente.post('/api/calendario').send({ titulo: 'x' })).status).toBe(403);
    // Ve los registros inactivos solo en sus módulos.
    await agente.post('/api/flash').send({ ...nuevoFlash('Flash oculto'), estado_fi: 'Inactivo' });
    const lista = await agente.get('/api/flash?estado=Inactivo&limite=100');
    expect(lista.body.datos.some((f: { titulo: string }) => f.titulo === 'Flash oculto')).toBe(true);

    // Solo puede elegir roles que tiene.
    expect((await agente.post('/api/auth/rol').send({ rol: 'Gestor Tendencias' })).status).toBe(400);
    expect((await agente.post('/api/auth/rol').send({ rol: 'Super Admin' })).status).toBe(400);

    // Quitar roles aplica de inmediato.
    expect((await admin.patch(`/api/usuarios/${cuenta.id}`).send({ roles: [await idRol('Usuario')] })).status).toBe(200);
    expect((await agente.post('/api/flash').send(nuevoFlash('Ya no'))).status).toBe(403);
    expect((await agente.get('/api/auth/yo')).body.rol_activo).toBeNull();
  });

  it('una cuenta con un solo rol no elige rol al entrar', async () => {
    const cuenta = await crearUsuario('Usuario');
    const { agente, perfil } = await entrar(cuenta.correo);
    expect(perfil.rol_activo).toBeNull();
    expect((await agente.post('/api/auth/rol').send({ rol: 'Usuario' })).status).toBe(200);
    expect((await invitado().post('/api/auth/rol').send({ rol: 'Usuario' })).status).toBe(401);
  });

  it('una empresa coformadora que además es gestora cambia de rol para usar cada uno', async () => {
    const { agente: admin } = await sesion('Gestor Observatorio');
    const cuenta = await crearUsuario('Empresa Coformadora');
    await db().query(
      `insert into empresa_coformadora (nit, razon_social, sector_economico, departamento, municipio, id_usuario)
       values ('ROL-' || floor(random() * 1e9)::text, 'Empresa gestora', 'Comercio', 'Bogotá D.C.', 'Bogotá', $1)`,
      [cuenta.id],
    );
    await admin.patch(`/api/usuarios/${cuenta.id}`).send({ roles: [await idRol('Empresa Coformadora'), await idRol('Gestor Calendario')] });

    const { agente, perfil } = await entrar(cuenta.correo);
    expect(perfil.rol_activo).toBe('Gestor Calendario');
    // Con el rol Gestor Calendario no edita la empresa.
    expect((await agente.get('/api/mi-empresa')).status).toBe(403);
    await agente.post('/api/auth/rol').send({ rol: 'Empresa Coformadora' });
    expect((await agente.get('/api/mi-empresa')).body.razon_social).toBe('Empresa gestora');
    expect((await agente.patch('/api/mi-empresa').send({ descripcion: 'Editada por la gestora' })).status).toBe(200);
    // Conserva lo de un usuario: favoritos.
    expect((await agente.get('/api/favoritos')).status).toBe(200);
    await agente.post('/api/auth/rol').send({ rol: 'Gestor Calendario' });
    const evento = await agente.post('/api/calendario').send({
      titulo: 'Evento de gestora', fecha_inicio: '2026-11-20T08:00:00-05:00', modalidad: 'Virtual', tipo_evento: 'Foro',
    });
    expect(evento.status).toBe(201);
  });

  it('solo un Super Admin asigna ese rol, aunque venga junto con otros', async () => {
    const { agente: gestorObs } = await sesion('Gestor Observatorio');
    const { agente: superAdmin } = await sesion('Super Admin');
    const cuenta = await crearUsuario('Usuario');
    const conSuper = { roles: [await idRol('Usuario'), await idRol('Super Admin')] };
    expect((await gestorObs.patch(`/api/usuarios/${cuenta.id}`).send(conSuper)).status).toBe(403);
    expect((await superAdmin.patch(`/api/usuarios/${cuenta.id}`).send(conSuper)).status).toBe(200);
    // Ahora la cuenta es Super Admin: el Gestor Observatorio ya no le cambia los roles.
    expect((await gestorObs.patch(`/api/usuarios/${cuenta.id}`).send({ roles: [await idRol('Usuario')] })).status).toBe(403);
  });

  it('valida la lista de roles y filtra por cualquier rol de la cuenta', async () => {
    const { agente: admin } = await sesion('Gestor Observatorio');
    const cuenta = await crearUsuario('Usuario');
    expect((await admin.patch(`/api/usuarios/${cuenta.id}`).send({ roles: [] })).status).toBe(400);
    expect((await admin.patch(`/api/usuarios/${cuenta.id}`).send({ roles: [999999] })).status).toBe(400);

    const tendencias = await idRol('Gestor Tendencias');
    await admin.patch(`/api/usuarios/${cuenta.id}`).send({ roles: [await idRol('Usuario'), tendencias] });
    const filtrado = await admin.get(`/api/usuarios?id_rol=${tendencias}&limite=100`);
    expect(filtrado.body.datos.some((u: { id_usuario: number }) => u.id_usuario === cuenta.id)).toBe(true);

    // Crear una cuenta con varios roles.
    const creada = await admin.post('/api/usuarios').send({
      nombre_usuario: 'Varios', apellido_usuario: 'Roles', correo: `varios.${Date.now()}@test.co`, contrasena: 'Clave-segura-123',
      roles: [await idRol('Gestor Flash Informativo'), await idRol('Gestor Calendario')], acepta_tratamiento_datos: true,
    });
    expect(creada.status).toBe(201);
    expect(creada.body.roles).toHaveLength(2);
  });

  it('el registro público crea cuentas con un solo rol, Usuario', async () => {
    const r = await invitado().post('/api/auth/registro').send({
      nombre_usuario: 'Nuevo', apellido_usuario: 'Registro', correo: `nuevo.${Date.now()}@test.co`,
      contrasena: 'Clave-segura-123', acepta_tratamiento_datos: true,
    });
    expect(r.status).toBe(201);
    expect(r.body.roles).toEqual([expect.objectContaining({ nombre_rol: 'Usuario' })]);
  });
});
