import { useQuery } from '@tanstack/react-query';
import { Menu } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { api } from '../../api/cliente';
import { iconoBuscar, iconoCerrarSesion, iconoPerfil, iconoUsuario } from '../../assets/figma/iconos';
import type { ResultadoBusqueda, TipoContenido } from '../../api/tipos';
import { descripcionRol, etiquetaRol, RUTA_MODULO, useSesion } from '../../sesion/sesion';
import { fechaCorta, iniciales } from '../../utilidades/formato';

export const RUTA_DE: Record<TipoContenido, string> = {
  Flash: '/flash-informativo',
  Faro: '/faro-empresarial',
  Empresa: '/empresas',
  Tendencia: '/tendencias',
  Evento: '/eventos',
};

const ETIQUETA_DE: Record<TipoContenido, string> = {
  Flash: 'Flash informativo',
  Faro: 'Faro Empresarial',
  Empresa: 'Empresa coformadora',
  Tendencia: 'Tendencia',
  Evento: 'Evento institucional',
};

export function BarraSuperior({ onAbrirMenu }: { onAbrirMenu: () => void }) {
  return (
    <header className="sticky top-0 z-20 flex h-[86px] items-center gap-3 bg-white px-4 sm:px-6 lg:gap-10 lg:pl-[30px] lg:pr-[48px]">
      <button type="button" onClick={onAbrirMenu} className="cursor-pointer rounded-lg p-2 text-azul lg:hidden" aria-label="Abrir menú">
        <Menu className="size-6" />
      </button>
      <BuscadorGlobal />
      <MenuSesion />
    </header>
  );
}

