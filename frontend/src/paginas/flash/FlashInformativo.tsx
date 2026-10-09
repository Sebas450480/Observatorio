import { useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router';
import { mensajeDeError } from '../../api/cliente';
import iconoCalendario from '../../assets/figma/iconos/calendario-meta.svg';
import iconoCosto from '../../assets/figma/iconos/costo.svg';
import iconoUbicacion from '../../assets/figma/iconos/ubicacion.svg';
import cohete from '../../assets/figma/tarjetas/cohete.svg';
import globo from '../../assets/figma/tarjetas/globo.svg';
import grafica from '../../assets/figma/tarjetas/grafica.svg';
import libro from '../../assets/figma/tarjetas/libro.svg';
import maletin from '../../assets/figma/tarjetas/maletin.svg';
import premio from '../../assets/figma/tarjetas/premio.svg';
import { useCategorias, useListado } from '../../api/consultas';
import type { Flash, Modalidad } from '../../api/tipos';
import { BarraFiltros, contarActivos } from '../../componentes/contenido/Controles';
import { Boton } from '../../componentes/ui/Boton';
import { Filtro } from '../../componentes/ui/Campos';
import { Cargando, EncabezadoPagina, EstadoVacio, Etiqueta, Insignia, MensajeError, MenuExportar, Paginacion } from '../../componentes/ui/Elementos';
import { useSesion } from '../../sesion/sesion';
import { DEPARTAMENTOS, opcionesAnios } from '../../utilidades/colombia';
import { costo, fechaLarga, modalidadTexto } from '../../utilidades/formato';
import { DetalleFlash } from './DetalleFlash';
import { FormularioFlash } from './FormularioFlash';

/** Fondo e ilustración de cada tarjeta (los 6 estilos del Figma, en rotación). */
const ESTILOS_TARJETA = [
  { fondo: 'bg-[#ebf3ff]', icono: grafica },
  { fondo: 'bg-exito-claro', icono: maletin },
  { fondo: 'bg-rojo-claro', icono: premio },
  { fondo: 'bg-morado-claro', icono: globo },
  { fondo: 'bg-naranja-claro', icono: libro },
  { fondo: 'bg-cian-claro', icono: cohete },
];

export function tonoModalidad(m: Modalidad | null): 'azul' | 'verde' | 'morado' {
  if (m === 'Presencial') return 'verde';
  if (m === 'Hibrido') return 'morado';
  return 'azul';
}

/** Fila de dato de las tarjetas: ícono de 14 px y texto de 16 px. */
export function DatoTarjeta({ icono, children, className = '' }: { icono: string; children: ReactNode; className?: string }) {
  return (
    <li className={`flex min-w-0 items-center gap-2 ${className}`}>
      <img src={icono} alt="" aria-hidden className="size-[13px] shrink-0" />
      <span className="truncate">{children}</span>
    </li>
  );
}

function TarjetaFlash({ flash, indice, onAbrir }: { flash: Flash; indice: number; onAbrir: () => void }) {
  const estilo = ESTILOS_TARJETA[indice % ESTILOS_TARJETA.length]!;
  const gratuito = flash.es_gratuito || !flash.costo;
  return (
    <article className="flex flex-col overflow-hidden rounded-tarjeta bg-white shadow-tarjeta">
      <div className={`relative grid h-[104px] shrink-0 place-items-center ${flash.imagen ? '' : estilo.fondo}`}>
        {flash.imagen ? (
          <img src={flash.imagen} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <img src={estilo.icono} alt="" aria-hidden width={46} height={46} />
        )}
        <Insignia tono={tonoModalidad(flash.modalidad)} className="absolute left-3 top-3">
          {modalidadTexto(flash.modalidad)}
        </Insignia>
        {flash.estado_fi === 'Inactivo' && (
          <span className="absolute right-3 top-3 rounded-md bg-white/90 px-2 py-1 text-[12px] font-bold text-texto-suave">INACTIVO</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-[18px]">
        {flash.categorias.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {flash.categorias.slice(0, 3).map((c) => (
              <Etiqueta key={c.id_categoria}>{c.nombre}</Etiqueta>
            ))}
          </div>
        )}
        <h2 className="line-clamp-2 h-[45px] text-body font-bold text-texto">{flash.titulo}</h2>
        <ul className="mt-auto flex flex-col gap-1.5 text-small text-texto-suave">
          <DatoTarjeta icono={iconoCalendario}>{fechaLarga(flash.fecha_inicio)}</DatoTarjeta>
          {flash.lugar && <DatoTarjeta icono={iconoUbicacion}>{flash.lugar}</DatoTarjeta>}
          <DatoTarjeta icono={iconoCosto} className={`font-semibold ${gratuito ? 'text-exito' : 'text-texto'}`}>
            {gratuito ? 'GRATUITO' : costo(flash.costo, false)}
          </DatoTarjeta>
        </ul>
        <button type="button" onClick={onAbrir} className="cursor-pointer rounded-md bg-rojo py-2.5 text-small font-bold uppercase text-white hover:bg-[#c2002e]">
          Acceder
          <span className="sr-only">: {flash.titulo}</span>
        </button>
      </div>
    </article>
  );
}

/** Flash Informativo: eventos y oportunidades del entorno empresarial. */
const FILTROS_INICIALES = { departamento: '', anio: '', categoria: '', estado: '' };

export function FlashInformativo() {
  const { id } = useParams();
  const navegar = useNavigate();
  const { puedeGestionar } = useSesion();
  const gestiona = puedeGestionar('flash');
  const { data: categorias = [] } = useCategorias();

  const [borrador, setBorrador] = useState(FILTROS_INICIALES);
  const [filtros, setFiltros] = useState(borrador);
  const [pagina, setPagina] = useState(1);
  const [formulario, setFormulario] = useState<{ registro?: Flash } | null>(null);

  const consulta = {
    departamento: filtros.departamento || undefined,
    desde: filtros.anio ? `${filtros.anio}-01-01` : undefined,
    hasta: filtros.anio ? `${filtros.anio}-12-31` : undefined,
    categoria: filtros.categoria || undefined,
    estado: filtros.estado || undefined,
  };
  const { data, isLoading, error, refetch } = useListado<Flash>('/flash', { ...consulta, pagina, limite: 6 });

  return (
    <>
      <EncabezadoPagina
        modulo="flash"
        titulo="Flash Informativo"
        subtitulo="Mantente informado sobre los últimos acontecimientos empresariales, innovaciones y tendencias del mundo corporativo."
      acciones={<MenuExportar ruta="/flash" consulta={consulta} />} />
      <BarraFiltros
        activos={contarActivos(filtros, FILTROS_INICIALES)}
        onBuscar={() => { setFiltros(borrador); setPagina(1); }}
        onLimpiar={() => { setBorrador(FILTROS_INICIALES); setFiltros(FILTROS_INICIALES); setPagina(1); }}
        extra={
          gestiona && (
            <Boton pildora onClick={() => setFormulario({})}>
              Crear Flash informativo
            </Boton>
          )
        }
      >
        <Filtro etiqueta="Región" todos="Todas las regiones" opciones={DEPARTAMENTOS} valor={borrador.departamento} onChange={(v) => setBorrador({ ...borrador, departamento: v })} />
        <Filtro etiqueta="Año" todos="Todos los años" opciones={opcionesAnios()} valor={borrador.anio} onChange={(v) => setBorrador({ ...borrador, anio: v })} />
        <Filtro
          etiqueta="Categoría"
          todos="Todas las categorías"
          opciones={categorias.map((c) => ({ valor: String(c.id_categoria), texto: c.nombre_categoria }))}
          valor={borrador.categoria}
          onChange={(v) => setBorrador({ ...borrador, categoria: v })}
        />
        {gestiona && (
          <Filtro
            etiqueta="Estado"
            todos="Todos los estados"
            opciones={[{ valor: 'Activo', texto: 'Activos' }, { valor: 'Inactivo', texto: 'Inactivos' }]}
            valor={borrador.estado}
            onChange={(v) => setBorrador({ ...borrador, estado: v })}
          />
        )}
      </BarraFiltros>

      {isLoading ? (
        <Cargando />
      ) : error ? (
        <MensajeError mensaje={mensajeDeError(error)} onReintentar={() => refetch()} />
      ) : !data?.datos.length ? (
        <EstadoVacio titulo="No hay eventos para estos filtros" detalle="Prueba con otra región, año o categoría." />
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 xl:gap-y-[17px]">
            {data.datos.map((f, i) => (
              <TarjetaFlash key={f.id_fi} flash={f} indice={i} onAbrir={() => navegar(`/flash-informativo/${f.id_fi}`)} />
            ))}
          </div>
          <Paginacion pagina={data.pagina} paginas={data.paginas} onCambiar={setPagina} />
        </>
      )}

      {id && (
        <DetalleFlash
          id={Number(id)}
          onCerrar={() => navegar('/flash-informativo')}
          onEditar={
            gestiona
              ? (registro) => {
                  setFormulario({ registro });
                  navegar('/flash-informativo');
                }
              : undefined
          }
        />
      )}
      {formulario && (
        <FormularioFlash
          registro={formulario.registro}
          onCerrar={() => setFormulario(null)}
        />
      )}
    </>
  );
}
