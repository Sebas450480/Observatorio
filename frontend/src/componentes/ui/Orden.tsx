import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

/** Orden de una tabla: columna y sentido, o null para el orden por defecto. */
export type Orden = { campo: string; direccion: 'asc' | 'desc' } | null;

/** Como en Excel: primer clic ascendente, segundo descendente, tercero vuelve al orden por defecto. */
export function siguienteOrden(actual: Orden, campo: string): Orden {
  if (actual?.campo !== campo) return { campo, direccion: 'asc' };
  return actual.direccion === 'asc' ? { campo, direccion: 'desc' } : null;
}

/** Valor de aria-sort para el <th> de la columna. */
export function ariaOrden(orden: Orden, campo: string): 'ascending' | 'descending' | 'none' {
  if (orden?.campo !== campo) return 'none';
  return orden.direccion === 'asc' ? 'ascending' : 'descending';
}

/** Parámetros de la consulta a la API (orden y direccion). */
export function consultaOrden(orden: Orden): { orden?: string; direccion?: 'asc' | 'desc' } {
  return orden ? { orden: orden.campo, direccion: orden.direccion } : {};
}

/** Título de una columna que ordena la tabla al hacer clic (A→Z / 1→9 y Z→A / 9→1). */
export function BotonOrden({
  titulo,
  campo,
  orden,
  onOrdenar,
  className = '',
}: {
  titulo: string;
  campo: string;
  orden: Orden;
  onOrdenar: (orden: Orden) => void;
  className?: string;
}) {
  const activo = orden?.campo === campo;
  const Icono = !activo ? ArrowUpDown : orden.direccion === 'asc' ? ArrowUp : ArrowDown;
  const siguiente = !activo ? 'ascendente' : orden.direccion === 'asc' ? 'descendente' : 'sin orden';
  return (
    <button
      type="button"
      onClick={() => onOrdenar(siguienteOrden(orden, campo))}
      title={`Ordenar por ${titulo.toLowerCase()} (${siguiente})`}
      className={`inline-flex max-w-full cursor-pointer items-center justify-center gap-1 rounded px-1 font-[inherit] hover:bg-black/5 ${className}`}
    >
      <span className="truncate">{titulo}</span>
      <Icono className={`size-3.5 shrink-0 ${activo ? 'opacity-100' : 'opacity-40'}`} aria-hidden />
    </button>
  );
}
