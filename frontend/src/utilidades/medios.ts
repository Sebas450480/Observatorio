import { useSyncExternalStore } from 'react';

/** Ancho desde el que la plataforma deja de usar el diseño de celular (sm de Tailwind). */
export const DESDE_SM = '(min-width: 640px)';

/** Indica si la pantalla cumple la consulta de medios y se actualiza al cambiar de tamaño. */
export function useConsultaMedia(consulta: string) {
  return useSyncExternalStore(
    (avisar) => {
      const medio = window.matchMedia(consulta);
      medio.addEventListener('change', avisar);
      return () => medio.removeEventListener('change', avisar);
    },
    () => window.matchMedia(consulta).matches,
    () => true,
  );
}
