import type { DatesSetArg, EventClickArg, EventContentArg } from '@fullcalendar/core';
import esLocale from '@fullcalendar/core/locales/es';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin, { type DateClickArg } from '@fullcalendar/interaction';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Clock, DollarSign, ExternalLink, MapPin, MonitorSmartphone } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { api, mensajeDeError } from '../../api/cliente';
import { registrarActividad, useDetalle } from '../../api/consultas';
import type { Evento, Pagina, TipoEvento } from '../../api/tipos';
import { Boton } from '../../componentes/ui/Boton';
import iconoPanel from '../../assets/figma/eventos/calendario-panel.svg';
import { DatoConIcono, EncabezadoPagina, Insignia, MensajeError } from '../../componentes/ui/Elementos';
import { Modal } from '../../componentes/ui/Modal';
import { useSesion } from '../../sesion/sesion';
import { costo, fechaLarga, modalidadTexto, rangoHoras } from '../../utilidades/formato';
import { FormularioEvento } from './FormularioEvento';

/** Color de cada tipo de evento (Figma: texto del color y fondo al 12 %). */
const COLOR_TIPO: Record<TipoEvento, { color: string; tono: 'azul' | 'verde' | 'rojo' | 'morado' | 'naranja' | 'gris' }> = {
  Congreso: { color: '#266bd9', tono: 'azul' },
  Foro: { color: '#0a8c5c', tono: 'verde' },
  Cumbre: { color: '#0a8c5c', tono: 'verde' },
  Seminario: { color: '#e4002b', tono: 'rojo' },
  Taller: { color: '#a32afa', tono: 'morado' },
  Hackathon: { color: '#e07314', tono: 'naranja' },
  Otro: { color: '#69788c', tono: 'gris' },
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

function DetalleEvento({ evento, onEditar }: { evento: Evento; onEditar?: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Insignia tono={COLOR_TIPO[evento.tipo_evento].tono}>{evento.tipo_evento}</Insignia>
        <h2 className="mt-2 text-subtitle font-bold leading-snug text-azul-titulo">{evento.titulo}</h2>
      </div>
      <DatoConIcono icono={<CalendarDays />} etiqueta="Fecha">
        {fechaLarga(evento.fecha_inicio)}
        {evento.fecha_fin && fechaLarga(evento.fecha_fin) !== fechaLarga(evento.fecha_inicio) && ` al ${fechaLarga(evento.fecha_fin)}`}
      </DatoConIcono>
      <DatoConIcono icono={<Clock />} etiqueta="Horario">
        {rangoHoras(evento.fecha_inicio, evento.fecha_fin)}
      </DatoConIcono>
      <DatoConIcono icono={<MonitorSmartphone />} etiqueta="Modalidad">
        {modalidadTexto(evento.modalidad)}
      </DatoConIcono>
      {evento.lugar && (
        <DatoConIcono icono={<MapPin />} etiqueta="Lugar">
          {evento.lugar}
        </DatoConIcono>
      )}
      <DatoConIcono icono={<DollarSign />} etiqueta="Costo">
        <span className={evento.es_gratuito || !evento.costo ? 'text-exito' : ''}>{costo(evento.costo, evento.es_gratuito)}</span>
      </DatoConIcono>
      {evento.descripcion && <p className="whitespace-pre-line text-small leading-relaxed text-texto-suave">{evento.descripcion}</p>}
      <div className="flex flex-col gap-2.5">
        {evento.link_externo && (
          <a
            href={evento.link_externo}
            target="_blank"
            rel="noreferrer"
            onClick={() => registrarActividad('Evento', evento.id_evento, 'Clic_acceder')}
            className="inline-flex h-[42px] items-center justify-center gap-2 rounded-control bg-rojo px-5 text-small font-bold uppercase text-white hover:bg-[#c2002e]"
          >
            Más información <ExternalLink className="size-4" aria-hidden />
          </a>
        )}
        {onEditar && (
          <Boton variante="secundario" onClick={onEditar}>
            Editar evento
          </Boton>
        )}
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
    <div className="flex h-full flex-col gap-1 overflow-hidden rounded-lg p-2.5 text-caption" style={{ background: fondoTipo(evento.tipo_evento) }}>
      <p className="font-bold leading-[1.2]" style={{ color }}>
        {event.title}
      </p>
      <p className="leading-[1.2] text-[#0a1c40]/80">{rangoHoras(evento.fecha_inicio, evento.fecha_fin)}</p>
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
    `h-[39px] cursor-pointer rounded-full px-[22px] text-small font-semibold ${vista === v ? 'bg-rojo-vivo text-white' : 'text-[#0a1c40] hover:bg-fondo'}`;

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
          <div className="flex flex-wrap items-center gap-4">
            {gestiona && (
              <Boton pildora className="px-5!" onClick={() => setFormulario({})}>
                Crear evento
              </Boton>
            )}
            <div role="group" aria-label="Vista del calendario" className="flex gap-1 rounded-full border border-[#d9dee8] bg-white p-1">
              <button type="button" aria-pressed={vista === 'timeGridWeek'} className={claseVista('timeGridWeek')} onClick={() => cambiarVista('timeGridWeek')}>
                Semanal
              </button>
              <button type="button" aria-pressed={vista === 'dayGridMonth'} className={claseVista('dayGridMonth')} onClick={() => cambiarVista('dayGridMonth')}>
                Mensual
              </button>
            </div>
            <div className="flex h-11 items-center gap-5 rounded-full border border-[#d9dee8] bg-white px-[18px] text-[#0a1c40]">
              <button type="button" aria-label="Periodo anterior" className="cursor-pointer text-body font-bold" onClick={() => calendario.current?.getApi().prev()}>
                ‹
              </button>
              <span className="min-w-[110px] text-center text-small font-bold" aria-live="polite">
                {rango?.titulo}
              </span>
              <button type="button" aria-label="Periodo siguiente" className="cursor-pointer text-body font-bold" onClick={() => calendario.current?.getApi().next()}>
                ›
              </button>
            </div>
          </div>
        }
      />

      {error && <MensajeError mensaje={mensajeDeError(error)} onReintentar={() => refetch()} />}

      <div className={`grid gap-6 ${vista === 'timeGridWeek' ? 'xl:grid-cols-[1fr_420px]' : ''}`}>
        <div
          className={`overflow-hidden bg-white ${
            vista === 'timeGridWeek' ? 'calendario-semana rounded-2xl border border-[#e5e8f0]' : 'calendario-mes rounded-[20px] border-2 border-black/10'
          }`}
        >
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
            }}
            dateClick={gestiona ? (arg: DateClickArg) => setFormulario({ inicio: arg.date }) : undefined}
          />
        </div>

        {vista === 'timeGridWeek' && (
          <aside className="flex flex-col rounded-2xl border border-[#e5e8f0] bg-white p-6 xl:h-[800px]">
            {seleccionado ? (
              <DetalleEvento evento={seleccionado} onEditar={editarSeleccionado} />
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
        <Modal abierto onCerrar={() => navegar('/eventos')} titulo="Detalle del evento" ancho={520}>
          <DetalleEvento evento={seleccionado} onEditar={editarSeleccionado} />
        </Modal>
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
