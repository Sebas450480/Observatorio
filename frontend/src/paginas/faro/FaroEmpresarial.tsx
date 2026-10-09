import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { mensajeDeError } from '../../api/cliente';
import iconoCalendario from '../../assets/figma/iconos/calendario-meta.svg';
import iconoCosto from '../../assets/figma/iconos/costo.svg';
import iconoUbicacion from '../../assets/figma/iconos/ubicacion.svg';
import grafica from '../../assets/figma/tarjetas/grafica.svg';
import libro from '../../assets/figma/tarjetas/libro.svg';
import maletin from '../../assets/figma/tarjetas/maletin.svg';
import premio from '../../assets/figma/tarjetas/premio.svg';
import { useCategorias, useListado } from '../../api/consultas';
import { MODALIDADES, TIPOS_FARO, type Faro, type TipoFaro } from '../../api/tipos';
import { BarraFiltros, contarActivos } from '../../componentes/contenido/Controles';
import { Boton } from '../../componentes/ui/Boton';
import { Filtro } from '../../componentes/ui/Campos';
import { Cargando, EncabezadoPagina, EstadoVacio, Etiqueta, Insignia, MensajeError, MenuExportar, Paginacion } from '../../componentes/ui/Elementos';
import { useSesion } from '../../sesion/sesion';
import { costo, fechaMedia, modalidadTexto } from '../../utilidades/formato';
import { DatoTarjeta } from '../flash/FlashInformativo';
import { DetalleFaro } from './DetalleFaro';
import { FormularioFaro } from './FormularioFaro';

/** Estilo de cada tipo de registro (Figma: Beca verde, Convocatoria azul, Curso morado). */
export const ESTILO_TIPO: Record<TipoFaro, { singular: string; tono: 'verde' | 'azul' | 'morado' | 'naranja'; fondo: string; icono: string }> = {
  Becas: { singular: 'Beca', tono: 'verde', fondo: 'bg-[#edfcf5]', icono: premio },
  Convocatorias: { singular: 'Convocatoria', tono: 'azul', fondo: 'bg-[#ebf2ff]', icono: maletin },
  Cursos: { singular: 'Curso', tono: 'morado', fondo: 'bg-[#f5f0ff]', icono: grafica },
  Talleres: { singular: 'Taller', tono: 'naranja', fondo: 'bg-naranja-claro', icono: libro },
};

/** "Cierre: 2 de nov de 2026", "Cierre: Por definir" o "Inicio: 3 de feb de 2027". */
export function fechaClave(f: Faro, formato: (valor: string) => string = fechaMedia): string {
  if (f.tipo === 'Cursos' || f.tipo === 'Talleres') {
    if (f.fecha_inicio) return `Inicio: ${formato(f.fecha_inicio)}`;
  }
  return `Cierre: ${f.fecha_cierre ? formato(f.fecha_cierre) : 'Por definir'}`;
}

