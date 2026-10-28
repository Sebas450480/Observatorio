import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { api, mensajeDeError } from '../../api/cliente';
import iconoCalendario from '../../assets/figma/tendencias/calendario-tendencia.svg';
import iconoEditar from '../../assets/figma/tendencias/editar-tabla.png';
import iconoEnlace from '../../assets/figma/tendencias/enlace-externo.png';
import iconoGlobo from '../../assets/figma/tendencias/globo-tendencia.png';
import iconoEncabezado from '../../assets/figma/tendencias/tendencias-encabezado.svg';
import vistaCompacta from '../../assets/figma/tendencias/vista-compacta.svg';
import vistaGrande from '../../assets/figma/tendencias/vista-grande.svg';
import vistaLista from '../../assets/figma/tendencias/vista-lista.svg';
import { useListado } from '../../api/consultas';
import type { Tendencia } from '../../api/tipos';
import { BotonDescargar } from '../../componentes/contenido/BotonDescargar';
import { CargaMasiva } from '../../componentes/contenido/CargaMasiva';
import { BotonFavorito } from '../../componentes/contenido/BotonFavorito';
import { BarraFiltros, contarActivos } from '../../componentes/contenido/Controles';
import { Filtro } from '../../componentes/ui/Campos';
import { Cargando, EncabezadoPagina, EstadoVacio, MensajeError, Paginacion, PieTabla, type TamanoTabla } from '../../componentes/ui/Elementos';
import { BotonOrden, ariaOrden, consultaOrden, type Orden } from '../../componentes/ui/Orden';
import { useSesion } from '../../sesion/sesion';
import { fechaCorta, numero } from '../../utilidades/formato';
import { DESDE_SM, useConsultaMedia } from '../../utilidades/medios';
import { DetalleTendencia } from './DetalleTendencia';
import { FormularioTendencia } from './FormularioTendencia';
import { MapaTendencias } from './MapaTendencias';
import { todasLasMegatendencias } from '../../utilidades/megatendencias';
import { CasillaFila, CasillaTodos, MenuAcciones, useSeleccion, type Seleccion } from '../../componentes/contenido/AccionesLote';
import { TARJETA_INTERACTIVA } from '../../componentes/ui/tarjetaInteractiva';

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
  return (
    <span className="inline-flex h-[26px] items-center self-start rounded-[20px] bg-[#f6ecff] px-3 text-small font-bold tracking-[-0.5px] text-[#a32afa]">
      {children}
    </span>
  );
}

function TarjetaTendencia({ t, onAbrir }: { t: Tendencia; onAbrir: () => void }) {
  // La banderita va fuera del botón de la tarjeta (un botón no puede ir dentro de otro).
  return (
    <div className="relative flex min-w-0">
      <button
        type="button"
        onClick={onAbrir}
        className={`flex w-full min-w-0 flex-col gap-3 rounded-[20px] border-2 border-black/10 bg-white pb-[21px] pl-[23px] pr-[31px] pt-[26px] text-left ${TARJETA_INTERACTIVA}`}
      >
        {/* Espacio a la derecha para los botones de descarga y favorito, que van encima de la tarjeta. */}
        <span className="flex flex-wrap items-center gap-2 pr-[72px]">
          <EtiquetaMega>{t.megatendencia}</EtiquetaMega>
          {t.estado_te === 'Inactivo' && (
            <span className="inline-flex h-[22px] items-center rounded-full bg-[#eef2f6] px-2.5 text-[11px] font-bold tracking-[0.3px] text-texto-suave">INACTIVA</span>
          )}
        </span>
        <span className="flex flex-col gap-1.5 tracking-[-0.5px] text-[#232734]">
          <span className="text-subtitle font-bold">{t.tendencia}</span>
          <span className="line-clamp-2 min-h-[44px] text-body font-light">{t.descripcion}</span>
        </span>
        <span className="mt-auto flex items-center justify-between gap-3 border-t border-[#e2e8f0] pt-3.5">
          <span className="flex items-center gap-2 text-small font-bold tracking-[-0.5px] text-[#232734]">
            <img src={iconoGlobo} alt="" aria-hidden className="size-3.5" /> Global &amp; Colombia
          </span>
          <span className="flex items-center gap-2 text-small text-[#4d525c]">
            <img src={iconoCalendario} alt="" aria-hidden className="size-3.5" /> {fechaCorta(t.fecha_publicacion)}
          </span>
        </span>
      </button>
      <div className="absolute right-3 top-4 flex gap-1">
        <BotonDescargar ruta="/tendencias" id={t.id_te} titulo={t.tendencia} />
        <BotonFavorito tipo="Tendencia" id={t.id_te} titulo={t.tendencia} />
      </div>
    </div>
  );
}

