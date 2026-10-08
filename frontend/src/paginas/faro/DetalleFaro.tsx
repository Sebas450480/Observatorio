import { CalendarDays, Clock, DollarSign, Link2, MapPin, MonitorSmartphone } from 'lucide-react';
import { useEffect } from 'react';
import { mensajeDeError } from '../../api/cliente';
import { registrarActividad, useDetalle } from '../../api/consultas';
import type { Faro } from '../../api/tipos';
import { Boton } from '../../componentes/ui/Boton';
import { Cargando, DatoConIcono, Etiqueta, InsigniaEstado, MensajeError } from '../../componentes/ui/Elementos';
import { Modal } from '../../componentes/ui/Modal';
import { costo, fechaLarga, modalidadTexto } from '../../utilidades/formato';
import { ESTILO_TIPO } from './FaroEmpresarial';

/** Detalle de una beca, convocatoria, curso o taller (Figma: "Modal — Detalle beca"). */
export function DetalleFaro({ id, onCerrar, onEditar }: { id: number; onCerrar: () => void; onEditar?: (f: Faro) => void }) {
  const { data: faro, isLoading, error } = useDetalle<Faro>('/faro', id);

  useEffect(() => {
    registrarActividad('Faro', id, 'Vista');
  }, [id]);

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      ancho={700}
      destacado
      titulo={faro?.titulo ?? 'Faro Empresarial'}
      sobreTitulo={
        faro && (
          <>
            <span className="rounded bg-white px-2 py-0.5 text-[13px] font-bold uppercase text-azul-oscuro">{ESTILO_TIPO[faro.tipo].singular}</span>
            <span className="text-caption text-white/80">ID: OE-{String(faro.id_fe).padStart(4, '0')}</span>
            {faro.estado_fe && <InsigniaEstado estado={faro.estado_fe} />}
          </>
        )
      }
      pie={
        faro && (
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center sm:gap-12">
            {onEditar && (
              <Boton className="min-w-36 uppercase" onClick={() => onEditar(faro)}>
                Editar
              </Boton>
            )}
            {faro.link && (
              <a
                href={faro.link}
                target="_blank"
                rel="noreferrer"
                onClick={() => registrarActividad('Faro', faro.id_fe, 'Clic_acceder')}
                className="inline-flex h-[42px] min-w-56 items-center justify-center rounded-control bg-rojo px-5 font-bold uppercase text-white hover:bg-[#c2002e]"
              >
                Más información
              </a>
            )}
          </div>
        )
      }
    >
      {isLoading ? (
        <Cargando />
      ) : error || !faro ? (
        <MensajeError mensaje={error ? mensajeDeError(error) : 'No encontramos este registro.'} />
      ) : (
        <div className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <DatoConIcono icono={<CalendarDays />} etiqueta={faro.fecha_inicio ? 'Fecha de inicio' : 'Fecha de cierre'}>
              {faro.fecha_inicio ? fechaLarga(faro.fecha_inicio) : faro.fecha_cierre ? fechaLarga(faro.fecha_cierre) : 'Por definir'}
            </DatoConIcono>
            <DatoConIcono icono={<MonitorSmartphone />} etiqueta="Modalidad">
              {modalidadTexto(faro.modalidad) || 'Por definir'}
            </DatoConIcono>
            <DatoConIcono icono={<Clock />} etiqueta="Duración">
              {faro.duracion || 'Por definir'}
            </DatoConIcono>
            <DatoConIcono icono={<DollarSign />} etiqueta="Costo">
              <span className={faro.es_gratuito || !faro.costo ? 'text-exito' : ''}>{costo(faro.costo, faro.es_gratuito)}</span>
            </DatoConIcono>
          </div>
          {faro.fecha_inicio && faro.fecha_cierre && (
            <p className="text-small text-texto-suave">
              Cierre de inscripciones: <strong className="text-texto">{fechaLarga(faro.fecha_cierre)}</strong>
            </p>
          )}
          {faro.descripcion && (
            <section>
              <h3 className="mb-1 text-body font-bold text-texto">Descripción</h3>
              <p className="whitespace-pre-line text-small leading-relaxed text-texto-suave">{faro.descripcion}</p>
            </section>
          )}
          {(faro.entidad || faro.lugar) && (
            <section>
              <h3 className="mb-2 text-body font-bold text-texto">Lugar de referencia</h3>
              <p className="flex items-center gap-2 rounded-lg bg-fondo px-3 py-2.5 text-small text-texto">
                <MapPin className="size-4 shrink-0 text-azul-oscuro" aria-hidden />
                {[faro.entidad, faro.lugar].filter(Boolean).join(' — ')}
              </p>
            </section>
          )}
          {faro.link && (
            <section>
              <h3 className="mb-2 text-body font-bold text-texto">Link de referencia</h3>
              <a
                href={faro.link}
                target="_blank"
                rel="noreferrer"
                onClick={() => registrarActividad('Faro', faro.id_fe, 'Clic_acceder')}
                className="flex items-center gap-2 break-all rounded-lg bg-fondo px-3 py-2.5 text-small text-azul-oscuro hover:underline"
              >
                <Link2 className="size-4 shrink-0" aria-hidden /> {faro.link}
              </a>
            </section>
          )}
          {faro.categorias.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {faro.categorias.map((c) => (
                <Etiqueta key={c.id_categoria}>{c.nombre}</Etiqueta>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
