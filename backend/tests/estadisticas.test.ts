import { describe, expect, it } from 'vitest';
import { correosDePrueba } from '../src/servicios/correo.js';
import { ejecutarAlertas, ejecutarEnvioDiario, ejecutarRecordatorios } from '../src/servicios/alertas.js';
import { crearUsuario, db, invitado, sesion } from './ayudas.js';

describe('Actividad y estadísticas', () => {
  it('registra vistas de invitados y de usuarios, y el SuperAdmin las ve en el panel', async () => {
    expect((await invitado().post('/api/actividad').send({ tipo_contenido: 'Flash', id_contenido: 1, accion: 'Vista' })).status).toBe(201);
    const { agente: usuario } = await sesion('Usuario');
    await usuario.post('/api/actividad').send({ tipo_contenido: 'Flash', id_contenido: 1, accion: 'Vista' });
    await usuario.post('/api/actividad').send({ tipo_contenido: 'Faro', id_contenido: 1, accion: 'Clic_acceder' });

    const { agente: admin } = await sesion('Gestor Observatorio');
    const resumen = await admin.get('/api/estadisticas/resumen');
    expect(resumen.status).toBe(200);
    expect(resumen.body.visitas_mes).toBeGreaterThanOrEqual(2);
    expect(resumen.body.clics_acceder_mes).toBeGreaterThanOrEqual(1);

    const top = await admin.get('/api/estadisticas/top-contenidos');
    expect(top.body[0]).toMatchObject({ tipo_contenido: 'Flash', id_contenido: 1 });
    expect(top.body[0].titulo).toBeTruthy();

    for (const ruta of ['modulos', 'ciudades', 'intereses']) {
      expect((await admin.get(`/api/estadisticas/${ruta}`)).status).toBe(200);
    }
  });

  it('valida la actividad y protege el panel', async () => {
    expect((await invitado().post('/api/actividad').send({ tipo_contenido: 'Otro', id_contenido: 1, accion: 'Vista' })).status).toBe(400);
    const { agente } = await sesion('Gestor Flash Informativo');
    expect((await agente.get('/api/estadisticas/resumen')).status).toBe(403);
  });
});

