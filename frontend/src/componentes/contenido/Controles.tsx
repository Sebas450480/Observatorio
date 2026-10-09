import { Check, ImagePlus, Link2, Mail, MessageCircle } from 'lucide-react';
import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { registrarActividad } from '../../api/consultas';
import type { Categoria, TipoContenido } from '../../api/tipos';
import { Boton } from '../ui/Boton';
import { Modal } from '../ui/Modal';

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

/** Compartir un contenido: copiar enlace, correo o WhatsApp. */
export function ModalCompartir({
  abierto,
  onCerrar,
  titulo,
  ruta,
  tipo,
  id,
}: {
  abierto: boolean;
  onCerrar: () => void;
  titulo: string;
  ruta: string;
  tipo: TipoContenido;
  id: number;
}) {
  const [copiado, setCopiado] = useState(false);
  const enlace = `${window.location.origin}${ruta}`;
  const registrar = () => registrarActividad(tipo, id, 'Compartir');

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo="Compartir" subtitulo="Comparte esta información con otras personas por medio de un enlace." ancho={560}>
      <p className="mb-2 text-caption font-semibold text-azul-titulo">Enlace para compartir</p>
      <div className="flex gap-2">
        <input readOnly value={enlace} aria-label="Enlace" className="h-11 min-w-0 flex-1 rounded-control border border-borde bg-[#f9fafb] px-3 text-caption" />
        <Boton
          variante="azul"
          icono={copiado ? <Check className="size-4" /> : <Link2 className="size-4" />}
          onClick={async () => {
            await navigator.clipboard?.writeText(enlace).catch(() => undefined);
            setCopiado(true);
            registrar();
          }}
        >
          {copiado ? 'Copiado' : 'Copiar'}
        </Boton>
      </div>
      <p className="mt-2 text-[13px] text-texto-suave">Este enlace estará disponible para cualquier persona que tenga acceso.</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <a
          href={`mailto:?subject=${encodeURIComponent(titulo)}&body=${encodeURIComponent(`${titulo}\n${enlace}`)}`}
          onClick={registrar}
          className="flex items-center gap-3 rounded-xl border border-borde p-4 hover:bg-fondo"
        >
          <Mail className="size-5 text-azul-titulo" aria-hidden />
          <span>
            <span className="block text-small font-semibold text-azul-titulo">Enviar por correo</span>
            <span className="block text-[13px] text-texto-suave">Compartir por correo</span>
          </span>
        </a>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`${titulo} ${enlace}`)}`}
          target="_blank"
          rel="noreferrer"
          onClick={registrar}
          className="flex items-center gap-3 rounded-xl border border-borde p-4 hover:bg-fondo"
        >
          <MessageCircle className="size-5 text-exito" aria-hidden />
          <span>
            <span className="block text-small font-semibold text-azul-titulo">Compartir WhatsApp</span>
            <span className="block text-[13px] text-texto-suave">Envío directo</span>
          </span>
        </a>
      </div>
    </Modal>
  );
}
