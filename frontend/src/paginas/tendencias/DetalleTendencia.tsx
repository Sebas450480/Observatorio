import { useEffect } from 'react';
import { mensajeDeError } from '../../api/cliente';
import { registrarActividad, useDetalle } from '../../api/consultas';
import type { Tendencia } from '../../api/tipos';
import iconoColombia from '../../assets/figma/tendencias/colombia.png';
import iconoMundo from '../../assets/figma/tendencias/mundo.png';
import {
  AccionesDetalle, BotonDetalle, CajaDetalle, CUERPO_DETALLE, codigoDetalle, MetaDetalle, SeccionDetalle, VinetaDetalle, VinetasDetalle,
} from '../../componentes/contenido/Detalle';
import { Cargando, Etiqueta, InsigniaEstado, MensajeError } from '../../componentes/ui/Elementos';
import { Modal } from '../../componentes/ui/Modal';
import { fechaCorta } from '../../utilidades/formato';

/** Detalle de una tendencia (Figma: "Modal — Detalle tendencia: IA generativa"). */
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
      claseCuerpo={CUERPO_DETALLE}
      titulo={t?.tendencia ?? 'Tendencia'}
      sobreTitulo={
        t && (
          <>
            <MetaDetalle etiqueta={t.megatendencia} mayusculas={false}>
              {codigoDetalle(t.id_te, t.fecha_publicacion)} · Publicada: {fechaCorta(t.fecha_publicacion)}
            </MetaDetalle>
            {t.estado_te && t.estado_te !== 'Activo' && <InsigniaEstado estado={t.estado_te} />}
          </>
        )
      }
    >
      {isLoading ? (
        <Cargando />
      ) : error || !t ? (
        <MensajeError mensaje={error ? mensajeDeError(error) : 'No encontramos esta tendencia.'} />
      ) : (
        <>
          {t.descripcion && (
            <SeccionDetalle titulo="Descripción">
              <p className="whitespace-pre-line text-small font-light text-black">{t.descripcion}</p>
            </SeccionDetalle>
          )}
          <SeccionDetalle titulo="Tendencia a nivel mundial">
            <CajaDetalle icono={iconoMundo} tamanoIcono={20}>
              <span className="font-light text-black">{t.comportamiento_mundo || 'Sin información registrada.'}</span>
            </CajaDetalle>
          </SeccionDetalle>
          <SeccionDetalle titulo="Tendencia a nivel Colombia">
            <CajaDetalle icono={iconoColombia} tamanoIcono={20}>
              <span className="font-light text-black">{t.comportamiento_colombia || 'Sin información registrada.'}</span>
            </CajaDetalle>
          </SeccionDetalle>
          {t.fuentes.length > 0 && (
            <SeccionDetalle titulo="Fuentes de la tendencia">
              <VinetasDetalle>
                {t.fuentes.map((f, i) => (
                  <VinetaDetalle key={f.id_fuente ?? i}>
                    {f.link ? (
                      <a
                        href={f.link}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => registrarActividad('Tendencia', t.id_te, 'Clic_acceder')}
                        className="hover:text-azul-oscuro hover:underline"
                      >
                        {f.nombre}
                      </a>
                    ) : (
                      f.nombre
                    )}
                  </VinetaDetalle>
                ))}
              </VinetasDetalle>
            </SeccionDetalle>
          )}
          {t.categorias.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {t.categorias.map((c) => (
                <Etiqueta key={c.id_categoria}>{c.nombre}</Etiqueta>
              ))}
            </div>
          )}
          {onEditar && (
            <AccionesDetalle>
              <BotonDetalle onClick={() => onEditar(t)}>Editar</BotonDetalle>
            </AccionesDetalle>
          )}
        </>
      )}
    </Modal>
  );
}
