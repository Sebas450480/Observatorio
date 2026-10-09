import { zodResolver } from '@hookform/resolvers/zod';
import { useId, useState, type TextareaHTMLAttributes } from 'react';
import { useForm } from 'react-hook-form';
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

const escribirFuentes = (fuentes: { nombre: string; link: string | null }[]) =>
  fuentes.map((f) => (f.link ? (f.link.includes(f.nombre) ? f.link : `${f.nombre} — ${f.link}`) : f.nombre)).join('\n');

const esquema = z.object({
  megatendencia: z.string().trim().min(1, 'Selecciona la megatendencia o agrega una nueva').max(60),
  tendencia: z.string().trim().min(1, 'Escribe la tendencia').max(80),
  descripcion: z.string().trim(),
  comportamiento_mundo: z.string().trim(),
  comportamiento_colombia: z.string().trim(),
  fecha_publicacion: z.string().min(1, 'Elige la fecha'),
  estado_te: z.enum(['Activo', 'Inactivo']),
  fuentes: z.string().refine((t) => leerFuentes(t).every((f) => f.nombre.length <= 150), 'Cada fuente debe tener máximo 150 caracteres'),
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
  const { register, trigger, getValues, setValue, formState } = useForm<Datos>({
    resolver: zodResolver(esquema),
    defaultValues: {
      megatendencia: registro?.megatendencia ?? '',
      tendencia: registro?.tendencia ?? '',
      descripcion: registro?.descripcion ?? '',
      comportamiento_mundo: registro?.comportamiento_mundo ?? '',
      comportamiento_colombia: registro?.comportamiento_colombia ?? '',
      fecha_publicacion: registro?.fecha_publicacion ?? new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }),
      estado_te: registro?.estado_te ?? 'Activo',
      fuentes: escribirFuentes(registro?.fuentes ?? []),
    },
  });
  const e = formState.errors;

  const guardar = async () => {
    const d = getValues();
    // Una "nueva" megatendencia que ya existe (con otras mayúsculas) se guarda con el nombre existente.
    const existente = opcionesMega.find((o) => o.valor.toLocaleLowerCase('es') === d.megatendencia.trim().toLocaleLowerCase('es'));
    await guardarApi.mutateAsync({
      id: registro?.id_te,
      datos: { ...d, megatendencia: existente?.valor ?? d.megatendencia.trim(), fuentes: leerFuentes(d.fuentes), categorias: seleccion },
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
      <AreaTexto
        etiqueta="Fuentes de la tendencia"
        rows={3}
        placeholder="Pega los enlaces de las fuentes (uno por línea)"
        ayuda="Puedes escribir «Nombre — https://enlace» para darle nombre a la fuente."
        error={e.fuentes?.message}
        {...register('fuentes')}
      />
      <SelectorCategorias categorias={categorias} seleccion={seleccion} onCambiar={setSeleccion} />
    </FormularioCrud>
  );
}
