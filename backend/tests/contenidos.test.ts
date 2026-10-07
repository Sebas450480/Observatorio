import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { PNG_1X1, binario, db, invitado, sesion } from './ayudas.js';

const nuevoFlash = (titulo: string, extra: Record<string, unknown> = {}) => ({
  titulo,
  fecha_inicio: '2026-11-20T08:00:00-05:00',
  fecha_fin: '2026-11-20T17:00:00-05:00',
  modalidad: 'Virtual',
  tipo_evento: 'Foro',
  es_gratuito: true,
  categorias: [1, 2],
  ...extra,
});

describe('Flash Informativo', () => {
  it('el invitado ve los flashes activos sin el campo de estado', async () => {
    const r = await invitado().get('/api/flash');
    expect(r.status).toBe(200);
    expect(r.body.total).toBeGreaterThanOrEqual(6);
    const primero = r.body.datos[0];
    expect(primero).toHaveProperty('titulo');
    expect(primero).toHaveProperty('categorias');
    expect(primero).not.toHaveProperty('estado_fi');
    expect(primero).not.toHaveProperty('creado_por');
  });

  it('el gestor crea, edita y elimina; el invitado no ve los inactivos', async () => {
    const { agente, usuario } = await sesion('Gestor Flash Informativo');

    const creado = await agente.post('/api/flash').send(nuevoFlash('Feria de prueba'));
    expect(creado.status).toBe(201);
    expect(creado.body).toMatchObject({ titulo: 'Feria de prueba', estado_fi: 'Activo', creado_por: usuario.id });
    expect(creado.body.categorias).toHaveLength(2);
    const id = creado.body.id_fi;

    const editado = await agente.patch(`/api/flash/${id}`).send({ estado_fi: 'Inactivo', categorias: [3] });
    expect(editado.status).toBe(200);
    expect(editado.body.estado_fi).toBe('Inactivo');
    expect(editado.body.categorias.map((c: { id_categoria: number }) => c.id_categoria)).toEqual([3]);

    expect((await invitado().get(`/api/flash/${id}`)).status).toBe(404);
    expect((await agente.get(`/api/flash/${id}`)).status).toBe(200);
    const filtrado = await agente.get('/api/flash?estado=Inactivo');
    expect(filtrado.body.datos.map((f: { id_fi: number }) => f.id_fi)).toContain(id);

    expect((await agente.delete(`/api/flash/${id}`)).status).toBe(204);
    expect((await agente.get(`/api/flash/${id}`)).status).toBe(404);
  });

  it('otro gestor, un usuario o un invitado no pueden crear', async () => {
    const { agente: gestorFaro } = await sesion('Gestor Faro Empresarial');
    const { agente: usuario } = await sesion('Usuario');
    expect((await gestorFaro.post('/api/flash').send(nuevoFlash('x'))).status).toBe(403);
    expect((await usuario.post('/api/flash').send(nuevoFlash('x'))).status).toBe(403);
    expect((await invitado().post('/api/flash').send(nuevoFlash('x'))).status).toBe(401);
  });

  it('el SuperAdmin puede gestionar cualquier módulo', async () => {
    const { agente } = await sesion('SuperAdmin');
    const r = await agente.post('/api/flash').send(nuevoFlash('Creado por SuperAdmin'));
    expect(r.status).toBe(201);
  });

  it('valida los datos y las reglas de la base de datos', async () => {
    const { agente } = await sesion('Gestor Flash Informativo');
    const sinTitulo = await agente.post('/api/flash').send(nuevoFlash(''));
    expect(sinTitulo.status).toBe(400);
    const fechas = await agente.post('/api/flash').send(nuevoFlash('Fechas', { fecha_fin: '2026-11-19T08:00:00-05:00' }));
    expect(fechas.status).toBe(400);
    const gratisConCosto = await agente.post('/api/flash').send(nuevoFlash('Costo', { costo: 1000 }));
    expect(gratisConCosto.status).toBe(400);
    const tipo = await agente.post('/api/flash').send(nuevoFlash('Tipo', { tipo_evento: 'Fiesta' }));
    expect(tipo.status).toBe(400);
  });

  it('filtra por tipo, categoría, texto y fechas, y pagina', async () => {
    const tipo = await invitado().get('/api/flash?tipo_evento=Hackathon');
    expect(tipo.body.datos.every((f: { tipo_evento: string }) => f.tipo_evento === 'Hackathon')).toBe(true);

    const finanzas = await invitado().get('/api/flash?categoria=5');
    expect(finanzas.body.total).toBeGreaterThanOrEqual(2);

    const texto = await invitado().get('/api/flash?q=hackathon');
    expect(texto.body.total).toBeGreaterThanOrEqual(1);

    const rango = await invitado().get('/api/flash?desde=2026-10-20&hasta=2026-10-21');
    expect(rango.body.datos.length).toBeGreaterThanOrEqual(2);

    const pagina = await invitado().get('/api/flash?limite=2&pagina=2&orden=titulo');
    expect(pagina.body).toMatchObject({ pagina: 2, limite: 2 });
    expect(pagina.body.datos).toHaveLength(2);

    expect((await invitado().get('/api/flash?limite=500')).status).toBe(400);
  });

  it('sube, reemplaza y quita la imagen; rechaza archivos que no son imágenes', async () => {
    const { agente } = await sesion('Gestor Flash Informativo');
    const { body } = await agente.post('/api/flash').send(nuevoFlash('Con imagen'));

    const subida = await agente.post(`/api/flash/${body.id_fi}/imagen/imagen`).attach('imagen', PNG_1X1, 'foto.png');
    expect(subida.status).toBe(201);
    expect(subida.body.imagen).toMatch(/^\/uploads\/flash\/.+\.png$/);

    const archivo = await invitado().get(subida.body.imagen);
    expect(archivo.status).toBe(200);
    expect(archivo.headers['content-type']).toBe('image/png');

    const falsa = await agente.post(`/api/flash/${body.id_fi}/imagen/imagen`).attach('imagen', Buffer.from('hola'), 'foto.png');
    expect(falsa.status).toBe(415);

    const campo = await agente.post(`/api/flash/${body.id_fi}/imagen/logo`).attach('imagen', PNG_1X1, 'foto.png');
    expect(campo.status).toBe(400);

    expect((await agente.delete(`/api/flash/${body.id_fi}/imagen/imagen`)).status).toBe(204);
    expect((await invitado().get(subida.body.imagen)).status).toBe(404);
  });

  it('exporta a Excel y PDF sin la columna de estado para el invitado', async () => {
    const excel = await invitado().get('/api/flash/exportar?formato=xlsx').buffer(true).parse(binario);
    expect(excel.status).toBe(200);
    expect(excel.headers['content-disposition']).toMatch(/flash-.*\.xlsx/);
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(excel.body as unknown as ArrayBuffer);
    const encabezados = (libro.worksheets[0]!.getRow(1).values as unknown[]).filter(Boolean);
    expect(encabezados).toContain('Título');
    expect(encabezados).not.toContain('Estado');

    const pdf = await invitado().get('/api/flash/exportar?formato=pdf').buffer(true).parse(binario);
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toBe('application/pdf');
    expect(Buffer.from(pdf.body).subarray(0, 4).toString()).toBe('%PDF');
  });
});

