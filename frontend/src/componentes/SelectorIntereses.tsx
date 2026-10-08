import { Check } from 'lucide-react';
import type { Categoria } from '../api/tipos';

/** Categorías que describen tipos de contenido; las demás son sectores (Figma: registro paso 2). */
const CONTENIDO = ['Becas', 'Convocatorias', 'Cursos', 'Talleres', 'Eventos', 'Tendencias', 'Flash informativo'];

function Chip({ categoria, seleccionada, onAlternar }: { categoria: Categoria; seleccionada: boolean; onAlternar: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={seleccionada}
      onClick={onAlternar}
      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-caption transition-colors ${
        seleccionada ? 'border-rojo bg-rojo-claro font-semibold text-rojo' : 'border-borde bg-white text-texto-suave hover:border-texto-tenue'
      }`}
    >
      {seleccionada && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
      {categoria.nombre_categoria}
    </button>
  );
}

/** Selección de intereses en "chips", agrupados en contenido y sectores. */
export function SelectorIntereses({
  categorias,
  seleccion,
  onCambiar,
}: {
  categorias: Categoria[];
  seleccion: number[];
  onCambiar: (ids: number[]) => void;
}) {
  const alternar = (id: number) => onCambiar(seleccion.includes(id) ? seleccion.filter((s) => s !== id) : [...seleccion, id]);
  const contenido = categorias.filter((c) => CONTENIDO.includes(c.nombre_categoria));
  const sectores = categorias.filter((c) => !CONTENIDO.includes(c.nombre_categoria));

  return (
    <div className="flex flex-col gap-4">
      {[
        { titulo: 'Contenido que quiero recibir', lista: contenido },
        { titulo: 'Sectores de interés', lista: sectores },
      ]
        .filter((g) => g.lista.length)
        .map((grupo) => (
          <fieldset key={grupo.titulo}>
            <legend className="mb-2 text-caption font-semibold text-azul-titulo">{grupo.titulo}</legend>
            <div className="flex flex-wrap gap-2">
              {grupo.lista.map((c) => (
                <Chip key={c.id_categoria} categoria={c} seleccionada={seleccion.includes(c.id_categoria)} onAlternar={() => alternar(c.id_categoria)} />
              ))}
            </div>
          </fieldset>
        ))}
    </div>
  );
}
