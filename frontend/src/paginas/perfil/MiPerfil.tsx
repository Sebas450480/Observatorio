import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ErrorApi, api, mensajeDeError } from '../../api/cliente';
import { useCategorias } from '../../api/consultas';
import type { FrecuenciaAlertas, Perfil } from '../../api/tipos';
import { SelectorIntereses } from '../../componentes/SelectorIntereses';
import { Boton } from '../../componentes/ui/Boton';
import { Entrada } from '../../componentes/ui/Campos';
import { Aviso, Modal } from '../../componentes/ui/Modal';
import { descripcionRol, esRolSuperAdmin, useSesion } from '../../sesion/sesion';
import { iniciales } from '../../utilidades/formato';

const esquema = z.object({
  nombre_usuario: z.string().trim().min(1, 'Escribe tu nombre').max(50),
  apellido_usuario: z.string().trim().min(1, 'Escribe tu apellido').max(50),
  correo: z.email('Escribe un correo válido'),
  ciudad: z.string().trim().max(60),
  apodo_usuario: z.string().trim().max(20),
  frecuencia_alertas: z.enum(['Inmediata', 'Semanal', 'Ninguna']),
});
type Datos = z.infer<typeof esquema>;

const esquemaContrasena = z
  .object({
    actual: z.string().min(1, 'Escribe tu contraseña actual'),
    nueva: z.string().min(8, 'Mínimo 8 caracteres').max(72),
    confirmar: z.string(),
  })
  .refine((d) => d.nueva === d.confirmar, { message: 'Las contraseñas no coinciden', path: ['confirmar'] });
type DatosContrasena = z.infer<typeof esquemaContrasena>;

const FRECUENCIAS: { valor: FrecuenciaAlertas; titulo: string; detalle: string }[] = [
  { valor: 'Inmediata', titulo: 'En el momento', detalle: 'Cada vez que se publique algo de tu interés' },
  { valor: 'Semanal', titulo: 'Resumen semanal', detalle: 'Un correo los lunes con lo más importante' },
  { valor: 'Ninguna', titulo: 'No recibir alertas', detalle: 'Solo verás las novedades al entrar al sitio' },
];

const TARJETA = 'flex flex-col gap-5 rounded-2xl border border-[#e5ebf2] bg-white p-5 shadow-[0_4px_16px_0_rgba(13,26,64,0.06)] sm:p-8';

function EncabezadoTarjeta({ titulo, detalle }: { titulo: string; detalle: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-subtitle font-bold text-azul-marino">{titulo}</h2>
      <p className="text-small text-gris-azulado">{detalle}</p>
    </div>
  );
}

function CambiarContrasena({ onCerrar, onListo }: { onCerrar: () => void; onListo: () => void }) {
  const { register, handleSubmit, setError, formState } = useForm<DatosContrasena>({ resolver: zodResolver(esquemaContrasena) });
  const cambiar = useMutation({
    mutationFn: (d: DatosContrasena) => api('/perfil/contrasena', { metodo: 'PUT', cuerpo: { actual: d.actual, nueva: d.nueva } }),
    onSuccess: onListo,
    onError: (e) => {
      if (e instanceof ErrorApi && e.estado === 400 && /actual/i.test(e.message)) setError('actual', { message: e.message });
    },
  });
  const e = formState.errors;
  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      titulo="Cambiar contraseña"
      ancho={480}
      pie={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Boton variante="secundario" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" form="formulario-contrasena" cargando={cambiar.isPending}>
            Cambiar contraseña
          </Boton>
        </div>
      }
    >
      <form id="formulario-contrasena" noValidate className="flex flex-col gap-4" onSubmit={handleSubmit((d) => cambiar.mutate(d))}>
        <Entrada etiqueta="Contraseña actual" type="password" autoComplete="current-password" error={e.actual?.message} {...register('actual')} />
        <Entrada etiqueta="Nueva contraseña" type="password" autoComplete="new-password" ayuda="Mínimo 8 caracteres." error={e.nueva?.message} {...register('nueva')} />
        <Entrada etiqueta="Confirmar nueva contraseña" type="password" autoComplete="new-password" error={e.confirmar?.message} {...register('confirmar')} />
        {cambiar.error && !e.actual && (
          <p role="alert" className="rounded-lg bg-rojo-claro px-4 py-3 text-caption text-rojo">
            {mensajeDeError(cambiar.error)}
          </p>
        )}
      </form>
    </Modal>
  );
}

