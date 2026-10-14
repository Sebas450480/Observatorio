import { claveFavorito, useAlternarFavorito, useClavesFavoritos } from '../../api/favoritos';
import type { TipoContenido } from '../../api/tipos';
import { useSesion } from '../../sesion/sesion';

/** Banderita (marcador): contorno gris sin guardar, dorada al guardar. */
export function IconoBanderita({ marcado, tamano = 18 }: { marcado: boolean; tamano?: number }) {
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 24 24" aria-hidden>
      <path
        d="M6 3h12a1 1 0 0 1 1 1v17l-7-4.5L5 21V4a1 1 0 0 1 1-1z"
        fill={marcado ? 'var(--color-dorado)' : 'none'}
        stroke={marcado ? 'var(--color-dorado-borde)' : 'currentColor'}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </svg>
  );
}

const VARIANTES = {
  normal: 'size-9 text-texto-suave hover:bg-black/5',
  /** Círculo blanco para que se vea encima de fotos y fondos de color. */
  imagen: 'size-9 bg-white/95 text-texto-suave shadow-[0_1px_4px_rgba(0,0,0,0.18)] hover:bg-white',
  /** Junto a la X del encabezado azul de los modales de detalle. */
  encabezado: 'size-8 bg-white/15 text-white hover:bg-white/25',
};

/** Botón de favorito de una tarjeta o detalle. Solo aparece con sesión iniciada. */
export function BotonFavorito({
  tipo,
  id,
  titulo,
  variante = 'normal',
  className = '',
}: {
  tipo: TipoContenido;
  id: number;
  titulo: string;
  variante?: keyof typeof VARIANTES;
  className?: string;
}) {
  const { usuario } = useSesion();
  const { data: claves } = useClavesFavoritos();
  const alternar = useAlternarFavorito();
  if (!usuario) return null;

  const marcado = !!claves?.has(claveFavorito(tipo, id));
  return (
    <button
      type="button"
      aria-pressed={marcado}
      aria-label={`${marcado ? 'Quitar de favoritos' : 'Guardar en favoritos'}: ${titulo}`}
      title={marcado ? 'Quitar de favoritos' : 'Guardar en favoritos'}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        alternar.mutate({ tipo, id, guardar: !marcado });
      }}
      className={`grid shrink-0 cursor-pointer place-items-center rounded-full transition-colors ${VARIANTES[variante]} ${className}`}
    >
      <IconoBanderita marcado={marcado} tamano={variante === 'encabezado' ? 16 : 18} />
    </button>
  );
}
