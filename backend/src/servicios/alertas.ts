import cron, { type ScheduledTask } from 'node-cron';
import { config } from '../config.js';
import { comoSistema, type Cliente } from '../db/contexto.js';
import { firmarIdEnvio } from '../auth/tokens.js';
import { botonCorreo, enviarCorreo, escaparHtml, plantillaCorreo, recuadroCorreo } from './correo.js';

/**
 * Correos del Observatorio. Hay dos tipos, separados y con su propio control en Mi perfil:
 *
 * 1. Boletín de novedades (tendencias, contenidos nuevos y empresas coformadoras nuevas),
 *    según la frecuencia elegida:
 *    - Diaria:    todos los días a las 8:00 (hora de Bogotá) con lo publicado en el día.
 *    - Cada2Dias: a las 8:00, un día sí y otro no, con lo publicado en esos dos días.
 *    - Semanal:   los lunes a las 8:00 con lo publicado en la semana.
 *    - Ninguna:   no recibe boletines.
 *    Se incluyen Flash, Faro y Tendencias que coincidan con sus intereses (si no marcó
 *    intereses, recibe todo), los eventos institucionales y las empresas nuevas.
 *
 * 2. Recordatorios de eventos favoritos (Flash y Calendario): una semana antes y el
 *    mismo día del evento, a las 8:00. Se desactivan en Mi perfil.
 *
 * Cada envío queda en la tabla envio_alerta, y una imagen invisible en el correo marca
 * cuándo se abrió.
 */
export type FrecuenciaEnvio = 'Diaria' | 'Cada2Dias' | 'Semanal';
/** Tareas que se pueden ejecutar: un boletín o los recordatorios. */
export type TareaAlertas = FrecuenciaEnvio | 'Recordatorios';

interface Novedad {
  tipo: 'Flash' | 'Faro' | 'Tendencia' | 'Evento' | 'Empresa';
  id: number;
  titulo: string;
  imagen: string | null;
}

const RUTA_FRONTEND: Record<Novedad['tipo'], string> = {
  Flash: 'flash-informativo',
  Faro: 'faro-empresarial',
  Tendencia: 'tendencias',
  Evento: 'eventos',
  Empresa: 'empresas',
};

const ETIQUETA: Record<Novedad['tipo'], string> = {
  Flash: 'Flash Informativo',
  Faro: 'Faro',
  Tendencia: 'Tendencia',
  Evento: 'Evento institucional',
  Empresa: 'Nueva empresa coformadora',
};

/** Fotos de ejemplo (las mismas de la plataforma) para los registros sin imagen. */
const EJEMPLOS = 'https://brobinraqmjepzqnumrq.supabase.co/storage/v1/object/public/imagenes/ejemplos';

/** Máximo de publicaciones por boletín. */
const MAXIMO_BOLETIN = 5;

/** Veces que se le dio "Acceder" a un registro (en la plataforma o desde un correo). */
const clics = (tipo: Novedad['tipo'], columna: string) =>
  `(select count(*) from actividad a where a.tipo_contenido = '${tipo}' and a.id_contenido = ${columna} and a.accion = 'Clic_acceder')::int`;

/**
 * Top 5 de lo publicado después de `desde` que le interesa al usuario: primero lo que más
 * veces se abrió con "Acceder" y, a igualdad (o si aún nadie lo abrió), lo más reciente.
 */
