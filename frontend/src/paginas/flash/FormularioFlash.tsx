import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { useCategorias, useEliminar, useGuardar, useSubirImagen } from '../../api/consultas';
import { MODALIDADES, TIPOS_EVENTO, type Flash } from '../../api/tipos';
import { CampoImagen, SelectorCategorias } from '../../componentes/contenido/Controles';
import { FormularioCrud } from '../../componentes/contenido/FormularioCrud';
import { AreaTexto, Casilla, Entrada, Selector } from '../../componentes/ui/Campos';
import { DEPARTAMENTOS } from '../../utilidades/colombia';
import { aEntradaFecha, aEntradaHora, aIsoBogota, modalidadTexto } from '../../utilidades/formato';

const esquema = z
  .object({
    titulo: z.string().trim().min(1, 'Escribe el título').max(150),
    tipo_evento: z.enum(TIPOS_EVENTO, { message: 'Elige el tipo de evento' }),
    departamento: z.string(),
    fecha_inicio: z.string().min(1, 'Elige la fecha de inicio'),
    hora_inicio: z.string().min(1, 'Elige la hora de inicio'),
    fecha_fin: z.string(),
    hora_fin: z.string(),
    modalidad: z.enum(MODALIDADES, { message: 'Elige la modalidad' }),
    es_gratuito: z.boolean(),
    costo: z.string().regex(/^\d*$/, 'Escribe solo números'),
    descripcion: z.string().trim(),
    lugar: z.string().trim().max(100),
    link: z.union([z.literal(''), z.url('Escribe un enlace válido (https://...)')]),
    info_adicional: z.string(),
    estado_fi: z.enum(['Activo', 'Inactivo']),
  })
  .refine((d) => d.es_gratuito || d.costo !== '', { message: 'Escribe el costo o marca "Gratuito"', path: ['costo'] })
  .refine((d) => !d.fecha_fin || aIsoBogota(d.fecha_fin, d.hora_fin || d.hora_inicio) >= aIsoBogota(d.fecha_inicio, d.hora_inicio), {
    message: 'La finalización debe ser posterior al inicio',
    path: ['fecha_fin'],
  });
type Datos = z.infer<typeof esquema>;

