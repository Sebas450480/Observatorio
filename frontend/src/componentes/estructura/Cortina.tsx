import { useSyncExternalStore } from 'react';
import logoBlanco from '../../assets/logo-observatorio-blanco.png';

/**
 * Cortina de transición: al iniciar o cerrar sesión cubre la pantalla con el azul
 * institucional y el logo, cambia de página por debajo y se desvanece.
 */
const DURACION_MS = 260;

let visible = false;
const oyentes = new Set<() => void>();
const avisar = () => oyentes.forEach((o) => o());
const suscribir = (o: () => void) => {
  oyentes.add(o);
  return () => oyentes.delete(o);
};

const reducirMovimiento = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Muestra la cortina, ejecuta la acción (navegar, cerrar sesión...) y la retira. */
export async function pasarConCortina(accion: () => void | Promise<void>) {
  if (reducirMovimiento()) return accion();
  visible = true;
  avisar();
  await esperar(DURACION_MS);
  try {
    await accion();
  } finally {
    await esperar(120);
    visible = false;
    avisar();
  }
}

export function Cortina() {
  const mostrar = useSyncExternalStore(suscribir, () => visible);
  return (
    <div
      aria-hidden
      className={`pointer-events-none fixed inset-0 z-[100] grid place-items-center bg-azul-marino transition-opacity duration-[260ms] ease-out ${
        mostrar ? 'pointer-events-auto opacity-100' : 'opacity-0'
      }`}
    >
      <img
        src={logoBlanco}
        alt=""
        className={`w-[240px] max-w-[70vw] transition-transform duration-[260ms] ease-out ${mostrar ? 'scale-100' : 'scale-90'}`}
      />
    </div>
  );
}
