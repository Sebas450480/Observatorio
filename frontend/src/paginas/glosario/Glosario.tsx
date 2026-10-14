import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { Pencil, Search } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { api, mensajeDeError } from '../../api/cliente';
import { useEliminar, useGuardar, useListado } from '../../api/consultas';
import { FormularioCrud } from '../../componentes/contenido/FormularioCrud';
import { Boton } from '../../componentes/ui/Boton';
import { AreaTexto, Entrada, Selector } from '../../componentes/ui/Campos';
import { Cargando, EncabezadoPagina, EstadoVacio, MensajeError, Paginacion } from '../../componentes/ui/Elementos';
import { useSesion } from '../../sesion/sesion';

export interface Termino {
  id_termino: number;
  termino: string;
  definicion: string;
  fuente: string | null;
  estado_gt?: 'Activo' | 'Inactivo';
}

const LETRAS = [...'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ', '#'];

const esquema = z.object({
  termino: z.string().trim().min(1, 'Escribe el término').max(120),
  definicion: z.string().trim().min(1, 'Escribe la definición').max(5000),
  fuente: z.string().trim().max(300),
  estado_gt: z.enum(['Activo', 'Inactivo']),
});
type Datos = z.infer<typeof esquema>;

function FormularioTermino({ registro, onCerrar }: { registro?: Termino; onCerrar: () => void }) {
  const guardarApi = useGuardar<Termino>('/glosario');
  const eliminarApi = useEliminar('/glosario');
  const { register, trigger, getValues, formState } = useForm<Datos>({
    resolver: zodResolver(esquema),
    defaultValues: {
      termino: registro?.termino ?? '',
      definicion: registro?.definicion ?? '',
      fuente: registro?.fuente ?? '',
      estado_gt: registro?.estado_gt ?? 'Activo',
    },
  });
  const e = formState.errors;
  return (
    <FormularioCrud
      abierto
      modo={registro ? 'editar' : 'crear'}
      titulo={registro ? 'Editar término' : 'Nuevo término'}
      sustantivo={{ palabra: 'término', demostrativo: 'este' }}
      seccion="Glosario"
      validar={() => trigger()}
      guardar={async () => {
        await guardarApi.mutateAsync({ id: registro?.id_termino, datos: getValues() });
      }}
      eliminar={registro ? () => eliminarApi.mutateAsync(registro.id_termino) : undefined}
      onCerrar={onCerrar}
    >
      <div className="flex flex-col gap-5">
        <Entrada etiqueta="Término" obligatorio placeholder="Ej. Coformación" error={e.termino?.message} {...register('termino')} />
        <AreaTexto etiqueta="Definición" obligatorio rows={5} placeholder="Explica el concepto con claridad." error={e.definicion?.message} {...register('definicion')} />
        <Entrada etiqueta="Fuente" placeholder="Opcional: autor, norma o documento de referencia" {...register('fuente')} />
        <Selector etiqueta="Estado" opciones={[{ valor: 'Activo', texto: 'Activo (visible para todos)' }, { valor: 'Inactivo', texto: 'Inactivo (oculto al público)' }]} {...register('estado_gt')} />
      </div>
    </FormularioCrud>
  );
}

