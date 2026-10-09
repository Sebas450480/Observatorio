import { LoaderCircle } from 'lucide-react';
import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import iconoCerrarDetalle from '../../assets/figma/detalle/cerrar-14.svg';
import iconoCerrar from '../../assets/figma/modal/cerrar.svg';
import insigniaAdvertencia from '../../assets/figma/modal/insignia-advertencia.svg';
import insigniaEditar from '../../assets/figma/modal/insignia-editar.svg';
import insigniaExito from '../../assets/figma/modal/insignia-exito.svg';

interface PropsModal {
  abierto: boolean;
  onCerrar: () => void;
  titulo: ReactNode;
  subtitulo?: ReactNode;
  /** Contenido sobre el título (p. ej. la etiqueta del tipo de evento). */
  sobreTitulo?: ReactNode;
  /** Insignia de 28 px antes del título (advertencia, editar o éxito). */
  insignia?: keyof typeof INSIGNIAS;
  children: ReactNode;
  pie?: ReactNode;
  /** Ancho máximo en px (Figma: 700 detalle, 620 formularios, 520 avisos). */
  ancho?: number;
  /** Plantilla de los modales de detalle: encabezado grande con línea roja y pie con la firma. */
  destacado?: boolean;
  /** Relleno del cuerpo (Figma: 32 px en avisos, 28 px en formularios). */
  claseCuerpo?: string;
  /** Panel que sube desde abajo, pegado al borde de la pantalla (filtros en celular). */
  hoja?: boolean;
}

const INSIGNIAS = { advertencia: insigniaAdvertencia, editar: insigniaEditar, exito: insigniaExito };

/**
 * Bloqueo del scroll de la página mientras haya modales abiertos. Se cuenta cuántos hay
 * porque se encadenan (detalle → editar → confirmar → aviso) y se abren y cierran en
 * cualquier orden; guardar y restaurar el valor en cada modal dejaba la página sin scroll.
 */
let modalesAbiertos = 0;
function bloquearScroll() {
  modalesAbiertos += 1;
  document.body.style.overflow = 'hidden';
}
function liberarScroll() {
  modalesAbiertos = Math.max(0, modalesAbiertos - 1);
  if (modalesAbiertos === 0) document.body.style.overflow = '';
}

/** Botones del pie de los modales del Figma (46 px, esquinas de 8 px). */
export const BOTON_MODAL = {
  base: 'inline-flex h-[46px] shrink-0 cursor-pointer items-center justify-center gap-2 rounded-control px-5 text-body disabled:cursor-not-allowed disabled:opacity-60',
  secundario: 'border border-[#e2e8f0] bg-white font-semibold text-[#64748b] hover:bg-fondo',
  peligro: 'border border-rojo-vivo bg-white font-semibold text-rojo-vivo hover:bg-rojo-claro',
  primario: 'bg-rojo px-6 font-bold text-white shadow-[0_4px_10px_0_rgba(225,29,72,0.25)] hover:bg-[#c2002e]',
};

