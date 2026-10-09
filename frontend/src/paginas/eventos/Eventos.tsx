import type { DatesSetArg, EventClickArg, EventContentArg } from '@fullcalendar/core';
import esLocale from '@fullcalendar/core/locales/es';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin, { type DateClickArg } from '@fullcalendar/interaction';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { api, mensajeDeError } from '../../api/cliente';
import { registrarActividad, useDetalle } from '../../api/consultas';
import type { Evento, Pagina, TipoEvento } from '../../api/tipos';
import { Boton } from '../../componentes/ui/Boton';
import iconoPanel from '../../assets/figma/eventos/calendario-panel.svg';
import {
  AccionesDetalle, BotonDetalle, CajaDetalle, CUERPO_DETALLE, codigoDetalle, DatoDetalle, DatosDetalle, EnlaceDetalle, ICONO_DETALLE,
  MetaDetalle, SeccionDetalle, TextoDetalle,
} from '../../componentes/contenido/Detalle';
import { EncabezadoPagina, MensajeError } from '../../componentes/ui/Elementos';
import { Modal } from '../../componentes/ui/Modal';
import { useSesion } from '../../sesion/sesion';
import { costo, fechaLarga, modalidadTexto, nombreTipoEvento, rangoHoras } from '../../utilidades/formato';
import { FormularioEvento } from './FormularioEvento';

/** Color de cada tipo de evento (Figma: texto del color y fondo al 12 %). */
const COLOR_TIPO: Record<TipoEvento, { color: string }> = {
  Congreso: { color: '#266bd9' },
  Foro: { color: '#0a8c5c' },
  Cumbre: { color: '#0a8c5c' },
  Seminario: { color: '#e4002b' },
  Taller: { color: '#a32afa' },
  Hackathon: { color: '#e07314' },
  Otro: { color: '#69788c' },
};
const fondoTipo = (tipo: TipoEvento) => `${COLOR_TIPO[tipo].color}1f`;

