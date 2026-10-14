import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { correosDePrueba } from '../src/servicios/correo.js';
import { ASUNTO_INVITACION } from '../src/modulos/invitaciones.js';
import { PNG_1X1, app, crearUsuario, db, invitado, sesion } from './ayudas.js';

/** Código del enlace del último correo de invitación enviado a `correo`. */
function codigoDelCorreo(correo: string) {
  const enviado = correosDePrueba.filter((c) => c.para === correo && c.asunto === ASUNTO_INVITACION).at(-1);
  const codigo = enviado?.texto.match(/registro-empresa\?codigo=([\w%-]+)/)?.[1];
  if (!codigo) throw new Error(`No llegó la invitación a ${correo}`);
  return decodeURIComponent(codigo);
}

const nuevoCorreo = () => `empresa.${randomUUID().slice(0, 8)}@test.co`;

const datosEmpresa = (codigo: string, nit = `NIT-${randomUUID().slice(0, 8)}`) => ({
  codigo,
  contrasena: 'Clave-empresa-123',
  acepta_tratamiento_datos: true,
  razon_social: 'Invitada S.A.S.',
  nombre_comercial: 'Invitada',
  nit,
  sector_economico: 'Tecnología',
  descripcion: 'Empresa registrada por invitación.',
  tamano_empresa: 'Pequeña',
  anio_constitucion: 2015,
  departamento: 'Bogotá D.C.',
  municipio: 'Bogotá',
  direccion: 'Cra 7 # 12-34',
  estudiantes_recibidos: 12,
});

async function invitar(agente: ReturnType<typeof request.agent>, correo = nuevoCorreo()) {
  const respuesta = await agente
    .post('/api/invitaciones')
    .send({ nombre_contacto: 'Ana', apellido_contacto: 'Pérez', correo, nombre_empresa: 'Invitada' });
  return { respuesta, correo };
}

