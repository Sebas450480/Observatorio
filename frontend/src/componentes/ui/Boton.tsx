import { LoaderCircle } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variante = 'primario' | 'secundario' | 'peligro' | 'azul' | 'fantasma' | 'claro';
type Tamano = 'sm' | 'md' | 'lg';

const VARIANTES: Record<Variante, string> = {
  primario: 'bg-rojo text-white hover:bg-[#c2002e] shadow-boton',
  secundario: 'bg-white text-azul-titulo border border-borde hover:bg-fondo',
  peligro: 'bg-white text-rojo border border-rojo hover:bg-rojo-claro',
  azul: 'bg-azul-boton text-white hover:bg-azul',
  fantasma: 'bg-transparent text-azul-titulo hover:bg-black/5',
  claro: 'bg-fondo text-azul-titulo hover:bg-[#e8ebee]',
};

const TAMANOS: Record<Tamano, string> = {
  sm: 'h-9 px-4 text-caption',
  md: 'h-[42px] px-5 text-small',
  lg: 'h-[54px] px-6 text-small',
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  tamano?: Tamano;
  /** Bordes completamente redondeados (píldora), como "Buscar" y "Crear..." en el Figma. */
  pildora?: boolean;
  cargando?: boolean;
  icono?: ReactNode;
}

export function Boton({
  variante = 'primario',
  tamano = 'md',
  pildora = false,
  cargando = false,
  icono,
  className = '',
  children,
  disabled,
  type = 'button',
  ...resto
}: Props) {
  return (
    <button
      type={type}
      disabled={disabled || cargando}
      className={`inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
        pildora ? 'rounded-full' : 'rounded-control'
      } ${VARIANTES[variante]} ${pildora ? 'h-[42px] px-6 text-body' : TAMANOS[tamano]} ${className}`}
      {...resto}
    >
      {cargando ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : icono}
      {children}
    </button>
  );
}