/** "mié." → "MIE" (encabezados del calendario en el Figma). */
const sinTilde = (texto: string) =>
  texto
    .replace('.', '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

/** "18 – 24 oct 2026" (semana) u "Octubre 2026" (mes), como en el Figma. */
function tituloPeriodo(vista: Vista, inicio: Date, fin: Date): string {
  const opciones = (o: Intl.DateTimeFormatOptions) => (f: Date) => f.toLocaleDateString('es-CO', o).replace('.', '').replace('sept', 'sep');
  if (vista === 'dayGridMonth') {
    const texto = opciones({ month: 'long', year: 'numeric' })(inicio).replace(' de ', ' ');
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }
  const mes = opciones({ month: 'short' });
  const mismoMes = inicio.getMonth() === fin.getMonth();
  return `${inicio.getDate()}${mismoMes ? '' : ` ${mes(inicio)}`} – ${fin.getDate()} ${mes(fin)} ${fin.getFullYear()}`;
}

type Vista = 'timeGridWeek' | 'dayGridMonth';
const aDia = (fecha: Date) => fecha.toLocaleDateString('en-CA');

/** Datos del evento: los usa el panel de la vista semanal y el modal de la vista mensual. */
function CuerpoEvento({ evento, onEditar, panel = false }: { evento: Evento; onEditar?: () => void; panel?: boolean }) {
  const abrirEnlace = () => registrarActividad('Evento', evento.id_evento, 'Clic_acceder');
  const varios = evento.fecha_fin && fechaLarga(evento.fecha_fin) !== fechaLarga(evento.fecha_inicio);
  return (
    <>
      <DatosDetalle unaColumna={panel}>
        <DatoDetalle icono={ICONO_DETALLE.calendario} etiqueta="Fecha de inicio">
          {fechaLarga(evento.fecha_inicio)}
          {varios && ` al ${fechaLarga(evento.fecha_fin!)}`}
        </DatoDetalle>
        <DatoDetalle icono={ICONO_DETALLE.modalidad} etiqueta="Modalidad">
          {modalidadTexto(evento.modalidad)}
        </DatoDetalle>
        <DatoDetalle icono={ICONO_DETALLE.reloj} etiqueta="Horario">
          {rangoHoras(evento.fecha_inicio, evento.fecha_fin)}
        </DatoDetalle>
        <DatoDetalle icono={ICONO_DETALLE.costo} etiqueta="Costo de participación">
          {evento.es_gratuito || !evento.costo ? <span className="text-exito">Gratuito</span> : costo(evento.costo, false)}
        </DatoDetalle>
      </DatosDetalle>
      {evento.descripcion && (
        <SeccionDetalle titulo="Descripción">
          <TextoDetalle>{evento.descripcion}</TextoDetalle>
        </SeccionDetalle>
      )}
      {evento.lugar && (
        <SeccionDetalle titulo="Lugar de referencia">
          <CajaDetalle>{evento.lugar}</CajaDetalle>
        </SeccionDetalle>
      )}
      {evento.link_externo && (
        <SeccionDetalle titulo="Link de referencia">
          <CajaDetalle href={evento.link_externo} onClick={abrirEnlace}>
            {evento.link_externo.replace(/^https?:\/\//, '')}
          </CajaDetalle>
        </SeccionDetalle>
      )}
      {(onEditar || evento.link_externo) && (
        <AccionesDetalle apiladas={panel}>
          {onEditar && <BotonDetalle onClick={onEditar}>Editar</BotonDetalle>}
          {evento.link_externo && (
            <EnlaceDetalle href={evento.link_externo} onClick={abrirEnlace}>
              Más información
            </EnlaceDetalle>
          )}
        </AccionesDetalle>
      )}
    </>
  );
}

/** Modal de detalle de un evento en la vista mensual (Figma: "Modal — Detalle evento"). */
function DetalleEvento({ evento, onCerrar, onEditar }: { evento: Evento; onCerrar: () => void; onEditar?: () => void }) {
  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      ancho={700}
      destacado
      claseCuerpo={CUERPO_DETALLE}
      titulo={<span className="uppercase">{evento.titulo}</span>}
      sobreTitulo={<MetaDetalle etiqueta={nombreTipoEvento(evento)}>{codigoDetalle(evento.id_evento, evento.fecha_inicio)}</MetaDetalle>}
    >
      <CuerpoEvento evento={evento} onEditar={onEditar} />
    </Modal>
  );
}

/** Detalle del evento en el panel derecho de la vista semanal (donde dice "Selecciona un evento"). */
function PanelEvento({ evento, onCerrar, onEditar }: { evento: Evento; onCerrar: () => void; onEditar?: () => void }) {
  const color = COLOR_TIPO[evento.tipo_evento].color;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-start justify-between gap-3">
        <span className="rounded-full px-3 py-1 text-caption font-bold uppercase" style={{ color, background: fondoTipo(evento.tipo_evento) }}>
          {nombreTipoEvento(evento)}
        </span>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar el detalle del evento"
          className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full text-subtitle leading-none text-gris-azulado hover:bg-fondo"
        >
          ✕
        </button>
      </div>
      <h2 className="mt-3 text-subtitle font-black uppercase leading-tight text-azul-marino">{evento.titulo}</h2>
      <p className="mt-1 text-caption font-medium text-gris-azulado">{codigoDetalle(evento.id_evento, evento.fecha_inicio)}</p>
      <span className="mt-3 block h-1 w-16 rounded-xs bg-rojo" />
      <div className="mt-5 flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pr-1">
        <CuerpoEvento evento={evento} onEditar={onEditar} panel />
      </div>
    </div>
  );
}

function ContenidoEvento({ event, view }: EventContentArg) {
  const evento = event.extendedProps.evento as Evento;
  const color = COLOR_TIPO[evento.tipo_evento].color;
  if (view.type === 'dayGridMonth') {
    return (
      <span className="block truncate rounded-full px-[18px] text-small font-bold leading-[25px]" style={{ color, background: fondoTipo(evento.tipo_evento) }}>
        {event.title}
      </span>
    );
  }
  return (
    <div
      title={`${event.title} · ${rangoHoras(evento.fecha_inicio, evento.fecha_fin)}`}
      className="@container flex h-full flex-col gap-1 overflow-hidden rounded-lg border-l-[3px] p-2 text-caption @max-[100px]:p-1.5"
      // Fondo opaco (tono del tipo sobre blanco) para que los eventos que se cruzan no se mezclen.
      style={{ background: `linear-gradient(${fondoTipo(evento.tipo_evento)}, ${fondoTipo(evento.tipo_evento)}), #fff`, borderColor: color }}
    >
      {/* Cuando varios eventos se cruzan la columna se divide: en los angostos solo va el título (en vertical si es muy angosto). */}
      <p
        className="font-bold leading-[1.2] @max-[100px]:text-[11px] @max-[100px]:leading-[1.15] @max-[48px]:min-h-0 @max-[48px]:flex-1 @max-[48px]:truncate @max-[48px]:[writing-mode:vertical-rl]"
        style={{ color }}
      >
        {event.title}
      </p>
      <p className="leading-[1.2] text-[#0a1c40]/80 @max-[100px]:hidden">{rangoHoras(evento.fecha_inicio, evento.fecha_fin)}</p>
    </div>
  );
}

/** Calendario de eventos institucionales, vista semanal y mensual (Figma: "Calendario de Eventos"). */
export function Eventos() {
  const { id } = useParams();
  const idSeleccionado = id ? Number(id) : null;
  const navegar = useNavigate();
  const { puedeGestionar } = useSesion();
  const gestiona = puedeGestionar('calendario');
  const calendario = useRef<FullCalendar>(null);
  const panel = useRef<HTMLElement>(null);
  const [vista, setVista] = useState<Vista>('timeGridWeek');
  const [rango, setRango] = useState<{ desde: string; hasta: string; titulo: string } | null>(null);
  const [formulario, setFormulario] = useState<{ registro?: Evento; inicio?: Date } | null>(null);
  const movidoA = useRef<number | null>(null);

  const { data, error, refetch } = useQuery({
    queryKey: ['/calendario', 'rango', rango?.desde, rango?.hasta],
    queryFn: ({ signal }) =>
      api<Pagina<Evento>>('/calendario', { consulta: { desde: rango!.desde, hasta: rango!.hasta, limite: 100 }, senal: signal }),
    enabled: !!rango,
  });
  const { data: seleccionado } = useDetalle<Evento>('/calendario', idSeleccionado);

  // Al abrir un evento desde la búsqueda o un enlace, el calendario salta a su fecha.
  useEffect(() => {
    if (seleccionado && movidoA.current !== seleccionado.id_evento) {
      movidoA.current = seleccionado.id_evento;
      calendario.current?.getApi().gotoDate(seleccionado.fecha_inicio);
      registrarActividad('Evento', seleccionado.id_evento, 'Vista');
    }
  }, [seleccionado]);

  const cambiarVista = (nueva: Vista) => {
    setVista(nueva);
    calendario.current?.getApi().changeView(nueva);
  };

  const alCambiarFechas = (arg: DatesSetArg) => {
    const fin = new Date(arg.end);
    fin.setDate(fin.getDate() - 1);
    const vistaActual = arg.view.type as Vista;
    setRango({
      desde: aDia(arg.start),
      hasta: aDia(fin),
      titulo: tituloPeriodo(vistaActual, vistaActual === 'dayGridMonth' ? arg.view.currentStart : arg.start, fin),
    });
  };

  const eventos = (data?.datos ?? []).map((e) => ({
    id: String(e.id_evento),
    title: e.titulo,
    start: e.fecha_inicio,
    end: e.fecha_fin ?? undefined,
    backgroundColor: 'transparent',
    textColor: COLOR_TIPO[e.tipo_evento].color,
    classNames: idSeleccionado === e.id_evento ? ['ring-2', 'ring-azul-oscuro'] : [],
    extendedProps: { evento: e },
  }));

  const editarSeleccionado = gestiona && seleccionado ? () => setFormulario({ registro: seleccionado }) : undefined;
  const claseVista = (v: Vista) =>
    `h-[39px] flex-1 cursor-pointer rounded-full px-[22px] text-small font-semibold sm:flex-none ${vista === v ? 'bg-rojo-vivo text-white' : 'text-[#0a1c40] hover:bg-fondo'}`;

  return (
    <>
      <EncabezadoPagina
        modulo="eventos"
        cuadroRedondo
        titulo="Calendario de Eventos"
        subtitulo={vista === 'timeGridWeek' ? 'Consulta los eventos de la semana' : 'Organiza tu agenda visualmente por mes'}
        claseSubtitulo="text-body font-bold tracking-[-0.5px] text-[#0d2375] sm:text-subtitle"
        className={vista === 'timeGridWeek' ? 'mb-6 xl:mb-8' : 'mb-6 xl:mb-[38px]'}
        acciones={
          // En celular cada control ocupa su propia fila a lo ancho; desde sm van en una sola fila.
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
            {gestiona && (
              <Boton pildora className="px-5!" onClick={() => setFormulario({})}>
                Crear evento
              </Boton>
            )}
            <div role="group" aria-label="Vista del calendario" className="flex gap-1 rounded-full border border-[#d9dee8] bg-white p-1 sm:w-auto">
              <button type="button" aria-pressed={vista === 'timeGridWeek'} className={claseVista('timeGridWeek')} onClick={() => cambiarVista('timeGridWeek')}>
                Semanal
              </button>
              <button type="button" aria-pressed={vista === 'dayGridMonth'} className={claseVista('dayGridMonth')} onClick={() => cambiarVista('dayGridMonth')}>
                Mensual
              </button>
            </div>
            <div className="flex h-11 items-center justify-between gap-5 rounded-full border border-[#d9dee8] bg-white px-2 text-[#0a1c40] sm:justify-start sm:px-[10px]">
              <button type="button" aria-label="Periodo anterior" className="grid size-9 cursor-pointer place-items-center rounded-full text-body font-bold hover:bg-fondo" onClick={() => calendario.current?.getApi().prev()}>
                ‹
              </button>
              <span className="min-w-[110px] text-center text-small font-bold" aria-live="polite">
                {rango?.titulo}
              </span>
              <button type="button" aria-label="Periodo siguiente" className="grid size-9 cursor-pointer place-items-center rounded-full text-body font-bold hover:bg-fondo" onClick={() => calendario.current?.getApi().next()}>
                ›
              </button>
            </div>
          </div>
        }
      />

      {error && <MensajeError mensaje={mensajeDeError(error)} onReintentar={() => refetch()} />}

      <div className={`grid grid-cols-1 gap-6 ${vista === 'timeGridWeek' ? 'xl:grid-cols-[minmax(0,1fr)_420px]' : ''}`}>
        <div
          className={`overflow-hidden bg-white ${
            vista === 'timeGridWeek' ? 'calendario-semana rounded-2xl border border-[#e5e8f0]' : 'calendario-mes rounded-[20px] border-2 border-black/10'
          }`}
        >
          {/* En celular la semana conserva un ancho mínimo y se desplaza de lado para que los eventos se lean. */}
          <div className={vista === 'timeGridWeek' ? 'overflow-x-auto overscroll-x-contain' : ''}>
            <div className={vista === 'timeGridWeek' ? 'min-w-[720px] md:min-w-0' : ''}>
              <FullCalendar
                ref={calendario}
                plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
                locale={esLocale}
                initialView={vista}
                headerToolbar={false}
                allDaySlot={false}
                slotMinTime="07:00:00"
                slotMaxTime="21:00:00"
                scrollTime="08:00:00"
                height={vista === 'timeGridWeek' ? 800 : 'auto'}
                dayMaxEvents={3}
                slotEventOverlap={false}
                slotLabelFormat={(arg) => `${arg.date.hour}:00`}
                slotLabelInterval="01:00"
                firstDay={0}
                fixedWeekCount={false}
                dayHeaderContent={(arg) => {
                  if (arg.view.type !== 'timeGridWeek') return sinTilde(arg.text);
                  const nombre = sinTilde(arg.date.toLocaleDateString('es-CO', { weekday: 'short' }));
                  const domingo = arg.date.getDay() === 0;
                  return (
                    <span className={`flex flex-col items-center gap-0.5 ${domingo ? 'text-rojo-vivo' : ''}`}>
                      <span className={`text-caption font-semibold ${domingo ? '' : 'text-gris-azulado'}`}>{nombre}</span>
                      <span className={`text-subtitle font-bold ${domingo ? '' : 'text-[#0a1c40]'}`}>{arg.date.getDate()}</span>
                    </span>
                  );
                }}
                dayCellContent={(arg) => arg.date.getDate()}
                events={eventos}
                eventContent={ContenidoEvento}
                datesSet={alCambiarFechas}
                eventClick={(arg: EventClickArg) => {
                  arg.jsEvent.preventDefault();
                  movidoA.current = Number(arg.event.id);
                  registrarActividad('Evento', Number(arg.event.id), 'Vista');
                  navegar(`/eventos/${arg.event.id}`);
                  // En pantallas angostas el panel queda debajo del calendario: se lleva la vista hasta él.
                  if (arg.view.type === 'timeGridWeek' && window.innerWidth < 1280) {
                    window.setTimeout(() => panel.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
                  }
                }}
                dateClick={gestiona ? (arg: DateClickArg) => setFormulario({ inicio: arg.date }) : undefined}
              />
            </div>
          </div>
        </div>

        {vista === 'timeGridWeek' && (
          <aside ref={panel} className="flex scroll-mt-4 flex-col rounded-2xl border border-[#e5e8f0] bg-white p-6 xl:h-[800px]">
            {seleccionado ? (
              <PanelEvento evento={seleccionado} onCerrar={() => navegar('/eventos')} onEditar={editarSeleccionado} />
            ) : (
              <div className="m-auto flex max-w-[340px] flex-col items-center gap-3.5 py-10 text-center">
                <span className="grid size-20 place-items-center rounded-full bg-[#0d1f87]/8">
                  <img src={iconoPanel} alt="" aria-hidden className="size-9" />
                </span>
                <p className="text-subtitle font-bold text-[#0a1c40]">Selecciona un evento</p>
                <p className="text-small text-gris-azulado sm:text-body">Haz clic en un evento del calendario para ver aquí su información.</p>
              </div>
            )}
          </aside>
        )}
      </div>

      {vista === 'dayGridMonth' && seleccionado && !formulario && (
        <DetalleEvento evento={seleccionado} onCerrar={() => navegar('/eventos')} onEditar={editarSeleccionado} />
      )}
      {formulario && (
        <FormularioEvento
          registro={formulario.registro}
          inicio={formulario.inicio}
          onCerrar={() => {
            setFormulario(null);
            if (formulario.registro) navegar('/eventos');
          }}
        />
      )}
    </>
  );
}
