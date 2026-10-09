import { useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import { BarraLateral } from './BarraLateral';
import { BarraSuperior } from './BarraSuperior';
import semicirculo from '../../assets/figma/decoraciones/semicirculo.svg';

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
    <div className="relative min-h-screen overflow-x-clip bg-fondo lg:pl-[325px]">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded focus:bg-white focus:px-4 focus:py-2"
      >
        Saltar al contenido
      </a>
      <BarraLateral abierto={menuAbierto} onCerrar={() => setMenuAbierto(false)} />
      {/* Semicírculo decorativo rojo de la esquina superior derecha (Figma), detrás de la barra superior */}
      <img
        src={semicirculo}
        alt=""
        aria-hidden
        width={136}
        height={315}
        className="pointer-events-none absolute right-0 top-0 hidden xl:block"
      />
      <BarraSuperior onAbrirMenu={() => setMenuAbierto(true)} />
      <main id="contenido" className="relative overflow-x-clip px-4 pb-16 pt-6 sm:px-6 lg:px-8 xl:pb-[60px] xl:pl-[30px] xl:pr-[61px] xl:pt-[17px]">
        <div className="relative max-w-[1504px] min-[1921px]:mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
