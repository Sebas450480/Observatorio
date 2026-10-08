import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

const BASE_CONTROL =
  'w-full rounded-control border border-borde bg-[#f9fafb] px-3.5 text-small text-texto placeholder:text-texto-tenue focus:border-azul-oscuro focus:bg-white focus:outline-none disabled:opacity-60';

interface Envoltura {
  etiqueta?: string;
  error?: string;
  ayuda?: string;
  icono?: ReactNode;
  className?: string;
  obligatorio?: boolean;
}

function Contenedor({ id, etiqueta, error, ayuda, className = '', obligatorio, children }: Envoltura & { id: string; children: ReactNode }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {etiqueta && (
        <label htmlFor={id} className="text-caption font-semibold text-azul-titulo">
          {etiqueta}
          {obligatorio && <span className="text-rojo"> *</span>}
        </label>
      )}
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-[13px] text-rojo">
          {error}
        </p>
      ) : (
        ayuda && <p className="text-[13px] text-texto-suave">{ayuda}</p>
      )}
    </div>
  );
}

type PropsEntrada = InputHTMLAttributes<HTMLInputElement> & Envoltura;

export const Entrada = forwardRef<HTMLInputElement, PropsEntrada>(function Entrada(
  { etiqueta, error, ayuda, icono, className, obligatorio, id, ...resto },
  ref,
) {
  const generado = useId();
  const idCampo = id ?? generado;
  return (
    <Contenedor id={idCampo} etiqueta={etiqueta} error={error} ayuda={ayuda} className={className} obligatorio={obligatorio}>
      <div className="relative">
        {icono && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-texto-suave">{icono}</span>}
        <input
          ref={ref}
          id={idCampo}
          aria-invalid={!!error}
          aria-describedby={error ? `${idCampo}-error` : undefined}
          className={`${BASE_CONTROL} h-11 ${icono ? 'pl-10' : ''} ${error ? 'border-rojo' : ''}`}
          {...resto}
        />
      </div>
    </Contenedor>
  );
});

type PropsArea = TextareaHTMLAttributes<HTMLTextAreaElement> & Envoltura;

export const AreaTexto = forwardRef<HTMLTextAreaElement, PropsArea>(function AreaTexto(
  { etiqueta, error, ayuda, className, obligatorio, id, rows = 4, ...resto },
  ref,
) {
  const generado = useId();
  const idCampo = id ?? generado;
  return (
    <Contenedor id={idCampo} etiqueta={etiqueta} error={error} ayuda={ayuda} className={className} obligatorio={obligatorio}>
      <textarea
        ref={ref}
        id={idCampo}
        rows={rows}
        aria-invalid={!!error}
        className={`${BASE_CONTROL} resize-y py-2.5 ${error ? 'border-rojo' : ''}`}
        {...resto}
      />
    </Contenedor>
  );
});

type PropsSelector = SelectHTMLAttributes<HTMLSelectElement> &
  Envoltura & { opciones: { valor: string; texto: string }[]; vacio?: string };

export const Selector = forwardRef<HTMLSelectElement, PropsSelector>(function Selector(
  { etiqueta, error, ayuda, className, obligatorio, id, opciones, vacio, ...resto },
  ref,
) {
  const generado = useId();
  const idCampo = id ?? generado;
  return (
    <Contenedor id={idCampo} etiqueta={etiqueta} error={error} ayuda={ayuda} className={className} obligatorio={obligatorio}>
      <select ref={ref} id={idCampo} aria-invalid={!!error} className={`${BASE_CONTROL} h-11 cursor-pointer ${error ? 'border-rojo' : ''}`} {...resto}>
        {vacio !== undefined && <option value="">{vacio}</option>}
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.texto}
          </option>
        ))}
      </select>
    </Contenedor>
  );
});

type PropsCasilla = InputHTMLAttributes<HTMLInputElement> & { etiqueta: ReactNode; error?: string };

export const Casilla = forwardRef<HTMLInputElement, PropsCasilla>(function Casilla({ etiqueta, error, id, className = '', ...resto }, ref) {
  const generado = useId();
  const idCampo = id ?? generado;
  return (
    <div className={className}>
      <label htmlFor={idCampo} className="flex cursor-pointer items-start gap-2 text-caption text-texto-suave">
        <input ref={ref} id={idCampo} type="checkbox" className="mt-0.5 size-4 shrink-0 cursor-pointer accent-rojo" {...resto} />
        <span>{etiqueta}</span>
      </label>
      {error && (
        <p role="alert" className="mt-1 text-[13px] text-rojo">
          {error}
        </p>
      )}
    </div>
  );
});

/**
 * Filtro desplegable de las barras de filtros (estilo del Figma: fondo blanco, borde gris).
 */
export function Filtro({
  valor,
  onChange,
  opciones,
  todos,
  etiqueta,
  className = '',
}: {
  valor: string;
  onChange: (valor: string) => void;
  opciones: { valor: string; texto: string }[];
  todos: string;
  etiqueta: string;
  className?: string;
}) {
  return (
    <select
      aria-label={etiqueta}
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      className={`h-[42px] min-w-[170px] cursor-pointer rounded-control border border-borde bg-white px-3.5 text-small text-texto focus:border-azul-oscuro focus:outline-none ${className}`}
    >
      <option value="">{todos}</option>
      {opciones.map((o) => (
        <option key={o.valor} value={o.valor}>
          {o.texto}
        </option>
      ))}
    </select>
  );
}