/** `orden`: nombre del orden en la API (las columnas sin él no se ordenan). */
const COLUMNAS_TABLA: { titulo: string; ancho: number; orden?: string }[] = [
  { titulo: 'ID', ancho: 64, orden: 'id' },
  { titulo: 'Megatendencia', ancho: 300, orden: 'megatendencia' },
  { titulo: 'Tendencia', ancho: 205, orden: 'tendencia' },
  { titulo: 'Descripción', ancho: 210, orden: 'descripcion' },
  { titulo: 'Mundo', ancho: 186, orden: 'mundo' },
  { titulo: 'Colombia', ancho: 190, orden: 'colombia' },
  { titulo: 'Fecha', ancho: 130, orden: 'publicacion' },
  { titulo: 'Fuente', ancho: 83 },
];

function TablaTendencias({
  datos,
  onAbrir,
  onEditar,
  orden,
  onOrdenar,
  seleccion,
}: {
  datos: Tendencia[];
  onAbrir: (id: number) => void;
  onEditar?: (t: Tendencia) => void;
  orden: Orden;
  onOrdenar: (orden: Orden) => void;
  /** Selección múltiple (solo gestores). */
  seleccion?: Seleccion;
}) {
  const { usuario } = useSesion();
  const columnas: { titulo: string; ancho: number; orden?: string }[] = [
    ...COLUMNAS_TABLA,
    ...(usuario ? [{ titulo: 'Favorito', ancho: 90 }] : []),
    ...(onEditar ? [{ titulo: 'Acciones', ancho: 141 }] : []),
  ];
  const celda = 'h-10 truncate px-1 text-center';
  const tenue = `${celda} font-semibold text-black/40`;
  return (
    <>
      {/* Por debajo de xl cada fila es una tarjeta horizontal. */}
      <ul className="flex flex-col gap-3 xl:hidden">
        {datos.map((t) => (
          <li key={t.id_te} className="flex items-start gap-3 rounded-2xl border-2 border-black/10 bg-[#fdfdfc] p-3.5 sm:gap-4 sm:px-5">
            {seleccion && (
              <span className="pt-1">
                <CasillaFila seleccion={seleccion} id={t.id_te} nombre={t.tendencia} />
              </span>
            )}
            <button type="button" onClick={() => onAbrir(t.id_te)} className="flex min-w-0 flex-1 cursor-pointer flex-col gap-1 text-left">
              <span className="truncate text-caption font-bold text-azul-titulo">{t.megatendencia}</span>
              <span className="text-body font-bold leading-[1.2] text-black">{t.tendencia}</span>
              {t.descripcion && <span className="line-clamp-2 text-small text-black/50">{t.descripcion}</span>}
              <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption font-semibold text-black/40">
                <span>ID {t.id_te}</span>
                <span>{fechaCorta(t.fecha_publicacion)}</span>
              </span>
            </button>
            <div className="flex shrink-0 flex-col items-center gap-1">
              <BotonDescargar ruta="/tendencias" id={t.id_te} titulo={t.tendencia} />
              <BotonFavorito tipo="Tendencia" id={t.id_te} titulo={t.tendencia} />
              {t.fuentes[0]?.link && (
                <a href={t.fuentes[0].link} target="_blank" rel="noreferrer" aria-label={`Fuente de ${t.tendencia}`} className="grid size-10 place-items-center rounded-lg hover:bg-black/5">
                  <img src={iconoEnlace} alt="" aria-hidden className="size-5" />
                </a>
              )}
              {onEditar && (
                <button type="button" aria-label={`Editar ${t.tendencia}`} onClick={() => onEditar(t)} className="grid size-10 cursor-pointer place-items-center rounded-lg hover:bg-black/5">
                  <img src={iconoEditar} alt="" className="size-[22px]" />
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto xl:block">
        <table className="w-full min-w-[1100px] table-fixed border-separate border-spacing-0 text-body">
          <colgroup>
            {seleccion && <col style={{ width: 48 }} />}
            {columnas.map((c) => (
              <col key={c.titulo} style={{ width: c.ancho }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {seleccion && (
                <th scope="col" className="h-10 border-y-2 border-l-2 border-black/10 bg-black/10 text-center">
                  <CasillaTodos seleccion={seleccion} pagina={datos.map((t) => ({ id: t.id_te, nombre: t.tendencia }))} />
                </th>
              )}
              {columnas.map((c, i) => (
                <th
                  key={c.titulo}
                  scope="col"
                  aria-sort={c.orden ? ariaOrden(orden, c.orden) : undefined}
                  className={`h-10 border-y-2 border-black/10 bg-black/10 text-center font-bold text-azul-titulo ${i === 0 && !seleccion ? 'border-l-2' : ''} ${i === columnas.length - 1 ? 'border-r-2' : ''}`}
                >
                  {c.orden ? <BotonOrden titulo={c.titulo} campo={c.orden} orden={orden} onOrdenar={onOrdenar} /> : c.titulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-[#fdfdfc] [&_td:first-child]:border-l-2 [&_td:last-child]:border-r-2 [&_td]:border-black/10 [&_tr:last-child_td]:border-b-2">
            {datos.map((t) => (
              <tr key={t.id_te} className={seleccion?.tiene(t.id_te) ? 'bg-[#eef3ff]' : 'hover:bg-fondo'}>
                {seleccion && (
                  <td className="h-10 text-center">
                    <CasillaFila seleccion={seleccion} id={t.id_te} nombre={t.tendencia} />
                  </td>
                )}
                <td className={tenue}>{t.id_te}</td>
                <td className={`${celda} font-bold text-azul-titulo`}>{t.megatendencia}</td>
                <td className="h-10 px-1 text-center font-bold leading-[1.1] text-black">
                  <button type="button" className="line-clamp-2 max-w-full cursor-pointer hover:underline" onClick={() => onAbrir(t.id_te)}>
                    {t.tendencia}
                  </button>
                </td>
                <td className={tenue} title={t.descripcion ?? ''}>{t.descripcion}</td>
                <td className={tenue} title={t.comportamiento_mundo ?? ''}>{t.comportamiento_mundo}</td>
                <td className={tenue} title={t.comportamiento_colombia ?? ''}>{t.comportamiento_colombia}</td>
                <td className={tenue}>{fechaCorta(t.fecha_publicacion)}</td>
                <td className={celda}>
                  {t.fuentes[0]?.link ? (
                    <a href={t.fuentes[0].link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-bold text-azul-titulo hover:underline">
                      Ver <img src={iconoEnlace} alt="" aria-hidden className="size-5" />
                    </a>
                  ) : (
                    <span className="text-black/40">—</span>
                  )}
                </td>
                {usuario && (
                  <td className={celda}>
                    <div className="flex justify-center">
                      <BotonDescargar ruta="/tendencias" id={t.id_te} titulo={t.tendencia} />
                      <BotonFavorito tipo="Tendencia" id={t.id_te} titulo={t.tendencia} />
                    </div>
                  </td>
                )}
                {onEditar && (
                  <td className={celda}>
                    <button type="button" aria-label={`Editar ${t.tendencia}`} onClick={() => onEditar(t)} className="inline-grid cursor-pointer place-items-center rounded p-0.5 hover:bg-black/5">
                      <img src={iconoEditar} alt="" className="size-[23px]" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

const FILTROS_INICIALES = { megatendencia: '', q: '', dias: '', estado: '' };

/** Tendencias Empresariales: listado (tarjetas, compactas, tabla) y mapa de tendencias. */
export function Tendencias() {
  const { id } = useParams();
  const navegar = useNavigate();
  const { puedeGestionar, esSuperAdmin, esGestor } = useSesion();
  const gestiona = puedeGestionar('tendencias');
  /** La vista en tabla es solo para los gestores y la administración (no para el público ni los invitados). */
  const conTabla = esSuperAdmin || esGestor;
  const [orden, setOrden] = useState<Orden>(null);
  const [pestana, setPestana] = useState<'lista' | 'mapa'>('lista');
  const [vistaElegida, setVista] = useState<VistaLista>('tarjetas');
  // En celular solo se usan las tarjetas compactas: la tabla y las tarjetas grandes no caben bien.
  const ancha = useConsultaMedia(DESDE_SM);
  const vista: VistaLista = !ancha ? 'compactas' : vistaElegida === 'tabla' && !conTabla ? 'tarjetas' : vistaElegida;
  const [borrador, setBorrador] = useState(FILTROS_INICIALES);
  const [filtros, setFiltros] = useState(borrador);
  const [pagina, setPagina] = useState(1);
  const [formulario, setFormulario] = useState<{ registro?: Tendencia } | null>(null);

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
  const [tamano, setTamano] = useState<TamanoTabla>(15);
  const seleccion = useSeleccion();
  const limite = vista === 'tabla' ? tamano : vista === 'compactas' ? 12 : 8;
  const { data, isLoading, error, refetch } = useListado<Tendencia>('/tendencias', {
    ...consulta,
    ...(vista === 'tabla' ? consultaOrden(orden) : {}),
    pagina,
    limite,
  });
  const abrir = (idT: number) => navegar(`/tendencias/${idT}`);
  // Desde el mapa: vuelve al listado con la megatendencia y la tendencia elegidas como filtros.
  const verTendencia = (megatendencia: string, tendencia: string) => {
    const nuevos = { megatendencia, q: tendencia, dias: '', estado: '' };
    setFiltros(nuevos);
    setBorrador(nuevos);
    setPagina(1);
    setPestana('lista');
    window.scrollTo({ top: 0 });
  };

  // Chips de "Filtros aplicados" (Figma: "Resultados").
  const aplicados = [
    filtros.megatendencia && { campo: 'megatendencia' as const, texto: filtros.megatendencia },
    filtros.q && { campo: 'q' as const, texto: filtros.q },
    filtros.dias && { campo: 'dias' as const, texto: FECHAS.find((f) => f.valor === filtros.dias)?.texto ?? '' },
  ].filter((f): f is { campo: 'megatendencia' | 'q' | 'dias'; texto: string } => !!f);
  const quitarFiltro = (campo?: 'megatendencia' | 'q' | 'dias') => {
    const nuevos = campo ? { ...filtros, [campo]: '' } : FILTROS_INICIALES;
    setFiltros(nuevos);
    setBorrador(nuevos);
    setPagina(1);
  };

  const pestanaClase = (activa: boolean) =>
    // En celular es un control segmentado (como Semanal/Mensual); desde sm, las pestañas del Figma.
    `h-10 flex-1 cursor-pointer whitespace-nowrap rounded-full px-2 text-caption font-bold tracking-[0.02em] min-[400px]:text-small sm:rounded-[15px] sm:text-body ${
      activa ? 'bg-rojo-activo text-white' : 'text-black hover:bg-fondo sm:border-2 sm:border-black/10 sm:bg-[#fdfdfc]'
    }`;
  type OpcionVista = { valor: VistaLista; etiqueta: string; icono: string; forma: string; ancho: string };
  const vistas = ([
    { valor: 'tarjetas', etiqueta: 'Vista en tarjetas', icono: vistaGrande, forma: 'rounded-l-[20px]', ancho: 'w-[47px]' },
    { valor: 'compactas', etiqueta: 'Vista compacta', icono: vistaCompacta, forma: '', ancho: 'w-[47px]' },
    { valor: 'tabla', etiqueta: 'Vista en tabla', icono: vistaLista, forma: 'rounded-r-[20px]', ancho: 'w-[50px]' },
  ] as OpcionVista[]).filter((v) => v.valor !== 'tabla' || conTabla);
  if (!conTabla) vistas[vistas.length - 1]!.forma = 'rounded-r-[20px]';

  return (
    <>
      <EncabezadoPagina
        iconoConCuadro={iconoEncabezado}
        titulo="Tendencias Empresariales"
        subtitulo="Megatendencias globales y su impacto en Colombia"
        claseSubtitulo="text-body font-bold tracking-[-0.5px] text-[#0d2375] sm:text-subtitle"
        acciones={
          pestana === 'lista' && gestiona ? (
            <CargaMasiva ruta="/tendencias" modulo="Tendencias" />
          ) : undefined
        }
        className="mb-6"
      />
      <div
        role="tablist"
        aria-label="Secciones de tendencias"
        className={`mb-3.5 flex gap-1 rounded-full border-2 border-black/10 bg-white p-1 sm:gap-[21px] sm:rounded-[20px] sm:bg-white/50 sm:pb-[9px] sm:pl-[26px] sm:pr-[23px] sm:pt-[7px] ${pestana === 'lista' ? 'xl:ml-1' : 'xl:mb-[27px]'}`}
      >
        <button type="button" role="tab" aria-selected={pestana === 'lista'} className={pestanaClase(pestana === 'lista')} onClick={() => setPestana('lista')}>
          Tendencias
        </button>
        <button type="button" role="tab" aria-selected={pestana === 'mapa'} className={pestanaClase(pestana === 'mapa')} onClick={() => setPestana('mapa')}>
          Mapa de tendencias
        </button>
      </div>

      {pestana === 'mapa' ? (
        <MapaTendencias onVerTendencia={verTendencia} />
      ) : (
        <>
          <BarraFiltros
            className="min-h-[50px]! gap-3 xl:mb-[35px]"
            activos={contarActivos(filtros, FILTROS_INICIALES)}
            onBuscar={() => { setFiltros(borrador); setPagina(1); }}
            onLimpiar={() => quitarFiltro()}
            acciones={
              <>
                {gestiona && vista === 'tabla' && <MenuAcciones seleccion={seleccion} ruta="/tendencias" plural="tendencias" />}
                {gestiona && (
                  <button
                    type="button"
                    onClick={() => setFormulario({})}
                    className="inline-flex h-[46px] cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-rojo px-4 text-body font-bold text-white hover:bg-[#c2002e] sm:h-[50px] sm:rounded-[20px] sm:border-2 sm:border-black/10 sm:bg-white sm:px-6 sm:tracking-[-0.5px] sm:text-black sm:hover:bg-fondo xl:w-[286px]"
                  >
                    {/* En celular comparte fila con "Filtros": texto corto. */}
                    <span className="sm:hidden">+ Nuevo registro</span>
                    <span className="hidden sm:inline">Crear nuevo registro</span>
                  </button>
                )}
                {ancha && (
                  <div role="group" aria-label="Vista" className="flex h-[50px] items-center justify-center rounded-[20px] border-2 border-black/10 bg-[#fdfdfc]/50 px-[10px]">
                    {vistas.map((v) => (
                      <button
                        key={v.valor}
                        type="button"
                        aria-label={v.etiqueta}
                        aria-pressed={vista === v.valor}
                        onClick={() => {
                          setVista(v.valor);
                          setPagina(1);
                        }}
                        className={`grid h-[33px] cursor-pointer place-items-center ${v.ancho} ${v.forma} ${vista === v.valor ? 'bg-rojo-activo' : 'hover:bg-black/5'}`}
                      >
                        <img src={v.icono} alt="" />
                      </button>
                    ))}
                  </div>
                )}
              </>
            }
          >
            <Filtro
              etiqueta="Megatendencia"
              todos="Todas las megatendencias"
              className="xl:w-[280px]"
              opciones={todasLasMegatendencias(megatendencias).map((m) => ({ valor: m, texto: m }))}
              valor={borrador.megatendencia}
              onChange={(v) => setBorrador({ ...borrador, megatendencia: v, q: '' })}
            />
            <Filtro etiqueta="Tendencia" todos="Todas las tendencias" className="xl:w-[250px]" opciones={opcionesTendencia} valor={borrador.q} onChange={(v) => setBorrador({ ...borrador, q: v })} />
            <Filtro etiqueta="Fecha" todos="Todas las fechas" className="xl:w-[210px]" opciones={FECHAS} valor={borrador.dias} onChange={(v) => setBorrador({ ...borrador, dias: v })} />
          </BarraFiltros>

          {aplicados.length > 0 && (
            <div className="mb-[21px] flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-small font-semibold text-gris-azulado">Filtros aplicados:</span>
                {aplicados.map((f) => (
                  <span key={f.campo} className="inline-flex h-[29px] items-center gap-2 rounded-full bg-azul-marino/8 px-3 text-caption font-semibold text-azul-marino">
                    {f.texto}
                    <button type="button" aria-label={`Quitar el filtro ${f.texto}`} className="cursor-pointer font-bold" onClick={() => quitarFiltro(f.campo)}>
                      ✕
                    </button>
                  </span>
                ))}
                <button type="button" className="cursor-pointer text-small font-semibold text-rojo-vivo hover:underline" onClick={() => quitarFiltro()}>
                  Limpiar filtros
                </button>
              </div>
              {data && (
                <p className="text-small font-semibold text-gris-azulado">
                  Mostrando {data.datos.length} de {numero(data.total)} registros
                </p>
              )}
            </div>
          )}

          {isLoading ? (
            <Cargando />
          ) : error ? (
            <MensajeError mensaje={mensajeDeError(error)} onReintentar={() => refetch()} />
          ) : !data?.datos.length ? (
            <EstadoVacio titulo="No hay tendencias para estos filtros" detalle="Prueba con otra megatendencia o periodo." />
          ) : (
            <>
              {vista === 'tabla' ? (
                <TablaTendencias
                  datos={data.datos}
                  onAbrir={abrir}
                  onEditar={gestiona ? (t) => setFormulario({ registro: t }) : undefined}
                  seleccion={gestiona ? seleccion : undefined}
                  orden={orden}
                  onOrdenar={(o) => {
                    setOrden(o);
                    setPagina(1);
                  }}
                />
              ) : (
                <div className={`grid gap-6 ${vista === 'tarjetas' ? 'lg:grid-cols-2 xl:gap-8' : 'sm:grid-cols-2 xl:grid-cols-3 xl:gap-x-[33px] xl:gap-y-[30px]'}`}>
                  {data.datos.map((t) => (
                    <TarjetaTendencia key={t.id_te} t={t} onAbrir={() => abrir(t.id_te)} />
                  ))}
                </div>
              )}
              {vista === 'tabla' ? (
                <PieTabla
                  pagina={data.pagina}
                  paginas={data.paginas}
                  total={data.total}
                  tamano={tamano}
                  onCambiarPagina={setPagina}
                  onCambiarTamano={(t) => {
                    setTamano(t);
                    setPagina(1);
                  }}
                />
              ) : (
                <Paginacion pagina={data.pagina} paginas={data.paginas} onCambiar={setPagina} />
              )}
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
    </>
  );
}