describe('Invitaciones a empresas coformadoras', () => {
  it('el gestor invita, la empresa completa el registro y queda publicada con la sesión iniciada', async () => {
    const { agente } = await sesion('Gestor Empresas Coformadoras');
    const { respuesta, correo } = await invitar(agente);
    expect(respuesta.status).toBe(201);
    expect(respuesta.body).toMatchObject({ estado: 'Pendiente', correo, correo_enviado: true });
    expect(respuesta.body).not.toHaveProperty('token_hash');

    const codigo = codigoDelCorreo(correo);
    const datos = await invitado().get(`/api/invitaciones/codigo/${codigo}`);
    expect(datos.status).toBe(200);
    expect(datos.body).toMatchObject({ nombre_contacto: 'Ana', apellido_contacto: 'Pérez', correo, nombre_empresa: 'Invitada' });

    const empresa = request.agent(app);
    const registro = await empresa.post('/api/invitaciones/completar').send(datosEmpresa(codigo));
    expect(registro.status).toBe(201);
    expect(registro.body.usuario).toMatchObject({ correo, nombre_usuario: 'Ana', nombre_rol: 'Empresa Coformadora' });
    const idEc = registro.body.id_ec as number;

    // Sesión iniciada con la cuenta nueva.
    expect((await empresa.get('/api/auth/yo')).body.correo).toBe(correo);

    // Publicada en el directorio, ligada a la cuenta y con el contacto principal.
    const publica = await invitado().get(`/api/empresas/${idEc}`);
    expect(publica.status).toBe(200);
    expect(publica.body).toMatchObject({ razon_social: 'Invitada S.A.S.', estudiantes_recibidos: 12 });
    expect(publica.body).not.toHaveProperty('id_usuario');
    expect(publica.body.contactos).toEqual([expect.objectContaining({ nombre: 'Ana Pérez', correo, es_principal: true })]);
    const { rows } = await db().query('select id_usuario, estado_ec from empresa_coformadora where id_ec = $1', [idEc]);
    expect(rows[0].estado_ec).toBe('Activo');
    expect(rows[0].id_usuario).toBe(registro.body.usuario.id_usuario);

    // La invitación queda completada y el enlace ya no sirve.
    const lista = (await agente.get('/api/invitaciones')).body as { correo: string; estado: string; id_ec: number }[];
    expect(lista.find((i) => i.correo === correo)).toMatchObject({ estado: 'Completada', id_ec: idEc });
    expect((await invitado().get(`/api/invitaciones/codigo/${codigo}`)).status).toBe(404);
    expect((await invitado().post('/api/invitaciones/completar').send(datosEmpresa(codigo))).status).toBe(400);
  });

  it('solo el SuperAdmin y el Gestor Empresas gestionan invitaciones', async () => {
    for (const rol of ['Usuario', 'Gestor Flash'] as const) {
      const { agente } = await sesion(rol);
      expect((await invitar(agente)).respuesta.status).toBe(403);
      expect((await agente.get('/api/invitaciones')).status).toBe(403);
    }
    expect((await invitado().get('/api/invitaciones')).status).toBe(401);
    const { agente } = await sesion('SuperAdmin');
    expect((await invitar(agente)).respuesta.status).toBe(201);
  });

  it('no invita a un correo con cuenta ni duplica invitaciones pendientes', async () => {
    const { agente } = await sesion('SuperAdmin');
    const existente = await crearUsuario('Usuario');
    expect((await invitar(agente, existente.correo)).respuesta.status).toBe(409);

    const { correo } = await invitar(agente);
    const repetida = await invitar(agente, correo);
    expect(repetida.respuesta.status).toBe(409);
    expect(repetida.respuesta.body.error).toMatch(/pendiente/);
  });

  it('reenviar cambia el enlace; anular lo invalida', async () => {
    const { agente } = await sesion('SuperAdmin');
    const { respuesta, correo } = await invitar(agente);
    const id = respuesta.body.id_invitacion as number;
    const primero = codigoDelCorreo(correo);

    expect((await agente.post(`/api/invitaciones/${id}/reenviar`)).status).toBe(200);
    const segundo = codigoDelCorreo(correo);
    expect(segundo).not.toBe(primero);
    expect((await invitado().get(`/api/invitaciones/codigo/${primero}`)).status).toBe(404);
    expect((await invitado().get(`/api/invitaciones/codigo/${segundo}`)).status).toBe(200);

    const anulada = await agente.post(`/api/invitaciones/${id}/anular`);
    expect(anulada.body.estado).toBe('Anulada');
    expect((await invitado().get(`/api/invitaciones/codigo/${segundo}`)).status).toBe(404);
    expect((await agente.post(`/api/invitaciones/${id}/reenviar`)).status).toBe(409);
  });

  it('un enlace vencido no sirve y aparece como Vencida', async () => {
    const { agente } = await sesion('SuperAdmin');
    const { respuesta, correo } = await invitar(agente);
    await db().query("update invitacion_empresa set fecha_vencimiento = now() - interval '1 minute' where id_invitacion = $1", [
      respuesta.body.id_invitacion,
    ]);
    const codigo = codigoDelCorreo(correo);
    expect((await invitado().get(`/api/invitaciones/codigo/${codigo}`)).status).toBe(404);
    expect((await invitado().post('/api/invitaciones/completar').send(datosEmpresa(codigo))).status).toBe(400);
    const lista = (await agente.get('/api/invitaciones')).body as { correo: string; estado: string }[];
    expect(lista.find((i) => i.correo === correo)?.estado).toBe('Vencida');
  });

  it('valida los datos y un NIT repetido no deja nada a medias', async () => {
    const { agente } = await sesion('SuperAdmin');
    const { correo } = await invitar(agente);
    const codigo = codigoDelCorreo(correo);

    const sinDatos = await invitado().post('/api/invitaciones/completar').send({ codigo, contrasena: 'corta' });
    expect(sinDatos.status).toBe(400);

    const { rows } = await db().query<{ nit: string }>(
      `insert into empresa_coformadora (nit, razon_social, sector_economico, departamento, municipio)
       values ('NIT-' || floor(random() * 1e9)::text, 'Ya existe', 'Comercio', 'Bogotá D.C.', 'Bogotá') returning nit`,
    );
    const repetido = await invitado().post('/api/invitaciones/completar').send(datosEmpresa(codigo, rows[0]!.nit));
    expect(repetido.status).toBe(409);
    const cuenta = await db().query('select 1 from usuario where correo = $1', [correo]);
    expect(cuenta.rowCount).toBe(0);
    // El enlace sigue sirviendo para corregir el dato.
    expect((await invitado().post('/api/invitaciones/completar').send(datosEmpresa(codigo))).status).toBe(201);
  });
});

