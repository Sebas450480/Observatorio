import { z } from 'zod';

/**
 * Ayuda a construir filtros SQL con parámetros ($1, $2...) sin concatenar valores,
 * para evitar inyección SQL.
 */
export class Filtros {
  readonly condiciones: string[] = [];
  readonly valores: unknown[] = [];

  /** Agrega un valor y devuelve su marcador ($n). */
  param(valor: unknown): string {
    this.valores.push(valor);
    return `$${this.valores.length}`;
  }

  /** Agrega una condición (unida con AND). */
  y(condicion: string): this {
    this.condiciones.push(condicion);
    return this;
  }

  /** Búsqueda de texto (sin distinguir mayúsculas) en una o varias columnas. */
  texto(columnas: string[], valor: string): this {
    const marcador = this.param(`%${valor.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
    return this.y(`(${columnas.map((c) => `${c}::text ilike ${marcador}`).join(' or ')})`);
  }

  where(): string {
    return this.condiciones.length ? `where ${this.condiciones.join(' and ')}` : '';
  }
}

export const esquemaPaginacion = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
});

export interface Pagina<T> {
  datos: T[];
  total: number;
  pagina: number;
  limite: number;
  paginas: number;
}

export function construirPagina<T>(datos: T[], total: number, pagina: number, limite: number): Pagina<T> {
  return { datos, total, pagina, limite, paginas: Math.max(1, Math.ceil(total / limite)) };
}

/** Columnas e inserción a partir de un objeto ya validado (omite los valores undefined). */
export function columnasYValores(datos: Record<string, unknown>): { columnas: string[]; valores: unknown[] } {
  const columnas: string[] = [];
  const valores: unknown[] = [];
  for (const [columna, valor] of Object.entries(datos)) {
    if (valor !== undefined) {
      columnas.push(columna);
      valores.push(valor);
    }
  }
  return { columnas, valores };
}
