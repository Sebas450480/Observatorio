import { zodResolver } from '@hookform/resolvers/zod';
import { useId, useState, type TextareaHTMLAttributes } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';
import { useCategorias, useEliminar, useGuardar } from '../../api/consultas';
import type { Tendencia } from '../../api/tipos';
import iconoColombia from '../../assets/figma/tendencias/colombia.png';
import iconoMundo from '../../assets/figma/tendencias/mundo.png';
import { SelectorCategorias } from '../../componentes/contenido/Controles';
import { FormularioCrud } from '../../componentes/contenido/FormularioCrud';
import { AreaTexto, Entrada, Selector } from '../../componentes/ui/Campos';
import { MEGATENDENCIAS } from './MapaTendencias';

/** Opción del selector que abre el campo para escribir una megatendencia nueva. */
const NUEVA = '__nueva__';

/** Una fuente por línea: "Nombre — https://enlace", solo el enlace o solo el nombre. */
export function leerFuentes(texto: string): { nombre: string; link: string | null }[] {
  return texto
    .split('\n')
    .map((linea) => linea.trim())
    .filter(Boolean)
    .map((linea) => {
      const conNombre = linea.match(/^(.*?)\s+[—–-]\s+(https?:\/\/\S+)$/);
      if (conNombre) return { nombre: conNombre[1]!.trim(), link: conNombre[2]! };
      if (/^https?:\/\/\S+$/.test(linea)) {
        let nombre = linea;
        try {
          nombre = new URL(linea).hostname.replace(/^www\./, '');
        } catch {
          /* se deja el enlace como nombre */
        }
        return { nombre, link: linea };
      }
      return { nombre: linea, link: null };
    });
}

/** Una fuente como texto del campo: "Nombre — https://enlace", solo el enlace o solo el nombre. */
const escribirFuente = (f: { nombre: string; link: string | null }) => (f.link ? (f.link.includes(f.nombre) ? f.link : `${f.nombre} — ${f.link}`) : f.nombre);

/** Máximo de fuentes que se agregan desde el formulario (el Excel puede traer más). */
const MAX_FUENTES = 5;

const esquema = z.object({
  megatendencia: z.string().trim().min(1, 'Selecciona la megatendencia o agrega una nueva').max(60),
  tendencia: z.string().trim().min(1, 'Escribe la tendencia').max(80),
  descripcion: z.string().trim(),
  comportamiento_mundo: z.string().trim(),
  comportamiento_colombia: z.string().trim(),
  fecha_publicacion: z.string().min(1, 'Elige la fecha'),
  estado_te: z.enum(['Activo', 'Inactivo']),
  fuentes: z.array(
    z.object({ texto: z.string().refine((t) => leerFuentes(t).every((f) => f.nombre.length <= 150), 'Máximo 150 caracteres') }),
  ),
});
type Datos = z.infer<typeof esquema>;

/** Campo gris con ícono de "Tendencia a nivel mundial / Colombia" (Figma). */
function CampoUbicacion({ etiqueta, icono, ...resto }: { etiqueta: string; icono: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-body font-bold text-texto">
        {etiqueta}
      </label>
      <div className="flex gap-2.5 rounded-control bg-etiqueta p-3 focus-within:outline-2 focus-within:outline-azul-oscuro">
        <img src={icono} alt="" aria-hidden className="mt-px size-5 shrink-0" />
        <textarea id={id} rows={1} className="min-h-5 flex-1 resize-y bg-transparent text-small text-[#0a1c40] placeholder:font-light placeholder:text-[#788fad] focus:outline-none" {...resto} />
      </div>
    </div>
  );
}

