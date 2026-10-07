import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useListado } from '../api/consultas';
import type { Evento, Faro, Flash } from '../api/tipos';
import { Tarjeta } from '../componentes/ui/Elementos';
import { costo, diaMes, fechaLarga, modalidadTexto } from '../utilidades/formato';
import { ESTILO_TIPO, fechaClave } from './faro/FaroEmpresarial';

const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

const ABREVIATURA_MODALIDAD = { Virtual: 'VIRTUAL', Presencial: 'PRES.', Hibrido: 'MIXTO' } as const;
const COLOR_MODALIDAD = {
  Virtual: 'bg-[#e6eefc] text-[#1d5bd8]',
  Presencial: 'bg-exito-claro text-[#059669]',
  Hibrido: 'bg-morado-claro text-morado',
} as const;
const COLOR_FARO = {
  Becas: 'bg-exito-claro text-[#059669]',
  Convocatorias: 'bg-[#e8ebf3] text-azul-titulo',
  Cursos: 'bg-morado-claro text-morado',
  Talleres: 'bg-naranja-claro text-[#c2410c]',
} as const;

function Columna({ titulo, ruta, children, vacio }: { titulo: string; ruta: string; children: ReactNode[]; vacio: string }) {
  return (
    <Tarjeta className="min-w-0 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-bold text-azul-titulo">{titulo}</h2>
        <Link to={ruta} className="inline-flex items-center gap-1 text-caption font-semibold text-rojo hover:underline">
          Ver todo <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>
      {children.length ? <ul className="divide-y divide-borde">{children}</ul> : <p className="py-6 text-center text-caption text-texto-suave">{vacio}</p>}
    </Tarjeta>
  );
}

function Fila({ to, insignia, titulo, detalle }: { to: string; insignia: ReactNode; titulo: string; detalle: string }) {
  return (
    <li>
      <Link to={to} className="flex items-center gap-3 rounded-lg py-3 hover:bg-fondo/60">
        {insignia}
        <span className="min-w-0">
          <span className="block text-caption font-semibold text-azul-titulo">{titulo}</span>
          <span className="block truncate text-[12px] text-texto-suave">{detalle}</span>
        </span>
      </Link>
    </li>
  );
}

function Carrusel({ eventos }: { eventos: Evento[] }) {
  const [indice, setIndice] = useState(0);
  const total = eventos.length;
  useEffect(() => {
    if (total < 2) return;
    const temporizador = window.setInterval(() => setIndice((i) => (i + 1) % total), 8000);
    return () => window.clearInterval(temporizador);
  }, [total]);
  const evento = eventos[indice % Math.max(total, 1)];
  if (!evento) return null;
  const { dia } = diaMes(evento.fecha_inicio);
  const mesAnio = new Date(evento.fecha_inicio).toLocaleDateString('es-CO', { timeZone: 'America/Bogota', month: 'long', year: 'numeric' }).replace(' de ', ' ').toUpperCase();
  const flecha = 'absolute top-1/2 z-10 grid size-8 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-white/15 text-white hover:bg-white/25';

  return (
    <section aria-roledescription="carrusel" aria-label="Eventos destacados" className="relative overflow-hidden rounded-tarjeta bg-gradient-to-r from-[#0b1a5c] via-azul-oscuro to-[#1b2fa6] text-white shadow-tarjeta">
      <span aria-hidden className="absolute -right-24 -top-24 size-80 rounded-full border-[40px] border-white/5" />
      <span aria-hidden className="absolute -bottom-20 -right-10 size-56 rounded-full bg-rojo" />
      <div className="relative grid items-center gap-6 px-12 py-8 sm:px-16 lg:grid-cols-[1fr_auto] lg:py-10">
        <div aria-live="polite">
          <span className="rounded-full bg-rojo px-3 py-1 text-[11px] font-bold uppercase">Evento destacado</span>
          <h2 className="mt-3 text-[26px] font-bold leading-tight sm:text-display">{evento.titulo}</h2>
          <p className="mt-2 text-small font-semibold">
            {[fechaLarga(evento.fecha_inicio), evento.lugar, modalidadTexto(evento.modalidad)].filter(Boolean).join(' · ')}
          </p>
          {evento.descripcion && <p className="mt-2 line-clamp-2 max-w-2xl text-caption text-white/80">{evento.descripcion}</p>}
          <div className="mt-5 flex flex-wrap gap-3">
            <Link to={`/eventos/${evento.id_evento}`} className="inline-flex h-11 items-center gap-2 rounded-control bg-rojo px-5 text-small font-semibold hover:bg-[#c2002e]">
              Ver evento <ArrowRight className="size-4" aria-hidden />
            </Link>
            {evento.link_externo && (
              <a href={evento.link_externo} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center rounded-control border border-white/60 px-5 text-small font-semibold hover:bg-white/10">
                Inscribirme
              </a>
            )}
          </div>
          {total > 1 && (
            <div className="mt-6 flex gap-1.5">
              {eventos.map((e, i) => (
                <button
                  key={e.id_evento}
                  type="button"
                  aria-label={`Ir al evento ${i + 1}`}
                  aria-current={i === indice}
                  onClick={() => setIndice(i)}
                  className={`h-1.5 cursor-pointer rounded-full ${i === indice ? 'w-5 bg-rojo' : 'w-1.5 bg-white/50'}`}
                />
              ))}
            </div>
          )}
        </div>
        <div className="hidden min-w-40 rounded-xl bg-white px-10 py-5 text-center text-texto shadow-menu lg:block">
          <p className="text-caption text-texto-suave">Próximo evento</p>
          <p className="text-[44px] font-bold leading-none text-azul-titulo">{dia}</p>
          <p className="mt-1 text-caption font-bold text-rojo">{mesAnio}</p>
        </div>
      </div>
      {total > 1 && (
        <>
          <button type="button" aria-label="Evento anterior" className={`${flecha} left-3`} onClick={() => setIndice((i) => (i - 1 + total) % total)}>
            <ChevronLeft className="size-4" />
          </button>
          <button type="button" aria-label="Evento siguiente" className={`${flecha} right-3`} onClick={() => setIndice((i) => (i + 1) % total)}>
            <ChevronRight className="size-4" />
          </button>
        </>
      )}
    </section>
  );
}

