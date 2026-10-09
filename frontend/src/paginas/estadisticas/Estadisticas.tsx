import { useQuery } from '@tanstack/react-query';
import { api, mensajeDeError } from '../../api/cliente';
import type { Panel, TipoContenido } from '../../api/tipos';
import { Cargando, EncabezadoPagina, MensajeError } from '../../componentes/ui/Elementos';
import { numero } from '../../utilidades/formato';

interface TopContenido {
  tipo_contenido: TipoContenido;
  id_contenido: number;
  titulo: string | null;
  vistas: number;
}
interface Interes {
  id_categoria: number;
  nombre_categoria: string;
  usuarios: number;
  porcentaje: number | null;
}
interface Ciudad {
  ciudad: string;
  usuarios: number;
}

const ETIQUETA_TIPO: Record<TipoContenido, { texto: string; color: string }> = {
  Flash: { texto: 'FLASH', color: '#1c59d9' },
  Faro: { texto: 'FARO', color: '#0a8c5c' },
  Empresa: { texto: 'EMPRESA', color: '#e07314' },
  Tendencia: { texto: 'TEND.', color: '#8c5cf5' },
  Evento: { texto: 'EVENTO', color: '#e4002b' },
};

const TARJETA = 'rounded-2xl border border-[#e5ebf2] bg-white p-5 shadow-[0_4px_16px_0_rgba(13,26,64,0.06)] sm:p-7';

