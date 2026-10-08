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
import { Entrada, Selector } from '../../componentes/ui/Campos';
import { Tarjeta } from '../../componentes/ui/Elementos';
import { Aviso, Modal } from '../../componentes/ui/Modal';
import { descripcionRol, useSesion } from '../../sesion/sesion';
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

const FRECUENCIAS: { valor: FrecuenciaAlertas; texto: string }[] = [
  { valor: 'Inmediata', texto: 'Inmediata: apenas se publique algo de mi interés' },
  { valor: 'Semanal', texto: 'Semanal: un resumen cada semana' },
  { valor: 'Ninguna', texto: 'No quiero recibir alertas' },
];

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

  // Los modales van fuera del <form>: los eventos de un portal suben por el árbol de React.
  return (
    <>
    <form noValidate onSubmit={handleSubmit((d) => guardar.mutate(d))}>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[24px] font-bold text-azul-titulo sm:text-titulo">Mi perfil</h1>
          <p className="text-small text-texto-suave">Actualiza tus datos y tus preferencias en el Observatorio.</p>
        </div>
        <div className="flex gap-3">
          <Boton variante="secundario" onClick={cancelar}>
            Cancelar
          </Boton>
          <Boton type="submit" cargando={guardar.isPending}>
            Guardar cambios
          </Boton>
        </div>
      </div>
      {guardar.error && !e.correo && (
        <p role="alert" className="mb-4 rounded-lg bg-rojo-claro px-4 py-3 text-caption text-rojo">
          {mensajeDeError(guardar.error)}
        </p>
      )}

      <Tarjeta className="flex flex-col gap-5 p-5 sm:p-6">
        <div>
          <h2 className="font-bold text-azul-titulo">Mis datos</h2>
          <p className="text-[12px] text-texto-suave">Tu información en el Observatorio.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-full bg-azul-oscuro font-bold text-white">{iniciales(usuario.nombre_usuario, usuario.apellido_usuario)}</span>
          <div>
            <p className="font-bold text-azul-titulo">
              {usuario.nombre_usuario} {usuario.apellido_usuario}
            </p>
            <p className="text-[12px] text-texto-suave">{usuario.correo}</p>
          </div>
          <span className="rounded-full bg-[#e8ebf3] px-3 py-1 text-[12px] font-semibold text-azul-titulo">{descripcionRol(usuario.nombre_rol)}</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Entrada etiqueta="Nombre" error={e.nombre_usuario?.message} {...register('nombre_usuario')} />
          <Entrada etiqueta="Apellido" error={e.apellido_usuario?.message} {...register('apellido_usuario')} />
          <Entrada etiqueta="Correo electrónico" type="email" autoComplete="email" error={e.correo?.message} {...register('correo')} />
          <Entrada etiqueta="Ciudad" {...register('ciudad')} />
          <Entrada etiqueta="Apodo" className="sm:col-span-2" error={e.apodo_usuario?.message} {...register('apodo_usuario')} />
        </div>
        <div className="flex flex-col gap-3 border-t border-borde pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-caption font-semibold text-azul-titulo">Contraseña</p>
            <p className="text-[12px] text-texto-suave">Al cambiarla se cierran tus otras sesiones abiertas.</p>
          </div>
          <Boton variante="secundario" tamano="sm" onClick={() => setModal('contrasena')}>
            Cambiar contraseña
          </Boton>
        </div>
      </Tarjeta>

      <Tarjeta className="mt-6 flex flex-col gap-4 p-5 sm:p-6">
        <div>
          <h2 className="font-bold text-azul-titulo">Intereses y alertas</h2>
          <p className="text-[12px] text-texto-suave">Te avisaremos por correo cuando se publique algo de estos temas.</p>
        </div>
        <SelectorIntereses categorias={categorias} seleccion={intereses} onCambiar={setIntereses} />
        <Selector etiqueta="Frecuencia de las alertas" className="sm:max-w-md" opciones={FRECUENCIAS} {...register('frecuencia_alertas')} />
      </Tarjeta>
    </form>

      {modal === 'contrasena' && <CambiarContrasena onCerrar={() => setModal(null)} onListo={() => setModal('contrasena-lista')} />}
      <Aviso abierto={modal === 'contrasena-lista'} titulo="Contraseña actualizada" mensaje="Tu contraseña se cambió correctamente." onCerrar={() => setModal(null)} />
      <Aviso abierto={modal === 'guardado'} titulo="Perfil actualizado" mensaje="Tus datos se guardaron correctamente." onCerrar={() => setModal(null)} />
    </>
  );
}
