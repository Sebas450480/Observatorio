import { AlertTriangle, Download, FileSpreadsheet, FileText, Inbox, LoaderCircle } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { urlDescarga } from '../../api/cliente';
import { ICONOS_MODULO, type Modulo } from '../../assets/figma/iconos';
import flechaDerecha from '../../assets/figma/iconos/flecha-derecha.svg';
import flechaIzquierda from '../../assets/figma/iconos/flecha-izquierda.svg';

/** Etiqueta gris de categoría ("Tecnología", "Innovación"). */
export function Etiqueta({ children }: { children: ReactNode }) {
  return <span className="rounded bg-etiqueta px-2 py-[3px] text-caption font-medium text-texto">{children}</span>;
}

type Tono = 'azul' | 'verde' | 'morado' | 'rojo' | 'naranja' | 'gris';

const TONOS: Record<Tono, string> = {
  azul: 'bg-[rgba(14,31,135,0.1)] text-azul-oscuro',
  verde: 'bg-[rgba(16,185,129,0.1)] text-exito',
  morado: 'bg-[rgba(139,92,246,0.1)] text-morado',
  rojo: 'bg-[rgba(221,0,52,0.1)] text-rojo',
  naranja: 'bg-[rgba(249,115,22,0.12)] text-[#c2410c]',
  gris: 'bg-etiqueta text-texto-suave',
};

/** Insignia de color (modalidad, tipo de registro, estado). */
export function Insignia({ tono = 'azul', children, className = '' }: { tono?: Tono; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-caption font-bold uppercase ${TONOS[tono]} ${className}`}>
      {children}
    </span>
  );
}

export function InsigniaEstado({ estado }: { estado?: string }) {
  if (!estado) return null;
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${
        estado === 'Activo' ? 'bg-exito-claro text-[#059669]' : 'bg-etiqueta text-texto-suave'
      }`}
    >
      {estado}
    </span>
  );
}

/** Título de cada módulo: ícono en cuadro rojo, título azul y subtítulo. */
export function EncabezadoPagina({
  modulo,
  titulo,
  subtitulo,
  acciones,
}: {
  modulo?: Modulo;
  titulo: string;
  subtitulo?: string;
  acciones?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between xl:mb-[55px]">
      <div className="flex items-center gap-[13px]">
        {modulo && (
          <span className="grid size-[55px] shrink-0 place-items-center rounded-[10px] bg-rojo">
            <img src={ICONOS_MODULO[modulo]} alt="" aria-hidden className="size-[41px] object-contain" />
          </span>
        )}
        <div>
          <h1 className="text-[24px] font-bold tracking-[0.02em] text-azul-titulo sm:text-titulo">{titulo}</h1>
          {subtitulo && <p className="mt-0.5 text-small text-texto-suave sm:text-body">{subtitulo}</p>}
        </div>
      </div>
      {acciones && <div className="flex flex-wrap items-center gap-3">{acciones}</div>}
    </div>
  );
}

