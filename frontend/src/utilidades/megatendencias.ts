/** Megatendencias del mapa de tendencias (Figma) y sus colores. */
/** Color de cada megatendencia en el Figma; las nuevas toman la PALETA en orden. */
export const COLORES: Record<string, string> = {
  'Tecnología y sociedad': '#7338d9',
  'Medio ambiente y sostenibilidad': '#178c52',
  'Economía y trabajo': '#1f66c7',
  'Demografía y cultura': '#e07314',
  'Salud y bienestar': '#d62e6b',
  'Educación y talento': '#008c99',
  'Ciudades y urbanización': '#524dc2',
  'Finanzas y nuevos mercados': '#b2800a',
  'Comercio y geopolítica': '#476180',
  'Consumo y nuevos hábitos': '#a8339e',
  'Agroindustria y alimentos': '#61851a',
  'Energía y recursos': '#0a7ac7',
};
/** Colores para las megatendencias agregadas después (distintos de los del Figma). */
export const PALETA = ['#c2185b', '#00838f', '#6d4c41', '#5e35b1', '#2e7d32', '#ef6c00', '#455a64', '#ad1457'];
/** Megatendencias del Figma (el formulario las ofrece aunque todavía no tengan registros). */
export const MEGATENDENCIAS = Object.keys(COLORES);

/**
 * Todas las megatendencias, en orden alfabético: las del Figma y las que ya existen en la base.
 * La usan el mapa (chips) y el filtro del listado, para que siempre coincidan.
 */
export function todasLasMegatendencias(...registradas: string[][]): string[] {
  return [...new Set([...MEGATENDENCIAS, ...registradas.flat()])].sort((a, b) => a.localeCompare(b, 'es'));
}