async function buscarNovedades(c: Cliente, idUsuario: number, desde: Date): Promise<Novedad[]> {
  // Coincide con los intereses del usuario, o con todo si no marcó intereses.
  const coincide = (puente: string, columna: string, alias: string) => `
    (not exists (select 1 from usuario_interes where id_usuario = $1)
     or exists (select 1 from ${puente} p join usuario_interes ui on ui.id_categoria = p.id_categoria
                 where p.${columna} = ${alias}.${columna} and ui.id_usuario = $1))`;

  const { rows } = await c.query<Novedad>(
    `select tipo, id, titulo, imagen from (
       select 'Flash' as tipo, f.id_fi as id, f.titulo, coalesce(f.imagen, '${EJEMPLOS}/flash-' || lower(f.tipo_evento::text) || '.jpg?v=2') as imagen,
              ${clics('Flash', 'f.id_fi')} as clics, f.fecha_creacion as fecha
         from flash_informativo f
        where f.estado_fi = 'Activo' and f.fecha_creacion > $2 and ${coincide('flash_informativo_categoria', 'id_fi', 'f')}
       union all
       select 'Faro', fe.id_fe, fe.titulo, coalesce(fe.imagen, '${EJEMPLOS}/faro-' || lower(fe.tipo::text) || '.jpg?v=2'),
              ${clics('Faro', 'fe.id_fe')}, fe.fecha_creacion
         from faro_empresarial fe
        where fe.estado_fe = 'Activo' and fe.fecha_creacion > $2 and ${coincide('faro_empresarial_categoria', 'id_fe', 'fe')}
       union all
       select 'Tendencia', t.id_te, t.tendencia, null, ${clics('Tendencia', 't.id_te')}, t.fecha_creacion
         from tendencia_empresarial t
        where t.estado_te = 'Activo' and t.fecha_creacion > $2 and ${coincide('tendencia_categoria', 'id_te', 't')}
       union all
       select 'Evento', e.id_evento, e.titulo, null, ${clics('Evento', 'e.id_evento')}, e.fecha_creacion
         from calendario_eventos e
        where e.fecha_creacion > $2
       union all
       select 'Empresa', ec.id_ec, coalesce(ec.nombre_comercial, ec.razon_social), coalesce(ec.imagen_portada, '${EJEMPLOS}/empresa-general.jpg?v=2'),
              ${clics('Empresa', 'ec.id_ec')}, ec.fecha_creacion
         from empresa_coformadora ec
        where ec.estado_ec = 'Activo' and ec.fecha_creacion > $2
     ) x
     order by clics desc, fecha desc
     limit ${MAXIMO_BOLETIN}`,
    [idUsuario, desde],
  );
  return rows;
}

