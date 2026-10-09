import { describe, expect, it } from 'vitest';
import { aEntradaFecha, aEntradaHora, aIsoBogota, costo, diaMes, enlaceValido, iniciales, modalidadTexto, normalizarEnlace, vinetas } from './formato';

describe('formato', () => {
  it('muestra el costo en pesos o GRATUITO', () => {
    expect(costo(150000, false)).toBe('$150.000 COP');
    expect(costo(150000, true)).toBe('GRATUITO');
    expect(costo(null, false)).toBe('GRATUITO');
  });

  it('usa la hora de Bogotá para fechas y horas', () => {
    expect(aIsoBogota('2026-10-20', '08:30')).toBe('2026-10-20T08:30:00-05:00');
    expect(aEntradaFecha('2026-10-21T02:00:00Z')).toBe('2026-10-20');
    expect(aEntradaHora('2026-10-20T13:30:00Z')).toBe('08:30');
    expect(diaMes('2026-10-13')).toEqual({ dia: '13', mes: 'OCT' });
  });

  it('textos de apoyo', () => {
    expect(modalidadTexto('Hibrido')).toBe('Presencial y virtual');
    expect(iniciales('andrés', 'martínez')).toBe('AM');
    expect(vinetas('• Uno\n- Dos\n\n  Tres ')).toEqual(['Uno', 'Dos', 'Tres']);
  });

  it('completa los enlaces escritos sin https://', () => {
    expect(normalizarEnlace('www.uniempresarial.edu.co')).toBe('https://www.uniempresarial.edu.co');
    expect(normalizarEnlace(' http://sitio.co/x ')).toBe('http://sitio.co/x');
    expect(normalizarEnlace('  ')).toBeNull();
    expect(enlaceValido('www.sitio.com/inscripcion')).toBe(true);
    expect(enlaceValido('no es un enlace')).toBe(false);
    expect(enlaceValido('sitio')).toBe(false);
  });
});
