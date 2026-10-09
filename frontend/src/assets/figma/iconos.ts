/**
 * Íconos exportados del Figma "Observatorio Empresarial".
 * Los de los módulos son blancos (barra lateral y cuadro rojo del encabezado de cada página).
 */
import bombillo from './iconos/bombillo.png';
import calendario from './iconos/calendario.png';
import edificio from './iconos/edificio.png';
import estadisticas from './iconos/estadisticas.png';
import inicio from './iconos/inicio.svg';
import megafono from './iconos/megafono.png';
import tendencias from './iconos/tendencias.svg';
import usuario from './iconos/usuario.png';

export { default as iconoBuscar } from './iconos/buscar.png';
export { default as iconoUsuario } from './iconos/usuario.png';
export { default as iconoPerfil } from './iconos/perfil.svg';
export { default as iconoCerrarSesion } from './iconos/cerrar-sesion.svg';

export type Modulo = 'inicio' | 'flash' | 'faro' | 'empresas' | 'tendencias' | 'eventos' | 'usuarios' | 'estadisticas';

export const ICONOS_MODULO: Record<Modulo, string> = {
  inicio,
  flash: megafono,
  faro: bombillo,
  empresas: edificio,
  tendencias,
  eventos: calendario,
  usuarios: usuario,
  estadisticas,
};
