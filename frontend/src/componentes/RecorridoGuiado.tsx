import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router';
import { useSesion } from '../sesion/sesion';

/**
 * Recorrido guiado por la plataforma para las cuentas nuevas (registro normal y
 * registro de empresas por invitación). Resalta cada parte del menú y termina en
 * Mi perfil, donde la persona completa sus datos (o la ficha de su empresa).
 */

const CLAVE = 'obs_recorrido_pendiente';

/** Marca que la cuenta recién creada debe ver el recorrido al entrar. */
export function iniciarRecorrido() {
  try {
    localStorage.setItem(CLAVE, '1');
  } catch {
    // Sin almacenamiento (modo privado estricto): simplemente no se muestra.
  }
}

function recorridoPendiente(): boolean {
  try {
    return localStorage.getItem(CLAVE) === '1';
  } catch {
    return false;
  }
}

function terminarRecorrido() {
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    // Nada que limpiar.
  }
}

interface Paso {
  /** Valor de data-recorrido del elemento que se resalta; sin él, la tarjeta va al centro. */
  objetivo?: string;
  titulo: string;
  texto: string;
  /** Página donde está el elemento. */
  ruta?: string;
}

function pasos(esEmpresa: boolean): Paso[] {
  return [
    {
      titulo: '¡Te damos la bienvenida al Observatorio Empresarial!',
      texto: 'En un minuto te mostramos cómo está organizada la plataforma. Puedes omitir el recorrido cuando quieras.',
      ruta: '/inicio',
    },
    { objetivo: 'menu', titulo: 'Menú principal', texto: 'Desde aquí entras a cada sección del Observatorio.' },
    { objetivo: 'flash', titulo: 'Flash Informativo', texto: 'Eventos, foros, ferias y noticias del sector empresarial.' },
    { objetivo: 'faro', titulo: 'Faro', texto: 'Becas, convocatorias, cursos y talleres para impulsar tu crecimiento.' },
    { objetivo: 'empresas', titulo: 'Empresas coformadoras', texto: 'El directorio de las empresas aliadas de Uniempresarial.' },
    { objetivo: 'tendencias', titulo: 'Tendencias', texto: 'Las tendencias y megatendencias que están transformando las empresas.' },
    { objetivo: 'eventos', titulo: 'Eventos institucionales', texto: 'El calendario de eventos de la institución.' },
    { objetivo: 'glosario', titulo: 'Glosario', texto: 'Los términos y conceptos clave del Observatorio.' },
    {
      objetivo: 'buscador',
      titulo: 'Buscador',
      texto: 'Encuentra eventos, becas, cursos, tendencias o empresas desde cualquier página. Con la banderita de cada tarjeta guardas lo que te interesa en tus favoritos.',
    },
    { objetivo: 'sesion', titulo: 'Tu sesión', texto: 'Aquí abres tu perfil y cierras la sesión.' },
    esEmpresa
      ? {
          objetivo: 'mi-empresa',
          ruta: '/mi-perfil',
          titulo: 'Completa la ficha de tu empresa',
          texto: 'Llena el NIT, el sector, la ubicación y la descripción. Cuando la guardes, tu empresa quedará publicada en el directorio de empresas coformadoras.',
        }
      : {
          objetivo: 'intereses',
          ruta: '/mi-perfil',
          titulo: 'Completa tu perfil',
          texto: 'Revisa tus datos y marca tus intereses: así recibirás alertas solo de lo que te importa.',
        },
  ];
}

/** Elemento visible con ese data-recorrido (en celular el menú lateral está oculto). */
function buscarObjetivo(objetivo: string | undefined): HTMLElement | null {
  if (!objetivo) return null;
  for (const el of document.querySelectorAll<HTMLElement>(`[data-recorrido="${objetivo}"]`)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && r.right > 0 && r.left < window.innerWidth) return el;
  }
  return null;
}

const MARGEN = 8;
const ANCHO_TARJETA = 340;

