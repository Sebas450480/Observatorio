import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import iconoCalendario from '../../assets/figma/detalle/calendario-20.svg';
import iconoCosto from '../../assets/figma/detalle/dolar-20.svg';
import iconoModalidad from '../../assets/figma/detalle/monitor-20.svg';
import iconoPin from '../../assets/figma/detalle/pin-16.svg';
import iconoReloj from '../../assets/figma/detalle/reloj-20.svg';

/**
 * Piezas de los modales de detalle del Figma ("Modal — Detalle Congreso", "Detalle beca",
 * "Detalle tendencia", "Detalle evento"); el marco es `<Modal destacado>`.
 */
export const ICONO_DETALLE = { calendario: iconoCalendario, modalidad: iconoModalidad, reloj: iconoReloj, costo: iconoCosto, pin: iconoPin };

/** Relleno del cuerpo de los modales de detalle (32 px). */
export const CUERPO_DETALLE = 'flex flex-col gap-6 p-6 sm:p-8';

/** Etiqueta del tipo y código "ID: OE-…" sobre el título. */
export function MetaDetalle({ etiqueta, mayusculas = true, children }: { etiqueta: ReactNode; mayusculas?: boolean; children?: ReactNode }) {
  return (
    <>
      <span className={`rounded bg-white/20 px-2.5 py-1 text-caption font-bold text-white ${mayusculas ? 'uppercase' : ''}`}>{etiqueta}</span>
      {children && <span className="text-small font-medium text-white/80">{children}</span>}
    </>
  );
}

/** Código público del registro: "OE-2026-0342". */
export const codigoDetalle = (id: number, fecha?: string | null) =>
  `ID: OE-${fecha ? new Date(fecha).getFullYear() : new Date().getFullYear()}-${String(id).padStart(4, '0')}`;

/** `unaColumna`: en paneles angostos (detalle del evento junto al calendario). */
export function DatosDetalle({ children, unaColumna = false }: { children: ReactNode; unaColumna?: boolean }) {
  return <div className={`grid gap-x-3 gap-y-4 ${unaColumna ? '' : 'sm:grid-cols-2'}`}>{children}</div>;
}

/** Dato con ícono en cuadro gris de 40 px. */
export function DatoDetalle({ icono, etiqueta, children }: { icono: string; etiqueta: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-etiqueta">
        <img src={icono} alt="" aria-hidden width={20} height={20} />
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-small text-texto-suave">{etiqueta}</p>
        <div className="break-words text-body font-semibold text-texto">{children}</div>
      </div>
    </div>
  );
}

export function SeccionDetalle({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-body font-bold text-texto">{titulo}</h3>
      {children}
    </section>
  );
}

/** Texto de la descripción (18 px gris). */
export function TextoDetalle({ children }: { children: ReactNode }) {
  return <p className="whitespace-pre-line text-body text-texto-suave">{children}</p>;
}

/** Caja gris con ícono (lugar, enlace y comportamiento de la tendencia). */
export function CajaDetalle({
  icono = iconoPin,
  tamanoIcono = 16,
  href,
  onClick,
  children,
}: {
  icono?: string;
  tamanoIcono?: number;
  href?: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  const clase = 'flex items-center gap-2.5 rounded-lg bg-etiqueta p-3 text-small text-texto';
  const contenido = (
    <>
      <img src={icono} alt="" aria-hidden width={tamanoIcono} height={tamanoIcono} className="shrink-0" />
      <span className="min-w-0 whitespace-pre-line break-words">{children}</span>
    </>
  );
  return href ? (
    <a href={href} target="_blank" rel="noreferrer" onClick={onClick} className={`${clase} hover:underline`}>
      {contenido}
    </a>
  ) : (
    <p className={clase}>{contenido}</p>
  );
}

/** Lista con viñetas rojas ("Información clave", "Fuentes de la tendencia"). */
export function VinetasDetalle({ children }: { children: ReactNode }) {
  return <ul className="flex flex-col gap-1.5 text-body text-texto-suave">{children}</ul>;
}

export function VinetaDetalle({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-2">
      <span className="text-rojo" aria-hidden>
        •
      </span>
      <span className="min-w-0 break-words">{children}</span>
    </li>
  );
}

/** Fila de botones "EDITAR" / "MÁS INFORMACIÓN" al final del cuerpo. */
export function AccionesDetalle({ children, apiladas = false }: { children: ReactNode; apiladas?: boolean }) {
  return <div className={`flex flex-col gap-3 pt-2 ${apiladas ? '' : 'sm:flex-row sm:justify-center sm:gap-[100px]'}`}>{children}</div>;
}

const BOTON_DETALLE =
  'inline-flex h-[50px] cursor-pointer items-center justify-center rounded-[10px] bg-rojo px-12 text-body font-bold uppercase text-white hover:bg-[#c2002e]';

export function BotonDetalle({ className = '', ...resto }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={`${BOTON_DETALLE} ${className}`} {...resto} />;
}

export function EnlaceDetalle({ className = '', ...resto }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a target="_blank" rel="noreferrer" className={`${BOTON_DETALLE} ${className}`} {...resto} />;
}
