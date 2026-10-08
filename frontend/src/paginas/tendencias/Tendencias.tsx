import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Columns2, ExternalLink, FileUp, Globe, LayoutGrid, List, Pencil, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { api, mensajeDeError } from '../../api/cliente';
import { useListado } from '../../api/consultas';
import type { Tendencia } from '../../api/tipos';
import { BarraFiltros } from '../../componentes/contenido/Controles';
import { Boton } from '../../componentes/ui/Boton';
import { Filtro } from '../../componentes/ui/Campos';
import { Cargando, EncabezadoPagina, EstadoVacio, MensajeError, MenuExportar, Paginacion } from '../../componentes/ui/Elementos';
import { useSesion } from '../../sesion/sesion';
import { fechaCorta } from '../../utilidades/formato';
import { DetalleTendencia } from './DetalleTendencia';
import { FormularioTendencia } from './FormularioTendencia';
import { ImportarTendencias } from './ImportarTendencias';
import { MapaTendencias } from './MapaTendencias';

type VistaLista = 'tarjetas' | 'compactas' | 'tabla';

/** Fecha desde la que se filtra ("Última semana", "Último mes", "Último año"). */
function hace(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
}
const FECHAS = [
  { valor: '7', texto: 'Última semana' },
  { valor: '30', texto: 'Último mes' },
  { valor: '365', texto: 'Último año' },
];

function EtiquetaMega({ children }: { children: string }) {
  return <span className="inline-block rounded-md bg-morado-claro px-2 py-0.5 text-[12px] font-semibold text-morado">{children}</span>;
}

function TarjetaTendencia({ t, compacta, onAbrir }: { t: Tendencia; compacta: boolean; onAbrir: () => void }) {
  return (
    <button
      type="button"
      onClick={onAbrir}
      className="flex cursor-pointer flex-col gap-2 rounded-tarjeta border border-borde bg-white p-4 text-left shadow-tarjeta transition-shadow hover:shadow-menu"
    >
      <span className="flex items-center justify-between gap-2">
        <EtiquetaMega>{t.megatendencia}</EtiquetaMega>
        {t.estado_te === 'Inactivo' && <span className="text-[11px] font-bold text-texto-suave">INACTIVA</span>}
      </span>
      <span className="text-body font-bold text-texto">{t.tendencia}</span>
      {!compacta && t.descripcion && <span className="line-clamp-2 text-caption text-texto-suave">{t.descripcion}</span>}
      <span className="mt-auto flex items-center justify-between border-t border-borde pt-2.5 text-[12px]">
        <span className="flex items-center gap-1 font-semibold text-texto">
          <Globe className="size-3.5 text-exito" aria-hidden /> Global &amp; Colombia
        </span>
        <span className="flex items-center gap-1 text-texto-suave">
          <CalendarDays className="size-3.5" aria-hidden /> {fechaCorta(t.fecha_publicacion)}
        </span>
      </span>
    </button>
  );
}

