import { useEffect } from 'react';
import { mensajeDeError } from '../../api/cliente';
import { registrarActividad, useDetalle } from '../../api/consultas';
import type { Faro } from '../../api/tipos';
import {
  AccionesDetalle, BotonDetalle, CajaDetalle, CUERPO_DETALLE, codigoDetalle, DatoDetalle, DatosDetalle, EnlaceDetalle, ICONO_DETALLE,
  MetaDetalle, SeccionDetalle, TextoDetalle,
} from '../../componentes/contenido/Detalle';
import { Cargando, Etiqueta, InsigniaEstado, MensajeError } from '../../componentes/ui/Elementos';
import { Modal } from '../../componentes/ui/Modal';
import { costo, fechaLarga, modalidadTexto } from '../../utilidades/formato';
import { ESTILO_TIPO } from './FaroEmpresarial';

/** Detalle de una beca, convocatoria, curso o taller (Figma: "Modal — Detalle beca"). */
export function DetalleFaro({ id, onCerrar, onEditar }: { id: number; onCerrar: () => void; onEditar?: (f: Faro) => void }) {
  const { data: faro, isLoading, error } = useDetalle<Faro>('/faro', id);

  useEffect(() => {
    registrarActividad('Faro', id, 'Vista');
  }, [id]);

  const abrirEnlace = () => faro && registrarActividad('Faro', faro.id_fe, 'Clic_acceder');

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      ancho={700}
      destacado
      claseCuerpo={CUERPO_DETALLE}
      titulo={faro?.titulo ?? 'Faro Empresarial'}
      sobreTitulo={
        faro && (
          <>
            <MetaDetalle etiqueta={ESTILO_TIPO[faro.tipo].singular}>{codigoDetalle(faro.id_fe, faro.fecha_publicacion)}</MetaDetalle>
            {faro.estado_fe && faro.estado_fe !== 'Activo' && <InsigniaEstado estado={faro.estado_fe} />}
          </>
        )
      }
    >
      {isLoading ? (
        <Cargando />
      ) : error || !faro ? (
        <MensajeError mensaje={error ? mensajeDeError(error) : 'No encontramos este registro.'} />
      ) : (
        <>
          <DatosDetalle>
            <DatoDetalle icono={ICONO_DETALLE.calendario} etiqueta="Fecha de cierre">
              {faro.fecha_cierre ? fechaLarga(faro.fecha_cierre) : 'Por definir'}
            </DatoDetalle>
            <DatoDetalle icono={ICONO_DETALLE.modalidad} etiqueta="Modalidad">
              {modalidadTexto(faro.modalidad) || 'Por definir'}
            </DatoDetalle>
            <DatoDetalle icono={ICONO_DETALLE.reloj} etiqueta="Lugar">
              {faro.lugar || 'Por definir'}
            </DatoDetalle>
            <DatoDetalle icono={ICONO_DETALLE.costo} etiqueta="Costo">
              {faro.es_gratuito || !faro.costo ? <span className="text-exito">Gratuito</span> : costo(faro.costo, false)}
            </DatoDetalle>
            {faro.fecha_inicio && (
              <DatoDetalle icono={ICONO_DETALLE.calendario} etiqueta="Fecha de inicio">
                {fechaLarga(faro.fecha_inicio)}
              </DatoDetalle>
            )}
            {faro.duracion && (
              <DatoDetalle icono={ICONO_DETALLE.reloj} etiqueta="Duración">
                {faro.duracion}
              </DatoDetalle>
            )}
          </DatosDetalle>
          {faro.descripcion && (
            <SeccionDetalle titulo="Descripción">
              <TextoDetalle>{faro.descripcion}</TextoDetalle>
            </SeccionDetalle>
          )}
          {(faro.entidad || faro.lugar) && (
            <SeccionDetalle titulo="Lugar de referencia">
              <CajaDetalle>{[faro.entidad, faro.lugar].filter(Boolean).join(' — ')}</CajaDetalle>
            </SeccionDetalle>
          )}
          {faro.link && (
            <SeccionDetalle titulo="Link de referencia">
              <CajaDetalle href={faro.link} onClick={abrirEnlace}>
                {faro.link.replace(/^https?:\/\//, '')}
              </CajaDetalle>
            </SeccionDetalle>
          )}
          {faro.categorias.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {faro.categorias.map((c) => (
                <Etiqueta key={c.id_categoria}>{c.nombre}</Etiqueta>
              ))}
            </div>
          )}
          {(onEditar || faro.link) && (
            <AccionesDetalle>
              {onEditar && <BotonDetalle onClick={() => onEditar(faro)}>Editar</BotonDetalle>}
              {faro.link && (
                <EnlaceDetalle href={faro.link} onClick={abrirEnlace}>
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
