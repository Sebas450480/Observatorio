import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';
import { useCategorias, useEliminar, useGuardar } from '../../api/consultas';
import type { Tendencia } from '../../api/tipos';
import { SelectorCategorias } from '../../componentes/contenido/Controles';
import { FormularioCrud } from '../../componentes/contenido/FormularioCrud';
import { Boton } from '../../componentes/ui/Boton';
import { AreaTexto, Entrada, Selector } from '../../componentes/ui/Campos';

const esquema = z.object({
  megatendencia: z.string().trim().min(1, 'Escribe la megatendencia').max(60),
  tendencia: z.string().trim().min(1, 'Escribe la tendencia').max(80),
  descripcion: z.string().trim(),
  comportamiento_mundo: z.string().trim(),
  comportamiento_colombia: z.string().trim(),
  fecha_publicacion: z.string().min(1, 'Elige la fecha'),
  estado_te: z.enum(['Activo', 'Inactivo']),
  fuentes: z.array(
    z.object({
      nombre: z.string().trim().min(1, 'Escribe el nombre de la fuente').max(150),
      link: z.union([z.literal(''), z.url('Enlace inválido')]),
    }),
  ),
});
type Datos = z.infer<typeof esquema>;

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
  const { register, control, trigger, getValues, formState } = useForm<Datos>({
    resolver: zodResolver(esquema),
    defaultValues: {
      megatendencia: registro?.megatendencia ?? '',
      tendencia: registro?.tendencia ?? '',
      descripcion: registro?.descripcion ?? '',
      comportamiento_mundo: registro?.comportamiento_mundo ?? '',
      comportamiento_colombia: registro?.comportamiento_colombia ?? '',
      fecha_publicacion: registro?.fecha_publicacion ?? new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }),
      estado_te: registro?.estado_te ?? 'Activo',
      fuentes: registro?.fuentes.map((f) => ({ nombre: f.nombre, link: f.link ?? '' })) ?? [],
    },
  });
  const fuentes = useFieldArray({ control, name: 'fuentes' });
  const e = formState.errors;

  const guardar = async () => {
    const d = getValues();
    await guardarApi.mutateAsync({
      id: registro?.id_te,
      datos: {
        ...d,
        fuentes: d.fuentes.map((f) => ({ nombre: f.nombre, link: f.link || null })),
        categorias: seleccion,
      },
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
      <div className="grid gap-4 sm:grid-cols-2">
        <Entrada etiqueta="Megatendencia" obligatorio list="megatendencias" placeholder="Ej. Tecnología y sociedad" error={e.megatendencia?.message} {...register('megatendencia')} />
        <Entrada etiqueta="Tendencia" obligatorio placeholder="Ej. IA generativa" error={e.tendencia?.message} {...register('tendencia')} />
        <Entrada etiqueta="Fecha de publicación" type="date" obligatorio error={e.fecha_publicacion?.message} {...register('fecha_publicacion')} />
        <Selector etiqueta="Estado" opciones={[{ valor: 'Activo', texto: 'Activa' }, { valor: 'Inactivo', texto: 'Inactiva' }]} {...register('estado_te')} />
      </div>
      <datalist id="megatendencias">
        {megatendencias.map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>
      <AreaTexto etiqueta="Descripción" rows={3} placeholder="¿En qué consiste la tendencia?" {...register('descripcion')} />
      <AreaTexto etiqueta="Comportamiento en el mundo" rows={3} {...register('comportamiento_mundo')} />
      <AreaTexto etiqueta="Comportamiento en Colombia" rows={3} {...register('comportamiento_colombia')} />
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-caption font-semibold text-azul-titulo">Fuentes</legend>
        {fuentes.fields.map((campo, i) => (
          <div key={campo.id} className="grid items-start gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <Entrada aria-label={`Nombre de la fuente ${i + 1}`} placeholder="Nombre de la fuente" error={e.fuentes?.[i]?.nombre?.message} {...register(`fuentes.${i}.nombre`)} />
            <Entrada aria-label={`Enlace de la fuente ${i + 1}`} placeholder="https:// (opcional)" error={e.fuentes?.[i]?.link?.message} {...register(`fuentes.${i}.link`)} />
            <button
              type="button"
              aria-label={`Quitar fuente ${i + 1}`}
              onClick={() => fuentes.remove(i)}
              className="grid size-11 cursor-pointer place-items-center rounded-control text-texto-suave hover:bg-rojo-claro hover:text-rojo"
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
        <Boton variante="claro" tamano="sm" className="self-start" icono={<Plus className="size-4" />} onClick={() => fuentes.append({ nombre: '', link: '' })}>
          Agregar fuente
        </Boton>
      </fieldset>
      <SelectorCategorias categorias={categorias} seleccion={seleccion} onCambiar={setSeleccion} />
    </FormularioCrud>
  );
}
