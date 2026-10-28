import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { api } from '../api/cliente';
import { Boton } from './ui/Boton';
import { Modal } from './ui/Modal';
import { MEGATENDENCIAS } from '../utilidades/megatendencias';

/** Máximo de intereses por módulo (igual que en el backend). */
export const MAXIMO_INTERESES = 5;
/** Fichas visibles en cada módulo; el resto se elige en "Más". */
const VISIBLES = 5;

interface Opcion {
  valor: string;
  usos: number;
  id?: number;
}
type Opciones = Record<'Flash' | 'Faro' | 'Empresa' | 'Tendencia', Opcion[]>;

/** Intereses elegidos: Faro guarda ids de categoría; los demás módulos, el valor. */
export interface Intereses {
  Faro: number[];
  Flash: string[];
  Empresa: string[];
  Tendencia: string[];
}

function Chip({ texto, activo, deshabilitado, onAlternar }: { texto: string; activo: boolean; deshabilitado: boolean; onAlternar: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      disabled={deshabilitado}
      onClick={onAlternar}
      className={`inline-flex min-h-[42px] cursor-pointer items-center gap-1.5 rounded-[20px] px-4 py-2 text-left text-small transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
        activo
          ? 'border-[1.5px] border-rojo-vivo bg-rojo-vivo/8 font-semibold text-rojo-vivo'
          : 'border border-[#d1d9e3] bg-white text-azul-marino hover:border-azul-marino/40'
      }`}
    >
      {activo && <span aria-hidden>✓</span>}
      {texto}
    </button>
  );
}

const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Un módulo: las 5 opciones más usadas (más las elegidas) y "Más" con todas y un buscador. */
function Modulo({
  titulo,
  detalle,
  opciones,
  seleccion,
  onCambiar,
}: {
  titulo: string;
  detalle: string;
  opciones: { valor: string; texto: string }[];
  seleccion: string[];
  onCambiar: (valores: string[]) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const lleno = seleccion.length >= MAXIMO_INTERESES;
  const alternar = (v: string) => onCambiar(seleccion.includes(v) ? seleccion.filter((s) => s !== v) : [...seleccion, v]);
  const visibles = opciones.slice(0, VISIBLES);
  const extra = opciones.filter((o) => seleccion.includes(o.valor) && !visibles.includes(o));
  const filtradas = opciones.filter((o) => normalizar(o.texto).includes(normalizar(busqueda.trim())));
  const chip = (o: { valor: string; texto: string }) => (
    <Chip key={o.valor} texto={o.texto} activo={seleccion.includes(o.valor)} deshabilitado={lleno && !seleccion.includes(o.valor)} onAlternar={() => alternar(o.valor)} />
  );

  return (
    <fieldset className="flex flex-col gap-2.5">
      <legend className="mb-2.5 flex w-full items-baseline justify-between gap-3">
        <span className="flex flex-col gap-0.5">
          <span className="text-small font-bold text-azul-marino">{titulo}</span>
          <span className="text-caption text-gris-azulado">{detalle}</span>
        </span>
        <span className={`shrink-0 text-caption font-semibold ${lleno ? 'text-rojo-vivo' : 'text-gris-azulado'}`}>
          {seleccion.length} de {MAXIMO_INTERESES}
        </span>
      </legend>
      <div className="flex flex-wrap gap-2.5">
        {[...visibles, ...extra].map(chip)}
        {opciones.length > VISIBLES && (
          <button
            type="button"
            onClick={() => setAbierto(true)}
            className="inline-flex h-[42px] cursor-pointer items-center rounded-[20px] border border-dashed border-azul-marino/50 bg-white px-4 text-small font-semibold text-azul-marino hover:bg-fondo"
          >
            + Más
          </button>
        )}
      </div>
      <Modal
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
        titulo={titulo}
        subtitulo={`Elige hasta ${MAXIMO_INTERESES}. Llevas ${seleccion.length}.`}
        pie={
          <div className="flex justify-end">
            <Boton pildora onClick={() => setAbierto(false)}>
              Listo
            </Boton>
          </div>
        }
      >
        <label className="mb-4 flex h-[43px] items-center gap-2 rounded-control border border-borde bg-white px-3 focus-within:border-azul-oscuro">
          <Search aria-hidden className="size-4 text-gris-azulado" />
          <input
            type="search"
            aria-label={`Buscar en ${titulo}`}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar"
            className="w-full bg-transparent text-small outline-none"
          />
        </label>
        <div className="flex max-h-[50vh] flex-wrap gap-2.5 overflow-y-auto">
          {filtradas.length ? filtradas.map(chip) : <p className="text-small text-gris-azulado">No hay opciones con ese nombre.</p>}
        </div>
      </Modal>
    </fieldset>
  );
}

/**
 * "Mis intereses" por módulo (máx. 5 en cada uno): Flash por tipo de evento, Faro por
 * categorías, Empresas por sector y Tendencias por megatendencia. Los eventos institucionales
 * se siguen con favoritos.
 */
export function InteresesPorModulo({ valor, onCambiar }: { valor: Intereses; onCambiar: (valor: Intereses) => void }) {
  const { data } = useQuery({ queryKey: ['/intereses'], queryFn: () => api<Opciones>('/intereses'), staleTime: 10 * 60 * 1000 });
  if (!data) return <p className="text-small text-gris-azulado">Cargando opciones…</p>;

  const texto = (lista: Opcion[]) => lista.map((o) => ({ valor: o.valor, texto: o.valor }));
  // Megatendencias: las registradas (de más a menos usada) y luego las del Figma sin tendencias aún.
  const megas = [...data.Tendencia.map((o) => o.valor), ...MEGATENDENCIAS.filter((m) => !data.Tendencia.some((o) => o.valor === m))];

  return (
    <div className="flex flex-col gap-6">
      <Modulo
        titulo="Flash Informativo"
        detalle="Tipos de evento"
        opciones={texto(data.Flash)}
        seleccion={valor.Flash}
        onCambiar={(Flash) => onCambiar({ ...valor, Flash })}
      />
      <Modulo
        titulo="Faro"
        detalle="Becas, convocatorias, cursos y demás categorías"
        opciones={data.Faro.map((o) => ({ valor: String(o.id), texto: o.valor }))}
        seleccion={valor.Faro.map(String)}
        onCambiar={(ids) => onCambiar({ ...valor, Faro: ids.map(Number) })}
      />
      <Modulo
        titulo="Empresas coformadoras"
        detalle="Sectores económicos"
        opciones={[...texto(data.Empresa), { valor: 'Otro', texto: 'Otro sector' }]}
        seleccion={valor.Empresa}
        onCambiar={(Empresa) => onCambiar({ ...valor, Empresa })}
      />
      <Modulo
        titulo="Tendencias"
        detalle="Megatendencias"
        opciones={megas.map((m) => ({ valor: m, texto: m }))}
        seleccion={valor.Tendencia}
        onCambiar={(Tendencia) => onCambiar({ ...valor, Tendencia })}
      />
      <p className="rounded-[10px] bg-fondo px-3.5 py-3 text-small text-gris-azulado">
        <span className="font-semibold text-azul-marino">Eventos institucionales:</span> guarda los eventos con la banderita y te avisamos 7 días antes y
        el mismo día.
      </p>
    </div>
  );
}
