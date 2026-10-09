import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useListado } from '../api/consultas';
import aroCarrusel from '../assets/figma/decoraciones/aro-carrusel.svg';
import circuloRojoCarrusel from '../assets/figma/decoraciones/circulo-rojo-carrusel.svg';
import type { Evento, Faro, Flash } from '../api/tipos';
import { costo, diaMes, fechaCorta, fechaLarga, modalidadTexto } from '../utilidades/formato';
import { fechaClave } from './faro/FaroEmpresarial';

const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

const ABREVIATURA_MODALIDAD = { Virtual: 'VIRTUAL', Presencial: 'PRES.', Hibrido: 'MIXTO' } as const;
const COLOR_MODALIDAD = {
  Virtual: 'bg-[rgba(28,89,217,0.12)] text-[#1c59d9]',
  Presencial: 'bg-[rgba(15,153,107,0.12)] text-[#0f996b]',
  Hibrido: 'bg-[rgba(140,92,245,0.12)] text-[#8c5cf5]',
} as const;
const COLOR_FARO = {
  Becas: 'bg-[rgba(15,153,107,0.12)] text-[#0f996b]',
  Convocatorias: 'bg-[rgba(23,59,115,0.12)] text-azul-marino',
  Cursos: 'bg-[rgba(140,92,245,0.12)] text-[#8c5cf5]',
  Talleres: 'bg-[rgba(249,115,22,0.12)] text-[#c2410c]',
} as const;
const ABREVIATURA_FARO = { Becas: 'BECA', Convocatorias: 'CONV.', Cursos: 'CURSO', Talleres: 'TALLER' } as const;

function Columna({ titulo, ruta, children, vacio }: { titulo: string; ruta: string; children: ReactNode[]; vacio: string }) {
  return (
    <section className="min-w-0 rounded-2xl border border-[#e5ebf2] bg-white p-5 shadow-[0_4px_8px_0_rgba(13,26,64,0.06)] sm:p-7 xl:min-h-[362px]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-subtitle font-bold text-azul-marino">{titulo}</h2>
        <Link to={ruta} className="whitespace-nowrap text-small font-semibold text-rojo-vivo hover:underline">
          Ver todo&nbsp;&nbsp;→
        </Link>
      </div>
      {children.length ? (
        <ul className="flex flex-col gap-4 [&>li+li]:border-t [&>li+li]:border-[#e8ebf2] [&>li+li]:pt-4">{children}</ul>
      ) : (
        <p className="py-6 text-center text-small text-gris-azulado">{vacio}</p>
      )}
    </section>
  );
}

function Fila({ to, insignia, titulo, detalle }: { to: string; insignia: ReactNode; titulo: string; detalle: string }) {
  return (
    <li>
      <Link to={to} className="flex items-center gap-4 rounded-xl hover:bg-fondo/60">
        {insignia}
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-body font-semibold text-azul-marino">{titulo}</span>
          <span className="truncate text-small text-gris-azulado">{detalle}</span>
        </span>
      </Link>
    </li>
  );
}

