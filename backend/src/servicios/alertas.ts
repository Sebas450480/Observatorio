import cron, { type ScheduledTask } from 'node-cron';
import { config } from '../config.js';
import { comoSistema, type Cliente } from '../db/contexto.js';
import { firmarIdEnvio } from '../auth/tokens.js';
import { enviarCorreo, escaparHtml, plantillaCorreo } from './correo.js';

/**
 * Correos del Observatorio. Hay dos tipos, separados y con su propio control en Mi perfil:
 *
 * 1. Boletín de novedades (tendencias, contenidos nuevos y empresas coformadoras nuevas),
 *    según la frecuencia elegida:
 *    - Inmediata: cada 15 minutos se envía lo publicado desde el último boletín.
 *    - Diaria:    todos los días a las 8:00 (hora de Bogotá) con lo publicado en el día.
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
export type FrecuenciaEnvio = 'Inmediata' | 'Diaria' | 'Semanal';
/** Tareas que se pueden ejecutar: un boletín o los recordatorios. */
export type TareaAlertas = FrecuenciaEnvio | 'Recordatorios';

interface Novedad {
  tipo: 'Flash' | 'Faro' | 'Tendencia' | 'Evento' | 'Empresa';
  id: number;
  titulo: string;
}

const RUTA_FRONTEND: Record<Novedad['tipo'], string> = {
  Flash: 'flash-informativo',
  Faro: 'faro-empresarial',
  Tendencia: 'tendencias',
  Evento: 'eventos',
  Empresa: 'empresas',
};

const ETIQUETA: Record<Novedad['tipo'], string> = {
  Flash: 'Flash',
  Faro: 'Faro Empresarial',
  Tendencia: 'Tendencia',
  Evento: 'Evento institucional',
  Empresa: 'Nueva empresa coformadora',
};

/** Contenidos activos publicados después de `desde` que le interesan al usuario. */
async function buscarNovedades(c: Cliente, idUsuario: number, desde: Date): Promise<Novedad[]> {
  // Coincide con los intereses del usuario, o con todo si no marcó intereses.
  const coincide = (puente: string, columna: string, alias: string) => `
    (not exists (select 1 from usuario_interes where id_usuario = $1)
     or exists (select 1 from ${puente} p join usuario_interes ui on ui.id_categoria = p.id_categoria
                 where p.${columna} = ${alias}.${columna} and ui.id_usuario = $1))`;

  const { rows } = await c.query<Novedad>(
    `select 'Flash' as tipo, f.id_fi as id, f.titulo from flash_informativo f
      where f.estado_fi = 'Activo' and f.fecha_creacion > $2 and ${coincide('flash_informativo_categoria', 'id_fi', 'f')}
     union all
     select 'Faro', fe.id_fe, fe.titulo from faro_empresarial fe
      where fe.estado_fe = 'Activo' and fe.fecha_creacion > $2 and ${coincide('faro_empresarial_categoria', 'id_fe', 'fe')}
     union all
     select 'Tendencia', t.id_te, t.tendencia from tendencia_empresarial t
      where t.estado_te = 'Activo' and t.fecha_creacion > $2 and ${coincide('tendencia_categoria', 'id_te', 't')}
     union all
     select 'Evento', e.id_evento, e.titulo from calendario_eventos e
      where e.fecha_creacion > $2
     union all
     select 'Empresa', ec.id_ec, coalesce(ec.nombre_comercial, ec.razon_social) from empresa_coformadora ec
      where ec.estado_ec = 'Activo' and ec.fecha_creacion > $2
     order by 1, 3
     limit 50`,
    [idUsuario, desde],
  );
  return rows;
}

function armarCorreo(nombre: string, novedades: Novedad[], idEnvio: number) {
  const enlace = (n: Novedad) => `${config.frontendUrl}/${RUTA_FRONTEND[n.tipo]}/${n.id}`;
  const pixel = `${config.apiUrlPublica}/api/alertas/abierto/${idEnvio}/${firmarIdEnvio(idEnvio)}`;
  const items = novedades
    .map((n) => `<li style="margin-bottom:8px"><span style="color:#777;font-size:12px">${ETIQUETA[n.tipo]}</span><br>
       <a href="${escaparHtml(enlace(n))}" style="color:#1F3A68">${escaparHtml(n.titulo)}</a></li>`)
    .join('');
  return {
    asunto: `Novedades del Observatorio Empresarial (${novedades.length})`,
    html: plantillaCorreo(
      'Nuevas publicaciones para ti',
      `<p>Hola ${escaparHtml(nombre)}, esto es lo nuevo según tus intereses:</p><ul style="padding-left:18px">${items}</ul>
       <p style="font-size:12px;color:#777">Puedes cambiar la frecuencia de este boletín o desactivarlo en Mi perfil.</p>`,
      pixel,
    ),
    texto: `Hola ${nombre}, esto es lo nuevo en el Observatorio Empresarial:\n\n${novedades
      .map((n) => `- ${ETIQUETA[n.tipo]}: ${n.titulo}\n  ${enlace(n)}`)
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
                               else '-infinity' end) as desde
         from usuario u
        where u.estado_usuario = 'Activo' and u.frecuencia_alertas = $1::frecuencia_alertas`,
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
  const enlace = `${config.frontendUrl}/${RUTA_FRONTEND[r.tipo]}/${r.id}`;
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
      `<p>Hola ${escaparHtml(r.nombre_usuario)}, te recordamos un evento que guardaste en tus favoritos:</p>
       <p style="font-size:16px;font-weight:bold;margin:12px 0 4px"><a href="${escaparHtml(enlace)}" style="color:#1F3A68">${escaparHtml(r.titulo)}</a></p>
       <p style="margin:0;color:#555">${datos.map(escaparHtml).join('<br>')}</p>
       <p style="font-size:12px;color:#777;margin-top:16px">Puedes desactivar los recordatorios de eventos en Mi perfil.</p>`,
      pixel,
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

/** Ejecuta una tarea: el boletín de una frecuencia o los recordatorios. */
export function ejecutarTarea(tarea: TareaAlertas) {
  return tarea === 'Recordatorios' ? ejecutarRecordatorios() : ejecutarAlertas(tarea);
}

/**
 * Tareas del envío diario de las 8:00 (Vercel Cron llama una vez al día): boletín inmediato
 * y diario, recordatorios y, los lunes, el boletín semanal.
 */
export async function ejecutarEnvioDiario(fecha = new Date()): Promise<Partial<Record<TareaAlertas, { enviados: number; errores: number }>>> {
  const dia = fecha.toLocaleDateString('en-US', { timeZone: config.alertas.zonaHoraria, weekday: 'short' });
  const tareas: TareaAlertas[] = ['Inmediata', 'Diaria', ...(dia === 'Mon' ? (['Semanal'] as const) : []), 'Recordatorios'];
  const resultado: Partial<Record<TareaAlertas, { enviados: number; errores: number }>> = {};
  for (const tarea of tareas) resultado[tarea] = await ejecutarTarea(tarea);
  return resultado;
}

/** Marca un correo de alerta como abierto (la primera vez). */
export async function marcarAbierto(idEnvio: number): Promise<void> {
  await comoSistema((c) =>
    c.query('update envio_alerta set fecha_apertura = now() where id_envio = $1 and fecha_apertura is null', [idEnvio]));
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
    cron.schedule('*/15 * * * *', ejecutar('Inmediata'), opciones),
    cron.schedule('0 8 * * *', ejecutar('Diaria', 'Recordatorios'), opciones),
    cron.schedule('0 8 * * 1', ejecutar('Semanal'), opciones),
  ];
}