/** Crear y editar una tendencia con sus fuentes. */
export function FormularioTendencia({
  registro,
  megatendencias,
  onCerrar,
}: {
  registro?: Tendencia;
  megatendencias: string[];
  onCerrar: () => void;
}) {
  const { data: categorias = [] } = useCategorias();
  const guardarApi = useGuardar<Tendencia>('/tendencias');
  const eliminarApi = useEliminar('/tendencias');
  const [seleccion, setSeleccion] = useState<number[]>(registro?.categorias.map((c) => c.id_categoria) ?? []);
  // Todas las megatendencias: las del Figma y las que ya existen en la base, sin repetir.
  const opcionesMega = [...new Set([...MEGATENDENCIAS, ...megatendencias, ...(registro ? [registro.megatendencia] : [])])]
    .sort((a, b) => a.localeCompare(b, 'es'))
    .map((m) => ({ valor: m, texto: m }));
  const [eleccion, setEleccion] = useState(registro?.megatendencia ?? '');
  const { register, trigger, getValues, setValue, formState, control } = useForm<Datos>({
    resolver: zodResolver(esquema),
    defaultValues: {
      megatendencia: registro?.megatendencia ?? '',
      tendencia: registro?.tendencia ?? '',
      descripcion: registro?.descripcion ?? '',
      comportamiento_mundo: registro?.comportamiento_mundo ?? '',
      comportamiento_colombia: registro?.comportamiento_colombia ?? '',
      fecha_publicacion: registro?.fecha_publicacion ?? new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }),
      estado_te: registro?.estado_te ?? 'Activo',
      fuentes: registro?.fuentes.length ? registro.fuentes.map((f) => ({ texto: escribirFuente(f) })) : [{ texto: '' }],
    },
  });
  const e = formState.errors;
  const fuentes = useFieldArray({ control, name: 'fuentes' });

  const guardar = async () => {
    const d = getValues();
    // Una "nueva" megatendencia que ya existe (con otras mayúsculas) se guarda con el nombre existente.
    const existente = opcionesMega.find((o) => o.valor.toLocaleLowerCase('es') === d.megatendencia.trim().toLocaleLowerCase('es'));
    await guardarApi.mutateAsync({
      id: registro?.id_te,
      datos: { ...d, megatendencia: existente?.valor ?? d.megatendencia.trim(), fuentes: d.fuentes.flatMap((f) => leerFuentes(f.texto)), categorias: seleccion },
    });
  };

  return (
    <FormularioCrud
      abierto
      modo={registro ? 'editar' : 'crear'}
      titulo={registro ? 'Editar tendencia' : 'Nueva tendencia'}
      sustantivo={{ palabra: 'tendencia', demostrativo: 'esta' }}
      validar={() => trigger()}
      guardar={guardar}
      eliminar={registro ? () => eliminarApi.mutateAsync(registro.id_te) : undefined}
      onCerrar={onCerrar}
    >
      <Selector
        etiqueta="Megatendencia"
        obligatorio
        vacio="Selecciona la megatendencia"
        opciones={[...opcionesMega, { valor: NUEVA, texto: '+ Agregar nueva megatendencia' }]}
        value={eleccion}
        onChange={(ev) => {
          const valor = ev.target.value;
          setEleccion(valor);
          setValue('megatendencia', valor === NUEVA ? '' : valor, { shouldValidate: formState.isSubmitted });
        }}
        error={eleccion === NUEVA ? undefined : e.megatendencia?.message}
      />
      {eleccion === NUEVA && (
        <Entrada
          etiqueta="Nueva megatendencia"
          obligatorio
          autoFocus
          placeholder="Escribe el nombre de la nueva megatendencia"
          error={e.megatendencia?.message}
          {...register('megatendencia')}
        />
      )}
      <Entrada etiqueta="Título de la tendencia" obligatorio placeholder="Escribe el título de la tendencia" error={e.tendencia?.message} {...register('tendencia')} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Selector etiqueta="Estado" opciones={[{ valor: 'Activo', texto: 'Activo' }, { valor: 'Inactivo', texto: 'Inactivo' }]} {...register('estado_te')} />
        <Entrada etiqueta="Fecha de publicación" type="date" obligatorio error={e.fecha_publicacion?.message} {...register('fecha_publicacion')} />
      </div>
      <AreaTexto etiqueta="Descripción de la tendencia" rows={3} placeholder="Escribe una descripción breve de la tendencia" {...register('descripcion')} />
      <CampoUbicacion etiqueta="Tendencia a nivel mundial" icono={iconoMundo} placeholder="Describe el comportamiento de la tendencia en el mundo" {...register('comportamiento_mundo')} />
      <CampoUbicacion etiqueta="Tendencia a nivel Colombia" icono={iconoColombia} placeholder="Describe el comportamiento de la tendencia en Colombia" {...register('comportamiento_colombia')} />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-small font-semibold leading-[19px] text-[#0a1c40]">Fuentes de la tendencia</legend>
        {fuentes.fields.map((campo, i) => {
          const ultima = i === fuentes.fields.length - 1;
          return (
            <div key={campo.id} className="flex items-start gap-2">
              <Entrada
                className="flex-1"
                aria-label={`Fuente ${i + 1}`}
                placeholder="Nombre — https://enlace, o solo el enlace"
                error={e.fuentes?.[i]?.texto?.message}
                {...register(`fuentes.${i}.texto`)}
              />
              {fuentes.fields.length > 1 && (
                <button
                  type="button"
                  aria-label={`Quitar la fuente ${i + 1}`}
                  onClick={() => fuentes.remove(i)}
                  className="grid size-[43px] shrink-0 cursor-pointer place-items-center rounded-control border border-[#e2e8f0] bg-white text-body text-[#64748b] hover:bg-fondo"
                >
                  −
                </button>
              )}
              {ultima && (
                <button
                  type="button"
                  aria-label="Agregar otra fuente"
                  title={fuentes.fields.length >= MAX_FUENTES ? `Máximo ${MAX_FUENTES} fuentes` : 'Agregar otra fuente'}
                  disabled={fuentes.fields.length >= MAX_FUENTES}
                  onClick={() => fuentes.append({ texto: '' })}
                  className="grid size-[43px] shrink-0 cursor-pointer place-items-center rounded-control bg-rojo text-subtitle font-bold text-white hover:bg-[#c2002e] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  +
                </button>
              )}
            </div>
          );
        })}
        <p className="text-[13px] text-texto-suave">
          Hasta {MAX_FUENTES} fuentes. Escribe «Nombre — https://enlace» para darle nombre a la fuente.
        </p>
      </fieldset>
      <SelectorCategorias categorias={categorias} seleccion={seleccion} onCambiar={setSeleccion} />
    </FormularioCrud>
  );
}
