import { useQuery } from '@tanstack/react-query';
import { Layers, TrendingDown, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { ResponsiveContainer, Tooltip, Treemap } from 'recharts';
import { api, mensajeDeError } from '../../api/cliente';
import type { MapaTendencias as DatosMapa, TendenciaCrecimiento } from '../../api/tipos';
import { Cargando, EstadoVacio, MensajeError, Tarjeta } from '../../componentes/ui/Elementos';
import { numero } from '../../utilidades/formato';

/** Paleta de las megatendencias (Figma: morado, verde, azul, fucsia, naranja...). */
const PALETA = ['#6d35d9', '#1a8f55', '#1f6fd1', '#d7336f', '#e2711d', '#0f8d9a', '#a43bb0', '#4a5e7e', '#5d8a1c', '#a87d0c', '#4b4fc4', '#1478c9'];

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
      <rect x={x + 2} y={y + 2} width={Math.max(0, width - 4)} height={Math.max(0, height - 4)} rx={6} fill={color} />
      {width > 70 && height > 34 && (
        <foreignObject x={x + 8} y={y + 6} width={width - 16} height={height - 12}>
          <div className="flex h-full flex-col justify-between overflow-hidden text-white">
            <p className="text-[13px] font-semibold leading-tight">{name}</p>
            {height > 70 && <p className="truncate text-[11px] text-white/85">{detalle}</p>}
          </div>
        </foreignObject>
      )}
    </g>
  );
}

/** Mapa de tendencias: bloques proporcionales a las menciones del periodo y Top 5 en crecimiento. */
export function MapaTendencias({ onAbrir }: { onAbrir: (id: number) => void }) {
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const [mega, setMega] = useState<string | null>(null);
  const mapa = useQuery({
    queryKey: ['/tendencias', 'mapa', periodo],
    queryFn: () => api<DatosMapa>('/tendencias/mapa', { consulta: { periodo } }),
  });
  const top = useQuery({ queryKey: ['/tendencias', 'top5'], queryFn: () => api<TendenciaCrecimiento[]>('/tendencias/top5') });

  const megas = mapa.data?.megatendencias ?? [];
  const color = (m: string) => PALETA[Math.max(0, megas.findIndex((x) => x.megatendencia === m)) % PALETA.length]!;
  const nodos: Nodo[] = mega
    ? (mapa.data?.tendencias ?? [])
        .filter((t) => t.megatendencia === mega && Number(t.menciones) > 0)
        .map((t) => ({ name: t.tendencia, size: Number(t.menciones), color: color(mega), detalle: `${numero(Number(t.menciones))} menciones`, id_te: t.id_te }))
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
    `inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[12px] font-semibold ${
      activo ? 'border-azul-oscuro bg-azul-oscuro text-white' : 'border-borde bg-white text-texto hover:bg-fondo'
    }`;
  const maxTop = Math.max(1, ...(top.data ?? []).map((t) => Math.abs(t.crecimiento_pct ?? 0)));

  return (
    <Tarjeta className="p-4 sm:p-6">
      <div className="mb-4 flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-naranja-claro text-[#c2410c]">
          <Layers className="size-5" aria-hidden />
        </span>
        <div>
          <h2 className="text-body font-bold text-texto">Mapa de tendencias</h2>
          <p className="text-caption text-texto-suave">
            El tamaño de cada bloque muestra cuántas veces aparece la tendencia. Pasa el cursor para ver detalles y haz clic para explorar sus registros.
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="shrink-0 text-[12px] text-texto-suave">{megas.length} megatendencias</span>
          <button type="button" className={chip(mega === null)} aria-pressed={mega === null} onClick={() => setMega(null)}>
            Todas
          </button>
          {megas.map((m) => (
            <button key={m.megatendencia} type="button" className={chip(mega === m.megatendencia)} aria-pressed={mega === m.megatendencia} onClick={() => setMega(m.megatendencia)}>
              <span className="size-2 rounded-full" style={{ background: color(m.megatendencia) }} aria-hidden />
              {m.megatendencia}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Periodo" className="flex shrink-0 rounded-full border border-borde bg-white p-1">
          {PERIODOS.map((p) => (
            <button
              key={p.valor}
              type="button"
              aria-pressed={periodo === p.valor}
              onClick={() => setPeriodo(p.valor)}
              className={`h-8 cursor-pointer rounded-full px-3 text-[12px] font-semibold ${periodo === p.valor ? 'bg-rojo text-white' : 'text-texto hover:bg-fondo'}`}
            >
              {p.texto}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_260px]">
        <div className="min-h-[420px]">
          {mapa.isLoading ? (
            <Cargando />
          ) : mapa.error ? (
            <MensajeError mensaje={mensajeDeError(mapa.error)} onReintentar={() => mapa.refetch()} />
          ) : !nodos.length ? (
            <EstadoVacio titulo="Sin menciones en este periodo" detalle="Prueba con un periodo más amplio." />
          ) : (
            <ResponsiveContainer width="100%" height={460}>
              <Treemap
                data={nodos}
                dataKey="size"
                isAnimationActive={false}
                content={<Bloque />}
                onClick={(n: unknown) => {
                  const nodo = n as Partial<Nodo>;
                  if (nodo.id_te) onAbrir(nodo.id_te);
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
          {mega && <p className="mt-2 text-[12px] text-texto-suave">Haz clic en una tendencia para ver su detalle.</p>}
        </div>

        <aside className="h-fit rounded-xl border border-borde p-4">
          <h3 className="font-bold text-texto">Top 5 en crecimiento</h3>
          <p className="text-[12px] text-texto-suave">Últimos 30 días · vs. 30 días anteriores</p>
          {top.isLoading ? (
            <Cargando />
          ) : !top.data?.length ? (
            <p className="mt-4 text-caption text-texto-suave">Todavía no hay menciones recientes.</p>
          ) : (
            <ol className="mt-3 flex flex-col gap-3">
              {top.data.map((t, i) => {
                const pct = t.crecimiento_pct;
                const sube = (pct ?? t.crecimiento) >= 0;
                return (
                  <li key={t.id_te}>
                    <button type="button" onClick={() => onAbrir(t.id_te)} className="w-full cursor-pointer text-left">
                      <span className="flex items-center justify-between gap-2 text-caption font-semibold text-texto">
                        <span className="truncate">
                          <span className="mr-1 text-texto-suave">{i + 1}</span> {t.tendencia}
                        </span>
                        <span className={`flex shrink-0 items-center gap-0.5 ${sube ? 'text-exito' : 'text-rojo'}`}>
                          {sube ? <TrendingUp className="size-3.5" aria-hidden /> : <TrendingDown className="size-3.5" aria-hidden />}
                          {pct === null ? 'Nueva' : `${pct} %`}
                        </span>
                      </span>
                      <span className="block truncate text-[11px] text-texto-suave">
                        {t.megatendencia} · {numero(t.menciones_actual)} menciones
                      </span>
                      <span className="mt-1 block h-1 rounded-full bg-fondo">
                        <span
                          className="block h-1 rounded-full"
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
    </Tarjeta>
  );
}