/** Inicio: eventos destacados, próximos eventos, últimas noticias y oportunidades (Figma: "Inicio"). */
export function Inicio() {
  const desde = hoy();
  const eventos = useListado<Evento>('/calendario', { desde, limite: 4 });
  const noticias = useListado<Flash>('/flash', { desde, limite: 3 });
  const faro = useListado<Faro>('/faro', { limite: 3, orden: 'cierre' });
  const listaEventos = eventos.data?.datos ?? [];

  return (
    <>
      <div className="mb-5">
        <h1 className="text-[24px] font-bold text-azul-titulo sm:text-titulo">Bienvenido al Observatorio Empresarial</h1>
        <p className="text-small text-texto-suave">Lo más actual en eventos, oportunidades y tendencias para el sector empresarial.</p>
      </div>
      {listaEventos.length > 0 && <Carrusel eventos={listaEventos.slice(0, 3)} />}
      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <Columna titulo="Próximos eventos" ruta="/eventos" vacio="No hay eventos próximos.">
          {listaEventos.slice(0, 3).map((e) => {
            const { dia, mes } = diaMes(e.fecha_inicio);
            return (
              <Fila
                key={e.id_evento}
                to={`/eventos/${e.id_evento}`}
                insignia={
                  <span className="grid w-10 shrink-0 place-items-center rounded-md bg-fondo py-1 leading-tight">
                    <span className="font-bold text-azul-titulo">{dia}</span>
                    <span className="text-[10px] font-bold text-rojo">{mes}</span>
                  </span>
                }
                titulo={e.titulo}
                detalle={[e.lugar, modalidadTexto(e.modalidad)].filter(Boolean).join(' · ')}
              />
            );
          })}
        </Columna>
        <Columna titulo="Últimas noticias" ruta="/flash-informativo" vacio="No hay noticias próximas.">
          {(noticias.data?.datos ?? []).map((f) => (
            <Fila
              key={f.id_fi}
              to={`/flash-informativo/${f.id_fi}`}
              insignia={
                <span className={`grid h-10 w-12 shrink-0 place-items-center rounded-md text-[10px] font-bold ${COLOR_MODALIDAD[f.modalidad]}`}>
                  {ABREVIATURA_MODALIDAD[f.modalidad]}
                </span>
              }
              titulo={f.titulo}
              detalle={`${fechaLarga(f.fecha_inicio)} · ${f.es_gratuito || !f.costo ? 'Gratuito' : costo(f.costo, false)}`}
            />
          ))}
        </Columna>
        <Columna titulo="Oportunidades abiertas" ruta="/faro-empresarial" vacio="No hay oportunidades abiertas.">
          {(faro.data?.datos ?? []).map((f) => (
            <Fila
              key={f.id_fe}
              to={`/faro-empresarial/${f.id_fe}`}
              insignia={
                <span className={`grid h-10 w-12 shrink-0 place-items-center rounded-md text-[10px] font-bold uppercase ${COLOR_FARO[f.tipo]}`}>
                  {ESTILO_TIPO[f.tipo].singular.slice(0, 5)}
                </span>
              }
              titulo={f.titulo}
              detalle={[f.entidad, fechaClave(f)].filter(Boolean).join(' · ')}
            />
          ))}
        </Columna>
      </div>
    </>
  );
}
