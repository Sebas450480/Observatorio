import { CheckCircle2, X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Boton } from './Boton';

interface PropsModal {
  abierto: boolean;
  onCerrar: () => void;
  titulo: ReactNode;
  subtitulo?: ReactNode;
  /** Contenido sobre el título (p. ej. la etiqueta del tipo de evento). */
  sobreTitulo?: ReactNode;
  children: ReactNode;
  pie?: ReactNode;
  /** Ancho máximo en px (Figma: 700 detalle, 620 formularios, 520 avisos). */
  ancho?: number;
  /** Encabezado grande con línea roja (modales de detalle). */
  destacado?: boolean;
}

/**
 * Modal base de las plantillas del Figma: encabezado azul, alto máximo de 900 px con
 * scroll interno y padding de 20 a 30 px. Se cierra con Escape o clic fuera.
 */
export function Modal({ abierto, onCerrar, titulo, subtitulo, sobreTitulo, children, pie, ancho = 620, destacado = false }: PropsModal) {
  const idTitulo = useId();
  const panel = useRef<HTMLDivElement>(null);
  const cerrarRef = useRef(onCerrar);
  useEffect(() => {
    cerrarRef.current = onCerrar;
  }, [onCerrar]);

  useEffect(() => {
    if (!abierto) return;
    const anterior = document.activeElement as HTMLElement | null;
    const alPresionar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrarRef.current();
    };
    document.addEventListener('keydown', alPresionar);
    const desbordamiento = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.focus();
    return () => {
      document.removeEventListener('keydown', alPresionar);
      document.body.style.overflow = desbordamiento;
      anterior?.focus?.();
    };
  }, [abierto]);

  if (!abierto) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b1437]/60 p-3 sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        tabIndex={-1}
        style={{ maxWidth: ancho }}
        className="flex max-h-[min(900px,calc(100vh-24px))] w-full flex-col overflow-hidden rounded-[20px] bg-white shadow-menu focus:outline-none"
      >
        <header className="relative shrink-0 bg-azul-oscuro px-6 py-5 text-white sm:px-7">
          {sobreTitulo && <div className="mb-2 flex flex-wrap items-center gap-2 pr-10">{sobreTitulo}</div>}
          <h2
            id={idTitulo}
            className={`pr-10 font-bold ${destacado ? 'text-[22px] uppercase leading-tight sm:text-[26px]' : 'text-subtitle uppercase'}`}
          >
            {titulo}
          </h2>
          {subtitulo && <p className="mt-1 text-caption text-white/75">{subtitulo}</p>}
          {destacado && <span className="mt-3 block h-1 w-16 rounded-full bg-rojo" />}
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="absolute right-5 top-5 grid size-8 cursor-pointer place-items-center rounded-full bg-white/15 text-white hover:bg-white/25"
          >
            <X className="size-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 sm:px-7 sm:py-6">{children}</div>
        {pie && <footer className="shrink-0 border-t border-[#eceef1] px-6 py-4 sm:px-7">{pie}</footer>}
      </div>
    </div>,
    document.body,
  );
}

/** "¿Está seguro de que desea ...?" */
export function Confirmacion({
  abierto,
  titulo,
  pregunta,
  detalle,
  textoConfirmar,
  peligro = false,
  cargando = false,
  onConfirmar,
  onCancelar,
}: {
  abierto: boolean;
  titulo: string;
  pregunta: string;
  detalle?: string;
  textoConfirmar: string;
  peligro?: boolean;
  cargando?: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  return (
    <Modal abierto={abierto} onCerrar={onCancelar} titulo={titulo} ancho={520}>
      <p className="text-body font-semibold text-azul-titulo">{pregunta}</p>
      {detalle && <p className="mt-2 text-small text-texto-suave">{detalle}</p>}
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Boton variante="secundario" onClick={onCancelar} disabled={cargando}>
          Cancelar
        </Boton>
        <Boton variante={peligro ? 'primario' : 'azul'} onClick={onConfirmar} cargando={cargando}>
          {textoConfirmar}
        </Boton>
      </div>
    </Modal>
  );
}

/** Aviso de resultado ("REGISTRO CREADO", "La empresa se editó correctamente"...). */
export function Aviso({
  abierto,
  titulo,
  mensaje,
  detalle,
  onCerrar,
}: {
  abierto: boolean;
  titulo: string;
  mensaje: string;
  detalle?: string;
  onCerrar: () => void;
}) {
  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo={titulo} ancho={520}>
      <div className="flex flex-col items-center gap-3 py-2 text-center">
        <CheckCircle2 className="size-12 text-exito" aria-hidden />
        <p className="text-body font-semibold text-azul-titulo">{mensaje}</p>
        {detalle && <p className="text-small text-texto-suave">{detalle}</p>}
        <Boton className="mt-3 min-w-40" onClick={onCerrar}>
          Aceptar
        </Boton>
      </div>
    </Modal>
  );
}