/** Las imágenes guardadas en el servidor (/uploads/...) necesitan la dirección completa en un correo. */
function urlImagen(ruta: string | null): string | null {
  if (!ruta) return null;
  if (/^https:\/\//.test(ruta)) return ruta;
  return ruta.startsWith('/') ? `${config.apiUrlPublica}${ruta}` : null;
}

/** Enlace del correo que pasa por la API: cuenta el "Acceder" y lleva al registro. */
const enlaceSeguido = (idEnvio: number, tipo: Novedad['tipo'], id: number) =>
  `${config.apiUrlPublica}/api/alertas/ir/${idEnvio}/${firmarIdEnvio(idEnvio)}/${tipo}/${id}`;

/** Dirección del registro en la plataforma. */
export const enlaceRegistro = (tipo: Novedad['tipo'], id: number) => `${config.frontendUrl}/${RUTA_FRONTEND[tipo]}/${id}`;

/** Tipos de registro a los que lleva un enlace del correo. */
export const TIPOS_REGISTRO = Object.keys(RUTA_FRONTEND) as Novedad['tipo'][];

function armarCorreo(nombre: string, novedades: Novedad[], idEnvio: number) {
  const pixel = `${config.apiUrlPublica}/api/alertas/abierto/${idEnvio}/${firmarIdEnvio(idEnvio)}`;
  const etiqueta = (n: Novedad) =>
    `<span style="display:inline-block;margin-bottom:4px;font-size:11px;font-weight:bold;letter-spacing:.06em;text-transform:uppercase;color:#6b7280">${ETIQUETA[n.tipo]}</span>`;

  // La primera publicación va destacada: foto grande a todo el ancho y título más grande.
  const destacada = (n: Novedad) => {
    const url = escaparHtml(enlaceSeguido(idEnvio, n.tipo, n.id));
    const imagen = urlImagen(n.imagen);
    return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:18px 0 16px;border:1px solid #e5e8ef;border-radius:12px;overflow:hidden">
      ${imagen ? `<tr><td style="padding:0"><a href="${url}"><img src="${escaparHtml(imagen)}" width="640" alt="" style="display:block;width:100%;max-width:640px;height:auto;max-height:300px;object-fit:cover;border:0"></a></td></tr>` : ''}
      <tr><td style="padding:18px 22px 20px">
        ${etiqueta(n)}<br>
        <a href="${url}" style="font-size:20px;line-height:27px;font-weight:bold;color:#1F3A68;text-decoration:none">${escaparHtml(n.titulo)}</a>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:14px"><tr><td bgcolor="#C8102E" style="border-radius:8px">
          <a href="${url}" style="display:inline-block;padding:10px 20px;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none">Ver más →</a>
        </td></tr></table>
      </td></tr></table>`;
  };
  const tarjeta = (n: Novedad) => {
    const url = escaparHtml(enlaceSeguido(idEnvio, n.tipo, n.id));
    const imagen = urlImagen(n.imagen);
    return `<tr><td style="padding:0 0 12px">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #e5e8ef;border-radius:10px;overflow:hidden"><tr>
        ${imagen ? `<td width="124" valign="top" style="width:124px;padding:0"><a href="${url}"><img src="${escaparHtml(imagen)}" width="124" height="92" alt="" style="display:block;width:124px;height:92px;object-fit:cover;border:0"></a></td>` : ''}
        <td valign="middle" style="padding:12px 18px">
          ${etiqueta(n)}<br>
          <a href="${url}" style="font-size:15px;line-height:21px;font-weight:bold;color:#1F3A68;text-decoration:none">${escaparHtml(n.titulo)}</a><br>
          <a href="${url}" style="font-size:13px;color:#C8102E;text-decoration:none">Ver más →</a>
        </td></tr></table>
    </td></tr>`;
  };
  const [primera, ...resto] = novedades;
  return {
    asunto: `Novedades del Observatorio Empresarial (${novedades.length})`,
    html: plantillaCorreo(
      'Nuevas publicaciones para ti',
      `<p style="margin:0 0 4px">Hola ${escaparHtml(nombre)}, esto es lo más destacado en el Observatorio según tus intereses:</p>
       ${primera ? destacada(primera) : ''}
       ${resto.length ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${resto.map(tarjeta).join('')}</table>` : ''}
       ${botonCorreo('Ver todo en el Observatorio', `${config.frontendUrl}/inicio`)}`,
      {
        pixelUrl: pixel,
        motivo: 'Recibes este boletín porque tienes una cuenta en el Observatorio Empresarial. Puedes cambiar su frecuencia o desactivarlo en Mi perfil.',
        resumen: `${novedades.length} ${novedades.length === 1 ? 'publicación destacada' : 'publicaciones destacadas'} para ti.`,
      },
    ),
    texto: `Hola ${nombre}, esto es lo más destacado en el Observatorio Empresarial:\n\n${novedades
      .map((n) => `- ${ETIQUETA[n.tipo]}: ${n.titulo}\n  ${enlaceSeguido(idEnvio, n.tipo, n.id)}`)
      .join('\n')}\n\nPuedes cambiar la frecuencia de este boletín o desactivarlo en Mi perfil.`,
  };
}

/** Envía el boletín de novedades de una frecuencia. Devuelve cuántos correos se enviaron. */
export async function ejecutarAlertas(frecuencia: FrecuenciaEnvio): Promise<{ enviados: number; errores: number }> {
  const destinatarios = await comoSistema(async (c) => {
    const { rows } = await c.query<{ id_usuario: number; nombre_usuario: string; correo: string; desde: Date }>(
      `select u.id_usuario, u.nombre_usuario, u.correo,
              greatest(u.fecha_registro,
                       coalesce((select max(fecha_envio) from envio_alerta ea
                                  where ea.id_usuario = u.id_usuario and ea.tipo_envio = 'Boletin'), '-infinity'),
                       case $1 when 'Semanal' then now() - interval '7 days'
                               when 'Diaria' then now() - interval '1 day'
                               when 'Cada2Dias' then now() - interval '2 days'
                               else '-infinity' end) as desde
         from usuario u
        where u.estado_usuario = 'Activo' and u.frecuencia_alertas = $1::frecuencia_alertas
          -- Cada 2 días: se salta el día siguiente a un boletín (47 h dan margen a la hora del envío).
          and ($1 <> 'Cada2Dias' or not exists (
                select 1 from envio_alerta ea
                 where ea.id_usuario = u.id_usuario and ea.tipo_envio = 'Boletin' and ea.fecha_envio > now() - interval '47 hours'))`,
      [frecuencia],
    );
    return rows;
  });

  let enviados = 0;
  let errores = 0;
  for (const d of destinatarios) {
    try {
      // El registro del envío y el correo van juntos: si el correo falla, no queda registrado.
      const envio = await comoSistema(async (c) => {
        const novedades = await buscarNovedades(c, d.id_usuario, d.desde);
        if (!novedades.length) return false;
        const { rows } = await c.query<{ id_envio: number }>(
          'insert into envio_alerta (id_usuario) values ($1) returning id_envio',
          [d.id_usuario],
        );
        const correo = armarCorreo(d.nombre_usuario, novedades, rows[0]!.id_envio);
        await enviarCorreo({ para: d.correo, ...correo });
        return true;
      });
      if (envio) enviados++;
    } catch (error) {
      errores++;
      console.error(`No se pudo enviar la alerta al usuario ${d.id_usuario}:`, error);
    }
  }
  return { enviados, errores };
}

interface Recordatorio {
  id_usuario: number;
  nombre_usuario: string;
  correo: string;
  tipo: 'Flash' | 'Evento';
  id: number;
  titulo: string;
  fecha_inicio: Date;
  lugar: string | null;
  aviso: 'Semana' | 'Dia';
}

/**
 * Eventos favoritos (Flash activos y eventos del calendario) que empiezan hoy o dentro de
 * 7 días, de usuarios con los recordatorios activos, cuyo recordatorio aún no se envió.
 */
async function buscarRecordatorios(c: Cliente): Promise<Recordatorio[]> {
  const { rows } = await c.query<Recordatorio>(
    `with hoy as (select (now() at time zone $1)::date as dia),
     pendientes as (
       select u.id_usuario, u.nombre_usuario, u.correo, f.tipo_contenido::text as tipo, f.id_contenido as id,
              x.titulo, x.fecha_inicio, x.lugar,
              case when (x.fecha_inicio at time zone $1)::date = hoy.dia then 'Dia' else 'Semana' end as aviso
         from favorito f
         join usuario u on u.id_usuario = f.id_usuario
         cross join hoy
         join lateral (
           select t.titulo, t.fecha_inicio, t.lugar from flash_informativo t
            where f.tipo_contenido = 'Flash' and t.id_fi = f.id_contenido and t.estado_fi = 'Activo'
           union all
           select t.titulo, t.fecha_inicio, t.lugar from calendario_eventos t
            where f.tipo_contenido = 'Evento' and t.id_evento = f.id_contenido
         ) x on true
        where u.estado_usuario = 'Activo' and u.recordatorios_eventos
          and (x.fecha_inicio at time zone $1)::date in (hoy.dia, hoy.dia + 7))
     select p.* from pendientes p
      where not exists (select 1 from envio_alerta ea
                         where ea.tipo_envio = 'Recordatorio' and ea.id_usuario = p.id_usuario
                           and ea.tipo_contenido::text = p.tipo and ea.id_contenido = p.id and ea.aviso::text = p.aviso)
      order by p.id_usuario, p.fecha_inicio`,
    [config.alertas.zonaHoraria],
  );
  return rows;
}

function armarRecordatorio(r: Recordatorio, idEnvio: number) {
  const enlace = enlaceSeguido(idEnvio, r.tipo, r.id);
  const pixel = `${config.apiUrlPublica}/api/alertas/abierto/${idEnvio}/${firmarIdEnvio(idEnvio)}`;
  const cuando = r.fecha_inicio.toLocaleString('es-CO', {
    timeZone: config.alertas.zonaHoraria, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
  const titulo = r.aviso === 'Dia' ? `Hoy es «${r.titulo}»` : `«${r.titulo}» es en una semana`;
  const datos = [`Fecha: ${cuando}`, r.lugar ? `Lugar: ${r.lugar}` : null].filter(Boolean) as string[];
  return {
    asunto: `Recordatorio: ${titulo}`,
    html: plantillaCorreo(
      r.aviso === 'Dia' ? 'Tu evento es hoy' : 'Tu evento es en una semana',
      `<p style="margin:0 0 12px">Hola ${escaparHtml(r.nombre_usuario)}, te recordamos un evento que guardaste en tus favoritos:</p>
       ${recuadroCorreo(`<span style="display:block;margin-bottom:6px;font-size:17px;line-height:24px;font-weight:bold;color:#1F3A68">${escaparHtml(r.titulo)}</span>
         <strong>Fecha:</strong> ${escaparHtml(cuando)}${r.lugar ? `<br><strong>Lugar:</strong> ${escaparHtml(r.lugar)}` : ''}`)}
       ${botonCorreo('Ver evento', enlace)}`,
      {
        pixelUrl: pixel,
        motivo: 'Recibes este recordatorio porque guardaste este evento en tus favoritos. Puedes desactivar los recordatorios en Mi perfil.',
        resumen: `${r.aviso === 'Dia' ? 'Hoy' : 'En una semana'}: ${r.titulo}`,
      },
    ),
    texto: `Hola ${r.nombre_usuario}, te recordamos un evento que guardaste en tus favoritos:\n\n${r.titulo}\n${datos.join('\n')}\n${enlace}\n\nPuedes desactivar los recordatorios de eventos en Mi perfil.`,
  };
}

/** Envía los recordatorios de eventos favoritos (una semana antes y el mismo día). */
export async function ejecutarRecordatorios(): Promise<{ enviados: number; errores: number }> {
  const pendientes = await comoSistema(buscarRecordatorios);
  let enviados = 0;
  let errores = 0;
  for (const r of pendientes) {
    try {
      // El registro y el correo van juntos: si el correo falla, se intenta de nuevo en la próxima ejecución.
      const envio = await comoSistema(async (c) => {
        const { rows } = await c.query<{ id_envio: number }>(
          `insert into envio_alerta (id_usuario, tipo_envio, tipo_contenido, id_contenido, aviso)
           values ($1, 'Recordatorio', $2, $3, $4)
           on conflict (id_usuario, tipo_contenido, id_contenido, aviso) where tipo_envio = 'Recordatorio' do nothing
           returning id_envio`,
          [r.id_usuario, r.tipo, r.id, r.aviso],
        );
        if (!rows[0]) return false;
        await enviarCorreo({ para: r.correo, ...armarRecordatorio(r, rows[0].id_envio) });
        return true;
      });
      if (envio) enviados++;
    } catch (error) {
      errores++;
      console.error(`No se pudo enviar el recordatorio al usuario ${r.id_usuario}:`, error);
    }
  }
  return { enviados, errores };
}

/**
 * Correos de prueba para revisar el diseño: el boletín (con las 5 publicaciones más destacadas
 * de siempre, según los intereses del usuario) y los dos recordatorios (una semana antes y el
 * mismo día) con el próximo evento institucional. No quedan en envio_alerta y sus enlaces
 * (envío 0) no suman clics al top 5.
 */
export async function correosDePrueba(idUsuario: number, nombre: string) {
  return comoSistema(async (c) => {
    const correos: { asunto: string; texto: string; html: string }[] = [];
    const novedades = await buscarNovedades(c, idUsuario, new Date(0));
    if (novedades.length) correos.push(armarCorreo(nombre, novedades, 0));
    const { rows } = await c.query<{ id: number; titulo: string; fecha_inicio: Date; lugar: string | null }>(
      `select id_evento as id, titulo, fecha_inicio, lugar from calendario_eventos
        order by fecha_inicio < now(), abs(extract(epoch from fecha_inicio - now())) limit 1`,
    );
    const evento = rows[0];
    if (evento) {
      for (const aviso of ['Semana', 'Dia'] as const) {
        correos.push(armarRecordatorio({ id_usuario: idUsuario, nombre_usuario: nombre, correo: '', tipo: 'Evento', ...evento, aviso }, 0));
      }
    }
    return correos;
  });
}

/** Ejecuta una tarea: el boletín de una frecuencia o los recordatorios. */
export function ejecutarTarea(tarea: TareaAlertas) {
  return tarea === 'Recordatorios' ? ejecutarRecordatorios() : ejecutarAlertas(tarea);
}

/**
 * Tareas del envío diario de las 8:00 (Vercel Cron llama una vez al día): boletín diario y
 * de cada 2 días, recordatorios y, los lunes, el boletín semanal.
 */
export async function ejecutarEnvioDiario(fecha = new Date()): Promise<Partial<Record<TareaAlertas, { enviados: number; errores: number }>>> {
  const dia = fecha.toLocaleDateString('en-US', { timeZone: config.alertas.zonaHoraria, weekday: 'short' });
  const tareas: TareaAlertas[] = ['Diaria', 'Cada2Dias', ...(dia === 'Mon' ? (['Semanal'] as const) : []), 'Recordatorios'];
  const resultado: Partial<Record<TareaAlertas, { enviados: number; errores: number }>> = {};
  for (const tarea of tareas) resultado[tarea] = await ejecutarTarea(tarea);
  return resultado;
}

/** Marca un correo de alerta como abierto (la primera vez). */
export async function marcarAbierto(idEnvio: number): Promise<void> {
  await comoSistema((c) =>
    c.query('update envio_alerta set fecha_apertura = now() where id_envio = $1 and fecha_apertura is null', [idEnvio]));
}

/** Clic en un enlace del correo: cuenta como "Acceder" del destinatario y marca el correo como abierto. */
export async function registrarClicCorreo(idEnvio: number, tipo: Novedad['tipo'], id: number): Promise<void> {
  await comoSistema(async (c) => {
    const { rows } = await c.query<{ id_usuario: number }>('select id_usuario from envio_alerta where id_envio = $1', [idEnvio]);
    if (!rows[0]) return;
    await c.query(
      `insert into actividad (id_usuario, tipo_contenido, id_contenido, accion) values ($1, $2, $3, 'Clic_acceder')`,
      [rows[0].id_usuario, tipo, id],
    );
    await c.query('update envio_alerta set fecha_apertura = now() where id_envio = $1 and fecha_apertura is null', [idEnvio]);
  });
}

/** Programa los envíos automáticos. */
export function programarAlertas(): ScheduledTask[] {
  const opciones = { timezone: config.alertas.zonaHoraria, noOverlap: true };
  const ejecutar = (...tareas: TareaAlertas[]) => async () => {
    for (const tarea of tareas) {
      const r = await ejecutarTarea(tarea).catch((e) => {
        console.error(`Error en las alertas ${tarea}:`, e);
        return null;
      });
      if (r && (r.enviados || r.errores)) console.info(`[alertas ${tarea}] enviados: ${r.enviados}, errores: ${r.errores}`);
    }
  };
  return [
    cron.schedule('0 8 * * *', ejecutar('Diaria', 'Cada2Dias', 'Recordatorios'), opciones),
    cron.schedule('0 8 * * 1', ejecutar('Semanal'), opciones),
  ];
}
