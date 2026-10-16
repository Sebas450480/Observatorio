import { randomUUID } from 'node:crypto';
import ExcelJS from 'exceljs';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { correosDePrueba } from '../src/servicios/correo.js';
import { ASUNTO_INVITACION } from '../src/modulos/invitaciones.js';
import { PNG_1X1, app, binario, db, invitado, sesion } from './ayudas.js';

async function excel(hoja: string, encabezados: string[], filas: unknown[][]): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  const h = libro.addWorksheet(hoja);
  h.addRow(encabezados);
  filas.forEach((f) => h.addRow(f));
  return Buffer.from(await libro.xlsx.writeBuffer());
}

const unico = () => randomUUID().slice(0, 8);

describe('Carga masiva desde Excel', () => {
  it('cada módulo entrega su plantilla con instrucciones y listas', async () => {
    const casos = [
      ['Gestor Flash Informativo', '/api/flash/plantilla', 'Flash Informativo'],
      ['Gestor Faro', '/api/faro/plantilla', 'Faro'],
      ['Gestor Calendario', '/api/calendario/plantilla', 'Eventos institucionales'],
      ['Gestor Glosario', '/api/glosario/plantilla', 'Glosario'],
      ['Gestor Empresas Coformadoras', '/api/empresas/plantilla', 'Empresas'],
    ] as const;
    for (const [rol, ruta, hoja] of casos) {
      const { agente } = await sesion(rol);
      const r = await agente.get(ruta).buffer(true).parse(binario);
      expect(r.status, ruta).toBe(200);
      const libro = new ExcelJS.Workbook();
      await libro.xlsx.load(r.body as unknown as ArrayBuffer);
      expect(libro.getWorksheet(hoja), ruta).toBeDefined();
      expect(libro.getWorksheet('Instrucciones'), ruta).toBeDefined();
      expect(libro.getWorksheet('Listas'), ruta).toBeDefined();
    }
    const flash = await (await sesion('Gestor Flash Informativo')).agente.get('/api/flash/plantilla').buffer(true).parse(binario);
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(flash.body as unknown as ArrayBuffer);
    const listas = libro.getWorksheet('Listas')!;
    const tipos = (listas.getColumn(1).values as unknown[]).filter(Boolean);
    expect(tipos).toContain('Feria');
    // Solo el gestor del módulo descarga la plantilla.
    const usuario = await sesion('Usuario');
    expect((await usuario.agente.get('/api/flash/plantilla')).status).toBe(403);
  });

  it('Flash: revisa sin guardar, muestra errores por fila y columna y guarda todo junto', async () => {
    const { agente } = await sesion('Gestor Flash Informativo');
    const titulo = `Feria de prueba ${unico()}`;
    const encabezados = ['Título', 'Tipo de evento', 'Fecha de inicio', 'Hora de inicio', 'Modalidad', 'Lugar', 'Enlace', 'Gratuito', 'Costo (COP)', 'Categorías'];
    const conErrores = await excel('Flash Informativo', encabezados, [
      [titulo, 'Feria', new Date(Date.UTC(2026, 10, 20)), '08:30', 'Híbrido', 'Bogotá', 'https://feria.co', 'No', '150.000', 'Tecnología'],
      ['Sin fecha', 'Foro', '', '', 'Virtual'],
      ['Mes sin día', 'Foro', 'Abril de 2026', '', 'Virtual'],
      ['Tipo raro', 'Concierto', '2026-11-21', '', 'Virtual'],
    ]);
    const revision = await agente.post('/api/flash/importar?validar=1').attach('archivo', conErrores, 'flash.xlsx');
    expect(revision.status).toBe(200);
    expect(revision.body.total).toBe(4);
    expect(revision.body.validos).toBe(1);
    expect(revision.body.errores).toEqual([
      { fila: 3, columna: 'Fecha de inicio', mensaje: 'Es obligatorio' },
      { fila: 4, columna: 'Fecha de inicio', mensaje: expect.stringContaining('DD/MM/AAAA') },
      { fila: 5, columna: 'Tipo de evento', mensaje: expect.stringContaining('Valor no permitido') },
    ]);

    const rechazado = await agente.post('/api/flash/importar').attach('archivo', conErrores, 'flash.xlsx');
    expect(rechazado.status).toBe(422);
    expect((await invitado().get(`/api/flash?q=${encodeURIComponent(titulo)}`)).body.total).toBe(0);

    const valido = await excel('Flash Informativo', encabezados, [
      [titulo, 'Feria', '20/11/2026', '08:30', 'Híbrido', 'Bogotá', 'https://feria.co', 'No', '150.000', 'Tecnología'],
    ]);
    const vista = await agente.post('/api/flash/importar?validar=true').attach('archivo', valido, 'flash.xlsx');
    expect(vista.body).toMatchObject({ total: 1, validos: 1, errores: [], registros: [{ fila: 2, resumen: `${titulo} · 2026-11-20` }] });
    const guardado = await agente.post('/api/flash/importar').attach('archivo', valido, 'flash.xlsx');
    expect(guardado.status).toBe(201);
    expect(guardado.body).toMatchObject({ importados: 1 });
    const creado = (await invitado().get(`/api/flash?q=${encodeURIComponent(titulo)}`)).body.datos[0];
    expect(creado).toMatchObject({ tipo_evento: 'Feria', modalidad: 'Hibrido', costo: 150000, es_gratuito: false });
    expect(new Date(creado.fecha_inicio).toISOString()).toBe('2026-11-20T13:30:00.000Z');
    expect(creado.categorias).toHaveLength(1);
  });

  it('las imágenes son opcionales: la fila nombra el archivo y la respuesta indica dónde subirla', async () => {
    const { agente } = await sesion('Gestor Faro');
    const titulo = `Convocatoria con imagen ${unico()}`;
    const malo = await excel('Faro', ['Título', 'Tipo', 'Imagen'], [[titulo, 'Convocatorias', 'foto.gif']]);
    const revisionMala = await agente.post('/api/faro/importar?validar=1').attach('archivo', malo, 'f.xlsx');
    expect(revisionMala.body.errores).toEqual([{ fila: 2, columna: 'Imagen', mensaje: expect.stringContaining('.jpg o .png') }]);

    const archivo = await excel('Faro', ['Título', 'Tipo', 'Imagen'], [
      [titulo, 'Convocatorias', 'C:\\fotos\\convocatoria.PNG'],
      [`${titulo} sin imagen`, 'Cursos', ''],
    ]);
    const revision = await agente.post('/api/faro/importar?validar=1').attach('archivo', archivo, 'f.xlsx');
    expect(revision.body.registros.map((r: { imagenes: object }) => r.imagenes)).toEqual([{ imagen: 'convocatoria.PNG' }, {}]);
    const r = await agente.post('/api/faro/importar').attach('archivo', archivo, 'f.xlsx');
    expect(r.status).toBe(201);
    expect(r.body.creados).toEqual([
      { fila: 2, id: expect.any(Number), imagenes: { imagen: 'convocatoria.PNG' } },
      { fila: 3, id: expect.any(Number), imagenes: {} },
    ]);
    const subida = await agente.post(`/api/faro/${r.body.creados[0].id}/imagen/imagen`).attach('imagen', PNG_1X1, 'convocatoria.PNG');
    expect(subida.status).toBe(201);
  });

  it('rechaza más de 50 registros y archivos sin la estructura de la plantilla', async () => {
    const { agente } = await sesion('Gestor Glosario');
    const muchos = await excel('Glosario', ['Término', 'Definición'], Array.from({ length: 51 }, (_, i) => [`T${i}`, 'D']));
    const r = await agente.post('/api/glosario/importar').attach('archivo', muchos, 'g.xlsx');
    expect(r.status).toBe(422);
    expect(r.body.mensaje ?? r.body.error).toMatch(/50/);
    const otro = await excel('Glosario', ['Columna A'], [['x']]);
    expect((await agente.post('/api/glosario/importar').attach('archivo', otro, 'g.xlsx')).status).toBe(422);
  });

  it('Glosario: quita los dos puntos del término y detecta repetidos y existentes', async () => {
    const { agente } = await sesion('Gestor Glosario');
    const termino = `Término masivo ${unico()}`;
    await db().query("insert into glosario_termino (termino, definicion) values ('Ya existente masivo', 'x') on conflict do nothing");
    const archivo = await excel('Glosario', ['Término', 'Definición', 'Fuente'], [
      [`${termino}:`, 'Definición de prueba', 'Política'],
      [termino, 'Repetido', ''],
      ['ya existente masivo', 'Existe', ''],
    ]);
    const r = await agente.post('/api/glosario/importar?validar=1').attach('archivo', archivo, 'g.xlsx');
    expect(r.body.errores.map((e: { fila: number }) => e.fila)).toEqual([3, 4]);
    const solo = await excel('Glosario', ['Término', 'Definición'], [[`${termino}:`, 'Definición de prueba']]);
    expect((await agente.post('/api/glosario/importar').attach('archivo', solo, 'g.xlsx')).status).toBe(201);
    const { rows } = await db().query('select termino from glosario_termino where termino = $1', [termino]);
    expect(rows).toHaveLength(1);
  });

  it('Faro guarda "Dirigida a" y Eventos acepta el tipo Feria', async () => {
    const faro = await sesion('Gestor Faro');
    const titulo = `Beca masiva ${unico()}`;
    const archivoFaro = await excel('Faro', ['Título', 'Tipo', 'Entidad', 'Dirigida a', 'Fecha de cierre'], [
      [titulo, 'Becas', 'Swedish Institute', 'Profesionales con experiencia laboral', '25/02/2030'],
    ]);
    expect((await faro.agente.post('/api/faro/importar').attach('archivo', archivoFaro, 'f.xlsx')).status).toBe(201);
    const beca = (await invitado().get(`/api/faro?q=${encodeURIComponent(titulo)}`)).body.datos[0];
    expect(beca).toMatchObject({ dirigida_a: 'Profesionales con experiencia laboral', fecha_cierre: '2030-02-25' });

    const eventos = await sesion('Gestor Calendario');
    const evento = `Feria institucional ${unico()}`;
    const archivoEventos = await excel('Eventos institucionales', ['Título', 'Tipo de evento', 'Fecha de inicio', 'Modalidad', 'Gratuito'], [
      [evento, 'Feria', '20/11/2026', 'Presencial', 'Sí'],
    ]);
    expect((await eventos.agente.post('/api/calendario/importar').attach('archivo', archivoEventos, 'e.xlsx')).status).toBe(201);
    const creado = (await invitado().get(`/api/calendario?q=${encodeURIComponent(evento)}`)).body.datos[0];
    expect(creado).toMatchObject({ tipo_evento: 'Feria', es_gratuito: true });
  });

  it('Empresas: exige el contacto, crea la empresa inactiva, invita y la publica al completar la ficha', async () => {
    const { agente } = await sesion('Gestor Empresas Coformadoras');
    const correo = `precargada.${unico()}@test.co`;
    const nit = `PRE-${unico()}`;
    const encabezados = ['Nombres del contacto', 'Apellidos del contacto', 'Correo del contacto', 'Celular del contacto', 'Cargo del contacto',
      'Razón social', 'NIT', 'Sector económico', 'Tamaño', 'Departamento', 'Municipio'];
    const sinContacto = await excel('Empresas', encabezados, [['', '', '', '', '', 'Sin contacto S.A.S.']]);
    const revision = await agente.post('/api/empresas/importar?validar=1').attach('archivo', sinContacto, 'e.xlsx');
    expect(revision.body.errores.map((e: { columna: string }) => e.columna)).toEqual([
      'Nombres del contacto', 'Apellidos del contacto', 'Correo del contacto', 'Celular del contacto',
    ]);

    const archivo = await excel('Empresas', encabezados, [
      ['Sandra', 'Guerrero', correo, 3001234567, 'Gestión Humana', 'Precargada S.A.S.', nit, 'Software y TI', 'Microempresa', 'Cundinamarca', 'Bogotá'],
    ]);
    const r = await agente.post('/api/empresas/importar').attach('archivo', archivo, 'e.xlsx');
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ importados: 1, invitaciones_enviadas: 1, correos_fallidos: [] });

    const { rows } = await db().query(
      `select e.id_ec, e.estado_ec, e.ficha_pendiente, e.tamano_empresa, e.id_usuario,
              (select count(*)::int from contacto_empresa c where c.id_ec = e.id_ec and c.es_principal and c.telefono = '3001234567') as contactos,
              (select i.estado from invitacion_empresa i where i.id_ec = e.id_ec) as invitacion
         from empresa_coformadora e where e.nit = $1`,
      [nit],
    );
    expect(rows[0]).toMatchObject({ estado_ec: 'Inactivo', ficha_pendiente: true, tamano_empresa: 'Micro', id_usuario: null, contactos: 1, invitacion: 'Pendiente' });
    expect((await invitado().get(`/api/empresas/${rows[0].id_ec}`)).status).toBe(404);

    // El mismo correo no se puede volver a cargar (ya tiene invitación pendiente).
    const otraVez = await agente.post('/api/empresas/importar?validar=1').attach('archivo', archivo, 'e.xlsx');
    expect(otraVez.body.errores.map((e: { mensaje: string }) => e.mensaje)).toEqual(['Ya existe una empresa con ese NIT', 'Ese correo ya tiene una invitación pendiente']);

    // La empresa crea su contraseña con el enlace: la cuenta queda ligada a la empresa precargada.
    const enviado = correosDePrueba.filter((c) => c.para === correo && c.asunto === ASUNTO_INVITACION).at(-1);
    const codigo = decodeURIComponent(enviado!.texto.match(/registro-empresa\?codigo=([\w%-]+)/)![1]!);
    const empresa = request.agent(app);
    const registro = await empresa.post('/api/invitaciones/completar').send({ codigo, contrasena: 'Clave-empresa-123', acepta_tratamiento_datos: true });
    expect(registro.status).toBe(201);
    expect(registro.body.id_ec).toBe(rows[0].id_ec);
    const mia = await empresa.get('/api/mi-empresa');
    expect(mia.body).toMatchObject({ razon_social: 'Precargada S.A.S.', nit, pendiente: true, estado_ec: 'Inactivo' });

    // Al guardar su ficha con los datos obligatorios queda publicada.
    const ficha = await empresa.patch('/api/mi-empresa').send({ descripcion: 'Ficha completa' });
    expect(ficha.status).toBe(200);
    expect(ficha.body).toMatchObject({ pendiente: false, estado_ec: 'Activo' });
    expect((await invitado().get(`/api/empresas/${rows[0].id_ec}`)).status).toBe(200);
  });

  it('Empresas: sin datos de la empresa queda pendiente hasta completar los obligatorios', async () => {
    const { agente } = await sesion('Gestor Empresas Coformadoras');
    const correo = `solo.contacto.${unico()}@test.co`;
    const archivo = await excel('Empresas', ['Nombres del contacto', 'Apellidos del contacto', 'Correo del contacto', 'Celular del contacto'], [
      ['Luis', 'Pérez', correo, '3100000000'],
    ]);
    expect((await agente.post('/api/empresas/importar').attach('archivo', archivo, 'e.xlsx')).status).toBe(201);
    const { rows } = await db().query(
      `select e.nit, e.razon_social, e.sector_economico from empresa_coformadora e
         join invitacion_empresa i on i.id_ec = e.id_ec where i.correo = $1`,
      [correo],
    );
    expect(rows[0].nit).toMatch(/^PENDIENTE-/);
    expect(rows[0]).toMatchObject({ razon_social: 'Empresa de Luis Pérez', sector_economico: 'Por definir' });
  });
});
