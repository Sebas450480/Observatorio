import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ResponsiveContainer, Tooltip, Treemap } from 'recharts';
import { api, mensajeDeError } from '../../api/cliente';
import iconoCapas from '../../assets/figma/tendencias/capas.png';
import type { MapaTendencias as DatosMapa, TendenciaCrecimiento } from '../../api/tipos';
import { Cargando, EstadoVacio, MensajeError } from '../../componentes/ui/Elementos';
import { numero } from '../../utilidades/formato';

/** Color de cada megatendencia en el Figma; las nuevas toman la PALETA en orden. */
const COLORES: Record<string, string> = {
  'Tecnología y sociedad': '#7338d9',
  'Medio ambiente y sostenibilidad': '#178c52',
  'Economía y trabajo': '#1f66c7',
  'Demografía y cultura': '#e07314',
  'Salud y bienestar': '#d62e6b',
  'Educación y talento': '#008c99',
  'Ciudades y urbanización': '#524dc2',
  'Finanzas y nuevos mercados': '#b2800a',
  'Comercio y geopolítica': '#476180',
  'Consumo y nuevos hábitos': '#a8339e',
  'Agroindustria y alimentos': '#61851a',
  'Energía y recursos': '#0a7ac7',
};
/** Colores para las megatendencias agregadas después (distintos de los del Figma). */
const PALETA = ['#c2185b', '#00838f', '#6d4c41', '#5e35b1', '#2e7d32', '#ef6c00', '#455a64', '#ad1457'];
/** Megatendencias del Figma (el formulario las ofrece aunque todavía no tengan registros). */
export const MEGATENDENCIAS = Object.keys(COLORES);

type Periodo = 'semana' | 'mes' | 'anio';
const PERIODOS: { valor: Periodo; texto: string; comparacion: string }[] = [
  { valor: 'semana', texto: 'Última semana', comparacion: 'Última semana' },
  { valor: 'mes', texto: 'Último mes', comparacion: 'Último mes · vs. mes anterior' },
  { valor: 'anio', texto: 'Último año', comparacion: 'Último año' },
];

interface Nodo {
  name: string;
  size: number;
  color: string;
  detalle: string;
  id_te?: number;
  megatendencia?: string;
  [clave: string]: unknown;
}

interface PropsBloque {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  depth?: number;
  name?: string;
  color?: string;
  detalle?: string;
}

function Bloque({ x = 0, y = 0, width = 0, height = 0, depth, name, color, detalle }: PropsBloque) {
  if (depth !== 1) return null;
  return (
    <g style={{ cursor: 'pointer' }}>
      <rect x={x + 2} y={y + 2} width={Math.max(0, width - 4)} height={Math.max(0, height - 4)} rx={4} fill={color} />
      {width > 70 && height > 34 && (
        <foreignObject x={x + 10} y={y + 10} width={width - 20} height={height - 18}>
          <div className="flex h-full flex-col justify-between overflow-hidden text-white">
            <p className="text-small font-semibold leading-[1.2]">{name}</p>
            {height > 70 && <p className="truncate text-caption text-white/85">{detalle}</p>}
          </div>
        </foreignObject>
      )}
    </g>
  );
}