/** Botón del pie de los modales, con indicador de carga. */
export function BotonModal({
  variante = 'primario',
  cargando = false,
  className = '',
  children,
  disabled,
  type = 'button',
  ...resto
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: 'primario' | 'secundario' | 'peligro'; cargando?: boolean }) {
  return (
    <button type={type} disabled={disabled || cargando} className={`${BOTON_MODAL.base} ${BOTON_MODAL[variante]} ${className}`} {...resto}>
      {cargando && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

/**
 * Modal base de las plantillas del Figma: encabezado azul, alto máximo de 900 px con
 * scroll interno y pie con borde gris. Se cierra con Escape o clic fuera.
 */
export function Modal({
  abierto,
  onCerrar,
  titulo,
  subtitulo,
  sobreTitulo,
  insignia,
  children,
  pie,
  ancho = 620,
  destacado = false,
  claseCuerpo = 'p-6 sm:p-7',
  hoja = false,
}: PropsModal) {
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
    bloquearScroll();
    panel.current?.focus();
    return () => {
      document.removeEventListener('keydown', alPresionar);
      liberarScroll();
      anterior?.focus?.();
    };
  }, [abierto]);

  if (!abierto) return null;

  return createPortal(
    <div
      className={`entrada-fondo-modal fixed inset-0 z-50 flex justify-center bg-[#0b1437]/60 ${hoja ? 'items-end' : 'items-center p-3 sm:p-6'}`}
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
        className={`${hoja ? 'entrada-hoja max-h-[85dvh] rounded-t-[24px]' : `${insignia === 'exito' ? 'rebote-aviso' : 'entrada-modal'} max-h-[min(900px,calc(100vh-24px))] ${destacado ? 'rounded-2xl' : 'rounded-[20px]'}`} flex w-full flex-col overflow-hidden bg-white focus:outline-none ${destacado ? 'shadow-[0_0_40px_0_rgba(0,0,0,0.15)]' : 'shadow-[0_12px_32px_0_rgba(7,31,93,0.13)]'}`}
      >
        <header className={`relative shrink-0 bg-azul-oscuro text-white ${destacado ? 'p-6 sm:p-7' : 'px-6 py-5'}`}>
          {sobreTitulo && <div className={`flex flex-wrap items-center gap-2 pr-10 ${destacado ? 'mb-3' : 'mb-2'}`}>{sobreTitulo}</div>}
          <div className="flex items-center gap-3 pr-10">
            {insignia === 'exito' ? (
              // Insignia de éxito dibujada en línea para animar el visto.
              <svg aria-hidden width={28} height={28} viewBox="0 0 28 28" fill="none" className="rebote-insignia shrink-0">
                <rect width="28" height="28" rx="14" fill="#0F996B" />
                <path className="dibujar-visto" d="M9.334 14.333 12.334 17.333 18.667 11" stroke="white" strokeWidth="1.733" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              insignia && <img src={INSIGNIAS[insignia]} alt="" aria-hidden width={28} height={28} className="shrink-0" />
            )}
            <h2 id={idTitulo} className={destacado ? 'text-[22px] font-black sm:text-titulo' : 'text-subtitle font-extrabold uppercase'}>
              {titulo}
            </h2>
          </div>
          {subtitulo && <p className="mt-1 pr-10 text-small text-[#9eb1e0]">{subtitulo}</p>}
          {destacado && <span className="mt-3 block h-1 w-20 rounded-xs bg-rojo" />}
          {destacado ? (
            <button
              type="button"
              onClick={onCerrar}
              aria-label="Cerrar"
              className="absolute right-6 top-6 grid size-8 cursor-pointer place-items-center rounded-full bg-white/15 hover:bg-white/25"
            >
              <img src={iconoCerrarDetalle} alt="" width={14} height={14} />
            </button>
          ) : (
            <button
              type="button"
              onClick={onCerrar}
              aria-label="Cerrar"
              className={`absolute right-6 grid size-6 cursor-pointer place-items-center rounded-full hover:bg-white/15 ${subtitulo || sobreTitulo ? 'top-1/2 -translate-y-1/2' : 'top-[22px]'}`}
            >
              <img src={iconoCerrar} alt="" width={24} height={24} />
            </button>
          )}
        </header>
        <div className={`min-h-0 flex-1 overflow-y-auto ${claseCuerpo}`}>{children}</div>
        {destacado ? (
          <footer className="shrink-0 border-t border-borde p-5 text-center text-caption font-semibold uppercase tracking-[0.04em] text-texto-suave">
            Observatorio Empresarial
          </footer>
        ) : (
          pie && <footer className="shrink-0 border-t border-[#e2e8f0] p-6">{pie}</footer>
        )}
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
    <Modal
      abierto={abierto}
      onCerrar={onCancelar}
      titulo={titulo}
      insignia={peligro ? 'advertencia' : 'editar'}
      ancho={520}
      claseCuerpo="flex flex-col gap-4 p-8"
      pie={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <BotonModal variante="secundario" onClick={onCancelar} disabled={cargando}>
            Cancelar
          </BotonModal>
          <BotonModal onClick={onConfirmar} cargando={cargando}>
            {textoConfirmar}
          </BotonModal>
        </div>
      }
    >
      <p className="text-subtitle font-bold text-[#0a1c40]">{pregunta}</p>
      {detalle && <p className="text-body text-[#64748b]">{detalle}</p>}
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
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={titulo}
      insignia="exito"
      ancho={520}
      claseCuerpo="flex flex-col gap-4 p-8"
      pie={
        <div className="flex justify-end">
          <BotonModal onClick={onCerrar}>Aceptar</BotonModal>
        </div>
      }
    >
      <p className="text-subtitle font-bold text-[#0a1c40]">{mensaje}</p>
      {detalle && <p className="text-body text-[#64748b]">{detalle}</p>}
    </Modal>
  );
}
