import chevronAbajo from '../../assets/figma/iconos/chevron-abajo.svg';
import { forwardRef, useEffect, useId, useRef, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

/** Campo del Figma: fondo #f8fafc, borde #e2e8f0, texto de 16 px y ejemplo en gris claro. */
const BASE_CONTROL =
  'w-full rounded-control border border-[#e2e8f0] bg-[#f8fafc] px-4 text-small text-[#0a1c40] placeholder:font-light placeholder:text-[#788fad] focus:border-azul-oscuro focus:bg-white focus:outline-none disabled:opacity-60';

/** Campo de Mi perfil y del registro: blanco, 48 px y texto de 18 px (52 px en el inicio de sesión). */
const CONTROL_PERFIL =
  'w-full rounded-control border border-[#d1d9e3] bg-white px-3.5 text-body text-[#1f293d] placeholder:text-[#788fad] focus:border-azul-oscuro focus:outline-none disabled:opacity-60';

interface Envoltura {
  /** "perfil": campos blancos de 48 px (Mi perfil, registro); "acceso": igual, de 52 px (inicio de sesión); "formulario": grises de 43 px. */
  variante?: 'formulario' | 'perfil' | 'acceso';
  etiqueta?: string;
  error?: string;
  ayuda?: string;
  icono?: ReactNode;
  className?: string;
  obligatorio?: boolean;
}

function Contenedor({ id, etiqueta, error, ayuda, className = '', obligatorio, variante, children }: Envoltura & { id: string; children: ReactNode }) {
  return (
    <div className={`flex flex-col ${variante && variante !== 'formulario' ? 'gap-1.5' : 'gap-2'} ${className}`}>
      {etiqueta && (
        <label htmlFor={id} className={`text-small leading-[19px] font-semibold ${variante && variante !== 'formulario' ? 'text-azul-marino' : 'text-[#0a1c40]'}`}>
          {etiqueta}
          {obligatorio && <span aria-hidden> *</span>}
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
  { etiqueta, error, ayuda, icono, className, obligatorio, variante, id, ...resto },
  ref,
) {
  const generado = useId();
  const idCampo = id ?? generado;
  return (
    <Contenedor id={idCampo} etiqueta={etiqueta} error={error} ayuda={ayuda} className={className} obligatorio={obligatorio} variante={variante}>
      <div className="relative">
        {icono && <span className="pointer-events-none absolute left-4 top-1/2 grid -translate-y-1/2 place-items-center text-texto-suave">{icono}</span>}
        <input
          ref={ref}
          id={idCampo}
          aria-invalid={!!error}
          aria-describedby={error ? `${idCampo}-error` : undefined}
          aria-required={obligatorio || undefined}
          className={`${variante === 'perfil' ? `${CONTROL_PERFIL} h-12` : variante === 'acceso' ? `${CONTROL_PERFIL} h-[52px]` : `${BASE_CONTROL} h-[43px]`} ${icono ? 'pl-11' : ''} ${error ? 'border-rojo' : ''}`}
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
        className={`${BASE_CONTROL} min-h-[100px] resize-y p-4 ${error ? 'border-rojo' : ''}`}
        {...resto}
      />
    </Contenedor>
  );
});

type PropsSelector = SelectHTMLAttributes<HTMLSelectElement> &
  Envoltura & { opciones: { valor: string; texto: string }[]; vacio?: string };

export const Selector = forwardRef<HTMLSelectElement, PropsSelector>(function Selector(
  { etiqueta, error, ayuda, className, obligatorio, id, opciones, vacio, icono, onChange, value, defaultValue, ...resto },
  ref,
) {
  const generado = useId();
  const idCampo = id ?? generado;
  const interno = useRef<HTMLSelectElement | null>(null);
  const [actual, setActual] = useState<string>(String(value ?? defaultValue ?? ''));
  // Con react-hook-form el valor vive en el DOM (register, reset): se relee después de cada render.
  // Solo cambia el estado si el valor es distinto, así que no entra en un ciclo.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const valorDom = interno.current?.value ?? '';
    if (valorDom !== actual) setActual(valorDom);
  });
  const texto = opciones.find((o) => o.valor === actual)?.texto;
  return (
    <Contenedor id={idCampo} etiqueta={etiqueta} error={error} ayuda={ayuda} className={className} obligatorio={obligatorio}>
      <div
        className={`${BASE_CONTROL} relative flex h-[43px] items-center focus-within:border-azul-oscuro focus-within:bg-white ${error ? 'border-rojo' : ''}`}
      >
        {icono && <span className="mr-3 grid shrink-0 place-items-center">{icono}</span>}
        <span aria-hidden className={`truncate whitespace-pre ${texto ? '' : 'font-light text-[#788fad]'}`}>
          {texto ?? vacio ?? ''}
          {'  '}
          <span className="text-[11px]">▾</span>
        </span>
        <select
          ref={(nodo) => {
            interno.current = nodo;
            if (typeof ref === 'function') ref(nodo);
            else if (ref) ref.current = nodo;
          }}
          id={idCampo}
          aria-invalid={!!error}
          aria-required={obligatorio || undefined}
          value={value}
          defaultValue={defaultValue}
          onChange={(ev) => {
            setActual(ev.target.value);
            onChange?.(ev);
          }}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
          {...resto}
        >
          {vacio !== undefined && <option value="">{vacio}</option>}
          {opciones.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.texto}
            </option>
          ))}
        </select>
      </div>
    </Contenedor>
  );
});

/** Casilla del Figma: 22 px, borde gris y relleno rojo con visto blanco al marcarla. */
const CASILLA =
  'size-[22px] shrink-0 cursor-pointer appearance-none rounded border-[1.5px] border-[#d1d9e3] bg-white bg-center bg-no-repeat checked:border-rojo-vivo checked:bg-rojo-vivo checked:bg-[url("data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20width=%2712%27%20height=%2712%27%20viewBox=%270%200%2012%2012%27%20fill=%27none%27%3E%3Cpath%20d=%27M2.5%206.2%205%208.5l4.5-5%27%20stroke=%27white%27%20stroke-width=%272%27%20stroke-linecap=%27round%27%20stroke-linejoin=%27round%27/%3E%3C/svg%3E")] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul-oscuro';

type PropsCasilla = InputHTMLAttributes<HTMLInputElement> & { etiqueta: ReactNode; error?: string };

export const Casilla = forwardRef<HTMLInputElement, PropsCasilla>(function Casilla({ etiqueta, error, id, className = '', ...resto }, ref) {
  const generado = useId();
  const idCampo = id ?? generado;
  return (
    <div className={className}>
      <label htmlFor={idCampo} className="flex cursor-pointer items-start gap-3 text-small text-gris-azulado">
        <input ref={ref} id={idCampo} type="checkbox" className={CASILLA} {...resto} />
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
  todos?: string;
  etiqueta: string;
  className?: string;
}) {
  return (
    <select
      aria-label={etiqueta}
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      style={{ backgroundImage: `url("${chevronAbajo}")` }}
      className={`h-[42px] max-w-full cursor-pointer appearance-none rounded-control border border-borde bg-white bg-[length:13px_13px] bg-[position:right_16px_center] bg-no-repeat pl-4 pr-[34px] text-body text-texto [field-sizing:content] focus:border-azul-oscuro focus:outline-none ${className}`}
    >
      {todos !== undefined && <option value="">{todos}</option>}
      {opciones.map((o) => (
        <option key={o.valor} value={o.valor}>
          {o.texto}
        </option>
      ))}
    </select>
  );
}