describe('Invitaciones en lote', () => {
  it('envía varias a la vez y reporta las que fallan sin detener las demás', async () => {
    const { agente } = await sesion('Gestor Empresas Coformadoras');
    const existente = await crearUsuario('Usuario');
    const [a, b] = [nuevoCorreo(), nuevoCorreo()];
    const fila = (correo: string, empresa: string) => ({ nombre_contacto: 'Ana', apellido_contacto: 'Pérez', correo, nombre_empresa: empresa });
    const respuesta = await agente.post('/api/invitaciones/lote').send({
      invitaciones: [fila(a, 'Uno'), fila(b, 'Dos'), fila(a.toUpperCase(), 'Repetida'), fila(existente.correo, 'Con cuenta')],
    });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.enviadas).toBe(2);
    expect(respuesta.body.resultados.map((r: { ok: boolean }) => r.ok)).toEqual([true, true, false, false]);
    expect(respuesta.body.resultados[2].error).toMatch(/repetido/);
    expect(respuesta.body.resultados[3].error).toMatch(/cuenta/);
    expect(codigoDelCorreo(a)).toBeTruthy();
    expect(codigoDelCorreo(b)).toBeTruthy();
  });

  it('valida la lista y solo la usan los gestores de empresas', async () => {
    const { agente } = await sesion('SuperAdmin');
    expect((await agente.post('/api/invitaciones/lote').send({ invitaciones: [] })).status).toBe(400);
    const { agente: usuario } = await sesion('Usuario');
    expect((await usuario.post('/api/invitaciones/lote').send({ invitaciones: [] })).status).toBe(403);
  });
});

describe('Mi empresa (rol Empresa Coformadora)', () => {
  async function empresaRegistrada() {
    const { agente: gestor } = await sesion('SuperAdmin');
    const { correo } = await invitar(gestor);
    const empresa = request.agent(app);
    const registro = await empresa.post('/api/invitaciones/completar').send(datosEmpresa(codigoDelCorreo(correo)));
    return { empresa, correo, idEc: registro.body.id_ec as number };
  }

  it('ve y edita su empresa en cualquier momento, con el correo de la invitación', async () => {
    const { empresa, correo, idEc } = await empresaRegistrada();
    const mia = await empresa.get('/api/mi-empresa');
    expect(mia.status).toBe(200);
    expect(mia.body).toMatchObject({ id_ec: idEc, razon_social: 'Invitada S.A.S.', correo_cuenta: correo });

    const edicion = await empresa.patch('/api/mi-empresa').send({ descripcion: 'Nueva descripción', estudiantes_recibidos: 30, link: 'https://invitada.co' });
    expect(edicion.status).toBe(200);
    expect((await invitado().get(`/api/empresas/${idEc}`)).body).toMatchObject({ descripcion: 'Nueva descripción', estudiantes_recibidos: 30 });

    // No puede cambiar el estado ni editar otras empresas por la API general.
    expect((await empresa.patch('/api/mi-empresa').send({ estado_ec: 'Inactivo' })).body.estado_ec).toBe('Activo');
    expect((await empresa.patch(`/api/empresas/${idEc}`).send({ descripcion: 'x' })).status).toBe(403);

    // Sigue teniendo lo de un usuario: favoritos.
    expect((await empresa.put(`/api/favoritos/Empresa/${idEc}`)).status).toBe(200);
  });

  it('sube su logo y su portada', async () => {
    const { empresa } = await empresaRegistrada();
    const logo = await empresa.post('/api/mi-empresa/imagen/logo_ec').attach('imagen', PNG_1X1, 'logo.png');
    expect(logo.status).toBe(201);
    expect((await empresa.get('/api/mi-empresa')).body.logo_ec).toBe(logo.body.logo_ec);
    expect((await empresa.delete('/api/mi-empresa/imagen/logo_ec')).status).toBe(204);
    expect((await empresa.post('/api/mi-empresa/imagen/otro').attach('imagen', PNG_1X1, 'x.png')).status).toBe(400);
  });

  it('las demás cuentas no tienen esta sección', async () => {
    for (const rol of ['Usuario', 'SuperAdmin', 'Gestor Empresas Coformadoras'] as const) {
      const { agente } = await sesion(rol);
      expect((await agente.get('/api/mi-empresa')).status).toBe(403);
    }
    expect((await invitado().get('/api/mi-empresa')).status).toBe(401);
    // Un SuperAdmin puede asignar el rol a una cuenta sin empresa: ve el aviso.
    const { agente } = await sesion('Empresa Coformadora');
    expect((await agente.get('/api/mi-empresa')).status).toBe(404);
  });
});
