import { Check, ImagePlus } from 'lucide-react';
import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { registrarActividad } from '../../api/consultas';
import type { Categoria, TipoContenido } from '../../api/tipos';
import iconoCopiar from '../../assets/figma/compartir/copiar.svg';
import iconoCorreo from '../../assets/figma/compartir/correo.svg';
import iconoDescargar from '../../assets/figma/compartir/descargar.svg';
import iconoEnlace from '../../assets/figma/compartir/enlace.svg';
import iconoInfo from '../../assets/figma/compartir/info.svg';
import iconoWhatsapp from '../../assets/figma/compartir/whatsapp.svg';
import { BotonModal, Modal } from '../ui/Modal';

/** Barra de filtros de los módulos: filtros, píldora "Buscar" y acciones. */
export function BarraFiltros({ children, acciones, className = 'gap-3' }: { children: ReactNode; acciones?: ReactNode; className?: string }) {
  return (
    <div className={`mb-[18px] flex min-h-14 flex-wrap items-center ${className}`}>
      {children}
      {acciones && <div className="flex flex-wrap items-center gap-3 sm:ml-auto">{acciones}</div>}
    </div>
  );
}

/** Selección de varias categorías (etiquetas) en un formulario. */
export function SelectorCategorias({
  categorias,
  seleccion,
  onCambiar,
  etiqueta = 'Categorías',
}: {
  categorias: Categoria[];
  seleccion: number[];
  onCambiar: (ids: number[]) => void;
  etiqueta?: string;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-caption font-semibold text-azul-titulo">{etiqueta}</legend>
      <div className="flex flex-wrap gap-2">
        {categorias.map((c) => {
          const activa = seleccion.includes(c.id_categoria);
          return (
            <button
              key={c.id_categoria}
              type="button"
              aria-pressed={activa}
              onClick={() => onCambiar(activa ? seleccion.filter((s) => s !== c.id_categoria) : [...seleccion, c.id_categoria])}
              className={`inline-flex cursor-pointer items-center gap-1 rounded-full border px-3 py-1 text-caption ${
                activa ? 'border-azul-oscuro bg-[rgba(14,31,135,0.08)] font-semibold text-azul-oscuro' : 'border-borde text-texto-suave'
              }`}
            >
              {activa && <Check className="size-3.5" aria-hidden />}
              {c.nombre_categoria}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** URL temporal para previsualizar un archivo elegido; se libera al cambiarlo. */
export function useVistaPrevia(archivo: File | null): string | null {
  const url = useMemo(() => (archivo ? URL.createObjectURL(archivo) : null), [archivo]);
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);
  return url;
}

/** Campo para elegir una imagen JPG o PNG (se sube al guardar). */
export function CampoImagen({
  etiqueta = 'Imagen',
  actual,
  archivo,
  onCambiar,
}: {
  etiqueta?: string;
  actual?: string | null;
  archivo: File | null;
  onCambiar: (archivo: File | null) => void;
}) {
  const id = useId();
  const vista = useVistaPrevia(archivo);
  const [error, setError] = useState<string | null>(null);
  const mostrar = vista ?? actual ?? null;

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-caption font-semibold text-azul-titulo">{etiqueta}</span>
      <label
        htmlFor={id}
        className="flex cursor-pointer items-center gap-3 rounded-control border border-dashed border-borde bg-[#f9fafb] p-3 hover:border-azul-oscuro"
      >
        {mostrar ? (
          <img src={mostrar} alt="" className="h-14 w-20 rounded object-cover" />
        ) : (
          <span className="grid h-14 w-20 place-items-center rounded bg-white text-texto-suave">
            <ImagePlus className="size-5" aria-hidden />
          </span>
        )}
        <span className="text-caption text-texto-suave">
          {archivo ? archivo.name : actual ? 'Cambiar imagen (JPG o PNG, máx. 4 MB)' : 'Subir imagen (JPG o PNG, máx. 4 MB)'}
        </span>
      </label>
      <input
        id={id}
        type="file"
        accept="image/png,image/jpeg"
        className="sr-only"
        onChange={(e) => {
          const nuevo = e.target.files?.[0] ?? null;
          if (nuevo && nuevo.size > 4 * 1024 * 1024) {
            setError('La imagen supera 4 MB');
            return;
          }
          setError(null);
          onCambiar(nuevo);
        }}
      />
      {error && <p className="text-[13px] text-rojo">{error}</p>}
    </div>
  );
}

type MetodoCompartir = 'enlace' | 'correo' | 'whatsapp' | 'descargar';

const METODOS: { valor: MetodoCompartir; titulo: string; detalle: string; icono: string }[] = [
  { valor: 'enlace', titulo: 'Copiar enlace', detalle: 'Generar un enlace público', icono: iconoEnlace },
  { valor: 'correo', titulo: 'Enviar por correo', detalle: 'Compartir por correo', icono: iconoCorreo },
  { valor: 'whatsapp', titulo: 'Compartir WhatsApp', detalle: 'Envío directo', icono: iconoWhatsapp },
  { valor: 'descargar', titulo: 'Descargar ficha', detalle: 'Guarda la info en PDF', icono: iconoDescargar },
];

/** Compartir un contenido: copiar enlace, correo, WhatsApp o descargar la ficha (Figma: "Compartir empresa"). */
export function ModalCompartir({
  abierto,
  onCerrar,
  titulo,
  ruta,
  tipo,
  id,
  nombreTipo = 'contenido',
  descarga,
}: {
  abierto: boolean;
  onCerrar: () => void;
  titulo: string;
  ruta: string;
  tipo: TipoContenido;
  id: number;
  /** "empresa" → "COMPARTIR EMPRESA" y "Comparte la información de esta empresa…". */
  nombreTipo?: string;
  /** URL del PDF para la opción "Descargar ficha". */
  descarga?: string;
}) {
  const [metodo, setMetodo] = useState<MetodoCompartir>('enlace');
  const [copiado, setCopiado] = useState(false);
  const enlace = `${window.location.origin}${ruta}`;
  const registrar = () => registrarActividad(tipo, id, 'Compartir');
  const copiar = async () => {
    await navigator.clipboard?.writeText(enlace).catch(() => undefined);
    setCopiado(true);
    registrar();
  };
  const compartir = () => {
    if (metodo === 'enlace') return void copiar();
    registrar();
    const destino = {
      correo: `mailto:?subject=${encodeURIComponent(titulo)}&body=${encodeURIComponent(`${titulo}\n${enlace}`)}`,
      whatsapp: `https://wa.me/?text=${encodeURIComponent(`${titulo} ${enlace}`)}`,
      descargar: descarga ?? enlace,
    }[metodo];
    if (metodo === 'correo') window.location.href = destino;
    else window.open(destino, '_blank', 'noopener');
  };
  const femenino = /a$/.test(nombreTipo);

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={`Compartir ${nombreTipo}`}
      subtitulo={`Comparte la información de ${femenino ? 'esta' : 'este'} ${nombreTipo} con otras personas por medio de un enlace.`}
      ancho={560}
      claseCuerpo="flex flex-col gap-5 p-6"
      pie={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <BotonModal variante="secundario" onClick={onCerrar}>
            Cancelar
          </BotonModal>
          <BotonModal className="bg-[#e11d48]! px-5!" onClick={compartir}>
            Compartir
          </BotonModal>
        </div>
      }
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-small font-semibold text-[#071f5d]">Selecciona el método de compartir</legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {METODOS.filter((m) => m.valor !== 'descargar' || descarga).map((m) => (
            <label
              key={m.valor}
              className="flex cursor-pointer flex-col items-center gap-2.5 rounded-xl border border-[#e2e8f0] bg-white p-4 text-center text-[#64748b] has-checked:border-2 has-checked:border-[#2563eb] has-checked:bg-[#eff6ff] has-checked:p-[15px] has-checked:text-[#2563eb] has-focus-visible:outline-2 has-focus-visible:outline-azul-oscuro"
            >
              <input type="radio" name="metodo-compartir" value={m.valor} checked={metodo === m.valor} onChange={() => setMetodo(m.valor)} className="sr-only" />
              <span aria-hidden className="size-6 bg-current" style={{ mask: `url("${m.icono}") center / contain no-repeat` }} />
              <span className={`text-small font-bold ${metodo === m.valor ? '' : 'text-[#0f172a]'}`}>{m.titulo}</span>
              <span className="w-full truncate text-caption text-[#64748b]">{m.detalle}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-col gap-2">
        <label htmlFor="enlace-compartir" className="text-small font-semibold text-[#071f5d]">
          Enlace para compartir
        </label>
        <div className="flex gap-3">
          <input
            id="enlace-compartir"
            readOnly
            value={enlace}
            className="h-11 min-w-0 flex-1 truncate rounded-[10px] border border-[#e2e8f0] bg-[#f8fafc] px-4 text-small text-[#0f172a]"
          />
          <button
            type="button"
            onClick={copiar}
            className="inline-flex h-[43px] shrink-0 cursor-pointer items-center gap-1.5 rounded-[10px] bg-[#071f5d] px-4 text-small font-semibold text-white hover:bg-azul"
          >
            <img src={iconoCopiar} alt="" aria-hidden width={14} height={14} />
            {copiado ? 'Copiado' : 'Copiar'}
          </button>
        </div>
      </div>
      <p className="flex items-center gap-2.5 rounded-lg bg-[#eff6ff] p-3 text-small text-[#2563eb]">
        <img src={iconoInfo} alt="" aria-hidden width={16} height={16} className="shrink-0" />
        Este enlace estará disponible para cualquier persona que tenga acceso.
      </p>
    </Modal>
  );
}
