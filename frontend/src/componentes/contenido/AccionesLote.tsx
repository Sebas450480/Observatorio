import { Ban, CheckCircle2, ChevronDown, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { mensajeDeError } from '../../api/cliente';
import { useAccionLote, type AccionLote } from '../../api/consultas';
import { Aviso, BotonModal, Modal } from '../ui/Modal';

/**
 * Selección múltiple de las tablas: casillas por fila y en el encabezado, menú "Acciones"
 * arriba a la derecha y confirmación (doble al eliminar).
 */
/** Un registro de la tabla: su id y el nombre que se muestra al confirmar. */
export type ItemSeleccion = { id: number; nombre: string };

export function useSeleccion() {
  // Se guarda también el nombre, para listarlos al confirmar aunque estén en otra página.
  const [items, setItems] = useState<ItemSeleccion[]>([]);
  const ids = items.map((i) => i.id);
  return {
    ids,
    nombres: items.map((i) => i.nombre),
    cantidad: items.length,
    tiene: (id: number) => ids.includes(id),
    alternar: (item: ItemSeleccion) =>
      setItems((a) => (a.some((x) => x.id === item.id) ? a.filter((x) => x.id !== item.id) : [...a, item])),
    /** Marca o desmarca todos los de la página. */
    alternarTodos: (pagina: ItemSeleccion[]) =>
      setItems((a) => {
        const todos = pagina.every((p) => a.some((x) => x.id === p.id));
        if (todos) return a.filter((x) => !pagina.some((p) => p.id === x.id));
        return [...a, ...pagina.filter((p) => !a.some((x) => x.id === p.id))];
      }),
    limpiar: () => setItems([]),
  };
}
export type Seleccion = ReturnType<typeof useSeleccion>;

const CASILLA = 'size-[18px] cursor-pointer accent-azul-oscuro';

export function CasillaFila({ seleccion, id, nombre }: { seleccion: Seleccion; id: number; nombre: string }) {
  return (
    <input type="checkbox" className={CASILLA} checked={seleccion.tiene(id)} onChange={() => seleccion.alternar({ id, nombre })} aria-label={`Seleccionar ${nombre}`} />
  );
}

export function CasillaTodos({ seleccion, pagina }: { seleccion: Seleccion; pagina: ItemSeleccion[] }) {
  const ref = useRef<HTMLInputElement>(null);
  const marcados = pagina.filter((p) => seleccion.tiene(p.id)).length;
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = marcados > 0 && marcados < pagina.length;
  }, [marcados, pagina.length]);
  return (
    <input
      ref={ref}
      type="checkbox"
      className={CASILLA}
      checked={pagina.length > 0 && marcados === pagina.length}
      onChange={() => seleccion.alternarTodos(pagina)}
      aria-label="Seleccionar todos los de esta página"
    />
  );
}

const ACCIONES: Record<AccionLote, { texto: string; icono: typeof Trash2; verbo: string; participio: string }> = {
  activar: { texto: 'Activar', icono: CheckCircle2, verbo: 'activar', participio: 'activados' },
  desactivar: { texto: 'Desactivar', icono: Ban, verbo: 'desactivar', participio: 'desactivados' },
  eliminar: { texto: 'Eliminar', icono: Trash2, verbo: 'eliminar', participio: 'eliminados' },
};

interface PropsMenu {
  seleccion: Seleccion;
  /** Ruta de la API del módulo (p. ej. '/usuarios'). */
  ruta: string;
  /** Plural del registro: "usuarios", "tendencias". */
  plural: string;
  /** Acciones que ofrece el módulo (eliminar siempre va). */
  acciones?: AccionLote[];
}

