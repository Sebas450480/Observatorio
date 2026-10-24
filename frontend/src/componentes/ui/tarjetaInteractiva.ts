import type { MouseEvent } from 'react';

/**
 * Tarjetas que abren un detalle (Flash, Faro, Tendencias, Empresas): al pasar el mouse
 * suben y crecen un poco, y la foto se acerca. Sin animaciones si el sistema pide
 * reducir el movimiento.
 */
export const TARJETA_INTERACTIVA =
  'group cursor-pointer transition duration-200 ease-out hover:shadow-menu motion-safe:hover:-translate-y-1 motion-safe:hover:scale-[1.02]';

/** Foto de la tarjeta: se acerca suavemente al pasar el mouse por la tarjeta. */
export const FOTO_INTERACTIVA = 'transition-transform duration-500 ease-out motion-safe:group-hover:scale-110';

/** Botón "Acceder" destacado: degradado, sombra, flecha que avanza y efecto al presionar. */
export const BOTON_ACCEDER =
  'relative inline-flex w-full cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg bg-gradient-to-r from-rojo to-rojo-vivo py-3 text-small font-extrabold uppercase tracking-[0.06em] text-white shadow-[0_6px_14px_rgba(200,16,46,0.35)] transition duration-200 hover:brightness-110 hover:shadow-[0_8px_22px_rgba(200,16,46,0.5)] motion-safe:active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul-oscuro';

/** Flecha del botón: avanza al pasar el mouse por la tarjeta. */
export const FLECHA_ACCEDER = 'size-4 transition-transform duration-200 motion-safe:group-hover:translate-x-1';

/**
 * Clic en cualquier parte de la tarjeta: abre el detalle, salvo que se haya hecho clic en
 * un botón o enlace propio (favorito, descargar, Acceder).
 */
export const clicTarjeta = (abrir: () => void) => (e: MouseEvent<HTMLElement>) => {
  if ((e.target as HTMLElement).closest('button, a, input, label')) return;
  abrir();
};
