import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { z } from 'zod';
import { mensajeDeError } from '../../api/cliente';
import { useAccionInvitacion, useInvitaciones, useInvitarVarias, type EstadoInvitacion, type Invitacion } from '../../api/invitaciones';
import { Boton } from '../../componentes/ui/Boton';
import { Entrada } from '../../componentes/ui/Campos';
import { Cargando, EstadoVacio, MensajeError } from '../../componentes/ui/Elementos';
import { Aviso, Confirmacion } from '../../componentes/ui/Modal';
import { fechaCorta } from '../../utilidades/formato';
import { Migas, TARJETA } from './PerfilEmpresa';

const fila = z.object({
  nombre_contacto: z.string().trim().min(1, 'Escribe el nombre').max(50),
  apellido_contacto: z.string().trim().min(1, 'Escribe el apellido').max(50),
  correo: z.email('Escribe un correo válido'),
  nombre_empresa: z.string().trim().max(150),
});
type Fila = z.infer<typeof fila>;
const MAXIMO = 50;
const esquema = z.object({ filas: z.array(fila).min(1).max(MAXIMO) });
type Datos = z.infer<typeof esquema>;
const FILA_VACIA: Fila = { nombre_contacto: '', apellido_contacto: '', correo: '', nombre_empresa: '' };

const COLOR_ESTADO: Record<EstadoInvitacion, string> = {
  Pendiente: 'bg-[#fdf5e1] text-[#7a5a00]',
  Vencida: 'bg-[#f1f5f9] text-[#64748b]',
  Completada: 'bg-[#e6f6ef] text-[#0b7a55]',
  Anulada: 'bg-rojo-claro text-rojo',
};

function FilaInvitacion({ invitacion, onAccion }: { invitacion: Invitacion; onAccion: (tipo: 'reenviar' | 'anular') => void }) {
  const i = invitacion;
  const pendiente = i.estado === 'Pendiente' || i.estado === 'Vencida';
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-[#e5ebf2] p-4 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-body font-bold text-azul-marino">
            {i.nombre_contacto} {i.apellido_contacto}
          </span>
          <span className={`rounded px-2 py-0.5 text-caption font-bold ${COLOR_ESTADO[i.estado]}`}>{i.estado}</span>
        </div>
        <p className="text-small text-gris-azulado [overflow-wrap:anywhere]">
          {[i.correo, i.nombre_empresa].filter(Boolean).join(' · ')}
        </p>
        <p className="text-caption text-texto-suave">
          {i.estado === 'Completada' && i.fecha_completada
            ? `Registro completado el ${fechaCorta(i.fecha_completada)}`
            : i.estado === 'Anulada'
              ? `Enviada el ${fechaCorta(i.fecha_envio)}`
              : `Enviada el ${fechaCorta(i.fecha_envio)} · ${i.estado === 'Vencida' ? 'venció' : 'vence'} el ${fechaCorta(i.fecha_vencimiento)}`}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        {i.estado === 'Completada' && i.id_ec && (
          <Link to={`/empresas/${i.id_ec}`} className="inline-flex h-9 items-center rounded-full border border-[#d1d9e3] px-4 text-caption font-semibold text-azul-marino hover:bg-fondo">
            Ver empresa
          </Link>
        )}
        {pendiente && (
          <>
            <Boton tamano="sm" variante="secundario" pildora={false} className="rounded-full!" onClick={() => onAccion('reenviar')}>
              Reenviar
            </Boton>
            <Boton tamano="sm" variante="peligro" className="rounded-full!" onClick={() => onAccion('anular')}>
              Anular
            </Boton>
          </>
        )}
      </div>
    </li>
  );
}

/**
 * Invitaciones a empresas coformadoras (SuperAdmin y Gestor Empresas): se registra el
 * contacto inicial y el sistema le envía el correo para que la empresa complete su registro.
 */