/** Glosario: términos y conceptos clave del Observatorio, con índice A-Z y búsqueda. */
export function Glosario() {
  const { puedeGestionar } = useSesion();
  const gestiona = puedeGestionar('glosario');
  const [texto, setTexto] = useState('');
  const [q, setQ] = useState('');
  const [letra, setLetra] = useState('');
  const [pagina, setPagina] = useState(1);
  const [formulario, setFormulario] = useState<{ registro?: Termino } | null>(null);

  const { data: letrasConTerminos = [] } = useQuery({ queryKey: ['/glosario', 'letras'], queryFn: () => api<string[]>('/glosario/letras') });
  const { data, isLoading, error, refetch } = useListado<Termino>('/glosario', { q: q || undefined, letra: letra || undefined, pagina, limite: 30 });

  const elegirLetra = (l: string) => {
    setLetra(letra === l ? '' : l);
    setPagina(1);
  };

  return (
    <>
      <EncabezadoPagina
        modulo="glosario"
        titulo="Glosario"
        subtitulo="Términos y conceptos clave del Observatorio Empresarial."
        acciones={
          gestiona && (
            <Boton pildora className="px-5! font-semibold" onClick={() => setFormulario({})}>
              Agregar término
            </Boton>
          )
        }
        className="mb-6"
      />

      <div className="mb-5 flex flex-col gap-4 rounded-2xl border border-[#e2e8f0] bg-white p-4 sm:p-5">
        <form
          role="search"
          className="flex gap-3"
          onSubmit={(ev) => {
            ev.preventDefault();
            setQ(texto.trim());
            setPagina(1);
          }}
        >
          <label className="flex h-[42px] min-w-0 flex-1 items-center gap-2.5 rounded-control border border-borde bg-white px-4 focus-within:border-azul-oscuro">
            <Search className="size-[18px] text-texto-suave" aria-hidden />
            <input
              type="search"
              aria-label="Buscar en el glosario"
              placeholder="Buscar un término o una palabra de la definición"
              className="min-w-0 flex-1 bg-transparent text-small text-texto placeholder:text-[#788fad] focus:outline-none"
              value={texto}
              onChange={(ev) => setTexto(ev.target.value)}
            />
          </label>
          <Boton type="submit" pildora className="px-6!">
            Buscar
          </Boton>
        </form>
        <nav aria-label="Índice alfabético" className="flex flex-wrap gap-1.5">
          {LETRAS.map((l) => {
            const hay = letrasConTerminos.includes(l);
            return (
              <button
                key={l}
                type="button"
                disabled={!hay}
                aria-pressed={letra === l}
                aria-label={l === '#' ? 'Números y símbolos' : `Letra ${l}`}
                onClick={() => elegirLetra(l)}
                className={`grid size-9 cursor-pointer place-items-center rounded-lg text-small font-bold transition-colors disabled:cursor-default disabled:text-black/20 ${
                  letra === l ? 'bg-rojo-activo text-white' : 'text-azul-marino hover:bg-fondo'
                }`}
              >
                {l}
              </button>
            );
          })}
        </nav>
      </div>

      {isLoading ? (
        <Cargando />
      ) : error ? (
        <MensajeError mensaje={mensajeDeError(error)} onReintentar={() => refetch()} />
      ) : !data?.datos.length ? (
        <EstadoVacio
          titulo={q || letra ? 'No hay términos para esta búsqueda' : 'El glosario aún no tiene términos'}
          detalle={q || letra ? 'Prueba con otra palabra o letra.' : gestiona ? 'Agrega el primer término con el botón «Agregar término».' : 'Pronto encontrarás aquí los conceptos clave del Observatorio.'}
        />
      ) : (
        <>
          <dl className="grid gap-4 lg:grid-cols-2">
            {data.datos.map((t) => (
              <div key={t.id_termino} className="flex flex-col gap-2 rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-[0_4px_12px_0_rgba(0,0,0,0.02)]">
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-subtitle font-extrabold text-[#0a1c40]">
                    {t.termino}
                    {t.estado_gt === 'Inactivo' && (
                      <span className="ml-2 rounded bg-[#eef0f3] px-2 py-0.5 align-middle text-caption font-bold text-[#8c94a1]">INACTIVO</span>
                    )}
                  </dt>
                  {gestiona && (
                    <button
                      type="button"
                      aria-label={`Editar ${t.termino}`}
                      onClick={() => setFormulario({ registro: t })}
                      className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full text-texto-suave hover:bg-black/5"
                    >
                      <Pencil className="size-4" aria-hidden />
                    </button>
                  )}
                </div>
                <dd className="whitespace-pre-line text-body text-[#334155]">{t.definicion}</dd>
                {t.fuente && <dd className="text-small text-texto-suave">Fuente: {t.fuente}</dd>}
              </div>
            ))}
          </dl>
          <Paginacion pagina={data.pagina} paginas={data.paginas} onCambiar={setPagina} />
        </>
      )}

      {formulario && <FormularioTermino registro={formulario.registro} onCerrar={() => setFormulario(null)} />}
    </>
  );
}
