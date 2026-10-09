import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { binario, invitado, sesion } from './ayudas.js';

const ENCABEZADOS = [
  'Megatendencia',
  'Tendencia',
  'Descripción',
  'Comportamiento en el mundo',
  'Comportamiento en Colombia',
  'Fecha de publicación (AAAA-MM-DD)',
  'Fuentes (Nombre | enlace; separadas por punto y coma)',
  'Categorías (separadas por coma)',
];

async function excel(filas: unknown[][], encabezados = ENCABEZADOS): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet('Tendencias');
  hoja.addRow(encabezados);
  filas.forEach((f) => hoja.addRow(f));
  return Buffer.from(await libro.xlsx.writeBuffer());
}

describe('Tendencias', () => {
  it('lista tendencias con fuentes y número de menciones', async () => {
    const r = await invitado().get('/api/tendencias?q=IA generativa');
    expect(r.status).toBe(200);
    const ia = r.body.datos.find((t: { tendencia: string }) => t.tendencia === 'IA generativa');
    expect(ia.fuentes).toHaveLength(3);
    expect(ia.menciones).toBeGreaterThan(0);
  });

  it('filtra por fecha de publicación', async () => {
    const todas = await invitado().get('/api/tendencias?limite=100');
    const futuras = await invitado().get('/api/tendencias?desde=2999-01-01');
    expect(futuras.status).toBe(200);
    expect(futuras.body.total).toBe(0);
    expect(todas.body.total).toBeGreaterThan(0);
    expect((await invitado().get('/api/tendencias?desde=ayer')).status).toBe(400);
  });

  it('entrega los datos del mapa por periodo y el Top 5', async () => {
    const mapa = await invitado().get('/api/tendencias/mapa?periodo=anio');
    expect(mapa.status).toBe(200);
    expect(mapa.body.periodo).toBe('anio');
    expect(mapa.body.megatendencias.length).toBe(4);
    expect(mapa.body.tendencias.length).toBeGreaterThanOrEqual(15);

    const top = await invitado().get('/api/tendencias/top5');
    expect(top.status).toBe(200);
    expect(top.body.length).toBeLessThanOrEqual(5);

    expect((await invitado().get('/api/tendencias/mapa?periodo=siglo')).status).toBe(400);
  });

  it('el gestor crea una tendencia con fuentes y registra menciones', async () => {
    const { agente } = await sesion('Gestor Tendencias');
    const creada = await agente.post('/api/tendencias').send({
      megatendencia: 'Tecnología y sociedad',
      tendencia: 'Computación cuántica',
      categorias: [1],
      fuentes: [{ nombre: 'IBM Research', link: 'https://research.ibm.com' }, { nombre: 'Informe interno' }],
    });
    expect(creada.status).toBe(201);
    expect(creada.body.fuentes).toHaveLength(2);

    const editada = await agente.patch(`/api/tendencias/${creada.body.id_te}`).send({ fuentes: [{ nombre: 'Solo una' }] });
    expect(editada.body.fuentes).toHaveLength(1);

    const mencion = await agente.post(`/api/tendencias/${creada.body.id_te}/menciones`).send({ fuente: 'Prensa' });
    expect(mencion.status).toBe(201);
    const detalle = await agente.get(`/api/tendencias/${creada.body.id_te}`);
    expect(detalle.body.menciones).toBe(1);

    const repetida = await agente.post('/api/tendencias').send({ megatendencia: 'Tecnología y sociedad', tendencia: 'Computación cuántica' });
    expect(repetida.status).toBe(409);
  });

  it('descarga la plantilla de importación', async () => {
    const { agente } = await sesion('Gestor Tendencias');
    const r = await agente.get('/api/tendencias/plantilla').buffer(true).parse(binario);
    expect(r.status).toBe(200);
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(r.body as unknown as ArrayBuffer);
    expect((libro.getWorksheet('Tendencias')!.getRow(1).values as unknown[]).filter(Boolean)).toEqual(ENCABEZADOS);
  });

  it('importa un Excel válido completo', async () => {
    const { agente } = await sesion('Gestor Tendencias');
    const archivo = await excel([
      ['Economía y trabajo', 'Semana laboral de 4 días', 'Pilotos de reducción de jornada', 'Crece en Europa', 'Debate en Colombia',
        '2026-10-01', 'OIT | https://www.ilo.org; Prensa', 'Empresarial, Talento humano'],
      ['Medio ambiente y sostenibilidad', 'Hidrógeno verde', '', '', '', '', '', ''],
    ]);
    const r = await agente.post('/api/tendencias/importar').attach('archivo', archivo, 'tendencias.xlsx');
    expect(r.status).toBe(201);
    expect(r.body).toEqual({ importadas: 2 });

    const busqueda = await invitado().get('/api/tendencias?q=Semana laboral');
    const t = busqueda.body.datos[0];
    expect(t.fuentes.map((f: { nombre: string }) => f.nombre)).toEqual(['OIT', 'Prensa']);
    expect(t.categorias).toHaveLength(2);
  });

  it('une las megatendencias escritas con otras mayúsculas o sin tildes', async () => {
    const { agente } = await sesion('Gestor Tendencias');
    const archivo = await excel([
      ['ECONOMIA Y TRABAJO', 'Trabajo por proyectos', '', '', '', '', '', 'empresarial'],
      ['Nueva megatendencia', 'Primera', '', '', '', '', '', ''],
      ['nueva megatendéncia', 'Segunda', '', '', '', '', '', ''],
    ]);
    const r = await agente.post('/api/tendencias/importar').attach('archivo', archivo, 'tendencias.xlsx');
    expect(r.status).toBe(201);
    const megas = (await invitado().get('/api/tendencias/megatendencias')).body as string[];
    expect(megas).toContain('Economía y trabajo');
    expect(megas).not.toContain('ECONOMIA Y TRABAJO');
    expect(megas.filter((m) => m.toLowerCase().startsWith('nueva megatend'))).toEqual(['Nueva megatendencia']);
  });

  it('rechaza todo el archivo si una fila tiene errores', async () => {
    const { agente } = await sesion('Gestor Tendencias');
    const archivo = await excel([
      ['Economía y trabajo', 'Tendencia válida que no debe quedar', '', '', '', '', '', ''],
      ['', 'Sin megatendencia', '', '', '', '', '', ''],
      ['Tecnología y sociedad', 'IA generativa', '', '', '', '', '', ''],
      ['Economía y trabajo', 'Con categoría falsa', '', '', '', '', '', 'Categoría inventada'],
      ['Economía y trabajo', 'Fecha mala', '', '', '', '2026-13-45', '', ''],
    ]);
    const r = await agente.post('/api/tendencias/importar').attach('archivo', archivo, 'tendencias.xlsx');
    expect(r.status).toBe(422);
    expect(r.body.detalles.errores.map((e: { fila: number }) => e.fila)).toEqual([3, 4, 5, 6]);

    const busqueda = await invitado().get('/api/tendencias?q=no debe quedar');
    expect(busqueda.body.total).toBe(0);
  });

  it('rechaza archivos con otra estructura o que no son Excel', async () => {
    const { agente } = await sesion('Gestor Tendencias');
    const otro = await excel([['a', 'b']], ['Columna A', 'Columna B']);
    const r1 = await agente.post('/api/tendencias/importar').attach('archivo', otro, 'otro.xlsx');
    expect(r1.status).toBe(422);
    const r2 = await agente.post('/api/tendencias/importar').attach('archivo', Buffer.from('a,b,c'), 'datos.csv');
    expect(r2.status).toBe(415);
  });

  it('solo el gestor de tendencias importa', async () => {
    const { agente } = await sesion('Gestor Flash Informativo');
    const r = await agente.post('/api/tendencias/importar').attach('archivo', await excel([]), 'x.xlsx');
    expect(r.status).toBe(403);
  });
});
