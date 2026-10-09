import { useEffect } from 'react';
import { registrarActividad, useDetalle } from '../../api/consultas';
import { mensajeDeError } from '../../api/cliente';
import type { Flash } from '../../api/tipos';
import {
  AccionesDetalle, BotonDetalle, CajaDetalle, CUERPO_DETALLE, codigoDetalle, DatoDetalle, DatosDetalle, EnlaceDetalle, ICONO_DETALLE,
  MetaDetalle, SeccionDetalle, TextoDetalle, VinetaDetalle, VinetasDetalle,
} from '../../componentes/contenido/Detalle';
import { Cargando, InsigniaEstado, MensajeError } from '../../componentes/ui/Elementos';
import { Modal } from '../../componentes/ui/Modal';
import { costo, fechaLarga, modalidadTexto, nombreTipoEvento, rangoHoras, vinetas } from '../../utilidades/formato';

/** Modal de detalle de un Flash Informativo (Figma: "Modal — Detalle Congreso"). */
export function DetalleFlash({ id, onCerrar, onEditar }: { id: number; onCerrar: () => void; onEditar?: (f: Flash) => void }) {
  const { data: flash, isLoading, error } = useDetalle<Flash>('/flash', id);

  useEffect(() => {
    registrarActividad('Flash', id, 'Vista');
  }, [id]);

  const abrirEnlace = () => flash && registrarActividad('Flash', flash.id_fi, 'Clic_acceder');

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      ancho={700}
      destacado
      claseCuerpo={CUERPO_DETALLE}
      titulo={<span className="uppercase">{flash?.titulo ?? 'Flash informativo'}</span>}
      sobreTitulo={
        flash && (
          <>
            <MetaDetalle etiqueta={nombreTipoEvento(flash)}>{codigoDetalle(flash.id_fi, flash.fecha_inicio)}</MetaDetalle>
            {flash.estado_fi !== 'Activo' && <InsigniaEstado estado={flash.estado_fi} />}
          </>
        )
      }
    >
      {isLoading ? (
        <Cargando />
      ) : error || !flash ? (
        <MensajeError mensaje={error ? mensajeDeError(error) : 'No encontramos este evento.'} />
      ) : (
        <>
          <DatosDetalle>
            <DatoDetalle icono={ICONO_DETALLE.calendario} etiqueta="Fecha de inicio">
              {fechaLarga(flash.fecha_inicio)}
            </DatoDetalle>
            <DatoDetalle icono={ICONO_DETALLE.modalidad} etiqueta="Modalidad">
              {modalidadTexto(flash.modalidad)}
            </DatoDetalle>
            <DatoDetalle icono={ICONO_DETALLE.reloj} etiqueta="Horario">
              {rangoHoras(flash.fecha_inicio, flash.fecha_fin)}
            </DatoDetalle>
            <DatoDetalle icono={ICONO_DETALLE.costo} etiqueta="Costo de participación">
              {flash.es_gratuito || !flash.costo ? <span className="font-bold uppercase text-exito">{costo(flash.costo, flash.es_gratuito)}</span> : costo(flash.costo, flash.es_gratuito)}
            </DatoDetalle>
          </DatosDetalle>
          {flash.descripcion && (
            <SeccionDetalle titulo="Descripción">
              <TextoDetalle>{flash.descripcion}</TextoDetalle>
            </SeccionDetalle>
          )}
          {flash.lugar && (
            <SeccionDetalle titulo="Lugar de referencia">
              <CajaDetalle>{[flash.lugar, flash.departamento].filter(Boolean).join(' — ')}</CajaDetalle>
            </SeccionDetalle>
          )}
          {flash.link && (
            <SeccionDetalle titulo="Link de referencia">
              <CajaDetalle href={flash.link} onClick={abrirEnlace}>
                {flash.link.replace(/^https?:\/\//, '')}
              </CajaDetalle>
            </SeccionDetalle>
          )}
          {vinetas(flash.info_adicional).length > 0 && (
            <SeccionDetalle titulo="Información clave">
              <VinetasDetalle>
                {vinetas(flash.info_adicional).map((v) => (
                  <VinetaDetalle key={v}>{v}</VinetaDetalle>
                ))}
              </VinetasDetalle>
            </SeccionDetalle>
          )}
          {(onEditar || flash.link) && (
            <AccionesDetalle>
              {onEditar && <BotonDetalle onClick={() => onEditar(flash)}>Editar</BotonDetalle>}
              {flash.link && (
                <EnlaceDetalle href={flash.link} onClick={abrirEnlace}>
                  Más información
                </EnlaceDetalle>
              )}
            </AccionesDetalle>
          )}
        </>
      )}
    </Modal>
  );
}
