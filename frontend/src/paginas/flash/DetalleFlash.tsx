import { CalendarDays, Clock, DollarSign, Link2, MapPin, MonitorSmartphone } from 'lucide-react';
import { useEffect } from 'react';
import { registrarActividad, useDetalle } from '../../api/consultas';
import { mensajeDeError } from '../../api/cliente';
import type { Flash } from '../../api/tipos';
import { Boton } from '../../componentes/ui/Boton';
import { Cargando, DatoConIcono, InsigniaEstado, MensajeError } from '../../componentes/ui/Elementos';
import { Modal } from '../../componentes/ui/Modal';
import { costo, fechaLarga, modalidadTexto, rangoHoras, vinetas } from '../../utilidades/formato';

/** Modal de detalle de un Flash Informativo (Figma: "Modal — Detalle Congreso"). */
export function DetalleFlash({ id, onCerrar, onEditar }: { id: number; onCerrar: () => void; onEditar?: (f: Flash) => void }) {
  const { data: flash, isLoading, error } = useDetalle<Flash>('/flash', id);

  useEffect(() => {
    registrarActividad('Flash', id, 'Vista');
  }, [id]);

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      ancho={700}
      destacado
      titulo={flash?.titulo ?? 'Flash informativo'}
      sobreTitulo={
        flash && (
          <>
            <span className="rounded bg-white px-2 py-0.5 text-[13px] font-bold uppercase text-azul-oscuro">{flash.tipo_evento}</span>
            <span className="text-caption text-white/80">ID: OE-{String(flash.id_fi).padStart(4, '0')}</span>
            {flash.estado_fi && <InsigniaEstado estado={flash.estado_fi} />}
          </>
        )
      }
      pie={
        flash && (
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center sm:gap-12">
            {onEditar && (
              <Boton className="min-w-36 uppercase" onClick={() => onEditar(flash)}>
                Editar
              </Boton>
            )}
            {flash.link && (
              <a
                href={flash.link}
                target="_blank"
                rel="noreferrer"
                onClick={() => registrarActividad('Flash', flash.id_fi, 'Clic_acceder')}
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
      ) : error || !flash ? (
        <MensajeError mensaje={error ? mensajeDeError(error) : 'No encontramos este evento.'} />
      ) : (
        <div className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <DatoConIcono icono={<CalendarDays />} etiqueta="Fecha de inicio">
              {fechaLarga(flash.fecha_inicio)}
            </DatoConIcono>
            <DatoConIcono icono={<MonitorSmartphone />} etiqueta="Modalidad">
              {modalidadTexto(flash.modalidad)}
            </DatoConIcono>
            <DatoConIcono icono={<Clock />} etiqueta="Horario">
              {rangoHoras(flash.fecha_inicio, flash.fecha_fin)}
            </DatoConIcono>
            <DatoConIcono icono={<DollarSign />} etiqueta="Costo de participación">
              <span className={flash.es_gratuito || !flash.costo ? 'text-exito' : ''}>{costo(flash.costo, flash.es_gratuito)}</span>
            </DatoConIcono>
          </div>
          {flash.descripcion && (
            <section>
              <h3 className="mb-1 text-body font-bold text-texto">Descripción</h3>
              <p className="whitespace-pre-line text-small leading-relaxed text-texto-suave">{flash.descripcion}</p>
            </section>
          )}
          {flash.lugar && (
            <section>
              <h3 className="mb-2 text-body font-bold text-texto">Lugar de referencia</h3>
              <p className="flex items-center gap-2 rounded-lg bg-fondo px-3 py-2.5 text-small text-texto">
                <MapPin className="size-4 shrink-0 text-azul-oscuro" aria-hidden />
                {[flash.lugar, flash.departamento].filter(Boolean).join(' — ')}
              </p>
            </section>
          )}
          {flash.link && (
            <section>
              <h3 className="mb-2 text-body font-bold text-texto">Link de referencia</h3>
              <a
                href={flash.link}
                target="_blank"
                rel="noreferrer"
                onClick={() => registrarActividad('Flash', flash.id_fi, 'Clic_acceder')}
                className="flex items-center gap-2 break-all rounded-lg bg-fondo px-3 py-2.5 text-small text-azul-oscuro hover:underline"
              >
                <Link2 className="size-4 shrink-0" aria-hidden /> {flash.link}
              </a>
            </section>
          )}
          {vinetas(flash.info_adicional).length > 0 && (
            <section>
              <h3 className="mb-2 text-body font-bold text-texto">Información clave</h3>
              <ul className="flex flex-col gap-1.5 text-small text-texto-suave">
                {vinetas(flash.info_adicional).map((v) => (
                  <li key={v} className="flex gap-2">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-rojo" aria-hidden />
                    {v}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </Modal>
  );
}
