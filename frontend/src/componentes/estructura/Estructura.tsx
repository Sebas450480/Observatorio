import { useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import { BarraLateral } from './BarraLateral';
import { BarraSuperior } from './BarraSuperior';

/**
 * Estructura de todas las pantallas internas: barra lateral azul con el menú,
 * barra superior con el buscador y el menú de sesión, y el contenido.
 */
export function Estructura() {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const ubicacion = useLocation();
  const [rutaAnterior, setRutaAnterior] = useState(ubicacion.pathname);
  // Al navegar en móvil se cierra el menú.
  if (rutaAnterior !== ubicacion.pathname) {
    setRutaAnterior(ubicacion.pathname);
    setMenuAbierto(false);
  }

  return (
    <div className="min-h-screen bg-fondo lg:pl-[325px]">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded focus:bg-white focus:px-4 focus:py-2"
      >
        Saltar al contenido
      </a>
      <BarraLateral abierto={menuAbierto} onCerrar={() => setMenuAbierto(false)} />
      <BarraSuperior onAbrirMenu={() => setMenuAbierto(true)} />
      <main id="contenido" className="relative overflow-x-clip px-4 pb-16 pt-6 sm:px-6 lg:px-8 xl:px-[30px]">
        {/* Semicírculo decorativo rojo de la esquina superior derecha (Figma) */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-[130px] right-[-150px] hidden size-[260px] rounded-full border-[42px] border-[#f04d64] opacity-90 xl:block"
        />
        <div className="relative mx-auto max-w-[1520px]">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
