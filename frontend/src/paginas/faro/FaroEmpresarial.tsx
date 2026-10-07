import { BookOpen, CalendarDays, DollarSign, GraduationCap, Landmark, Lightbulb, MapPin, Wrench } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { mensajeDeError } from '../../api/cliente';
import { useCategorias, useListado } from '../../api/consultas';
import { MODALIDADES, TIPOS_FARO, type Faro, type TipoFaro } from '../../api/tipos';
import { BarraFiltros } from '../../componentes/contenido/Controles';
import { Boton } from '../../componentes/ui/Boton';
import { Filtro } from '../../componentes/ui/Campos';
import { Cargando, EncabezadoPagina, EstadoVacio, Etiqueta, Insignia, MensajeError, MenuExportar, Paginacion } from '../../componentes/ui/Elementos';
import { useSesion } from '../../sesion/sesion';
import { costo, fechaCorta, modalidadTexto } from '../../utilidades/formato';
import { DetalleFaro } from './DetalleFaro';
import { FormularioFaro } from './FormularioFaro';

/** Estilo de cada tipo de registro (Figma: Beca verde, Convocatoria azul, Curso morado). */
export const ESTILO_TIPO: Record<TipoFaro, { singular: string; tono: 'verde' | 'azul' | 'morado' | 'naranja'; fondo: string; icono: typeof BookOpen }> = {
  Becas: { singular: 'Beca', tono: 'verde', fondo: 'bg-exito-claro', icono: GraduationCap },
  Convocatorias: { singular: 'Convocatoria', tono: 'azul', fondo: 'bg-[#ebf3ff]', icono: Landmark },
  Cursos: { singular: 'Curso', tono: 'morado', fondo: 'bg-morado-claro', icono: BookOpen },
  Talleres: { singular: 'Taller', tono: 'naranja', fondo: 'bg-naranja-claro', icono: Wrench },
};

/** "Cierre: 2 de nov de 2026", "Cierre: Por definir" o "Inicio: 3 de feb de 2027". */
export function fechaClave(f: Faro): string {
  if (f.tipo === 'Cursos' || f.tipo === 'Talleres') {
    if (f.fecha_inicio) return `Inicio: ${fechaCorta(f.fecha_inicio)}`;
  }
  return `Cierre: ${f.fecha_cierre ? fechaCorta(f.fecha_cierre) : 'Por definir'}`;
}

function TarjetaFaro({ faro, onAbrir }: { faro: Faro; onAbrir: () => void }) {
  const estilo = ESTILO_TIPO[faro.tipo];
  const Icono = estilo.icono;
  const valor = faro.es_gratuito || faro.costo ? costo(faro.costo, faro.es_gratuito) : [modalidadTexto(faro.modalidad), faro.duracion].filter(Boolean).join(' · ');
  return (
    <article className="flex flex-col overflow-hidden rounded-tarjeta bg-white shadow-tarjeta">
      <div className={`relative grid h-[104px] place-items-center ${faro.imagen ? '' : estilo.fondo}`}>
        {faro.imagen ? <img src={faro.imagen} alt="" className="absolute inset-0 size-full object-cover" /> : <Icono className="size-11 text-black/10" aria-hidden />}
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
        <h2 className="line-clamp-2 min-h-[45px] text-body font-bold leading-snug text-texto">{faro.titulo}</h2>
        <ul className="mt-auto flex flex-col gap-1.5 text-small text-texto-suave">
          <li className="flex items-center gap-2">
            <CalendarDays className="size-3.5 shrink-0" aria-hidden /> {fechaClave(faro)}
          </li>
          {faro.entidad && (
            <li className="flex items-center gap-2">
              <MapPin className="size-3.5 shrink-0" aria-hidden /> <span className="truncate">{faro.entidad}</span>
            </li>
          )}
          {valor && (
            <li className={`flex items-center gap-2 font-semibold ${valor === 'GRATUITO' ? 'text-exito' : 'text-texto'}`}>
              <DollarSign className="size-3.5 shrink-0 text-texto-suave" aria-hidden /> {valor}
            </li>
          )}
        </ul>
        <button type="button" onClick={onAbrir} className="h-10 cursor-pointer rounded-md bg-rojo text-small font-bold uppercase text-white hover:bg-[#c2002e]">
          Acceder<span className="sr-only">: {faro.titulo}</span>
        </button>
      </div>
    </article>
  );
}

/** Faro Empresarial: becas, convocatorias, cursos y talleres. */
export function FaroEmpresarial() {
  const { id } = useParams();
  const navegar = useNavigate();
  const { puedeGestionar } = useSesion();
  const gestiona = puedeGestionar('faro');
  const { data: categorias = [] } = useCategorias();

  const [borrador, setBorrador] = useState({ tipo: '', modalidad: '', categoria: '', estado: '', vigentes: 'true' });
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
      <EncabezadoPagina icono={<Lightbulb />} titulo="Faro Empresarial" subtitulo="Becas, convocatorias, cursos y talleres para impulsar tu crecimiento empresarial." />
      <BarraFiltros acciones={<MenuExportar ruta="/faro" consulta={consulta} />}>
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
        <select
          aria-label="Vigencia"
          value={borrador.vigentes}
          onChange={(e) => setBorrador({ ...borrador, vigentes: e.target.value })}
          className="h-[42px] cursor-pointer rounded-control border border-borde bg-white px-3.5 text-small text-texto"
        >
          <option value="true">Solo vigentes</option>
          <option value="false">Incluir cerradas</option>
        </select>
        {gestiona && (
          <Filtro
            etiqueta="Estado"
            todos="Todos los estados"
            opciones={[{ valor: 'Activo', texto: 'Activos' }, { valor: 'Inactivo', texto: 'Inactivos' }]}
            valor={borrador.estado}
            onChange={(v) => setBorrador({ ...borrador, estado: v })}
          />
        )}
        <Boton pildora onClick={() => { setFiltros(borrador); setPagina(1); }}>
          Buscar
        </Boton>
        {gestiona && (
          <Boton pildora onClick={() => setFormulario({})}>
            Crear registro
          </Boton>
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
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
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
