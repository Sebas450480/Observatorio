import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import logoBlanco from '../../assets/logo-observatorio-blanco.png';

const BENEFICIOS = [
  'Recibir alertas de becas, convocatorias y eventos según tus intereses',
  'Recibir un resumen semanal de las tendencias empresariales',
  'Enterarte primero de cursos, talleres y oportunidades del Observatorio',
];

/**
 * Fondo común de inicio de sesión, registro y recuperación (Figma: General / Autenticación):
 * panel azul con el logo y los beneficios, y el formulario en una tarjeta blanca.
 */
export function PantallaAuth({ children, tituloBeneficios = 'Regístrate y podrás:' }: { children: ReactNode; tituloBeneficios?: string }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_20%_20%,#0d3a8f_0%,#062a6e_45%,#031a47_100%)]">
      {/* Panel claro en diagonal (pantallas grandes) */}
      <div
        aria-hidden
        className="absolute inset-y-0 right-0 hidden w-[62%] bg-[#e9edf3] lg:block"
        style={{ clipPath: 'polygon(42% 0, 100% 0, 100% 78%, 70% 100%, 20% 100%, 0 58%)' }}
      />
      {/* Ondas rojas decorativas */}
      <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1920 1080" preserveAspectRatio="none">
        <path d="M0 200 C 400 120, 700 160, 1000 110 S 1500 -10, 1920 -20" fill="none" stroke="#e8002f" strokeWidth="7" />
        <path d="M0 950 C 300 860, 600 870, 900 1000 S 1300 1100, 1500 1080" fill="none" stroke="#e8002f" strokeWidth="7" />
        <path d="M1560 985 L 1920 985" fill="none" stroke="#e8002f" strokeWidth="7" />
      </svg>

      <div className="relative mx-auto grid min-h-screen max-w-[1600px] items-center gap-10 px-5 py-10 lg:grid-cols-2 lg:px-16">
        <section className="text-white">
          <img src={logoBlanco} alt="Uniempresarial · Observatorio Empresarial" className="w-[300px] max-w-full lg:w-[520px]" />
          <div className="mt-6 hidden lg:block">
            <h2 className="text-body font-bold">{tituloBeneficios}</h2>
            <ul className="mt-4 flex max-w-[490px] flex-col gap-4">
              {BENEFICIOS.map((b) => (
                <li key={b} className="flex items-start gap-3.5 text-small text-white/90">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-rojo">
                    <Check className="size-5" strokeWidth={3} aria-hidden />
                  </span>
                  {b}
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-16 hidden text-caption text-white/80 lg:block">© {new Date().getFullYear()} Observatorio Empresarial</p>
        </section>
        <section className="flex justify-center lg:justify-end lg:pr-[8%]">
          <div className="w-full max-w-[520px] rounded-2xl bg-white p-7 shadow-menu sm:p-11">{children}</div>
        </section>
      </div>
    </div>
  );
}