function Carrusel({ eventos }: { eventos: Evento[] }) {
  const [indice, setIndice] = useState(0);
  // Sentido del último cambio, para deslizar el contenido desde la derecha o la izquierda.
  const [sentido, setSentido] = useState<'derecha' | 'izquierda'>('derecha');
  const total = eventos.length;
  const ir = (nuevo: number, haciaAtras = false) => {
    setSentido(haciaAtras ? 'izquierda' : 'derecha');
    setIndice(((nuevo % total) + total) % total);
  };
  // Cada evento dura 8 s; al cambiar a mano el conteo empieza de nuevo (igual que la barra de progreso).
  useEffect(() => {
    if (total < 2) return;
    const temporizador = window.setTimeout(() => {
      setSentido('derecha');
      setIndice((i) => (i + 1) % total);
    }, 8000);
    return () => window.clearTimeout(temporizador);
  }, [total, indice]);
  const evento = eventos[indice % Math.max(total, 1)];
  if (!evento) return null;
  const { dia } = diaMes(evento.fecha_inicio);
  const mesAnio = new Date(evento.fecha_inicio).toLocaleDateString('es-CO', { timeZone: 'America/Bogota', month: 'long', year: 'numeric' }).replace(' de ', ' ').toUpperCase();
  const flecha = 'absolute top-1/2 z-10 grid size-10 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-white/15 text-subtitle font-bold text-white hover:bg-white/25 sm:size-12';

  return (
    <section
      aria-roledescription="carrusel"
      aria-label="Eventos destacados"
      className="relative overflow-hidden rounded-[20px] bg-gradient-to-r from-[#0a1a4d] to-[#1c2b8c] text-white xl:h-[380px]"
    >
      {/* Aro y círculo rojo decorativos del carrusel (Figma) */}
      <img src={aroCarrusel} alt="" aria-hidden width={464} height={380} className="pointer-events-none absolute right-0 top-0 max-w-none" />
      <img src={circuloRojoCarrusel} alt="" aria-hidden width={104} height={130} className="pointer-events-none absolute bottom-0 right-0" />
      <div className="relative flex items-center gap-8 px-14 py-8 sm:px-[96px] xl:h-full xl:py-0">
        <div aria-live="polite" className="flex min-w-0 max-w-[820px] flex-1 flex-col items-start gap-4 xl:self-start xl:pt-12">
          <div key={indice} className={`flex flex-col items-start gap-4 entrada-carrusel-${sentido}`}>
            <span className="rounded-[14px] bg-rojo-vivo px-3.5 py-1.5 text-caption font-bold uppercase">Evento destacado</span>
            <h2 className="text-[26px] font-bold leading-[1.15] tracking-[-0.01em] sm:text-display">{evento.titulo}</h2>
            <p className="text-small font-semibold text-white/90 sm:text-body">
              {[fechaLarga(evento.fecha_inicio), evento.lugar, modalidadTexto(evento.modalidad)].filter(Boolean).join(' · ')}
            </p>
            {evento.descripcion && <p className="line-clamp-2 text-small text-white/75 sm:text-body">{evento.descripcion}</p>}
            <div className="flex flex-wrap gap-3">
              <Link to={`/eventos/${evento.id_evento}`} className="rounded-control bg-rojo-vivo px-7 py-3.5 text-body font-bold hover:bg-[#c2002e]">
                Ver evento&nbsp;&nbsp;→
              </Link>
              {evento.link_externo && (
                <a href={evento.link_externo} target="_blank" rel="noreferrer" className="rounded-control border border-white/60 px-7 py-3.5 text-body font-semibold hover:bg-white/10">
                  Inscribirme
                </a>
              )}
            </div>
          </div>
          {total > 1 && (
            <div className="mt-2 flex items-center gap-2 xl:absolute xl:bottom-8 xl:mt-0">
              {eventos.map((e, i) => (
                <button
                  key={e.id_evento}
                  type="button"
                  aria-label={`Ir al evento ${i + 1}`}
                  aria-current={i === indice}
                  onClick={() => ir(i, i < indice)}
                  className={`relative h-2 cursor-pointer overflow-hidden rounded bg-white/40 transition-[width] duration-300 ${i === indice ? 'w-7' : 'w-2'}`}
                >
                  {/* El punto activo se llena durante los 8 s que dura el evento. */}
                  {i === indice && <span key={indice} aria-hidden className="progreso-carrusel absolute inset-0 rounded bg-rojo-vivo" />}
                </button>
              ))}
            </div>
          )}
        </div>
        <div key={`dato-${indice}`} className="entrada-modal ml-auto hidden w-[260px] shrink-0 flex-col items-center gap-0.5 rounded-2xl bg-white px-9 py-7 text-center lg:flex xl:mr-[60px]">
          <p className="text-small font-semibold text-azul-marino/70">Próximo evento</p>
          <p className="text-[64px] font-extrabold leading-[1.15] tracking-[-0.01em] text-azul-marino">{dia}</p>
          <p className="text-small font-bold text-rojo-vivo">{mesAnio}</p>
        </div>
      </div>
      {total > 1 && (
        <>
          <button type="button" aria-label="Evento anterior" className={`${flecha} left-2 sm:left-6`} onClick={() => ir(indice - 1, true)}>
            ‹
          </button>
          <button type="button" aria-label="Evento siguiente" className={`${flecha} right-2 sm:right-6`} onClick={() => ir(indice + 1)}>
            ›
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
      <div className="mb-[23px] flex flex-col gap-1">
        <h1 className="text-[24px] font-bold text-azul-marino sm:text-titulo">Bienvenido al Observatorio Empresarial</h1>
        <p className="text-small text-gris-azulado sm:text-body">Lo más actual en eventos, oportunidades y tendencias para el sector empresarial.</p>
      </div>
      {listaEventos.length > 0 && <Carrusel eventos={listaEventos.slice(0, 4)} />}
      <div className="mt-7 grid gap-6 lg:grid-cols-3">
        <Columna titulo="Próximos eventos" ruta="/eventos" vacio="No hay eventos próximos.">
          {listaEventos.slice(0, 3).map((e) => {
            const { dia, mes } = diaMes(e.fecha_inicio);
            return (
              <Fila
                key={e.id_evento}
                to={`/eventos/${e.id_evento}`}
                insignia={
                  <span className="flex size-16 shrink-0 flex-col items-center justify-center rounded-xl bg-[rgba(23,59,115,0.08)] font-bold">
                    <span className="text-subtitle text-azul-marino">{dia.padStart(2, '0')}</span>
                    <span className="text-caption text-rojo-vivo">{mes}</span>
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
                <span className={`grid size-16 shrink-0 place-items-center rounded-xl text-caption font-bold ${COLOR_MODALIDAD[f.modalidad]}`}>
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
                <span className={`grid size-16 shrink-0 place-items-center rounded-xl text-caption font-bold ${COLOR_FARO[f.tipo]}`}>
                  {ABREVIATURA_FARO[f.tipo]}
                </span>
              }
              titulo={f.titulo}
              detalle={[f.entidad, fechaClave(f, fechaCorta)].filter(Boolean).join(' · ')}
            />
          ))}
        </Columna>
      </div>
    </>
  );
}
