import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { useEliminar, useGuardar } from '../../api/consultas';
import { MODALIDADES, TIPOS_EVENTO, type Evento } from '../../api/tipos';
import { FormularioCrud } from '../../componentes/contenido/FormularioCrud';
import { AreaTexto, Casilla, Entrada, Selector } from '../../componentes/ui/Campos';
import { aEntradaFecha, aEntradaHora, aIsoBogota, modalidadTexto } from '../../utilidades/formato';

const esquema = z
  .object({
    titulo: z.string().trim().min(1, 'Escribe el título').max(150),
    tipo_evento: z.enum(TIPOS_EVENTO, { message: 'Elige el tipo de evento' }),
    fecha_inicio: z.string().min(1, 'Elige la fecha'),
    hora_inicio: z.string().min(1, 'Elige la hora de inicio'),
    fecha_fin: z.string(),
    hora_fin: z.string(),
    modalidad: z.enum(MODALIDADES, { message: 'Elige la modalidad' }),
    lugar: z.string().trim().max(150),
    link_externo: z.union([z.literal(''), z.url('Escribe un enlace válido (https://...)')]),
    es_gratuito: z.boolean(),
    costo: z.string().regex(/^\d*$/, 'Escribe solo números'),
    descripcion: z.string().trim(),
  })
  .refine((d) => !d.fecha_fin || aIsoBogota(d.fecha_fin, d.hora_fin || d.hora_inicio) >= aIsoBogota(d.fecha_inicio, d.hora_inicio), {
    message: 'La finalización debe ser posterior al inicio',
    path: ['fecha_fin'],
  });
type Datos = z.infer<typeof esquema>;

/** Crear y editar un evento institucional. `inicio` precarga la fecha elegida en el calendario. */
export function FormularioEvento({ registro, inicio, onCerrar }: { registro?: Evento; inicio?: Date; onCerrar: () => void }) {
  const guardarApi = useGuardar<Evento>('/calendario');
  const eliminarApi = useEliminar('/calendario');
  const inicioIso = registro?.fecha_inicio ?? inicio?.toISOString();
  const { register, control, trigger, getValues, formState } = useForm<Datos>({
    resolver: zodResolver(esquema),
    defaultValues: {
      titulo: registro?.titulo ?? '',
      tipo_evento: registro?.tipo_evento,
      fecha_inicio: aEntradaFecha(inicioIso),
      hora_inicio: aEntradaHora(inicioIso),
      fecha_fin: aEntradaFecha(registro?.fecha_fin),
      hora_fin: aEntradaHora(registro?.fecha_fin),
      modalidad: registro?.modalidad,
      lugar: registro?.lugar ?? '',
      link_externo: registro?.link_externo ?? '',
      es_gratuito: registro?.es_gratuito ?? true,
      costo: registro?.costo ? String(Math.round(registro.costo)) : '',
      descripcion: registro?.descripcion ?? '',
    },
  });
  const e = formState.errors;
  const gratuito = useWatch({ control, name: 'es_gratuito' });

  const guardar = async () => {
    const d = getValues();
    await guardarApi.mutateAsync({
      id: registro?.id_evento,
      datos: {
        titulo: d.titulo,
        tipo_evento: d.tipo_evento,
        fecha_inicio: aIsoBogota(d.fecha_inicio, d.hora_inicio),
        fecha_fin: d.fecha_fin ? aIsoBogota(d.fecha_fin, d.hora_fin || d.hora_inicio) : d.hora_fin ? aIsoBogota(d.fecha_inicio, d.hora_fin) : null,
        modalidad: d.modalidad,
        lugar: d.lugar,
        link_externo: d.link_externo || null,
        es_gratuito: d.es_gratuito,
        costo: d.es_gratuito || !d.costo ? null : Number(d.costo),
        descripcion: d.descripcion,
      },
    });
  };

  return (
    <FormularioCrud
      abierto
      modo={registro ? 'editar' : 'crear'}
      titulo={registro ? 'Editar evento' : 'Nuevo evento'}
      sustantivo={{ palabra: 'evento', demostrativo: 'este' }}
      validar={() => trigger()}
      guardar={guardar}
      eliminar={registro ? () => eliminarApi.mutateAsync(registro.id_evento) : undefined}
      onCerrar={onCerrar}
    >
      <Entrada etiqueta="Título del evento" obligatorio placeholder="Escribe el título del evento" error={e.titulo?.message} {...register('titulo')} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Selector
          etiqueta="Tipo de evento"
          obligatorio
          vacio="Selecciona el tipo"
          opciones={TIPOS_EVENTO.map((t) => ({ valor: t, texto: t }))}
          error={e.tipo_evento?.message}
          {...register('tipo_evento')}
        />
        <Selector
          etiqueta="Modalidad"
          obligatorio
          vacio="Selecciona la modalidad"
          opciones={MODALIDADES.map((m) => ({ valor: m, texto: modalidadTexto(m) }))}
          error={e.modalidad?.message}
          {...register('modalidad')}
        />
        <Entrada etiqueta="Fecha de inicio" type="date" obligatorio error={e.fecha_inicio?.message} {...register('fecha_inicio')} />
        <Entrada etiqueta="Hora de inicio" type="time" obligatorio error={e.hora_inicio?.message} {...register('hora_inicio')} />
        <Entrada etiqueta="Fecha de finalización" type="date" ayuda="Vacía = el mismo día" error={e.fecha_fin?.message} {...register('fecha_fin')} />
        <Entrada etiqueta="Hora de finalización" type="time" {...register('hora_fin')} />
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Entrada etiqueta="Costo (COP)" inputMode="numeric" placeholder="Ej. 150000" disabled={gratuito} error={e.costo?.message} {...register('costo')} />
          <Casilla etiqueta="Gratuito" {...register('es_gratuito')} />
        </div>
      </div>
      <Entrada etiqueta="Lugar" placeholder="Ej. Auditorio principal, sede Bogotá" {...register('lugar')} />
      <Entrada etiqueta="Enlace externo" placeholder="https://" error={e.link_externo?.message} {...register('link_externo')} />
      <AreaTexto etiqueta="Descripción" placeholder="Describe el evento" {...register('descripcion')} />
    </FormularioCrud>
  );
}
