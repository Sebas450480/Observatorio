import { CalendarDays, ExternalLink, Flag, Globe, MessageSquareText } from 'lucide-react';
import { useEffect } from 'react';
import { mensajeDeError } from '../../api/cliente';
import { registrarActividad, useDetalle } from '../../api/consultas';
import type { Tendencia } from '../../api/tipos';
import { Boton } from '../../componentes/ui/Boton';
import { Cargando, DatoConIcono, Etiqueta, InsigniaEstado, MensajeError } from '../../componentes/ui/Elementos';
import { Modal } from '../../componentes/ui/Modal';
import { fechaLarga, numero } from '../../utilidades/formato';

/** Detalle de una tendencia: descripción, comportamiento en el mundo y en Colombia, y fuentes. */
export function DetalleTendencia({ id, onCerrar, onEditar }: { id: number; onCerrar: () => void; onEditar?: (t: Tendencia) => void }) {
  const { data: t, isLoading, error } = useDetalle<Tendencia>('/tendencias', id);

  useEffect(() => {
    registrarActividad('Tendencia', id, 'Vista');
  }, [id]);

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      ancho={700}
      destacado
      titulo={t?.tendencia ?? 'Tendencia'}
      sobreTitulo={
        t && (
          <>
            <span className="rounded bg-white px-2 py-0.5 text-[13px] font-bold text-azul-oscuro">{t.megatendencia}</span>
            {t.estado_te && <InsigniaEstado estado={t.estado_te} />}
          </>
        )
      }
      pie={
        t &&
        onEditar && (
          <div className="flex justify-center">
            <Boton className="min-w-36 uppercase" onClick={() => onEditar(t)}>
              Editar
            </Boton>
          </div>
        )
      }
    >
      {isLoading ? (
        <Cargando />
      ) : error || !t ? (
        <MensajeError mensaje={error ? mensajeDeError(error) : 'No encontramos esta tendencia.'} />
      ) : (
        <div className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <DatoConIcono icono={<CalendarDays />} etiqueta="Fecha de publicación">
              {fechaLarga(t.fecha_publicacion)}
            </DatoConIcono>
            <DatoConIcono icono={<MessageSquareText />} etiqueta="Menciones registradas">
              {numero(t.menciones)}
            </DatoConIcono>
          </div>
          {t.descripcion && (
            <section>
              <h3 className="mb-1 text-body font-bold text-texto">Descripción</h3>
              <p className="whitespace-pre-line text-small leading-relaxed text-texto-suave">{t.descripcion}</p>
            </section>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <section className="rounded-xl bg-fondo p-4">
              <h3 className="mb-1 flex items-center gap-2 text-small font-bold text-azul-titulo">
                <Globe className="size-4" aria-hidden /> En el mundo
              </h3>
              <p className="whitespace-pre-line text-caption leading-relaxed text-texto">{t.comportamiento_mundo || 'Sin información registrada.'}</p>
            </section>
            <section className="rounded-xl bg-fondo p-4">
              <h3 className="mb-1 flex items-center gap-2 text-small font-bold text-azul-titulo">
                <Flag className="size-4" aria-hidden /> En Colombia
              </h3>
              <p className="whitespace-pre-line text-caption leading-relaxed text-texto">{t.comportamiento_colombia || 'Sin información registrada.'}</p>
            </section>
          </div>
          {t.fuentes.length > 0 && (
            <section>
              <h3 className="mb-2 text-body font-bold text-texto">Fuentes</h3>
              <ul className="flex flex-col gap-2">
                {t.fuentes.map((f, i) => (
                  <li key={f.id_fuente ?? i} className="flex items-center justify-between gap-3 rounded-lg bg-fondo px-3 py-2.5 text-small">
                    <span className="text-texto">{f.nombre}</span>
                    {f.link && (
                      <a
                        href={f.link}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => registrarActividad('Tendencia', t.id_te, 'Clic_acceder')}
                        className="inline-flex shrink-0 items-center gap-1 font-semibold text-azul-oscuro hover:underline"
                      >
                        Ver <ExternalLink className="size-3.5" aria-hidden />
                        <span className="sr-only">{f.nombre}</span>
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {t.categorias.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {t.categorias.map((c) => (
                <Etiqueta key={c.id_categoria}>{c.nombre}</Etiqueta>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