describe('Faro Empresarial', () => {
  it('por defecto muestra solo convocatorias vigentes', async () => {
    const { agente } = await sesion('Gestor Faro Empresarial');
    const vencida = await agente.post('/api/faro').send({ titulo: 'Beca vencida', tipo: 'Becas', fecha_cierre: '2020-01-01' });
    expect(vencida.status).toBe(201);

    const vigentes = await invitado().get('/api/faro?limite=100');
    expect(vigentes.body.datos.map((f: { id_fe: number }) => f.id_fe)).not.toContain(vencida.body.id_fe);
    const todas = await invitado().get('/api/faro?vigentes=false&limite=100');
    expect(todas.body.datos.map((f: { id_fe: number }) => f.id_fe)).toContain(vencida.body.id_fe);
  });

  it('filtra por tipo de registro', async () => {
    const r = await invitado().get('/api/faro?tipo=Cursos&vigentes=false');
    expect(r.body.total).toBeGreaterThanOrEqual(2);
    expect(r.body.datos.every((f: { tipo: string }) => f.tipo === 'Cursos')).toBe(true);
  });

  it('el gestor de Flash no ve los registros inactivos del Faro', async () => {
    const { agente: gestorFaro } = await sesion('Gestor Faro Empresarial');
    const { body } = await gestorFaro.post('/api/faro').send({ titulo: 'Taller oculto', tipo: 'Talleres', estado_fe: 'Inactivo' });
    const { agente: gestorFlash } = await sesion('Gestor Flash Informativo');
    expect((await gestorFlash.get(`/api/faro/${body.id_fe}`)).status).toBe(404);
    expect((await gestorFlash.patch(`/api/faro/${body.id_fe}`).send({ titulo: 'x' })).status).toBe(403);
  });
});

describe('Calendario', () => {
  it('devuelve los eventos que se cruzan con el rango de la vista', async () => {
    const r = await invitado().get('/api/calendario?desde=2026-10-12&hasta=2026-10-18');
    const titulos = r.body.datos.map((e: { titulo: string }) => e.titulo);
    expect(titulos).toEqual(expect.arrayContaining(['Talent for Business 2026', 'Congreso de Innovación']));
    expect(titulos).not.toContain('Foro de Emprendimiento');
  });

  it('solo el gestor de calendario crea eventos', async () => {
    const evento = {
      titulo: 'Reunión de egresados', fecha_inicio: '2026-12-01T18:00:00-05:00', modalidad: 'Presencial', tipo_evento: 'Otro',
    };
    const { agente: gestor } = await sesion('Gestor Calendario');
    expect((await gestor.post('/api/calendario').send(evento)).status).toBe(201);
    const { agente: otro } = await sesion('Gestor Tendencias');
    expect((await otro.post('/api/calendario').send(evento)).status).toBe(403);
  });
});

describe('Auditoría', () => {
  it('fecha_actualizacion cambia al editar y creado_por no se puede alterar', async () => {
    const { agente, usuario } = await sesion('Gestor Calendario');
    const { body } = await agente.post('/api/calendario').send({
      titulo: 'Evento auditado', fecha_inicio: '2026-12-02T10:00:00-05:00', modalidad: 'Virtual', tipo_evento: 'Taller',
    });
    await new Promise((r) => setTimeout(r, 20));
    const editado = await agente.patch(`/api/calendario/${body.id_evento}`).send({ titulo: 'Evento auditado 2', creado_por: 1 });
    expect(editado.status).toBe(200);
    expect(new Date(editado.body.fecha_actualizacion).getTime()).toBeGreaterThan(new Date(body.fecha_actualizacion).getTime());
    const { rows } = await db().query('select creado_por from calendario_eventos where id_evento = $1', [body.id_evento]);
    expect(rows[0].creado_por).toBe(usuario.id);
  });
});