/** Mapa de tendencias: bloques proporcionales a las menciones del periodo y Top 5 en crecimiento. */
export function MapaTendencias({ onVerTendencia }: { onVerTendencia: (megatendencia: string, tendencia: string) => void }) {
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const [mega, setMega] = useState<string | null>(null);
  const mapa = useQuery({
    queryKey: ['/tendencias', 'mapa', periodo],
    queryFn: () => api<DatosMapa>('/tendencias/mapa', { consulta: { periodo } }),
  });
  const top = useQuery({ queryKey: ['/tendencias', 'top5'], queryFn: () => api<TendenciaCrecimiento[]>('/tendencias/top5') });
  const registradas = useQuery({ queryKey: ['/tendencias', 'megatendencias'], queryFn: () => api<string[]>('/tendencias/megatendencias') });

  const megas = mapa.data?.megatendencias ?? [];
  // Chips: todas las megatendencias del campo del formulario (las del Figma y las agregadas), tengan o no menciones.
  const todas = [...new Set([...MEGATENDENCIAS, ...(registradas.data ?? []), ...megas.map((m) => m.megatendencia)])].sort((a, b) => a.localeCompare(b, 'es'));
  const nuevas = todas.filter((m) => !COLORES[m]);
  const color = (m: string) => COLORES[m] ?? PALETA[Math.max(0, nuevas.indexOf(m)) % PALETA.length]!;
  const nodos: Nodo[] = mega
    ? (mapa.data?.tendencias ?? [])
        .filter((t) => t.megatendencia === mega && Number(t.menciones) > 0)
        .map((t) => ({ name: t.tendencia, size: Number(t.menciones), color: color(mega), detalle: `${numero(Number(t.menciones))} menciones`, id_te: t.id_te, megatendencia: mega }))
    : megas
        .filter((m) => Number(m.menciones) > 0)
        .map((m) => ({
          name: m.megatendencia,
          size: Number(m.menciones),
          color: color(m.megatendencia),
          detalle: `${numero(Number(m.menciones))} menciones · ${m.tendencias} tendencias`,
          megatendencia: m.megatendencia,
        }));

  const chip = (activo: boolean) =>
    `inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-full px-3.5 text-caption font-semibold ${
      activo ? 'h-[33px] bg-azul-marino text-white' : 'h-[35px] border border-[#d9dee8] bg-white text-[#0a1c40] hover:bg-fondo'
    }`;
  const maxTop = Math.max(1, ...(top.data ?? []).map((t) => Math.abs(t.crecimiento_pct ?? 0)));
  const actualizado = top.dataUpdatedAt
    ? new Date(top.dataUpdatedAt).toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: 'numeric', minute: '2-digit' })
    : null;

  return (
    <section className="flex flex-col gap-[22px] rounded-[20px] border-2 border-black/10 bg-white p-4 sm:pb-12 sm:pl-[35px] sm:pr-[33px] sm:pt-[31px] xl:ml-0.5">
      <div className="flex items-center gap-6">
        <img src={iconoCapas} alt="" aria-hidden width={50} height={48} className="shrink-0" />
        <div className="text-black">
          <h2 className="text-body font-bold">Mapa de tendencias</h2>
          <p className="text-small font-light sm:text-body">
            El tamaño de cada bloque muestra cuántas veces aparece la tendencia. Pasa el cursor para ver detalles y haz clic para explorar sus registros.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
          <div className="flex min-w-0 items-start gap-3 pt-1">
            <span className="shrink-0 pt-2 text-caption font-semibold text-gris-azulado">{todas.length} megatendencias</span>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <button type="button" className={chip(mega === null)} aria-pressed={mega === null} onClick={() => setMega(null)}>
                Todas
              </button>
              {todas.map((m) => (
                <button key={m} type="button" className={chip(mega === m)} aria-pressed={mega === m} onClick={() => setMega(m)}>
                  <span className="size-2.5 rounded-full" style={{ background: color(m) }} aria-hidden />
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div role="group" aria-label="Periodo" className="flex shrink-0 gap-1 self-start rounded-full border border-[#d9dee8] bg-white p-1">
            {PERIODOS.map((p) => (
              <button
                key={p.valor}
                type="button"
                aria-pressed={periodo === p.valor}
                onClick={() => setPeriodo(p.valor)}
                className={`h-[33px] cursor-pointer rounded-full px-4 text-caption font-semibold ${periodo === p.valor ? 'bg-rojo-vivo text-white' : 'text-[#0a1c40] hover:bg-fondo'}`}
              >
                {p.texto}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_330px]">
          <div className="min-h-[420px]">
            {mapa.isLoading ? (
              <Cargando />
            ) : mapa.error ? (
              <MensajeError mensaje={mensajeDeError(mapa.error)} onReintentar={() => mapa.refetch()} />
            ) : !nodos.length ? (
              <EstadoVacio
                titulo={mega ? `«${mega}» no tiene menciones en este periodo` : 'Sin menciones en este periodo'}
                detalle={mega ? 'Prueba con un periodo más amplio o elige otra megatendencia.' : 'Prueba con un periodo más amplio.'}
              />
            ) : (
              <ResponsiveContainer width="100%" height={717}>
                <Treemap
                  data={nodos}
                  dataKey="size"
                  isAnimationActive={false}
                  content={<Bloque />}
                  onClick={(n: unknown) => {
                    const nodo = n as Partial<Nodo>;
                    // Megatendencia → muestra sus tendencias; tendencia → abre el listado filtrado por ella.
                    if (nodo.id_te && nodo.megatendencia && nodo.name) onVerTendencia(nodo.megatendencia, nodo.name);
                    else if (nodo.megatendencia) setMega(nodo.megatendencia);
                  }}
                >
                  <Tooltip
                    formatter={(valor) => [`${numero(Number(valor))} menciones`, 'Menciones']}
                    labelFormatter={(_, carga) => String((carga?.[0]?.payload as Nodo | undefined)?.name ?? '')}
                  />
                </Treemap>
              </ResponsiveContainer>
            )}
            {mega && <p className="mt-2 text-caption text-gris-azulado">Haz clic en una tendencia para ver sus registros en Tendencias.</p>}
          </div>

          <aside className="flex flex-col gap-3.5 rounded-xl border border-[#d9dee8] px-[22px] py-6 xl:min-h-[717px]">
            <div className="flex flex-col gap-0.5">
              <h3 className="text-subtitle font-bold text-[#0a1c40]">Top 5 en crecimiento</h3>
              <p className="text-caption text-gris-azulado">Último mes · vs. mes anterior</p>
            </div>
            {actualizado && (
              <p className="flex items-center gap-2 self-start rounded-full bg-[#0a8c5c]/10 px-3 py-1.5 text-caption font-semibold text-[#0a734d]">
                <span className="size-2 rounded-full bg-[#0a8c5c]" aria-hidden /> Actualizado hoy, {actualizado}
              </p>
            )}
            {top.isLoading ? (
              <Cargando />
            ) : !top.data?.length ? (
              <p className="text-caption text-gris-azulado">Todavía no hay menciones recientes.</p>
            ) : (
              <ol className="flex flex-col gap-3.5">
                {top.data.map((t, i) => {
                  const pct = t.crecimiento_pct;
                  const sube = (pct ?? t.crecimiento) >= 0;
                  return (
                    <li key={t.id_te}>
                      <button type="button" onClick={() => onVerTendencia(t.megatendencia, t.tendencia)} className="flex w-full cursor-pointer flex-col gap-1.5 text-left">
                        <span className="flex items-center justify-between gap-2.5 text-small">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="font-bold text-gris-azulado/70">{i + 1}</span>
                            <span className="truncate font-semibold text-[#0a1c40]">{t.tendencia}</span>
                          </span>
                          <span className={`shrink-0 font-bold ${sube ? 'text-[#0a8c5c]' : 'text-rojo'}`}>
                            {pct === null ? 'Nueva' : `${sube ? '▲' : '▼'} ${Math.round(Math.abs(pct))} %`}
                          </span>
                        </span>
                        <span className="truncate text-caption text-gris-azulado">
                          {t.megatendencia} · {numero(t.menciones_actual)} menciones
                        </span>
                        <span className="block h-1.5 rounded-[3px] bg-[#edf0f5]">
                          <span
                            className="block h-1.5 rounded-[3px]"
                            style={{ width: `${pct === null ? 100 : Math.max(8, (Math.abs(pct) / maxTop) * 100)}%`, background: color(t.megatendencia) }}
                          />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
          </aside>
        </div>
      </div>
    </section>
  );
}
