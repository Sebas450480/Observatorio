import { describe, expect, it } from 'vitest';
import { PNG_1X1, invitado, sesion } from './ayudas.js';

const nuevaEmpresa = (nit: string, extra: Record<string, unknown> = {}) => ({
  nit,
  razon_social: `Empresa ${nit} S.A.S.`,
  sector_economico: 'Tecnológico',
  departamento: 'Bogotá D.C.',
  municipio: 'Bogotá',
  tamano_empresa: 'Pequeña',
  correo: 'Contacto@Empresa.co',
  ...extra,
});

describe('Empresas Coformadoras', () => {
  it('lista las empresas con sus contactos', async () => {
    const r = await invitado().get('/api/empresas?q=TecnoSoluciones');
    expect(r.status).toBe(200);
    expect(r.body.datos[0]).toMatchObject({ nit: '900.123.456-7', tamano_empresa: 'Mediana' });
    expect(r.body.datos[0].contactos[0]).toMatchObject({ nombre: 'Carlos Restrepo', es_principal: true });
  });

  it('filtra por sector, tamaño y ubicación', async () => {
    const r = await invitado().get('/api/empresas?tamano=Grande');
    expect(r.body.datos.every((e: { tamano_empresa: string }) => e.tamano_empresa === 'Grande')).toBe(true);
    const medellin = await invitado().get('/api/empresas?municipio=medellín');
    expect(medellin.body.total).toBeGreaterThanOrEqual(2);
  });

  it('el gestor crea una empresa, maneja contactos y la bloquea', async () => {
    const { agente } = await sesion('Gestor Empresas Coformadoras');
    const creada = await agente.post('/api/empresas').send(nuevaEmpresa('901.000.001-1'));
    expect(creada.status).toBe(201);
    expect(creada.body.correo).toBe('contacto@empresa.co');
    const id = creada.body.id_ec;

    const c1 = await agente.post(`/api/empresas/${id}/contactos`).send({ nombre: 'Laura', cargo: 'Gerente', es_principal: true });
    expect(c1.status).toBe(201);
    const c2 = await agente.post(`/api/empresas/${id}/contactos`).send({ nombre: 'Pedro', es_principal: true });
    expect(c2.status).toBe(201);

    const detalle = await agente.get(`/api/empresas/${id}`);
    const principales = detalle.body.contactos.filter((c: { es_principal: boolean }) => c.es_principal);
    expect(principales).toHaveLength(1);
    expect(principales[0].nombre).toBe('Pedro');

    expect((await agente.patch(`/api/empresas/${id}/contactos/${c1.body.id_contacto}`).send({ telefono: '3001234567' })).status).toBe(200);
    expect((await agente.delete(`/api/empresas/${id}/contactos/${c1.body.id_contacto}`)).status).toBe(204);

    expect((await agente.patch(`/api/empresas/${id}`).send({ estado_ec: 'Inactivo' })).status).toBe(200);
    expect((await invitado().get(`/api/empresas/${id}`)).status).toBe(404);
  });

  it('rechaza un NIT repetido', async () => {
    const { agente } = await sesion('Gestor Empresas Coformadoras');
    const r = await agente.post('/api/empresas').send(nuevaEmpresa('900.123.456-7'));
    expect(r.status).toBe(409);
  });

  it('sube logo y portada', async () => {
    const { agente } = await sesion('Gestor Empresas Coformadoras');
    const { body } = await agente.post('/api/empresas').send(nuevaEmpresa('901.000.002-2'));
    const logo = await agente.post(`/api/empresas/${body.id_ec}/imagen/logo_ec`).attach('imagen', PNG_1X1, 'logo.png');
    const portada = await agente.post(`/api/empresas/${body.id_ec}/imagen/imagen_portada`).attach('imagen', PNG_1X1, 'p.png');
    expect(logo.status).toBe(201);
    expect(portada.status).toBe(201);
    const detalle = await agente.get(`/api/empresas/${body.id_ec}`);
    expect(detalle.body.logo_ec).toBe(logo.body.logo_ec);
    expect(detalle.body.imagen_portada).toBe(portada.body.imagen_portada);
  });

  it('entrega los contadores del dashboard según el perfil', async () => {
    const publico = await invitado().get('/api/empresas/resumen');
    expect(publico.status).toBe(200);
    expect(publico.body.total).toBe(publico.body.activas);
    expect(publico.body).not.toHaveProperty('inactivas');
    expect(publico.body.por_sector.length).toBeGreaterThan(0);

    const { agente } = await sesion('Gestor Empresas Coformadoras');
    const gestor = await agente.get('/api/empresas/resumen');
    expect(gestor.body).toHaveProperty('inactivas');
    expect(gestor.body.total).toBe(gestor.body.activas + gestor.body.inactivas);
  });

  it('otros perfiles no pueden agregar contactos', async () => {
    const { agente } = await sesion('Usuario');
    expect((await agente.post('/api/empresas/1/contactos').send({ nombre: 'X' })).status).toBe(403);
  });
});
