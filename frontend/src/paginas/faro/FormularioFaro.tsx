import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { useCategorias, useEliminar, useGuardar, useSubirImagen } from '../../api/consultas';
import { MODALIDADES, TIPOS_FARO, type Faro } from '../../api/tipos';
import { CampoImagen, SelectorCategorias } from '../../componentes/contenido/Controles';
import { FormularioCrud } from '../../componentes/contenido/FormularioCrud';
import { AreaTexto, Casilla, Entrada, Selector } from '../../componentes/ui/Campos';
import { enlaceValido, modalidadTexto, normalizarEnlace } from '../../utilidades/formato';

const esquema = z
  .object({
    titulo: z.string().trim().min(1, 'Escribe el título').max(150),
    tipo: z.enum(TIPOS_FARO, { message: 'Elige el tipo de registro' }),
    entidad: z.string().trim().max(150),
    fecha_inicio: z.string(),
    fecha_cierre: z.string(),
    modalidad: z.string(),
    duracion: z.string().trim().max(50),
    lugar: z.string().trim().max(150),
    es_gratuito: z.boolean(),
    costo: z.string().regex(/^\d*$/, 'Escribe solo números'),
    descripcion: z.string().trim(),
    link: z.string().refine((v) => !v.trim() || enlaceValido(v), 'Escribe un enlace válido, por ejemplo www.sitio.com'),
    estado_fe: z.enum(['Activo', 'Inactivo']),
  })
  .refine((d) => !(d.es_gratuito && d.costo), { message: 'Un registro gratuito no tiene costo', path: ['costo'] });
type Datos = z.infer<typeof esquema>;

/** Crear y editar un registro del Faro (Figma: "Modal — Crear/Editar registro"). */
export function FormularioFaro({ registro, onCerrar }: { registro?: Faro; onCerrar: () => void }) {
  const { data: categorias = [] } = useCategorias();
  const guardarApi = useGuardar<Faro>('/faro');
  const eliminarApi = useEliminar('/faro');
  const subirImagen = useSubirImagen('/faro');
  const [seleccion, setSeleccion] = useState<number[]>(registro?.categorias.map((c) => c.id_categoria) ?? []);
  const [imagen, setImagen] = useState<File | null>(null);

  const { register, control, trigger, getValues, formState } = useForm<Datos>({
    resolver: zodResolver(esquema),
    defaultValues: {
      titulo: registro?.titulo ?? '',
      tipo: registro?.tipo,
      entidad: registro?.entidad ?? '',
      fecha_inicio: registro?.fecha_inicio ?? '',
      fecha_cierre: registro?.fecha_cierre ?? '',
      modalidad: registro?.modalidad ?? '',
      duracion: registro?.duracion ?? '',
      lugar: registro?.lugar ?? '',
      es_gratuito: registro?.es_gratuito ?? false,
      costo: registro?.costo ? String(Math.round(registro.costo)) : '',
      descripcion: registro?.descripcion ?? '',
      link: registro?.link ?? '',
      estado_fe: registro?.estado_fe ?? 'Activo',
    },
  });
  const e = formState.errors;
  const gratuito = useWatch({ control, name: 'es_gratuito' });

  const guardar = async () => {
    const d = getValues();
    const datos = {
      titulo: d.titulo,
      tipo: d.tipo,
      entidad: d.entidad,
      fecha_inicio: d.fecha_inicio || null,
      fecha_cierre: d.fecha_cierre || null,
      modalidad: d.modalidad || null,
      duracion: d.duracion,
      lugar: d.lugar,
      es_gratuito: d.es_gratuito,
      costo: d.es_gratuito || !d.costo ? null : Number(d.costo),
      descripcion: d.descripcion,
      link: normalizarEnlace(d.link),
      estado_fe: d.estado_fe,
      categorias: seleccion,
    };
    const guardado = await guardarApi.mutateAsync({ id: registro?.id_fe, datos });
    if (imagen) await subirImagen.mutateAsync({ id: guardado.id_fe, campo: 'imagen', archivo: imagen });
  };

  return (
    <FormularioCrud
      abierto
      modo={registro ? 'editar' : 'crear'}
      titulo={registro ? 'Editar registro' : 'Nuevo registro'}
      sustantivo={{ palabra: 'registro', demostrativo: 'este' }}
      seccion="Faro Empresarial"
      validar={() => trigger()}
      guardar={guardar}
      eliminar={registro ? () => eliminarApi.mutateAsync(registro.id_fe) : undefined}
      onCerrar={onCerrar}
    >
      <Selector
        etiqueta="Tipo de registro"
        obligatorio
        vacio="Selecciona el tipo"
        opciones={TIPOS_FARO.map((t) => ({ valor: t, texto: t }))}
        error={e.tipo?.message}
        {...register('tipo')}
      />
      <SelectorCategorias etiqueta="Etiquetas" categorias={categorias} seleccion={seleccion} onCambiar={setSeleccion} />
      <Entrada etiqueta="Título" placeholder="Escribe el título del registro" obligatorio error={e.titulo?.message} {...register('titulo')} />
      <Entrada etiqueta="Entidad" placeholder="Nombre de la entidad o institución" {...register('entidad')} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Entrada etiqueta="Fecha de cierre" type="date" ayuda="Vacía = Por definir" {...register('fecha_cierre')} />
        <Selector
          etiqueta="Modalidad"
          vacio="Selecciona la modalidad"
          opciones={MODALIDADES.map((m) => ({ valor: m, texto: modalidadTexto(m) }))}
          {...register('modalidad')}
        />
        <Entrada etiqueta="Fecha de inicio (opcional)" type="date" {...register('fecha_inicio')} />
        <Entrada etiqueta="Duración" placeholder="Ej. 1 año, 120 horas" {...register('duracion')} />
        <Entrada etiqueta="Lugar" placeholder="Ciudad o país" {...register('lugar')} />
        <div className="flex flex-col gap-2">
          <Entrada etiqueta="Costo" inputMode="numeric" placeholder="Ej. Gratuito" disabled={gratuito} error={e.costo?.message} {...register('costo')} />
          <Casilla etiqueta="Gratuito" {...register('es_gratuito')} />
        </div>
      </div>
      <AreaTexto etiqueta="Descripción" rows={3} placeholder="Escribe una descripción breve de la oportunidad" {...register('descripcion')} />
      <Entrada etiqueta="Link de referencia" placeholder="https://" error={e.link?.message} {...register('link')} />
      <div className="grid items-start gap-5 sm:grid-cols-2">
        <CampoImagen actual={registro?.imagen} archivo={imagen} onCambiar={setImagen} />
        <Selector etiqueta="Estado" opciones={[{ valor: 'Activo', texto: 'Activo' }, { valor: 'Inactivo', texto: 'Inactivo' }]} {...register('estado_fe')} />
      </div>
    </FormularioCrud>
  );
}