/** Buscador de la barra superior: busca en todos los módulos a la vez. */
function BuscadorGlobal() {
  const [texto, setTexto] = useState('');
  const [consulta, setConsulta] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(-1);
  const navegar = useNavigate();
  const { moduloGestor } = useSesion();
  const idLista = useId();
  const contenedor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const espera = setTimeout(() => setConsulta(texto.trim()), 300);
    return () => clearTimeout(espera);
  }, [texto]);

  const { data, isFetching } = useQuery({
    queryKey: ['/buscar', consulta],
    queryFn: ({ signal }) => api<{ resultados: ResultadoBusqueda[] }>('/buscar', { consulta: { q: consulta, limite: 4 }, senal: signal }),
    enabled: consulta.length >= 2,
  });
  // El gestor solo busca en su módulo.
  const resultados = (consulta.length >= 2 ? (data?.resultados ?? []) : []).filter(
    (r) => !moduloGestor || RUTA_DE[r.tipo] === RUTA_MODULO[moduloGestor],
  );

  useEffect(() => {
    const cerrar = (e: MouseEvent) => {
      if (!contenedor.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener('mousedown', cerrar);
    return () => document.removeEventListener('mousedown', cerrar);
  }, []);

  const ir = (r: ResultadoBusqueda) => {
    setAbierto(false);
    setTexto('');
    navegar(`${RUTA_DE[r.tipo]}/${r.id}`);
  };

  return (
    <div ref={contenedor} className="relative min-w-0 flex-1">
      <img src={iconoBuscar} alt="" aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-[25px] -translate-y-1/2" />
      <input
        type="search"
        role="combobox"
        aria-expanded={abierto && consulta.length >= 2}
        aria-controls={idLista}
        aria-label="Buscar en el Observatorio"
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setAbierto(true);
          setActivo(-1);
        }}
        onFocus={() => setAbierto(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActivo((a) => Math.min(a + 1, resultados.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActivo((a) => Math.max(a - 1, 0));
          } else if (e.key === 'Enter' && resultados.length) {
            ir(resultados[Math.max(activo, 0)]!);
          } else if (e.key === 'Escape') {
            setAbierto(false);
          }
        }}
        placeholder="Buscar eventos, becas, convocatorias, cursos, tendencias, empresas"
        className="h-[52px] w-full rounded-[20px] border-2 border-black/10 bg-white pl-[49px] pr-4 text-small font-bold text-black placeholder:text-black focus:border-azul-oscuro/40 focus:outline-none sm:text-subtitle sm:tracking-[-0.5px]"
      />
      {abierto && consulta.length >= 2 && (
        <div id={idLista} role="listbox" className="absolute inset-x-0 top-full z-30 mt-2 max-h-[70vh] overflow-y-auto rounded-2xl bg-white py-2 shadow-menu">
          {isFetching && !resultados.length && <p className="px-4 py-3 text-small text-texto-suave">Buscando...</p>}
          {!isFetching && !resultados.length && (
            <p className="px-4 py-3 text-small text-texto-suave">No encontramos resultados para “{consulta}”.</p>
          )}
          {resultados.map((r, i) => (
            <button
              key={`${r.tipo}-${r.id}`}
              type="button"
              role="option"
              aria-selected={i === activo}
              onClick={() => ir(r)}
              onMouseEnter={() => setActivo(i)}
              className={`flex w-full cursor-pointer items-start gap-3 px-4 py-2.5 text-left ${i === activo ? 'bg-fondo' : ''}`}
            >
              <span className="mt-0.5 shrink-0 rounded bg-[rgba(14,31,135,0.08)] px-2 py-0.5 text-[11px] font-bold uppercase text-azul-oscuro">
                {ETIQUETA_DE[r.tipo]}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-small font-semibold text-azul-titulo">{r.titulo}</span>
                <span className="block text-[13px] text-texto-suave">
                  {[r.detalle, r.fecha && fechaCorta(r.fecha)].filter(Boolean).join(' · ')}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Botón rojo con el rol y menú desplegable (Figma: "Menú de sesión"). */
function MenuSesion() {
  const { usuario, cerrarSesion } = useSesion();
  const [abierto, setAbierto] = useState(false);
  const navegar = useNavigate();
  const contenedor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const cerrar = (e: MouseEvent) => {
      if (!contenedor.current?.contains(e.target as Node)) setAbierto(false);
    };
    const escape = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false);
    document.addEventListener('mousedown', cerrar);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', cerrar);
      document.removeEventListener('keydown', escape);
    };
  }, [abierto]);

  const claseBoton =
    'flex h-[52px] shrink-0 cursor-pointer items-center justify-between gap-3 rounded-[20px] bg-rojo-sesion px-1.5 text-subtitle font-bold tracking-[-0.5px] text-white hover:bg-rojo sm:w-[215px] sm:pl-[20px] sm:pr-[23px]';

  if (!usuario) {
    return (
      <Link to="/iniciar-sesion" className={claseBoton}>
        <span className="hidden whitespace-nowrap sm:inline">Iniciar sesión</span>
        <img src={iconoUsuario} alt="" aria-hidden className="size-10" />
      </Link>
    );
  }

  return (
    <div ref={contenedor} className="relative">
      <button type="button" className={claseBoton} onClick={() => setAbierto((a) => !a)} aria-expanded={abierto} aria-haspopup="menu">
        <span className="hidden sm:inline">{etiquetaRol(usuario.nombre_rol)}</span>
        <img src={iconoUsuario} alt={`Sesión de ${usuario.nombre_usuario}`} className="size-10" />
      </button>
      {abierto && (
        <div
          role="menu"
          className="absolute right-0 top-[60px] flex w-[280px] flex-col overflow-hidden rounded-xl border border-[#e8ebf2] bg-white p-2 shadow-[0_12px_14px_0_rgba(13,26,64,0.16)]"
        >
          <div className="flex items-center gap-3 px-3 py-2.5">
            <span className="grid size-10 shrink-0 place-items-center rounded-[20px] bg-azul-marino text-small font-bold text-white">
              {iniciales(usuario.nombre_usuario, usuario.apellido_usuario)}
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-small font-semibold text-azul-marino">
                {usuario.nombre_usuario} {usuario.apellido_usuario}
              </span>
              <span className="truncate text-caption text-gris-azulado">{descripcionRol(usuario.nombre_rol)}</span>
            </span>
          </div>
          <div className="h-px bg-[#e8ebf2]" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setAbierto(false);
              navegar('/mi-perfil');
            }}
            className="flex w-full cursor-pointer items-center gap-3 rounded-lg p-3 text-left hover:bg-fondo"
          >
            <img src={iconoPerfil} alt="" aria-hidden className="size-[22px]" />
            <span className="flex flex-col gap-0.5">
              <span className="text-small font-semibold text-azul-marino">Mi perfil</span>
              <span className="text-caption text-gris-azulado">Ver y editar mis datos</span>
            </span>
          </button>
          <div className="h-px bg-[#e8ebf2]" />
          <button
            type="button"
            role="menuitem"
            onClick={async () => {
              setAbierto(false);
              await cerrarSesion();
              navegar('/inicio');
            }}
            className="flex w-full cursor-pointer items-center gap-3 rounded-lg p-3 text-left text-small font-semibold text-rojo-vivo hover:bg-rojo-claro"
          >
            <img src={iconoCerrarSesion} alt="" aria-hidden className="size-[22px]" />
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}