/** Mi perfil: datos personales, intereses, alertas y contraseña (Figma: "Mi perfil"). */
export function MiPerfil() {
  const { usuario, establecerUsuario } = useSesion();
  if (!usuario) return null;
  return <Formulario key={usuario.id_usuario} usuario={usuario} establecerUsuario={establecerUsuario} />;
}

function Formulario({ usuario, establecerUsuario }: { usuario: Perfil; establecerUsuario: (p: Perfil) => void }) {
  const { data: categorias = [] } = useCategorias();
  const [intereses, setIntereses] = useState(usuario.intereses.map((i) => i.id_categoria));
  const [modal, setModal] = useState<'contrasena' | 'contrasena-lista' | 'guardado' | null>(null);
  const valores = (p: Perfil): Datos => ({
    nombre_usuario: p.nombre_usuario,
    apellido_usuario: p.apellido_usuario,
    correo: p.correo,
    ciudad: p.ciudad ?? '',
    apodo_usuario: p.apodo_usuario ?? '',
    frecuencia_alertas: p.frecuencia_alertas,
  });
  const { register, handleSubmit, reset, setError, formState } = useForm<Datos>({ resolver: zodResolver(esquema), defaultValues: valores(usuario) });
  const e = formState.errors;

  const guardar = useMutation({
    mutationFn: async (d: Datos) => {
      await api<Perfil>('/perfil', { metodo: 'PATCH', cuerpo: d });
      return api<Perfil>('/perfil/intereses', { metodo: 'PUT', cuerpo: { intereses } });
    },
    onSuccess: (perfil) => {
      establecerUsuario(perfil);
      reset(valores(perfil));
      setModal('guardado');
    },
    onError: (err) => {
      if (err instanceof ErrorApi && err.estado === 409) setError('correo', { message: err.message });
    },
  });

  const cancelar = () => {
    reset(valores(usuario));
    setIntereses(usuario.intereses.map((i) => i.id_categoria));
  };

  const esAdmin = esRolSuperAdmin(usuario.nombre_rol);
  const esGestor = usuario.nombre_rol.startsWith('Gestor');
  const institucional = esAdmin || esGestor;
  const desde = new Date(usuario.fecha_registro).toLocaleDateString('es-CO', { month: 'long', year: 'numeric', timeZone: 'America/Bogota' });
  const botonClaro = 'cursor-pointer rounded-control border border-[#d1d9e3] bg-white font-semibold text-azul-marino hover:bg-fondo';

  // Los modales van fuera del <form>: los eventos de un portal suben por el árbol de React.
  return (
    <>
    <form noValidate onSubmit={handleSubmit((d) => guardar.mutate(d))}>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between xl:mb-[30px]">
        <div className="flex flex-col gap-1 xl:mt-px">
          <h1 className="text-[24px] font-bold text-azul-marino sm:text-titulo">Mi perfil</h1>
          <p className="text-small text-gris-azulado sm:text-body">
            {esAdmin ? 'Actualiza tus datos como administrador del Observatorio.' : 'Actualiza tus datos y elige sobre qué quieres recibir alertas del Observatorio.'}
          </p>
        </div>
        <div className="flex items-center gap-3 xl:mt-[5px]">
          <button type="button" onClick={cancelar} className={`h-[52px] px-7 text-body ${botonClaro}`}>
            Cancelar
          </button>
          <Boton type="submit" cargando={guardar.isPending} className="h-[50px]! rounded-control! bg-rojo-vivo! px-8! text-body! font-bold! shadow-none!">
            Guardar cambios
          </Boton>
        </div>
      </div>
      {guardar.error && !e.correo && (
        <p role="alert" className="mb-4 rounded-lg bg-rojo-claro px-4 py-3 text-caption text-rojo">
          {mensajeDeError(guardar.error)}
        </p>
      )}

      <div className={`grid items-start gap-6 ${esAdmin ? '' : 'xl:grid-cols-[900fr_580fr]'}`}>
        <section className={TARJETA}>
          <EncabezadoTarjeta
            titulo="Mis datos"
            detalle={
              esAdmin
                ? 'Tu información como administrador del Observatorio.'
                : esGestor
                  ? 'Tu información como gestor de contenidos del Observatorio.'
                  : 'Esta información nos ayuda a personalizar tus alertas.'
            }
          />
          <div className="flex flex-wrap items-center gap-4">
            <span className="grid size-16 shrink-0 place-items-center rounded-full bg-azul-marino text-subtitle font-bold text-white">
              {iniciales(usuario.nombre_usuario, usuario.apellido_usuario)}
            </span>
            <div className="flex flex-col gap-0.5">
              <p className="text-body font-bold text-azul-marino">
                {usuario.nombre_usuario} {usuario.apellido_usuario}
              </p>
              <p className="text-small text-gris-azulado">{institucional ? 'Cuenta institucional' : `Usuario registrado desde ${desde}`}</p>
            </div>
            {institucional && (
              <span className="rounded-[14px] bg-azul-marino/10 px-3 py-1.5 text-caption font-semibold text-azul-marino">{descripcionRol(usuario.nombre_rol)}</span>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Entrada variante="perfil" etiqueta="Nombre" error={e.nombre_usuario?.message} {...register('nombre_usuario')} />
            <Entrada variante="perfil" etiqueta="Apellido" error={e.apellido_usuario?.message} {...register('apellido_usuario')} />
            <Entrada
              variante="perfil"
              etiqueta={institucional ? 'Correo institucional' : 'Correo electrónico'}
              type="email"
              autoComplete="email"
              error={e.correo?.message}
              {...register('correo')}
            />
            <Entrada variante="perfil" etiqueta="Ciudad" {...register('ciudad')} />
            <Entrada variante="perfil" etiqueta="Apodo" className="sm:col-span-2" error={e.apodo_usuario?.message} {...register('apodo_usuario')} />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-0.5">
              <p className="text-small font-semibold text-azul-marino">Contraseña</p>
              <p className="text-small text-gris-azulado">Al cambiarla se cierran tus otras sesiones abiertas.</p>
            </div>
            <button type="button" onClick={() => setModal('contrasena')} className={`h-[45px] px-5 text-small ${botonClaro}`}>
              Cambiar contraseña
            </button>
          </div>
        </section>

        {!esAdmin && (
          <div className="flex flex-col gap-6">
            <section className={TARJETA}>
              <EncabezadoTarjeta titulo="Mis intereses" detalle="Recibirás alertas solo de lo que marques." />
              <SelectorIntereses categorias={categorias} seleccion={intereses} onCambiar={setIntereses} />
            </section>
            <section className={TARJETA}>
              <EncabezadoTarjeta titulo="Alertas por correo" detalle="¿Con qué frecuencia quieres recibirlas?" />
              <fieldset className="flex flex-col gap-5">
                <legend className="sr-only">Frecuencia de las alertas</legend>
                {FRECUENCIAS.map((f) => (
                  <label
                    key={f.valor}
                    className="flex cursor-pointer items-center gap-3 rounded-[10px] border border-[#d1d9e3] bg-white px-3.5 py-3 has-checked:border-rojo-vivo has-checked:bg-rojo-vivo/6"
                  >
                    <input type="radio" value={f.valor} className="peer sr-only" {...register('frecuencia_alertas')} />
                    <span
                      aria-hidden
                      className="grid size-[22px] shrink-0 place-items-center rounded-full border-[1.5px] border-[#d1d9e3] bg-white peer-checked:border-rojo-vivo peer-checked:[&>span]:block peer-focus-visible:outline-2 peer-focus-visible:outline-azul-oscuro"
                    >
                      <span className="hidden size-3 rounded-full bg-rojo-vivo" />
                    </span>
                    <span className="flex flex-col gap-0.5">
                      <span className="text-small font-semibold text-azul-marino">{f.titulo}</span>
                      <span className="text-small text-gris-azulado">{f.detalle}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
            </section>
          </div>
        )}
      </div>
    </form>

      {modal === 'contrasena' && <CambiarContrasena onCerrar={() => setModal(null)} onListo={() => setModal('contrasena-lista')} />}
      <Aviso abierto={modal === 'contrasena-lista'} titulo="Contraseña actualizada" mensaje="Tu contraseña se cambió correctamente." onCerrar={() => setModal(null)} />
      <Aviso abierto={modal === 'guardado'} titulo="Perfil actualizado" mensaje="Tus datos se guardaron correctamente." onCerrar={() => setModal(null)} />
    </>
  );
}
