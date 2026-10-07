import type { DatesSetArg, EventClickArg, EventContentArg } from '@fullcalendar/core';
import esLocale from '@fullcalendar/core/locales/es';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin, { type DateClickArg } from '@fullcalendar/interaction';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, DollarSign, ExternalLink, MapPin, MonitorSmartphone } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { api, mensajeDeError } from '../../api/cliente';
import { registrarActividad, useDetalle } from '../../api/consultas';
import type { Evento, Pagina, TipoEvento } from '../../api/tipos';
import { Boton } from '../../componentes/ui/Boton';
import { DatoConIcono, Insignia, MensajeError, Tarjeta } from '../../componentes/ui/Elementos';
import { Modal } from '../../componentes/ui/Modal';
import { useSesion } from '../../sesion/sesion';
import { costo, fechaLarga, modalidadTexto, rangoHoras } from '../../utilidades/formato';
import { FormularioEvento } from './FormularioEvento';

/** Colores de cada tipo de evento (Figma: azul, verde, rojo y morado sobre fondo claro). */
const COLOR_TIPO: Record<TipoEvento, { fondo: string; texto: string; tono: 'azul' | 'verde' | 'rojo' | 'morado' | 'naranja' | 'gris' }> = {
  Congreso: { fondo: '#e6eefc', texto: '#1d5bd8', tono: 'azul' },
  Foro: { fondo: '#e3f3ec', texto: '#0f8a5f', tono: 'verde' },
  Cumbre: { fondo: '#e3f3ec', texto: '#0f8a5f', tono: 'verde' },
  Seminario: { fondo: '#fde8ec', texto: '#c8102e', tono: 'rojo' },
  Taller: { fondo: '#f1e8fd', texto: '#8b2fd8', tono: 'morado' },
  Hackathon: { fondo: '#fff1e3', texto: '#c2410c', tono: 'naranja' },
  Otro: { fondo: '#eef0f3', texto: '#4b5563', tono: 'gris' },
};

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
  if (view.type === 'dayGridMonth') {
    return <span className="block truncate px-2 py-0.5 text-[12px] font-semibold">{event.title}</span>;
  }
  return (
    <div className="h-full overflow-hidden p-1.5">
      <p className="text-[12px] font-bold leading-tight">{event.title}</p>
      <p className="mt-1 text-[11px] text-texto-suave">{rangoHoras(evento.fecha_inicio, evento.fecha_fin)}</p>
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
    setRango({ desde: aDia(arg.start), hasta: aDia(fin), titulo: arg.view.title });
  };

  const eventos = (data?.datos ?? []).map((e) => ({
    id: String(e.id_evento),
    title: e.titulo,
    start: e.fecha_inicio,
    end: e.fecha_fin ?? undefined,
    backgroundColor: COLOR_TIPO[e.tipo_evento].fondo,
    textColor: COLOR_TIPO[e.tipo_evento].texto,
    classNames: idSeleccionado === e.id_evento ? ['ring-2', 'ring-azul-oscuro'] : [],
    extendedProps: { evento: e },
  }));

  const editarSeleccionado = gestiona && seleccionado ? () => setFormulario({ registro: seleccionado }) : undefined;
  const claseVista = (v: Vista) =>
    `h-9 cursor-pointer rounded-full px-4 text-caption font-semibold ${vista === v ? 'bg-rojo text-white' : 'text-texto hover:bg-fondo'}`;

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid size-[55px] shrink-0 place-items-center rounded-[10px] bg-rojo text-white">
            <CalendarDays className="size-8" aria-hidden />
          </span>
          <div>
            <h1 className="text-[24px] font-bold text-azul-titulo sm:text-titulo">Calendario de Eventos</h1>
            <p className="text-small font-semibold text-azul-titulo sm:text-body">
              {vista === 'timeGridWeek' ? 'Consulta los eventos de la semana' : 'Organiza tu agenda visualmente por mes'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {gestiona && (
            <Boton pildora onClick={() => setFormulario({})}>
              Crear evento
            </Boton>
          )}
          <div role="group" aria-label="Vista del calendario" className="flex rounded-full bg-white p-1 shadow-tarjeta">
            <button type="button" aria-pressed={vista === 'timeGridWeek'} className={claseVista('timeGridWeek')} onClick={() => cambiarVista('timeGridWeek')}>
              Semanal
            </button>
            <button type="button" aria-pressed={vista === 'dayGridMonth'} className={claseVista('dayGridMonth')} onClick={() => cambiarVista('dayGridMonth')}>
              Mensual
            </button>
          </div>
          <div className="flex h-11 items-center gap-1 rounded-full bg-white px-2 shadow-tarjeta">
            <button type="button" aria-label="Periodo anterior" className="grid size-8 cursor-pointer place-items-center rounded-full hover:bg-fondo" onClick={() => calendario.current?.getApi().prev()}>
              <ChevronLeft className="size-4" />
            </button>
            <span className="min-w-32 text-center text-caption font-bold capitalize text-azul-titulo" aria-live="polite">
              {rango?.titulo}
            </span>
            <button type="button" aria-label="Periodo siguiente" className="grid size-8 cursor-pointer place-items-center rounded-full hover:bg-fondo" onClick={() => calendario.current?.getApi().next()}>
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {error && <MensajeError mensaje={mensajeDeError(error)} onReintentar={() => refetch()} />}

      <div className={`grid gap-6 ${vista === 'timeGridWeek' ? 'xl:grid-cols-[1fr_300px]' : ''}`}>
        <Tarjeta className="overflow-hidden p-3 sm:p-4">
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
            height="auto"
            expandRows
            nowIndicator
            dayMaxEvents={3}
            slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
            firstDay={0}
            dayHeaderContent={(arg) => (
              <span className="flex flex-col items-center leading-tight">
                <span className="text-[11px] font-semibold uppercase">{arg.date.toLocaleDateString('es-CO', { weekday: 'short' }).replace('.', '')}</span>
                {vista === 'timeGridWeek' && <span className="text-subtitle font-bold">{arg.date.getDate()}</span>}
              </span>
            )}
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
        </Tarjeta>

        {vista === 'timeGridWeek' && (
          <Tarjeta className="h-fit p-5 xl:sticky xl:top-4">
            {seleccionado ? (
              <DetalleEvento evento={seleccionado} onEditar={editarSeleccionado} />
            ) : (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <span className="grid size-12 place-items-center rounded-full bg-fondo text-azul-titulo">
                  <CalendarDays className="size-5" aria-hidden />
                </span>
                <p className="font-bold text-texto">Selecciona un evento</p>
                <p className="text-caption text-texto-suave">Haz clic en un evento del calendario para ver aquí su información.</p>
              </div>
            )}
          </Tarjeta>
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