/** Tarjeta blanca básica. */
export function Tarjeta({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-tarjeta bg-white shadow-tarjeta ${className}`}>{children}</div>;
}

/** Paginación: flechas y números, la página actual en azul. */
export function Paginacion({ pagina, paginas, onCambiar }: { pagina: number; paginas: number; onCambiar: (p: number) => void }) {
  if (paginas <= 1) return null;
  const inicio = Math.max(1, Math.min(pagina - 2, paginas - 4));
  const numeros = Array.from({ length: Math.min(5, paginas) }, (_, i) => inicio + i);
  const clase = 'grid h-[23px] min-w-[37px] cursor-pointer place-items-center rounded-[7px] px-2 text-small font-bold tracking-[0.02em]';
  const flecha = 'cursor-pointer disabled:cursor-not-allowed disabled:opacity-40';
  return (
    <nav aria-label="Paginación" className="mt-7 flex items-center justify-center gap-[11px]">
      <button type="button" className={flecha} onClick={() => onCambiar(pagina - 1)} disabled={pagina <= 1} aria-label="Página anterior">
        <img src={flechaIzquierda} alt="" width={37} height={23} />
      </button>
      {numeros.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onCambiar(n)}
          aria-current={n === pagina ? 'page' : undefined}
          className={`${clase} ${n === pagina ? 'bg-[#011f75] text-white' : 'text-black hover:bg-black/5'}`}
        >
          {n}
        </button>
      ))}
      <button type="button" className={flecha} onClick={() => onCambiar(pagina + 1)} disabled={pagina >= paginas} aria-label="Página siguiente">
        <img src={flechaDerecha} alt="" width={37} height={23} />
      </button>
    </nav>
  );
}

export function Cargando({ texto = 'Cargando...' }: { texto?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-16 text-texto-suave">
      <LoaderCircle className="size-5 animate-spin" aria-hidden />
      {texto}
    </div>
  );
}

export function EstadoVacio({ titulo, detalle, accion }: { titulo: string; detalle?: string; accion?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-tarjeta bg-white px-6 py-14 text-center shadow-tarjeta">
      <span className="grid size-14 place-items-center rounded-full bg-fondo text-azul-titulo">
        <Inbox className="size-6" aria-hidden />
      </span>
      <p className="text-body font-semibold text-azul-titulo">{titulo}</p>
      {detalle && <p className="max-w-md text-small text-texto-suave">{detalle}</p>}
      {accion}
    </div>
  );
}

export function MensajeError({ mensaje, onReintentar }: { mensaje: string; onReintentar?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-tarjeta bg-white px-6 py-10 text-center shadow-tarjeta">
      <AlertTriangle className="size-8 text-rojo" aria-hidden />
      <p className="text-small text-texto">{mensaje}</p>
      {onReintentar && (
        <button type="button" onClick={onReintentar} className="cursor-pointer font-semibold text-azul-titulo underline">
          Reintentar
        </button>
      )}
    </div>
  );
}

/** Menú "Exportar" con descarga en PDF o Excel del listado filtrado. */
export function MenuExportar({ ruta, consulta }: { ruta: string; consulta: Record<string, string | number | boolean | undefined> }) {
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const cerrar = (e: MouseEvent) => {
      if (!contenedor.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener('mousedown', cerrar);
    return () => document.removeEventListener('mousedown', cerrar);
  }, [abierto]);

  return (
    <div ref={contenedor} className="relative">
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        aria-expanded={abierto}
        className="inline-flex h-[42px] cursor-pointer items-center gap-2 rounded-full border border-borde bg-white px-4 text-small font-semibold text-azul-titulo hover:bg-fondo"
      >
        <Download className="size-4" aria-hidden />
        Exportar
      </button>
      {abierto && (
        <div className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-xl bg-white py-1 shadow-menu">
          <a
            href={urlDescarga(`${ruta}/exportar`, { ...consulta, formato: 'pdf' })}
            className="flex items-center gap-2 px-4 py-2.5 text-small text-texto hover:bg-fondo"
            onClick={() => setAbierto(false)}
          >
            <FileText className="size-4 text-rojo" aria-hidden /> Descargar PDF
          </a>
          <a
            href={urlDescarga(`${ruta}/exportar`, { ...consulta, formato: 'xlsx' })}
            className="flex items-center gap-2 px-4 py-2.5 text-small text-texto hover:bg-fondo"
            onClick={() => setAbierto(false)}
          >
            <FileSpreadsheet className="size-4 text-exito" aria-hidden /> Descargar Excel
          </a>
        </div>
      )}
    </div>
  );
}

/** Fila de dato con ícono, etiqueta pequeña y valor (detalles de modales y perfiles). */
export function DatoConIcono({ icono, etiqueta, children }: { icono: ReactNode; etiqueta: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-fondo text-azul-titulo [&_svg]:size-4">{icono}</span>
      <div className="min-w-0">
        <p className="text-caption text-texto-suave">{etiqueta}</p>
        <div className="break-words text-small font-semibold text-texto">{children}</div>
      </div>
    </div>
  );
}
