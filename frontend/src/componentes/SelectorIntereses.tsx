import type { Categoria } from '../api/tipos';

/** Categorías que describen tipos de contenido; las demás son sectores (Figma: registro paso 2). */
const CONTENIDO = ['Becas', 'Convocatorias', 'Cursos', 'Talleres', 'Eventos', 'Tendencias', 'Flash informativo'];
/** Orden de los sectores en el Figma; los demás van después, en orden alfabético. */
const SECTORES = ['Tecnología', 'Innovación', 'Emprendimiento', 'Finanzas', 'Educación', 'Medio ambiente', 'Salud', 'Comercio'];

function ordenar(lista: Categoria[], orden: string[]): Categoria[] {
  const posicion = (c: Categoria) => {
    const i = orden.indexOf(c.nombre_categoria);
    return i === -1 ? orden.length : i;
  };
  return [...lista].sort((a, b) => posicion(a) - posicion(b) || a.nombre_categoria.localeCompare(b.nombre_categoria, 'es'));
}

function Chip({ categoria, seleccionada, onAlternar }: { categoria: Categoria; seleccionada: boolean; onAlternar: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={seleccionada}
      onClick={onAlternar}
      className={`inline-flex h-[42px] cursor-pointer items-center gap-1.5 rounded-[20px] px-4 text-small transition-colors ${
        seleccionada
          ? 'border-[1.5px] border-rojo-vivo bg-rojo-vivo/8 font-semibold text-rojo-vivo'
          : 'border border-[#d1d9e3] bg-white text-azul-marino hover:border-azul-marino/40'
      }`}
    >
      {seleccionada && <span aria-hidden>✓</span>}
      {categoria.nombre_categoria}
    </button>
  );
}

/** Selección de intereses en "chips", agrupados en contenido y sectores. */
export function SelectorIntereses({
  categorias,
  seleccion,
  onCambiar,
  titulos = ['Contenido', 'Sectores'],
}: {
  categorias: Categoria[];
  seleccion: number[];
  onCambiar: (ids: number[]) => void;
  /** Títulos de los dos grupos (contenido y sectores). */
  titulos?: [string, string];
}) {
  const alternar = (id: number) => onCambiar(seleccion.includes(id) ? seleccion.filter((s) => s !== id) : [...seleccion, id]);
  const contenido = ordenar(categorias.filter((c) => CONTENIDO.includes(c.nombre_categoria)), CONTENIDO);
  const sectores = ordenar(categorias.filter((c) => !CONTENIDO.includes(c.nombre_categoria)), SECTORES);

  return (
    <div className="flex flex-col gap-5">
      {[
        { titulo: titulos[0], lista: contenido },
        { titulo: titulos[1], lista: sectores },
      ]
        .filter((g) => g.lista.length)
        .map((grupo) => (
          <fieldset key={grupo.titulo}>
            <legend className="mb-2.5 text-small font-semibold text-azul-marino">{grupo.titulo}</legend>
            <div className="flex flex-wrap gap-2.5">
              {grupo.lista.map((c) => (
                <Chip key={c.id_categoria} categoria={c} seleccionada={seleccion.includes(c.id_categoria)} onAlternar={() => alternar(c.id_categoria)} />
              ))}
            </div>
          </fieldset>
        ))}
    </div>
  );
}
