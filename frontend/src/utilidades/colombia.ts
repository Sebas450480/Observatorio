/** Departamentos de Colombia (y Bogotá D.C.) para filtros y formularios. */
export const DEPARTAMENTOS = [
  'Amazonas', 'Antioquia', 'Arauca', 'Atlántico', 'Bogotá D.C.', 'Bolívar', 'Boyacá', 'Caldas', 'Caquetá', 'Casanare',
  'Cauca', 'Cesar', 'Chocó', 'Córdoba', 'Cundinamarca', 'Guainía', 'Guaviare', 'Huila', 'La Guajira', 'Magdalena',
  'Meta', 'Nariño', 'Norte de Santander', 'Putumayo', 'Quindío', 'Risaralda', 'San Andrés y Providencia', 'Santander',
  'Sucre', 'Tolima', 'Valle del Cauca', 'Vaupés', 'Vichada',
].map((d) => ({ valor: d, texto: d }));

/** Años para el filtro "Todos los años": el anterior, el actual y los dos siguientes. */
export function opcionesAnios(): { valor: string; texto: string }[] {
  const actual = new Date().getFullYear();
  return [actual - 1, actual, actual + 1, actual + 2].map((a) => ({ valor: String(a), texto: String(a) }));
}
