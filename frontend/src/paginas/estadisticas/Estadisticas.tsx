import { useQuery } from '@tanstack/react-query';
import { ChartColumn, TrendingDown, TrendingUp } from 'lucide-react';
import { api, mensajeDeError } from '../../api/cliente';
import type { Panel, TipoContenido } from '../../api/tipos';
import { Cargando, EncabezadoPagina, MensajeError, Tarjeta } from '../../componentes/ui/Elementos';
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

const ETIQUETA_TIPO: Record<TipoContenido, { texto: string; clase: string }> = {
  Flash: { texto: 'FLASH', clase: 'bg-[#e6eefc] text-[#1d5bd8]' },
  Faro: { texto: 'FARO', clase: 'bg-exito-claro text-[#059669]' },
  Empresa: { texto: 'EMPRESA', clase: 'bg-naranja-claro text-[#c2410c]' },
  Tendencia: { texto: 'TEND.', clase: 'bg-morado-claro text-morado' },
  Evento: { texto: 'EVENTO', clase: 'bg-rojo-claro text-rojo' },
};

function Variacion({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  const sube = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[12px] font-bold ${sube ? 'bg-exito-claro text-[#059669]' : 'bg-rojo-claro text-rojo'}`}>
      {sube ? <TrendingUp className="size-3" aria-hidden /> : <TrendingDown className="size-3" aria-hidden />}
      {Math.abs(pct)} %<span className="sr-only">{sube ? ' más' : ' menos'} que el mes anterior</span>
    </span>
  );
}

function Indicador({ titulo, valor, pct, detalle }: { titulo: string; valor: number; pct: number | null; detalle: string }) {
  return (
    <Tarjeta className="p-5">
      <p className="text-caption text-texto-suave">{titulo}</p>
      <p className="mt-1 flex items-center gap-3">
        <span className="text-[32px] font-bold leading-none text-azul-titulo">{numero(valor)}</span>
        <Variacion pct={pct} />
      </p>
      <p className="mt-2 text-[12px] text-texto-suave">{detalle}</p>
    </Tarjeta>
  );
}

function Barra({ etiqueta, valor, texto, max, color }: { etiqueta: string; valor: number; texto: string; max: number; color: string }) {
  return (
    <li>
      <span className="flex justify-between text-caption font-semibold text-texto">
        <span>{etiqueta}</span>
        <span style={{ color }}>{texto}</span>
      </span>
      <span className="mt-1 block h-1.5 rounded-full bg-fondo">
        <span className="block h-1.5 rounded-full" style={{ width: `${max ? Math.max(2, (valor / max) * 100) : 0}%`, background: color }} />
      </span>
    </li>
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
      <EncabezadoPagina icono={<ChartColumn />} titulo="Panel de estadísticas" subtitulo="Indicadores de uso y contenido del Observatorio" />
      <h2 className="mb-3 text-body font-bold text-azul-titulo">
        Resumen del mes <span className="ml-1 text-[12px] font-normal text-texto-suave">Variación frente al mes anterior</span>
      </h2>
      {panel.isLoading ? (
        <Cargando />
      ) : panel.error || !panel.data ? (
        <MensajeError mensaje={mensajeDeError(panel.error)} onReintentar={() => panel.refetch()} />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
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

      <h2 className="mb-3 mt-8 text-body font-bold text-azul-titulo">Lo que más interesa</h2>
      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        <Tarjeta className="p-5">
          <h3 className="font-bold text-azul-titulo">Top 5 de contenidos más vistos</h3>
          <p className="text-[12px] text-texto-suave">Últimos 30 días</p>
          {!top.data?.length ? (
            <p className="mt-4 text-caption text-texto-suave">{top.isLoading ? 'Cargando...' : 'Todavía no hay visitas registradas.'}</p>
          ) : (
            <ol className="mt-3 divide-y divide-borde">
              {top.data.map((c, i) => (
                <li key={`${c.tipo_contenido}-${c.id_contenido}`} className="flex items-center gap-3 py-2.5">
                  <span className="w-4 text-body font-bold text-texto-tenue">{i + 1}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${ETIQUETA_TIPO[c.tipo_contenido].clase}`}>{ETIQUETA_TIPO[c.tipo_contenido].texto}</span>
                  <span className="min-w-0 flex-1 text-caption font-semibold text-azul-titulo">{c.titulo ?? 'Contenido eliminado'}</span>
                  <span className="shrink-0 text-[12px] text-texto-suave">{numero(Number(c.vistas))} vistas</span>
                </li>
              ))}
            </ol>
          )}
        </Tarjeta>
        <Tarjeta className="p-5">
          <h3 className="font-bold text-azul-titulo">Intereses de los usuarios</h3>
          <p className="text-[12px] text-texto-suave">% de usuarios que eligió cada tema</p>
          <ul className="mt-3 flex flex-col gap-3">
            {(intereses.data ?? []).slice(0, 8).map((i) => (
              <Barra key={i.id_categoria} etiqueta={i.nombre_categoria} valor={Number(i.porcentaje ?? 0)} texto={`${i.porcentaje ?? 0} %`} max={100} color="#dd0034" />
            ))}
          </ul>
        </Tarjeta>
        <Tarjeta className="p-5">
          <h3 className="font-bold text-azul-titulo">Usuarios por ciudad</h3>
          <p className="text-[12px] text-texto-suave">Usuarios activos por ciudad de residencia</p>
          <ul className="mt-3 flex flex-col gap-3">
            {listaCiudades.map((c) => (
              <Barra key={c.ciudad} etiqueta={c.ciudad} valor={Number(c.usuarios)} texto={numero(Number(c.usuarios))} max={maxCiudad} color="#0e1f87" />
            ))}
          </ul>
        </Tarjeta>
      </div>
    </>
  );
}
