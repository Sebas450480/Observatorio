import { BarChart3, Building2, CalendarDays, CircleUser, House, Lightbulb, Megaphone, TrendingUp, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink } from 'react-router';
import logo from '../../assets/logo-observatorio.png';
import { useSesion } from '../../sesion/sesion';

interface Opcion {
  ruta: string;
  texto: string;
  icono: ReactNode;
  soloSuperAdmin?: boolean;
}

const OPCIONES: Opcion[] = [
  { ruta: '/inicio', texto: 'Inicio', icono: <House /> },
  { ruta: '/flash-informativo', texto: 'Flash informativo', icono: <Megaphone /> },
  { ruta: '/faro-empresarial', texto: 'Faro Empresarial', icono: <Lightbulb /> },
  { ruta: '/empresas', texto: 'Empresas coformadoras', icono: <Building2 /> },
  { ruta: '/tendencias', texto: 'Tendencias', icono: <TrendingUp /> },
  { ruta: '/eventos', texto: 'Eventos institucionales', icono: <CalendarDays /> },
  { ruta: '/usuarios', texto: 'Usuarios', icono: <CircleUser />, soloSuperAdmin: true },
  { ruta: '/estadisticas', texto: 'Estadísticas', icono: <BarChart3 />, soloSuperAdmin: true },
];

/** Barra lateral azul con el logo y el "Menú principal" según el rol. */
export function BarraLateral({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const { esSuperAdmin } = useSesion();
  const opciones = OPCIONES.filter((o) => !o.soloSuperAdmin || esSuperAdmin);

  return (
    <>
      {abierto && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={onCerrar} aria-hidden />}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[290px] flex-col bg-white transition-transform lg:w-[325px] lg:translate-x-0 ${
          abierto ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Menú principal"
      >
        <div className="flex h-[140px] shrink-0 items-center justify-between px-6 lg:px-[29px]">
          <NavLink to="/inicio" aria-label="Ir al inicio">
            <img src={logo} alt="Uniempresarial · Observatorio Empresarial" className="h-auto w-[230px] lg:w-[277px]" />
          </NavLink>
          <button type="button" onClick={onCerrar} className="cursor-pointer p-2 lg:hidden" aria-label="Cerrar menú">
            <X className="size-5" />
          </button>
        </div>
        <nav className="relative flex-1 overflow-hidden rounded-tr-[25px] bg-azul px-[14px] pt-7">
          {/* Círculos decorativos de la barra lateral (Figma) */}
          <span aria-hidden className="pointer-events-none absolute -left-[75px] bottom-[30px] size-[150px] rounded-full border-[34px] border-rojo-activo" />
          <span
            aria-hidden
            className="pointer-events-none absolute -right-[160px] bottom-[50px] size-[400px] rounded-full border-[70px] border-white/[0.07]"
          />
          <p className="relative mb-3 px-[22px] text-subtitle font-bold tracking-[0.02em] text-menu-tenue">Menú principal</p>
          <ul className="relative flex flex-col gap-2.5">
            {opciones.map((o) => (
              <li key={o.ruta}>
                <NavLink
                  to={o.ruta}
                  className={({ isActive }) =>
                    `flex h-[52px] items-center gap-3.5 rounded-xl px-4 text-body font-bold text-white transition-colors [&_svg]:size-6 [&_svg]:shrink-0 ${
                      isActive ? 'bg-rojo-activo' : 'hover:bg-white/10'
                    }`
                  }
                >
                  {o.icono}
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