export function Invitaciones() {
  const { data: invitaciones, isLoading, error, refetch } = useInvitaciones();
  const accion = useAccionInvitacion();
  const [aviso, setAviso] = useState<{ titulo: string; mensaje: string; detalle?: string } | null>(null);
  const [anular, setAnular] = useState<Invitacion | null>(null);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const invitarVarias = useInvitarVarias();
  const { register, handleSubmit, reset, setError, control, formState } = useForm<Datos>({
    resolver: zodResolver(esquema),
    defaultValues: { filas: [FILA_VACIA] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'filas' });
  const e = formState.errors.filas;

  const resultadoCorreo = (inv: Invitacion) =>
    inv.correo_enviado
      ? `Enviamos el correo a ${inv.correo}. El enlace vence en 7 días.`
      : `La invitación quedó registrada, pero el correo no se pudo enviar. Revisa la configuración del correo y usa "Reenviar".`;

  const enviar = handleSubmit(async ({ filas }) => {
    setErrorGeneral(null);
    try {
      const { enviadas, resultados } = await invitarVarias.mutateAsync(filas);
      // Quedan en el formulario solo las que fallaron, con su motivo.
      const fallidas = filas.map((f, i) => ({ fila: f, resultado: resultados[i]! })).filter((r) => !r.resultado.ok);
      reset({ filas: fallidas.length ? fallidas.map((r) => r.fila) : [FILA_VACIA] });
      fallidas.forEach((r, i) => {
        if (!r.resultado.ok) setError(`filas.${i}.correo`, { message: r.resultado.error });
      });
      const sinCorreo = resultados.filter((r) => r.ok && !r.invitacion.correo_enviado).length;
      setAviso({
        titulo: enviadas ? (enviadas === 1 ? 'Invitación enviada' : 'Invitaciones enviadas') : 'No se envió ninguna invitación',
        mensaje: enviadas === 1 ? 'Enviamos 1 invitación.' : `Enviamos ${enviadas} invitaciones.`,
        detalle: [
          fallidas.length ? `${fallidas.length} no se pudieron enviar; quedaron en el formulario con el motivo.` : 'Cada enlace vence en 7 días.',
          sinCorreo ? `${sinCorreo} quedaron registradas pero el correo no salió: revisa la configuración del correo y usa "Reenviar".` : '',
        ].filter(Boolean).join(' '),
      });
    } catch (err) {
      setErrorGeneral(mensajeDeError(err));
    }
  });

  const ejecutar = async (inv: Invitacion, tipo: 'reenviar' | 'anular') => {
    setErrorGeneral(null);
    try {
      const resultado = await accion.mutateAsync({ tipo, id: inv.id_invitacion });
      if (tipo === 'reenviar') {
        setAviso({ titulo: 'Invitación reenviada', mensaje: 'Enviamos un enlace nuevo; el anterior ya no sirve.', detalle: resultadoCorreo(resultado) });
      }
    } catch (err) {
      setErrorGeneral(mensajeDeError(err));
    } finally {
      setAnular(null);
    }
  };

  return (
    <>
      <Migas actual="Invitar empresas" />
      <div className="flex flex-col gap-4">
        <form onSubmit={enviar} noValidate className={`flex flex-col gap-4 p-5 sm:p-7 ${TARJETA}`}>
          <div className="flex flex-col gap-1">
            <h1 className="text-subtitle font-extrabold text-[#0a1c40]">Invitar empresas</h1>
            <p className="text-small text-[#64748b]">
              Registra el contacto inicial de cada empresa; puedes agregar varias y enviarlas a la vez. Cada una recibe un correo para crear su
              contraseña y completar la información de la empresa.
            </p>
          </div>
          <ol className="flex flex-col gap-3">
            {fields.map((campo, i) => (
              <li key={campo.id} className="rounded-xl border border-[#e5ebf2] p-4">
                <fieldset className="flex flex-col gap-3">
                  <legend className="flex w-full items-center justify-between text-small font-bold text-azul-marino">
                    Empresa {i + 1}
                    {fields.length > 1 && (
                      <button type="button" onClick={() => remove(i)} className="cursor-pointer text-caption font-semibold text-rojo hover:underline" aria-label={`Quitar empresa ${i + 1}`}>
                        Quitar
                      </button>
                    )}
                  </legend>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <Entrada etiqueta="Nombre del contacto" obligatorio placeholder="Ej. Ana" error={e?.[i]?.nombre_contacto?.message} {...register(`filas.${i}.nombre_contacto`)} />
                    <Entrada etiqueta="Apellido del contacto" obligatorio placeholder="Ej. Pérez" error={e?.[i]?.apellido_contacto?.message} {...register(`filas.${i}.apellido_contacto`)} />
                    <Entrada etiqueta="Correo del contacto" obligatorio type="email" placeholder="nombre@empresa.com" error={e?.[i]?.correo?.message} {...register(`filas.${i}.correo`)} />
                    <Entrada etiqueta="Nombre de la empresa" placeholder="Opcional" error={e?.[i]?.nombre_empresa?.message} {...register(`filas.${i}.nombre_empresa`)} />
                  </div>
                </fieldset>
              </li>
            ))}
          </ol>
          {errorGeneral && (
            <p role="alert" className="rounded-lg bg-rojo-claro px-4 py-3 text-caption text-rojo">
              {errorGeneral}
            </p>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
            <button
              type="button"
              disabled={fields.length >= MAXIMO}
              onClick={() => append(FILA_VACIA)}
              className="h-[42px] cursor-pointer rounded-full border border-[#d1d9e3] bg-white px-5 text-small font-semibold text-azul-marino hover:bg-fondo disabled:cursor-not-allowed disabled:opacity-60"
            >
              + Agregar otra empresa
            </button>
            <Boton type="submit" pildora className="bg-rojo-vivo! text-small! shadow-none!" cargando={formState.isSubmitting}>
              {fields.length === 1 ? 'Enviar invitación' : `Enviar ${fields.length} invitaciones`}
            </Boton>
          </div>
        </form>

        <section aria-labelledby="titulo-invitaciones" className={`flex flex-col gap-4 p-5 sm:p-7 ${TARJETA}`}>
          <h2 id="titulo-invitaciones" className="text-subtitle font-extrabold text-[#0a1c40]">Invitaciones enviadas</h2>
          {isLoading ? (
            <Cargando />
          ) : error ? (
            <MensajeError mensaje={mensajeDeError(error)} onReintentar={() => refetch()} />
          ) : !invitaciones?.length ? (
            <EstadoVacio titulo="Aún no hay invitaciones" detalle="Las invitaciones que envíes aparecerán aquí con su estado." />
          ) : (
            <ul className="flex flex-col gap-3">
              {invitaciones.map((inv) => (
                <FilaInvitacion
                  key={inv.id_invitacion}
                  invitacion={inv}
                  onAccion={(tipo) => (tipo === 'anular' ? setAnular(inv) : ejecutar(inv, 'reenviar'))}
                />
              ))}
            </ul>
          )}
        </section>
      </div>

      <Confirmacion
        abierto={!!anular}
        titulo="Anular invitación"
        pregunta="¿Está seguro de que desea anular esta invitación?"
        detalle="El enlace que recibió la empresa dejará de funcionar."
        textoConfirmar="Anular invitación"
        peligro
        cargando={accion.isPending}
        onConfirmar={() => anular && ejecutar(anular, 'anular')}
        onCancelar={() => setAnular(null)}
      />
      <Aviso abierto={!!aviso} titulo={aviso?.titulo ?? ''} mensaje={aviso?.mensaje ?? ''} detalle={aviso?.detalle} onCerrar={() => setAviso(null)} />
    </>
  );
}