describe('Alertas por correo', () => {
  it('envía las novedades según los intereses y registra la apertura', async () => {
    const interesado = await crearUsuario('Usuario', { frecuencia: 'Inmediata' });
    await db().query("update usuario set fecha_registro = now() - interval '1 hour' where id_usuario = $1", [interesado.id]);
    await db().query(
      "insert into usuario_interes (id_usuario, id_categoria) select $1, id_categoria from categoria where nombre_categoria = 'Finanzas'",
      [interesado.id],
    );
    const sinAlertas = await crearUsuario('Usuario', { frecuencia: 'Ninguna' });

    const { agente: gestor } = await sesion('Gestor Flash Informativo');
    const finanzas = (await invitado().get('/api/categorias')).body.find((c: { nombre_categoria: string }) => c.nombre_categoria === 'Finanzas');
    const tecnologia = (await invitado().get('/api/categorias')).body.find((c: { nombre_categoria: string }) => c.nombre_categoria === 'Tecnología');
    const base = { fecha_inicio: '2026-12-10T08:00:00-05:00', modalidad: 'Virtual', tipo_evento: 'Foro' };
    await gestor.post('/api/flash').send({ ...base, titulo: 'Foro de inversión ángel', categorias: [finanzas.id_categoria] });
    await gestor.post('/api/flash').send({ ...base, titulo: 'Foro de robótica', categorias: [tecnologia.id_categoria] });
    await gestor.post('/api/flash').send({ ...base, titulo: 'Foro oculto de finanzas', categorias: [finanzas.id_categoria], estado_fi: 'Inactivo' });

    correosDePrueba.length = 0;
    const resultado = await ejecutarAlertas('Inmediata');
    expect(resultado.errores).toBe(0);

    const correo = correosDePrueba.find((c) => c.para === interesado.correo);
    expect(correo).toBeDefined();
    expect(correo!.texto).toContain('Foro de inversión ángel');
    expect(correo!.texto).not.toContain('Foro de robótica');
    expect(correo!.texto).not.toContain('Foro oculto de finanzas');
    expect(correosDePrueba.find((c) => c.para === sinAlertas.correo)).toBeUndefined();

    // Una segunda ejecución no repite lo ya enviado.
    correosDePrueba.length = 0;
    await ejecutarAlertas('Inmediata');
    expect(correosDePrueba.find((c) => c.para === interesado.correo)).toBeUndefined();

    // Apertura del correo con la imagen invisible.
    const pixel = /\/api\/alertas\/abierto\/(\d+)\/([\w-]+)/.exec(correo!.html)!;
    expect((await invitado().get(`/api/alertas/abierto/${pixel[1]}/firma-falsa`)).status).toBe(200);
    let envio = await db().query('select fecha_apertura from envio_alerta where id_envio = $1', [pixel[1]]);
    expect(envio.rows[0].fecha_apertura).toBeNull();

    const abierto = await invitado().get(`/api/alertas/abierto/${pixel[1]}/${pixel[2]}`);
    expect(abierto.status).toBe(200);
    expect(abierto.headers['content-type']).toBe('image/gif');
    envio = await db().query('select fecha_apertura from envio_alerta where id_envio = $1', [pixel[1]]);
    expect(envio.rows[0].fecha_apertura).not.toBeNull();
  });

  it('envía recordatorios de los eventos favoritos una semana antes y el mismo día, una sola vez', async () => {
    const usuario = await crearUsuario('Usuario', { frecuencia: 'Ninguna' });
    const silenciado = await crearUsuario('Usuario', { frecuencia: 'Ninguna' });
    await db().query('update usuario set recordatorios_eventos = false where id_usuario = $1', [silenciado.id]);

    // Fechas en hora de Bogotá: hoy a las 6 p. m., en 7 días y en 3 días.
    const enDias = (dias: number) => `((now() at time zone 'America/Bogota')::date + ${dias} + time '18:00') at time zone 'America/Bogota'`;
    const flash = async (titulo: string, dias: number) =>
      (await db().query<{ id_fi: number }>(
        `insert into flash_informativo (titulo, fecha_inicio, modalidad, tipo_evento) values ($1, ${enDias(dias)}, 'Virtual', 'Foro') returning id_fi`,
        [titulo],
      )).rows[0]!.id_fi;
    const hoy = await flash('Foro de hoy', 0);
    const semana = await flash('Foro en una semana', 7);
    const otro = await flash('Foro en tres días', 3);
    const evento = (await db().query<{ id_evento: number }>(
      `insert into calendario_eventos (titulo, fecha_inicio, modalidad, tipo_evento) values ('Evento institucional de hoy', ${enDias(0)}, 'Presencial', 'Foro') returning id_evento`,
    )).rows[0]!.id_evento;
    for (const u of [usuario, silenciado]) {
      await db().query(
        `insert into favorito (id_usuario, tipo_contenido, id_contenido)
         values ($1, 'Flash', $2), ($1, 'Flash', $3), ($1, 'Flash', $4), ($1, 'Evento', $5)`,
        [u.id, hoy, semana, otro, evento],
      );
    }

    correosDePrueba.length = 0;
    const r = await ejecutarRecordatorios();
    expect(r.errores).toBe(0);
    const asuntos = correosDePrueba.filter((c) => c.para === usuario.correo).map((c) => c.asunto).sort();
    expect(asuntos).toEqual([
      'Recordatorio: Hoy es «Evento institucional de hoy»',
      'Recordatorio: Hoy es «Foro de hoy»',
      'Recordatorio: «Foro en una semana» es en una semana',
    ]);
    expect(correosDePrueba.find((c) => c.para === silenciado.correo)).toBeUndefined();

    // No se repiten.
    correosDePrueba.length = 0;
    await ejecutarRecordatorios();
    expect(correosDePrueba.find((c) => c.para === usuario.correo)).toBeUndefined();
  });

  it('el boletín diario incluye las empresas nuevas y el envío diario corre todas las tareas', async () => {
    const diario = await crearUsuario('Usuario', { frecuencia: 'Diaria' });
    await db().query("update usuario set fecha_registro = now() - interval '2 hours' where id_usuario = $1", [diario.id]);
    await db().query(
      `insert into empresa_coformadora (nit, razon_social, nombre_comercial, sector_economico, departamento, municipio)
       values ('BOL-' || floor(random() * 1e9)::text, 'Empresa Nueva S.A.S.', 'Empresa Nueva', 'Comercio', 'Bogotá D.C.', 'Bogotá')`,
    );
    correosDePrueba.length = 0;
    // Un martes: corre el boletín inmediato, el diario y los recordatorios, pero no el semanal.
    const resultado = await ejecutarEnvioDiario(new Date('2026-10-20T13:00:00Z'));
    expect(Object.keys(resultado)).toEqual(['Inmediata', 'Diaria', 'Recordatorios']);
    const correo = correosDePrueba.find((c) => c.para === diario.correo);
    expect(correo?.texto).toContain('Nueva empresa coformadora: Empresa Nueva');
    // Un lunes también corre el semanal.
    expect(Object.keys(await ejecutarEnvioDiario(new Date('2026-10-19T13:00:00Z')))).toContain('Semanal');
  });

  it('el SuperAdmin puede ejecutar el envío manualmente', async () => {
    const { agente } = await sesion('Gestor Observatorio');
    const r = await agente.post('/api/alertas/ejecutar').send({ frecuencia: 'Semanal' });
    expect(r.status).toBe(200);
    expect(r.body).toHaveProperty('enviados');
    const { agente: usuario } = await sesion('Usuario');
    expect((await usuario.post('/api/alertas/ejecutar').send({ frecuencia: 'Semanal' })).status).toBe(403);
  });

  it('Vercel Cron ejecuta el envío solo con el secreto correcto', async () => {
    const ruta = '/api/alertas/cron?frecuencia=Inmediata';
    const r = await invitado().get(ruta).set('Authorization', 'Bearer secreto-cron-de-pruebas-1234');
    expect(r.status).toBe(200);
    expect(r.body).toHaveProperty('enviados');
    const todo = await invitado().get('/api/alertas/cron').set('Authorization', 'Bearer secreto-cron-de-pruebas-1234');
    expect(todo.status).toBe(200);
    expect(todo.body).toHaveProperty('Recordatorios');
    expect((await invitado().get(ruta)).status).toBe(404);
    expect((await invitado().get(ruta).set('Authorization', 'Bearer otro-secreto-de-prueba-00')).status).toBe(404);
    const { agente } = await sesion('Gestor Observatorio');
    expect((await agente.get(ruta)).status).toBe(404);
  });
});