/** Botón "Acciones (n)" con su menú y las confirmaciones. Solo se ve con algo seleccionado. */
export function MenuAcciones({ seleccion, ruta, plural, acciones = ['activar', 'desactivar', 'eliminar'] }: PropsMenu) {
  const [abierto, setAbierto] = useState(false);
  const [accion, setAccion] = useState<AccionLote | null>(null);
  const [paso, setPaso] = useState<1 | 2>(1);
  const [texto, setTexto] = useState('');
  const [resultado, setResultado] = useState<string | null>(null);
  const lote = useAccionLote(ruta);
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, [abierto]);

  const cerrar = () => {
    setAccion(null);
    setPaso(1);
    setTexto('');
    lote.reset();
  };
  const ejecutar = () => {
    if (!accion) return;
    lote.mutate(
      { ids: seleccion.ids, accion },
      {
        onSuccess: ({ afectados }) => {
          setResultado(afectados === 1 ? `1 registro ${ACCIONES[accion].participio.replace(/s$/, '')}.` : `${afectados} registros ${ACCIONES[accion].participio}.`);
          seleccion.limpiar();
          cerrar();
        },
      },
    );
  };

  const n = seleccion.cantidad;
  const lista = seleccion.nombres;
  const info = accion ? ACCIONES[accion] : null;
  const eliminar = accion === 'eliminar';

  return (
    <>
      {n > 0 && (
        <div ref={caja} className="relative">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={abierto}
            onClick={() => setAbierto((a) => !a)}
            className="inline-flex h-[42px] cursor-pointer items-center gap-2 rounded-full border-2 border-azul-oscuro bg-white px-5 text-body font-semibold text-azul-oscuro hover:bg-fondo"
          >
            Acciones ({n})
            <ChevronDown className="size-4" aria-hidden />
          </button>
          {abierto && (
            <div role="menu" className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-xl border border-borde bg-white py-1 shadow-lg">
              {acciones.map((a) => {
                const { texto: etiqueta, icono: Icono } = ACCIONES[a];
                return (
                  <button
                    key={a}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setAbierto(false);
                      setAccion(a);
                    }}
                    className={`flex w-full cursor-pointer items-center gap-2.5 px-4 py-2.5 text-left text-small font-semibold hover:bg-fondo ${a === 'eliminar' ? 'text-rojo-vivo' : 'text-texto'}`}
                  >
                    <Icono className="size-4" aria-hidden />
                    {etiqueta} {n === 1 ? `1 ${plural.replace(/s$/, '')}` : `${n} ${plural}`}
                  </button>
                );
              })}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setAbierto(false);
                  seleccion.limpiar();
                }}
                className="w-full cursor-pointer border-t border-borde px-4 py-2.5 text-left text-small text-texto-suave hover:bg-fondo"
              >
                Quitar selección
              </button>
            </div>
          )}
        </div>
      )}

      {info && (
        <Modal
          abierto
          onCerrar={cerrar}
          titulo={paso === 2 ? 'Confirmación final' : `${info.texto} ${plural}`}
          insignia={eliminar ? 'advertencia' : 'editar'}
          ancho={520}
          claseCuerpo="flex flex-col gap-4 p-8"
          pie={
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <BotonModal variante="secundario" onClick={cerrar} disabled={lote.isPending}>
                Cancelar
              </BotonModal>
              {eliminar && paso === 1 ? (
                <BotonModal variante="peligro" onClick={() => setPaso(2)}>
                  Sí, continuar
                </BotonModal>
              ) : (
                <BotonModal onClick={ejecutar} cargando={lote.isPending} disabled={eliminar && texto.trim().toUpperCase() !== 'ELIMINAR'}>
                  {info.texto} {n} {n === 1 ? plural.replace(/s$/, '') : plural}
                </BotonModal>
              )}
            </div>
          }
        >
          {paso === 1 ? (
            <>
              <p className="text-subtitle font-bold text-[#0a1c40]">
                ¿Está seguro de que desea {info.verbo} {n === 1 ? `1 ${plural.replace(/s$/, '')}` : `${n} ${plural}`}?
              </p>
              <ul className="max-h-40 overflow-y-auto rounded-lg border border-borde bg-fondo px-4 py-2 text-small text-texto">
                {lista.map((nombre, i) => (
                  <li key={i} className="truncate py-0.5">
                    • {nombre}
                  </li>
                ))}
              </ul>
              {eliminar && <p className="text-body text-[#64748b]">Esta acción no se puede deshacer.</p>}
            </>
          ) : (
            <>
              <p className="text-subtitle font-bold text-rojo-vivo">
                Vas a eliminar {n === 1 ? `1 ${plural.replace(/s$/, '')}` : `${n} ${plural}`} de forma permanente.
              </p>
              <label className="flex flex-col gap-2 text-body text-[#64748b]">
                Para confirmar, escribe ELIMINAR:
                <input
                  autoFocus
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  className="h-11 rounded-control border border-[#d1d9e3] px-3 text-body font-semibold uppercase tracking-wider text-texto focus:border-rojo-vivo focus:outline-none"
                />
              </label>
            </>
          )}
          {lote.error && (
            <p role="alert" className="text-small text-rojo">
              {mensajeDeError(lote.error)}
            </p>
          )}
        </Modal>
      )}
      <Aviso abierto={!!resultado} titulo="Listo" mensaje={resultado ?? ''} onCerrar={() => setResultado(null)} />
    </>
  );
}