function TarjetaFaro({ faro, onAbrir }: { faro: Faro; onAbrir: () => void }) {
  const estilo = ESTILO_TIPO[faro.tipo];
  const valor = faro.es_gratuito || faro.costo ? costo(faro.costo, faro.es_gratuito) : [modalidadTexto(faro.modalidad), faro.duracion].filter(Boolean).join(' · ');
  return (
    <article className="flex flex-col overflow-hidden rounded-tarjeta bg-white shadow-tarjeta">
      <div className={`relative grid h-[104px] shrink-0 place-items-center ${faro.imagen ? '' : estilo.fondo}`}>
        {faro.imagen ? (
          <img src={faro.imagen} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <img src={estilo.icono} alt="" aria-hidden width={46} height={46} />
        )}
        <Insignia tono={estilo.tono} className="absolute left-3 top-3">
          {estilo.singular}
        </Insignia>
        {faro.estado_fe === 'Inactivo' && (
          <span className="absolute right-3 top-3 rounded-md bg-white/90 px-2 py-1 text-[12px] font-bold text-texto-suave">INACTIVO</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-[18px]">
        {faro.categorias.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {faro.categorias.slice(0, 3).map((c) => (
              <Etiqueta key={c.id_categoria}>{c.nombre}</Etiqueta>
            ))}
          </div>
        )}
        <h2 className="line-clamp-2 h-[45px] text-body font-bold text-texto">{faro.titulo}</h2>
        <ul className="mt-auto flex flex-col gap-1.5 text-small text-texto-suave">
          <DatoTarjeta icono={iconoCalendario}>{fechaClave(faro)}</DatoTarjeta>
          {faro.entidad && <DatoTarjeta icono={iconoUbicacion}>{faro.entidad}</DatoTarjeta>}
          {valor && (
            <DatoTarjeta icono={iconoCosto} className={`font-semibold ${valor === 'GRATUITO' ? 'text-exito' : 'text-texto'}`}>
              {valor}
            </DatoTarjeta>
          )}
        </ul>
        <button type="button" onClick={onAbrir} className="cursor-pointer rounded-md bg-rojo py-2.5 text-small font-bold uppercase text-white hover:bg-[#c2002e]">
          Acceder<span className="sr-only">: {faro.titulo}</span>
        </button>
      </div>
    </article>
  );
}

/** Faro Empresarial: becas, convocatorias, cursos y talleres. */
const FILTROS_INICIALES = { tipo: '', modalidad: '', categoria: '', estado: '', vigentes: 'true' };

export function FaroEmpresarial() {
  const { id } = useParams();
  const navegar = useNavigate();
  const { puedeGestionar } = useSesion();
  const gestiona = puedeGestionar('faro');
  const { data: categorias = [] } = useCategorias();

  const [borrador, setBorrador] = useState(FILTROS_INICIALES);
  const [filtros, setFiltros] = useState(borrador);
  const [pagina, setPagina] = useState(1);
  const [formulario, setFormulario] = useState<{ registro?: Faro } | null>(null);

  const consulta = {
    tipo: filtros.tipo || undefined,
    modalidad: filtros.modalidad || undefined,
    categoria: filtros.categoria || undefined,
    estado: filtros.estado || undefined,
    vigentes: filtros.vigentes,
  };
  const { data, isLoading, error, refetch } = useListado<Faro>('/faro', { ...consulta, pagina, limite: 6 });

  return (
    <>
      <EncabezadoPagina modulo="faro" titulo="Faro Empresarial" subtitulo="Becas, convocatorias, cursos y talleres para impulsar tu crecimiento empresarial." acciones={<MenuExportar ruta="/faro" consulta={consulta} />} />
      <BarraFiltros
        activos={contarActivos(filtros, FILTROS_INICIALES)}
        onBuscar={() => { setFiltros(borrador); setPagina(1); }}
        onLimpiar={() => { setBorrador(FILTROS_INICIALES); setFiltros(FILTROS_INICIALES); setPagina(1); }}
        extra={
          gestiona && (
            <Boton pildora onClick={() => setFormulario({})}>
              Crear registro
            </Boton>
          )
        }
      >
        <Filtro
          etiqueta="Tipo de registro"
          todos="Todos los tipos"
          opciones={TIPOS_FARO.map((t) => ({ valor: t, texto: t }))}
          valor={borrador.tipo}
          onChange={(v) => setBorrador({ ...borrador, tipo: v })}
        />
        <Filtro
          etiqueta="Modalidad"
          todos="Todas las modalidades"
          opciones={MODALIDADES.map((m) => ({ valor: m, texto: modalidadTexto(m) }))}
          valor={borrador.modalidad}
          onChange={(v) => setBorrador({ ...borrador, modalidad: v })}
        />
        <Filtro
          etiqueta="Categoría"
          todos="Todas las categorías"
          opciones={categorias.map((c) => ({ valor: String(c.id_categoria), texto: c.nombre_categoria }))}
          valor={borrador.categoria}
          onChange={(v) => setBorrador({ ...borrador, categoria: v })}
        />
        <Filtro
          etiqueta="Vigencia"
          opciones={[{ valor: 'true', texto: 'Solo vigentes' }, { valor: 'false', texto: 'Incluir cerradas' }]}
          valor={borrador.vigentes}
          onChange={(v) => setBorrador({ ...borrador, vigentes: v })}
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
        <EstadoVacio titulo="No hay oportunidades para estos filtros" detalle="Prueba con otro tipo de registro o incluye las convocatorias cerradas." />
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 xl:gap-y-[17px]">
            {data.datos.map((f) => (
              <TarjetaFaro key={f.id_fe} faro={f} onAbrir={() => navegar(`/faro-empresarial/${f.id_fe}`)} />
            ))}
          </div>
          <Paginacion pagina={data.pagina} paginas={data.paginas} onCambiar={setPagina} />
        </>
      )}

      {id && (
        <DetalleFaro
          id={Number(id)}
          onCerrar={() => navegar('/faro-empresarial')}
          onEditar={
            gestiona
              ? (registro) => {
                  setFormulario({ registro });
                  navegar('/faro-empresarial');
                }
              : undefined
          }
        />
      )}
      {formulario && <FormularioFaro registro={formulario.registro} onCerrar={() => setFormulario(null)} />}
    </>
  );
}
