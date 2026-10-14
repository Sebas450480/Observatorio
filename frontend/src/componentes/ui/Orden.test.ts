import { describe, expect, it } from 'vitest';
import { ariaOrden, consultaOrden, siguienteOrden } from './Orden';

describe('Orden de las tablas', () => {
  it('cicla como Excel: ascendente, descendente y sin orden', () => {
    const a = siguienteOrden(null, 'nombre');
    expect(a).toEqual({ campo: 'nombre', direccion: 'asc' });
    const b = siguienteOrden(a, 'nombre');
    expect(b).toEqual({ campo: 'nombre', direccion: 'desc' });
    expect(siguienteOrden(b, 'nombre')).toBeNull();
    // Otra columna empieza de nuevo en ascendente.
    expect(siguienteOrden(b, 'id')).toEqual({ campo: 'id', direccion: 'asc' });
  });

  it('marca aria-sort y arma la consulta a la API', () => {
    expect(ariaOrden({ campo: 'id', direccion: 'desc' }, 'id')).toBe('descending');
    expect(ariaOrden({ campo: 'id', direccion: 'desc' }, 'nombre')).toBe('none');
    expect(consultaOrden(null)).toEqual({});
    expect(consultaOrden({ campo: 'id', direccion: 'asc' })).toEqual({ orden: 'id', direccion: 'asc' });
  });
});