/** Crear y editar un Flash Informativo (Figma: "Modal — Crear/Editar evento"). */
export function FormularioFlash({ registro, onCerrar }: { registro?: Flash; onCerrar: () => void }) {
  const { data: categorias = [] } = useCategorias();
  const guardarApi = useGuardar<Flash>('/flash');
  const eliminarApi = useEliminar('/flash');
  const subirImagen = useSubirImagen('/flash');
  const [seleccion, setSeleccion] = useState<number[]>(registro?.categorias.map((c) => c.id_categoria) ?? []);
  const [imagen, setImagen] = useState<File | null>(null);

  const { register, control, trigger, getValues, formState } = useForm<Datos>({
    resolver: zodResolver(esquema),
    defaultValues: {
      titulo: registro?.titulo ?? '',
      tipo_evento: registro?.tipo_evento,
      departamento: registro?.departamento ?? '',
      fecha_inicio: aEntradaFecha(registro?.fecha_inicio),
      hora_inicio: aEntradaHora(registro?.fecha_inicio),
      fecha_fin: aEntradaFecha(registro?.fecha_fin),
      hora_fin: aEntradaHora(registro?.fecha_fin),
      modalidad: registro?.modalidad,
      es_gratuito: registro?.es_gratuito ?? false,
      costo: registro?.costo ? String(Math.round(registro.costo)) : '',
      descripcion: registro?.descripcion ?? '',
      lugar: registro?.lugar ?? '',
      link: registro?.link ?? '',
      info_adicional: registro?.info_adicional ?? '',
      estado_fi: registro?.estado_fi ?? 'Activo',
    },
  });
  const e = formState.errors;
  const gratuito = useWatch({ control, name: 'es_gratuito' });

  const guardar = async () => {
    const d = getValues();
    const datos = {
      titulo: d.titulo,
      tipo_evento: d.tipo_evento,
      departamento: d.departamento || null,
      fecha_inicio: aIsoBogota(d.fecha_inicio, d.hora_inicio),
      fecha_fin: d.fecha_fin ? aIsoBogota(d.fecha_fin, d.hora_fin || d.hora_inicio) : null,
      modalidad: d.modalidad,
      es_gratuito: d.es_gratuito,
      costo: d.es_gratuito ? null : Number(d.costo),
      descripcion: d.descripcion,
      lugar: d.lugar,
      link: d.link || null,
      info_adicional: d.info_adicional,
      estado_fi: d.estado_fi,
      categorias: seleccion,
    };
    const guardado = await guardarApi.mutateAsync({ id: registro?.id_fi, datos });
    if (imagen) await subirImagen.mutateAsync({ id: guardado.id_fi, campo: 'imagen', archivo: imagen });
  };

  return (
    <FormularioCrud
      abierto
      modo={registro ? 'editar' : 'crear'}
      titulo={registro ? 'Editar evento' : 'Nuevo evento'}
      sustantivo={{ palabra: 'evento', demostrativo: 'este' }}
      validar={() => trigger()}
      guardar={guardar}
      eliminar={registro ? () => eliminarApi.mutateAsync(registro.id_fi) : undefined}
      onCerrar={onCerrar}
    >
      <Entrada etiqueta="Título del evento" placeholder="Escribe el título del evento" obligatorio error={e.titulo?.message} {...register('titulo')} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Selector
          etiqueta="Tipo de evento"
          obligatorio
          vacio="Selecciona el tipo"
          opciones={TIPOS_EVENTO.map((t) => ({ valor: t, texto: t }))}
          error={e.tipo_evento?.message}
          {...register('tipo_evento')}
        />
        <Selector etiqueta="Departamento" vacio="Selecciona el departamento" opciones={DEPARTAMENTOS} {...register('departamento')} />
        <Entrada etiqueta="Fecha de inicio" type="date" obligatorio error={e.fecha_inicio?.message} {...register('fecha_inicio')} />
        <Entrada etiqueta="Horario de inicio" type="time" obligatorio error={e.hora_inicio?.message} {...register('hora_inicio')} />
        <Entrada etiqueta="Fecha de finalización" type="date" error={e.fecha_fin?.message} {...register('fecha_fin')} />
        <Entrada etiqueta="Horario de finalización" type="time" {...register('hora_fin')} />
        <Selector
          etiqueta="Modalidad"
          obligatorio
          vacio="Selecciona la modalidad"
          opciones={MODALIDADES.map((m) => ({ valor: m, texto: modalidadTexto(m) }))}
          error={e.modalidad?.message}
          {...register('modalidad')}
        />
        <div className="flex flex-col gap-2">
          <Entrada
            etiqueta="Costo de participación (COP)"
            inputMode="numeric"
            placeholder="Ej. 150000"
            disabled={gratuito}
            error={e.costo?.message}
            {...register('costo')}
          />
          <Casilla etiqueta="Gratuito" {...register('es_gratuito')} />
        </div>
      </div>
      <AreaTexto etiqueta="Descripción del evento" placeholder="Escribe la descripción del evento" {...register('descripcion')} />
      <Entrada etiqueta="Lugar de referencia" placeholder="Ingresa la ubicación" error={e.lugar?.message} {...register('lugar')} />
      <Entrada etiqueta="Link de referencia" placeholder="https://" error={e.link?.message} {...register('link')} />
      <AreaTexto etiqueta="Información clave" rows={3} ayuda="Una idea por línea; se muestran como viñetas." placeholder="• Escribe una nota" {...register('info_adicional')} />
      <SelectorCategorias categorias={categorias} seleccion={seleccion} onCambiar={setSeleccion} />
      <CampoImagen etiqueta="Imagen del evento" actual={registro?.imagen} archivo={imagen} onCambiar={setImagen} />
      <Selector etiqueta="Estado" opciones={[{ valor: 'Activo', texto: 'Activo' }, { valor: 'Inactivo', texto: 'Inactivo' }]} {...register('estado_fi')} />
    </FormularioCrud>
  );
}
