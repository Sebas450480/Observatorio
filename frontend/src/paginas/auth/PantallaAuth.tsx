import type { ReactNode } from 'react';
import logoBlanco from '../../assets/logo-observatorio-blanco.png';
import { FondoAuth } from './FondoAuth';

const BENEFICIOS = [
  'Recibir alertas de becas, convocatorias y eventos según tus intereses',
  'Recibir un resumen semanal de las tendencias empresariales',
  'Enterarte primero de cursos, talleres y oportunidades del Observatorio',
];

/**
 * Fondo común de inicio de sesión, registro y recuperación (Figma: General / Autenticación):
 * fondo animado, logo y beneficios a la izquierda y el formulario en una tarjeta blanca.
 * `ancha`: tarjeta de 560 px y logo de 610 px del registro (inicio de sesión: 520 y 573).
 */
export function PantallaAuth({
  children,
  tituloBeneficios = 'Regístrate y podrás:',
  ancha = false,
}: {
  children: ReactNode;
  tituloBeneficios?: string;
  ancha?: boolean;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#061b49]">
      <FondoAuth />
      <div
        className={`relative mx-auto grid min-h-screen max-w-[1920px] content-center items-center gap-10 px-4 py-10 sm:px-8 lg:gap-8 lg:pl-[6.8%] ${
          ancha ? 'lg:grid-cols-[minmax(0,1fr)_560px] lg:pr-[13%]' : 'lg:grid-cols-[minmax(0,1fr)_520px] lg:pr-[14%]'
        }`}
      >
        <section className="flex flex-col items-center text-white lg:mb-10 lg:items-start">
          <img
            src={logoBlanco}
            alt="Uniempresarial · Observatorio Empresarial"
            className={`w-[300px] max-w-full ${ancha ? 'lg:w-[610px]' : 'lg:w-[573px]'}`}
          />
          <div className={`hidden pl-10 lg:block ${ancha ? 'mt-[41px]' : 'mt-10'}`}>
            <h2 className="text-subtitle font-bold">{tituloBeneficios}</h2>
            <ul className="mt-[18px] flex max-w-[490px] flex-col gap-[18px]">
              {BENEFICIOS.map((b) => (
                <li key={b} className="flex items-center gap-3.5 text-body text-white">
                  <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-body font-bold text-rojo-vivo">
                    ✓
                  </span>
                  {b}
                </li>
              ))}
            </ul>
          </div>
        </section>
        <section className="flex justify-center">
          <div
            className={`flex w-full flex-col rounded-2xl bg-white p-6 shadow-[0_8px_32px_0_rgba(2,17,47,0.18)] ${
              ancha ? 'max-w-[560px] gap-[22px] sm:p-10' : 'max-w-[520px] gap-6 sm:p-11'
            }`}
          >
            {children}
          </div>
        </section>
      </div>
      <p className="absolute bottom-[37px] left-[calc(6.8%+40px)] hidden text-small text-white lg:block">© {new Date().getFullYear()} Observatorio Empresarial</p>
    </div>
  );
}

/** Título y subtítulo de la tarjeta ("Bienvenido de nuevo", "Crear cuenta"…). */
export function EncabezadoAuth({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h1 className="text-titulo font-bold text-azul-marino">{titulo}</h1>
      {children && <p className="text-body text-gris-azulado">{children}</p>}
    </div>
  );
}

/** Botones de la tarjeta: principal rojo (50-54 px) y secundario con borde. */
export const BOTON_AUTH = {
  principal:
    'inline-flex cursor-pointer items-center justify-center gap-2 rounded-control bg-rojo-vivo px-8 text-body font-bold text-white hover:bg-[#c8001f] disabled:cursor-not-allowed disabled:opacity-60',
  secundario:
    'inline-flex cursor-pointer items-center justify-center gap-2 rounded-control border border-[#d1d9e3] bg-white px-7 text-body font-semibold text-azul-marino hover:bg-fondo',
};

export function ErrorAuth({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-lg bg-rojo-claro px-4 py-3 text-caption text-rojo">
      {children}
    </p>
  );
}
