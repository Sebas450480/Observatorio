import cron, { type ScheduledTask } from 'node-cron';
import { config } from '../config.js';
import { comoSistema, type Cliente } from '../db/contexto.js';
import { firmarIdEnvio } from '../auth/tokens.js';
import { enviarCorreo, escaparHtml, plantillaCorreo } from './correo.js';

/**
 * Alertas por correo según los intereses y la frecuencia elegida por cada usuario.
 *
 * - Inmediata: cada 15 minutos se envía lo publicado desde la última alerta.
 * - Semanal:   los lunes a las 8:00 (hora de Bogotá) se envía lo publicado en la semana.
 * - Ninguna:   no recibe correos.
 *
 * Se incluyen Flash, Faro y Tendencias que coincidan con sus intereses (si no marcó
 * intereses, recibe todo) y los eventos institucionales nuevos. Cada envío queda en
 * la tabla envio_alerta, y una imagen invisible en el correo marca cuándo se abrió.
 */
export type FrecuenciaEnvio = 'Inmediata' | 'Semanal';

interface Novedad {
  tipo: 'Flash' | 'Faro' | 'Tendencia' | 'Evento';
  id: number;
  titulo: string;
}

const RUTA_FRONTEND: Record<Novedad['tipo'], string> = {
  Flash: 'flash-informativo',
  Faro: 'faro-empresarial',
  Tendencia: 'tendencias',
  Evento: 'eventos',
};

const ETIQUETA: Record<Novedad['tipo'], string> = {
  Flash: 'Flash Informativo',
  Faro: 'Faro Empresarial',
  Tendencia: 'Tendencia',
  Evento: 'Evento institucional',
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
       <p style="font-size:12px;color:#777">Puedes cambiar la frecuencia de estos correos en Mi perfil.</p>`,
      pixel,
    ),
    texto: `Hola ${nombre}, esto es lo nuevo en el Observatorio Empresarial:\n\n${novedades
      .map((n) => `- ${ETIQUETA[n.tipo]}: ${n.titulo}\n  ${enlace(n)}`)
      .join('\n')}\n\nPuedes cambiar la frecuencia de estos correos en Mi perfil.`,
  };
}

/** Envía las alertas pendientes de una frecuencia. Devuelve cuántos correos se enviaron. */
export async function ejecutarAlertas(frecuencia: FrecuenciaEnvio): Promise<{ enviados: number; errores: number }> {
  const destinatarios = await comoSistema(async (c) => {
    const { rows } = await c.query<{ id_usuario: number; nombre_usuario: string; correo: string; desde: Date }>(
      `select u.id_usuario, u.nombre_usuario, u.correo,
              greatest(u.fecha_registro,
                       coalesce((select max(fecha_envio) from envio_alerta ea where ea.id_usuario = u.id_usuario), '-infinity'),
                       case when $1 = 'Semanal' then now() - interval '7 days' else '-infinity' end) as desde
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

/** Marca un correo de alerta como abierto (la primera vez). */
export async function marcarAbierto(idEnvio: number): Promise<void> {
  await comoSistema((c) =>
    c.query('update envio_alerta set fecha_apertura = now() where id_envio = $1 and fecha_apertura is null', [idEnvio]));
}

/** Programa los envíos automáticos. */
export function programarAlertas(): ScheduledTask[] {
  const opciones = { timezone: config.alertas.zonaHoraria, noOverlap: true };
  const ejecutar = (frecuencia: FrecuenciaEnvio) => async () => {
    const r = await ejecutarAlertas(frecuencia).catch((e) => {
      console.error(`Error en las alertas ${frecuencia}:`, e);
      return null;
    });
    if (r && (r.enviados || r.errores)) console.info(`[alertas ${frecuencia}] enviados: ${r.enviados}, errores: ${r.errores}`);
  };
  return [
    cron.schedule('*/15 * * * *', ejecutar('Inmediata'), opciones),
    cron.schedule('0 8 * * 1', ejecutar('Semanal'), opciones),
  ];
}