function Variacion({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  const sube = pct >= 0;
  return (
    <span className={`rounded-xl px-2.5 py-1 text-caption font-bold ${sube ? 'bg-[#0a8c5c]/10 text-[#0a8c5c]' : 'bg-rojo-claro text-rojo'}`}>
      {sube ? '▲' : '▼'} {Math.round(Math.abs(pct))} %<span className="sr-only">{sube ? ' más' : ' menos'} que el mes anterior</span>
    </span>
  );
}

function Indicador({ titulo, valor, pct, detalle }: { titulo: string; valor: number; pct: number | null; detalle: string }) {
  return (
    <div className={`flex flex-col gap-1.5 sm:min-h-[169px] ${TARJETA}`}>
      <p className="text-small font-semibold text-gris-azulado">{titulo}</p>
      <p className="flex items-center gap-3">
        <span className="text-[28px] font-bold leading-[1.15] text-azul-marino sm:text-display">{numero(valor)}</span>
        <Variacion pct={pct} />
      </p>
      <p className="text-caption text-gris-azulado">{detalle}</p>
    </div>
  );
}

function Barra({ etiqueta, valor, texto, max, color }: { etiqueta: string; valor: number; texto: string; max: number; color: string }) {
  return (
    <li className="flex flex-col gap-1.5">
      <span className="flex justify-between gap-2 text-small">
        <span className="font-semibold text-azul-marino">{etiqueta}</span>
        <span className="font-bold" style={{ color }}>
          {texto}
        </span>
      </span>
      <span className="block h-2 rounded bg-[#edf0f5]">
        <span className="block h-2 rounded" style={{ width: `${max ? Math.max(2, (valor / max) * 100) : 0}%`, background: color }} />
      </span>
    </li>
  );
}

function Encabezado({ titulo, detalle }: { titulo: string; detalle: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-subtitle font-bold text-azul-marino">{titulo}</h3>
      <p className="text-small text-gris-azulado">{detalle}</p>
    </div>
  );
}

const usar = <T,>(ruta: string) => ({ queryKey: ['/estadisticas', ruta], queryFn: () => api<T>(`/estadisticas/${ruta}`) });

/** Panel de estadísticas del SuperAdmin (Figma: "Panel de estadísticas"). */
export function Estadisticas() {
  const panel = useQuery(usar<Panel>('panel'));
  const top = useQuery(usar<TopContenido[]>('top-contenidos'));
  const intereses = useQuery(usar<Interes[]>('intereses'));
  const ciudades = useQuery(usar<Ciudad[]>('ciudades'));

  const listaCiudades = (() => {
    const filas = ciudades.data ?? [];
    const principales = filas.slice(0, 5);
    const resto = filas.slice(5).reduce((s, c) => s + Number(c.usuarios), 0);
    return resto ? [...principales, { ciudad: 'Otras ciudades', usuarios: resto }] : principales;
  })();
  const maxCiudad = Math.max(0, ...listaCiudades.map((c) => Number(c.usuarios)));

  return (
    <>
      <EncabezadoPagina
        modulo="estadisticas"
        tamanoIcono={32}
        cuadroRedondo={false}
        titulo="Panel de estadísticas"
        subtitulo="Indicadores de uso y contenido del Observatorio"
        claseSubtitulo="text-body font-bold tracking-[-0.5px] text-[#0d2375] sm:text-subtitle"
        className="mb-6 xl:mb-[41px]"
      />
      <h2 className="mb-4 flex flex-wrap items-baseline gap-x-3 text-subtitle font-bold text-azul-marino">
        Resumen del mes <span className="text-caption font-normal text-gris-azulado">Variación frente al mes anterior</span>
      </h2>
      {panel.isLoading ? (
        <Cargando />
      ) : panel.error || !panel.data ? (
        <MensajeError mensaje={mensajeDeError(panel.error)} onReintentar={() => panel.refetch()} />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          <Indicador titulo="Usuarios registrados" valor={panel.data.usuarios.total} pct={panel.data.usuarios.variacion_pct} detalle={`${numero(panel.data.usuarios.nuevos_mes)} nuevos este mes`} />
          <Indicador
            titulo="Contenidos publicados"
            valor={panel.data.contenidos.total}
            pct={panel.data.contenidos.variacion_pct}
            detalle={`Flash ${panel.data.contenidos.flash} · Faro ${panel.data.contenidos.faro} · Eventos ${panel.data.contenidos.eventos} · Tendencias ${panel.data.contenidos.tendencias}`}
          />
          <Indicador titulo="Visitas a la plataforma" valor={panel.data.visitas.mes} pct={panel.data.visitas.variacion_pct} detalle={`${numero(panel.data.visitas.clics_acceder_mes)} clics en «Acceder»`} />
          <Indicador
            titulo="Suscriptores a alertas"
            valor={panel.data.suscriptores.total}
            pct={panel.data.suscriptores.variacion_pct}
            detalle={`Tasa de apertura de correos: ${panel.data.suscriptores.tasa_apertura_pct ?? 0} %`}
          />
        </div>
      )}

      <h2 className="mb-4 mt-10 text-subtitle font-bold text-azul-marino">Lo que más interesa</h2>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-[560fr_448fr_448fr]">
        <section className={`flex flex-col gap-4 xl:min-h-[447px] ${TARJETA}`}>
          <Encabezado titulo="Top 5 de contenidos más vistos" detalle="Últimos 30 días" />
          {!top.data?.length ? (
            <p className="text-small text-gris-azulado">{top.isLoading ? 'Cargando...' : 'Todavía no hay visitas registradas.'}</p>
          ) : (
            <ol className="flex flex-col gap-4 [&>li+li]:border-t [&>li+li]:border-[#e8ebf2] [&>li+li]:pt-4">
              {top.data.map((c, i) => {
                const tipo = ETIQUETA_TIPO[c.tipo_contenido];
                return (
                  <li key={`${c.tipo_contenido}-${c.id_contenido}`} className="flex min-h-[25px] items-center gap-3.5">
                    <span className="text-subtitle font-bold text-gris-azulado/60">{i + 1}</span>
                    <span className="rounded-md px-2 py-1 text-caption font-bold" style={{ color: tipo.color, background: `${tipo.color}1f` }}>
                      {tipo.texto}
                    </span>
                    <span className="line-clamp-2 min-w-0 flex-1 text-small font-semibold text-azul-marino">{c.titulo ?? 'Contenido eliminado'}</span>
                    <span className="shrink-0 text-small text-gris-azulado">{numero(Number(c.vistas))} vistas</span>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
        <section className={`flex flex-col gap-4 xl:min-h-[447px] ${TARJETA}`}>
          <Encabezado titulo="Intereses de los usuarios" detalle="% de usuarios que eligió cada tema al registrarse" />
          <ul className="flex flex-col gap-4">
            {(intereses.data ?? []).slice(0, 7).map((i) => (
              <Barra key={i.id_categoria} etiqueta={i.nombre_categoria} valor={Number(i.porcentaje ?? 0)} texto={`${Math.round(Number(i.porcentaje ?? 0))} %`} max={100} color="#e4002b" />
            ))}
          </ul>
        </section>
        <section className={`flex flex-col gap-4 xl:min-h-[447px] ${TARJETA}`}>
          <Encabezado titulo="Usuarios por ciudad" detalle="Usuarios registrados por ciudad de residencia" />
          <ul className="flex flex-col gap-4">
            {listaCiudades.map((c) => (
              <Barra key={c.ciudad} etiqueta={c.ciudad} valor={Number(c.usuarios)} texto={numero(Number(c.usuarios))} max={maxCiudad} color="#173b73" />
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