function TablaTendencias({ datos, onAbrir, onEditar }: { datos: Tendencia[]; onAbrir: (id: number) => void; onEditar?: (t: Tendencia) => void }) {
  const celda = 'max-w-44 truncate px-3 py-2.5';
  return (
    <div className="overflow-x-auto rounded-tarjeta border border-borde bg-white shadow-tarjeta">
      <table className="w-full min-w-[960px] text-caption">
        <thead className="bg-[#eceef1] text-azul-titulo">
          <tr>
            {['ID', 'Megatendencia', 'Tendencia', 'Descripción', 'Mundo', 'Colombia', 'Fecha', 'Fuente', ...(onEditar ? ['Acciones'] : [])].map((c) => (
              <th key={c} scope="col" className="px-3 py-2.5 text-center font-semibold">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {datos.map((t) => (
            <tr key={t.id_te} className="border-t border-borde hover:bg-fondo">
              <td className="px-3 py-2.5 text-center text-texto-suave">{t.id_te}</td>
              <td className="px-3 py-2.5 text-center font-semibold text-azul-titulo">{t.megatendencia}</td>
              <td className="px-3 py-2.5 text-center font-semibold text-texto">
                <button type="button" className="cursor-pointer hover:underline" onClick={() => onAbrir(t.id_te)}>
                  {t.tendencia}
                </button>
              </td>
              <td className={`${celda} text-texto-suave`} title={t.descripcion ?? ''}>{t.descripcion}</td>
              <td className={`${celda} text-texto-suave`} title={t.comportamiento_mundo ?? ''}>{t.comportamiento_mundo}</td>
              <td className={`${celda} text-texto-suave`} title={t.comportamiento_colombia ?? ''}>{t.comportamiento_colombia}</td>
              <td className="whitespace-nowrap px-3 py-2.5 text-center text-texto-suave">{fechaCorta(t.fecha_publicacion)}</td>
              <td className="px-3 py-2.5 text-center">
                {t.fuentes[0]?.link ? (
                  <a href={t.fuentes[0].link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-bold text-azul-oscuro hover:underline">
                    Ver <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                ) : (
                  <span className="text-texto-tenue">—</span>
                )}
              </td>
              {onEditar && (
                <td className="px-3 py-2.5 text-center">
                  <button type="button" aria-label={`Editar ${t.tendencia}`} onClick={() => onEditar(t)} className="cursor-pointer rounded p-1 text-azul-titulo hover:bg-white">
                    <Pencil className="size-4" />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Tendencias Empresariales: listado (tarjetas, compactas, tabla) y mapa de tendencias. */
export function Tendencias() {
  const { id } = useParams();
  const navegar = useNavigate();
  const { puedeGestionar } = useSesion();
  const gestiona = puedeGestionar('tendencias');
  const [pestana, setPestana] = useState<'lista' | 'mapa'>('lista');
  const [vista, setVista] = useState<VistaLista>('tarjetas');
  const [borrador, setBorrador] = useState({ megatendencia: '', q: '', dias: '', estado: '' });
  const [filtros, setFiltros] = useState(borrador);
  const [pagina, setPagina] = useState(1);
  const [formulario, setFormulario] = useState<{ registro?: Tendencia } | null>(null);
  const [importar, setImportar] = useState(false);

  const { data: megatendencias = [] } = useQuery({
    queryKey: ['/tendencias', 'megatendencias'],
    queryFn: () => api<string[]>('/tendencias/megatendencias'),
  });
  const { data: nombres } = useQuery({
    queryKey: ['/tendencias', 'mapa', 'total'],
    queryFn: () => api<{ tendencias: { tendencia: string; megatendencia: string }[] }>('/tendencias/mapa', { consulta: { periodo: 'total' } }),
  });
  const opcionesTendencia = (nombres?.tendencias ?? [])
    .filter((t) => !borrador.megatendencia || t.megatendencia === borrador.megatendencia)
    .map((t) => ({ valor: t.tendencia, texto: t.tendencia }));

  const consulta = {
    megatendencia: filtros.megatendencia || undefined,
    q: filtros.q || undefined,
    desde: filtros.dias ? hace(Number(filtros.dias)) : undefined,
    estado: filtros.estado || undefined,
  };
  const limite = vista === 'tabla' ? 15 : vista === 'compactas' ? 12 : 8;
  const { data, isLoading, error, refetch } = useListado<Tendencia>('/tendencias', { ...consulta, pagina, limite });
  const abrir = (idT: number) => navegar(`/tendencias/${idT}`);

  const pestanaClase = (activa: boolean) =>
    `h-9 flex-1 cursor-pointer rounded-full text-small font-bold ${activa ? 'bg-rojo text-white' : 'border border-borde bg-white text-texto hover:bg-fondo'}`;
  const vistaClase = (activa: boolean) => `grid size-9 cursor-pointer place-items-center rounded-lg ${activa ? 'bg-rojo text-white' : 'text-texto hover:bg-fondo'}`;

  return (
    <>
      <EncabezadoPagina icono={<TrendingUp />} titulo="Tendencias Empresariales" subtitulo="Megatendencias globales y su impacto en Colombia" />
      <div role="tablist" aria-label="Secciones de tendencias" className="mb-5 flex gap-3 rounded-full bg-white p-2 shadow-tarjeta">
        <button type="button" role="tab" aria-selected={pestana === 'lista'} className={pestanaClase(pestana === 'lista')} onClick={() => setPestana('lista')}>
          Tendencias
        </button>
        <button type="button" role="tab" aria-selected={pestana === 'mapa'} className={pestanaClase(pestana === 'mapa')} onClick={() => setPestana('mapa')}>
          Mapa de tendencias
        </button>
      </div>

      {pestana === 'mapa' ? (
        <MapaTendencias onAbrir={abrir} />
      ) : (
        <>
          <BarraFiltros
            acciones={
              <>
                {gestiona && (
                  <>
                    <Boton variante="secundario" pildora icono={<FileUp className="size-4" />} onClick={() => setImportar(true)}>
                      Importar Excel
                    </Boton>
                    <Boton variante="secundario" pildora onClick={() => setFormulario({})}>
                      Crear nuevo registro
                    </Boton>
                  </>
                )}
                <MenuExportar ruta="/tendencias" consulta={consulta} />
                <div role="group" aria-label="Vista" className="flex gap-1 rounded-xl bg-white p-1 shadow-tarjeta">
                  <button type="button" aria-label="Vista en tarjetas" aria-pressed={vista === 'tarjetas'} className={vistaClase(vista === 'tarjetas')} onClick={() => { setVista('tarjetas'); setPagina(1); }}>
                    <Columns2 className="size-4" />
                  </button>
                  <button type="button" aria-label="Vista compacta" aria-pressed={vista === 'compactas'} className={vistaClase(vista === 'compactas')} onClick={() => { setVista('compactas'); setPagina(1); }}>
                    <LayoutGrid className="size-4" />
                  </button>
                  <button type="button" aria-label="Vista en tabla" aria-pressed={vista === 'tabla'} className={vistaClase(vista === 'tabla')} onClick={() => { setVista('tabla'); setPagina(1); }}>
                    <List className="size-4" />
                  </button>
                </div>
              </>
            }
          >
            <Filtro
              etiqueta="Megatendencia"
              todos="Todas las megatendencias"
              opciones={megatendencias.map((m) => ({ valor: m, texto: m }))}
              valor={borrador.megatendencia}
              onChange={(v) => setBorrador({ ...borrador, megatendencia: v, q: '' })}
            />
            <Filtro etiqueta="Tendencia" todos="Todas las tendencias" opciones={opcionesTendencia} valor={borrador.q} onChange={(v) => setBorrador({ ...borrador, q: v })} />
            <Filtro etiqueta="Fecha" todos="Todas las fechas" opciones={FECHAS} valor={borrador.dias} onChange={(v) => setBorrador({ ...borrador, dias: v })} />
            {gestiona && (
              <Filtro
                etiqueta="Estado"
                todos="Todos los estados"
                opciones={[{ valor: 'Activo', texto: 'Activas' }, { valor: 'Inactivo', texto: 'Inactivas' }]}
                valor={borrador.estado}
                onChange={(v) => setBorrador({ ...borrador, estado: v })}
              />
            )}
            <Boton pildora onClick={() => { setFiltros(borrador); setPagina(1); }}>
              Buscar
            </Boton>
          </BarraFiltros>

          {isLoading ? (
            <Cargando />
          ) : error ? (
            <MensajeError mensaje={mensajeDeError(error)} onReintentar={() => refetch()} />
          ) : !data?.datos.length ? (
            <EstadoVacio titulo="No hay tendencias para estos filtros" detalle="Prueba con otra megatendencia o periodo." />
          ) : (
            <>
              {vista === 'tabla' ? (
                <TablaTendencias datos={data.datos} onAbrir={abrir} onEditar={gestiona ? (t) => setFormulario({ registro: t }) : undefined} />
              ) : (
                <div className={`grid gap-5 ${vista === 'tarjetas' ? 'lg:grid-cols-2' : 'sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4'}`}>
                  {data.datos.map((t) => (
                    <TarjetaTendencia key={t.id_te} t={t} compacta={vista === 'compactas'} onAbrir={() => abrir(t.id_te)} />
                  ))}
                </div>
              )}
              <Paginacion pagina={data.pagina} paginas={data.paginas} onCambiar={setPagina} />
            </>
          )}
        </>
      )}

      {id && (
        <DetalleTendencia
          id={Number(id)}
          onCerrar={() => navegar('/tendencias')}
          onEditar={
            gestiona
              ? (registro) => {
                  setFormulario({ registro });
                  navegar('/tendencias');
                }
              : undefined
          }
        />
      )}
      {formulario && <FormularioTendencia registro={formulario.registro} megatendencias={megatendencias} onCerrar={() => setFormulario(null)} />}
      {importar && <ImportarTendencias onCerrar={() => setImportar(false)} />}
    </>
  );
}
