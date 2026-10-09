import { X } from 'lucide-react';
import { NavLink } from 'react-router';
import circuloAzul from '../../assets/figma/decoraciones/circulo-azul-lateral.svg';
import circuloRojo from '../../assets/figma/decoraciones/circulo-rojo-lateral.svg';
import { ICONOS_MODULO, type Modulo } from '../../assets/figma/iconos';
import logo from '../../assets/figma/logo-observatorio.png';
import { RUTA_MODULO, useSesion } from '../../sesion/sesion';

interface Opcion {
  ruta: string;
  texto: string;
  icono: Modulo;
  soloSuperAdmin?: boolean;
}

const OPCIONES: Opcion[] = [
  { ruta: '/inicio', texto: 'Inicio', icono: 'inicio' },
  { ruta: '/flash-informativo', texto: 'Flash informativo', icono: 'flash' },
  { ruta: '/faro-empresarial', texto: 'Faro Empresarial', icono: 'faro' },
  { ruta: '/empresas', texto: 'Empresas coformadoras', icono: 'empresas' },
  { ruta: '/tendencias', texto: 'Tendencias', icono: 'tendencias' },
  { ruta: '/eventos', texto: 'Eventos institucionales', icono: 'eventos' },
  { ruta: '/usuarios', texto: 'Usuarios', icono: 'usuarios', soloSuperAdmin: true },
  { ruta: '/estadisticas', texto: 'Estadísticas', icono: 'estadisticas', soloSuperAdmin: true },
];

/** Barra lateral azul con el logo y el "Menú principal" según el rol. */
export function BarraLateral({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const { esSuperAdmin, moduloGestor } = useSesion();
  // El gestor solo ve su módulo.
  const opciones = moduloGestor
    ? OPCIONES.filter((o) => o.ruta === RUTA_MODULO[moduloGestor])
    : OPCIONES.filter((o) => !o.soloSuperAdmin || esSuperAdmin);

  return (
    <>
      {abierto && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={onCerrar} aria-hidden />}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[290px] flex-col bg-white transition-transform lg:w-[325px] lg:translate-x-0 ${
          abierto ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Menú principal"
      >
        <div className="flex h-[142px] shrink-0 items-start justify-between px-6 pt-[42px] lg:pl-[29px] lg:pr-[19px]">
          <NavLink to={moduloGestor ? RUTA_MODULO[moduloGestor] : '/inicio'} aria-label="Ir al inicio">
            <img src={logo} alt="Uniempresarial · Observatorio Empresarial" className="h-auto w-[230px] max-w-none lg:w-[277px]" />
          </NavLink>
          <button type="button" onClick={onCerrar} className="cursor-pointer p-2 lg:hidden" aria-label="Cerrar menú">
            <X className="size-5" />
          </button>
        </div>
        <nav className="relative flex-1 overflow-hidden rounded-tr-[25px] bg-azul px-[14px] pt-[29px]">
          {/* Medios círculos decorativos de la barra lateral (Figma) */}
          <img src={circuloRojo} alt="" aria-hidden width={76} height={155} className="pointer-events-none absolute bottom-[26px] left-0" />
          <img src={circuloAzul} alt="" aria-hidden width={400} height={414} className="pointer-events-none absolute bottom-[39px] left-[125px] max-w-none" />
          <p className="relative mb-4 px-[22px] text-subtitle font-bold tracking-[0.02em] text-menu-tenue">Menú principal</p>
          <ul className="relative flex flex-col gap-2.5">
            {opciones.map((o) => (
              <li key={o.ruta}>
                <NavLink
                  to={o.ruta}
                  className={({ isActive }) =>
                    `flex h-[52px] items-center gap-3.5 rounded-xl px-4 text-body font-bold text-white transition-colors ${
                      isActive ? 'bg-rojo-activo' : 'hover:bg-white/10'
                    }`
                  }
                >
                  <img src={ICONOS_MODULO[o.icono]} alt="" aria-hidden className="size-7 shrink-0 object-contain" />
                  {o.texto}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </>
  );
}