export function RecorridoGuiado() {
  const { usuario, esEmpresa } = useSesion();
  const [activo, setActivo] = useState(() => recorridoPendiente());
  const [indice, setIndice] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const tarjeta = useRef<HTMLDivElement>(null);
  const [altoTarjeta, setAltoTarjeta] = useState(200);
  const navegar = useNavigate();
  const { pathname } = useLocation();
  const idTitulo = useId();

  const lista = pasos(esEmpresa);
  const paso = lista[Math.min(indice, lista.length - 1)]!;
  const ultimo = indice >= lista.length - 1;

  const cerrar = useCallback(() => {
    terminarRecorrido();
    setActivo(false);
  }, []);

  // Cada paso abre su página, si la tiene.
  useEffect(() => {
    if (activo && usuario && paso.ruta && pathname !== paso.ruta) navegar(paso.ruta);
  }, [activo, usuario, paso.ruta, pathname, navegar]);

  // Ubica el elemento resaltado (espera a que la página lo pinte) y lo sigue al hacer scroll.
  useLayoutEffect(() => {
    if (!activo || !usuario) return;
    let intentos = 0;
    let temporizador = 0;
    const medir = () => {
      const el = buscarObjetivo(paso.objetivo);
      setRect(el ? el.getBoundingClientRect() : null);
      return el;
    };
    const esperar = () => {
      const el = medir();
      if (el) {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        temporizador = window.setTimeout(medir, 350);
      } else if (paso.objetivo && intentos++ < 30) {
        temporizador = window.setTimeout(esperar, 100);
      }
    };
    esperar();
    window.addEventListener('resize', medir);
    window.addEventListener('scroll', medir, true);
    return () => {
      window.clearTimeout(temporizador);
      window.removeEventListener('resize', medir);
      window.removeEventListener('scroll', medir, true);
    };
  }, [activo, usuario, paso.objetivo, pathname]);

  useLayoutEffect(() => {
    if (tarjeta.current) setAltoTarjeta(tarjeta.current.offsetHeight);
  }, [indice, rect]);

  useEffect(() => {
    if (!activo || !usuario) return;
    tarjeta.current?.focus();
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar();
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [activo, usuario, indice, cerrar]);

  if (!activo || !usuario) return null;

  // Tarjeta junto al elemento: a la derecha si cabe; si no, debajo o encima; sin elemento, al centro.
  const ancho = Math.min(ANCHO_TARJETA, window.innerWidth - 2 * MARGEN);
  let estilo: React.CSSProperties;
  if (!rect) {
    estilo = { left: (window.innerWidth - ancho) / 2, top: Math.max(MARGEN, (window.innerHeight - altoTarjeta) / 2) };
  } else if (rect.right + 16 + ancho <= window.innerWidth - MARGEN && rect.height < window.innerHeight * 0.6) {
    estilo = { left: rect.right + 16, top: Math.min(Math.max(MARGEN, rect.top), window.innerHeight - altoTarjeta - MARGEN) };
  } else {
    const abajo = rect.bottom + 12 + altoTarjeta <= window.innerHeight - MARGEN;
    const top = abajo ? rect.bottom + 12 : Math.max(MARGEN, rect.top - 12 - altoTarjeta);
    estilo = { left: Math.min(Math.max(MARGEN, rect.left), window.innerWidth - ancho - MARGEN), top };
  }

  return createPortal(
    <div className="fixed inset-0 z-[70]">
      {rect ? (
        // Resalta el elemento oscureciendo todo lo demás.
        <div
          aria-hidden
          className="pointer-events-none fixed rounded-xl ring-2 ring-white transition-all duration-200"
          style={{
            left: rect.left - 6,
            top: rect.top - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: '0 0 0 9999px rgba(11, 20, 55, 0.6)',
          }}
        />
      ) : (
        <div aria-hidden className="fixed inset-0 bg-[#0b1437]/60" />
      )}
      <div
        ref={tarjeta}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        tabIndex={-1}
        className="fixed flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-[0_12px_32px_0_rgba(7,31,93,0.25)] focus:outline-none"
        style={{ ...estilo, width: ancho }}
      >
        <p className="text-caption font-bold uppercase tracking-[0.04em] text-rojo-vivo">
          Paso {indice + 1} de {lista.length}
        </p>
        <h2 id={idTitulo} className="text-subtitle font-extrabold text-azul-marino">
          {paso.titulo}
        </h2>
        <p className="text-small text-gris-azulado">{paso.texto}</p>
        <div className="mt-1 flex items-center justify-between gap-3">
          {ultimo ? (
            <span />
          ) : (
            <button type="button" onClick={cerrar} className="cursor-pointer text-small font-semibold text-gris-azulado hover:underline">
              Omitir recorrido
            </button>
          )}
          <div className="flex gap-2">
            {indice > 0 && (
              <button
                type="button"
                onClick={() => setIndice((i) => i - 1)}
                className="h-10 cursor-pointer rounded-control border border-[#d1d9e3] bg-white px-4 text-small font-semibold text-azul-marino hover:bg-fondo"
              >
                Anterior
              </button>
            )}
            <button
              type="button"
              onClick={() => (ultimo ? cerrar() : setIndice((i) => i + 1))}
              className="h-10 cursor-pointer rounded-control bg-rojo-vivo px-5 text-small font-bold text-white hover:bg-rojo"
            >
              {ultimo ? 'Completar mi perfil' : indice === 0 ? 'Empezar' : 'Siguiente'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