describe('Panel de estadísticas', () => {
  it('entrega las tarjetas del resumen con contenidos por módulo', async () => {
    const { agente } = await sesion('Gestor Observatorio');
    const r = await agente.get('/api/estadisticas/panel');
    expect(r.status).toBe(200);
    expect(r.body.usuarios.total).toBeGreaterThan(0);
    const c = r.body.contenidos;
    expect(c.total).toBe(c.flash + c.faro + c.eventos + c.tendencias);
    expect(c.flash).toBeGreaterThanOrEqual(6);
    expect(r.body.visitas).toHaveProperty('variacion_pct');
    expect(r.body.suscriptores).toHaveProperty('tasa_apertura_pct');
  });

  it('solo lo ve el SuperAdmin', async () => {
    const { agente } = await sesion('Usuario');
    expect((await agente.get('/api/estadisticas/panel')).status).toBe(403);
  });
});

describe('Búsqueda global', () => {
  it('busca en todos los módulos a la vez', async () => {
    const r = await invitado().get('/api/buscar?q=innovación');
    expect(r.status).toBe(200);
    const tipos = new Set(r.body.resultados.map((x: { tipo: string }) => x.tipo));
    expect(tipos.has('Flash')).toBe(true);
    expect(tipos.has('Evento')).toBe(true);
    expect(r.body.resultados[0]).toHaveProperty('titulo');
  });

  it('no muestra registros inactivos a un invitado, pero sí al gestor', async () => {
    const { agente } = await sesion('Gestor Faro');
    await agente.post('/api/faro').send({ titulo: 'Convocatoria secreta zafiro', tipo: 'Convocatorias', estado_fe: 'Inactivo' });
    expect((await invitado().get('/api/buscar?q=zafiro')).body.total).toBe(0);
    expect((await agente.get('/api/buscar?q=zafiro')).body.total).toBe(1);
  });

  it('exige al menos 2 caracteres', async () => {
    expect((await invitado().get('/api/buscar?q=a')).status).toBe(400);
  });
});
