import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { mensajeDeError } from '../../api/cliente';
import { useAccionInvitacion } from '../../api/invitaciones';
import type { Empresa } from '../../api/tipos';
import { Boton } from '../../componentes/ui/Boton';
import { Entrada } from '../../componentes/ui/Campos';
import { Aviso, Modal } from '../../componentes/ui/Modal';

const esquema = z.object({
  nombre_contacto: z.string().trim().min(1, 'Escribe el nombre').max(50),
  apellido_contacto: z.string().trim().min(1, 'Escribe el apellido').max(50),
  correo: z.email('Escribe un correo válido'),
});
type Datos = z.infer<typeof esquema>;

/**
 * Invita a una empresa ya creada (formulario o carga masiva). La empresa sigue oculta
 * hasta que acepta la invitación, autoriza el uso de sus datos y su marca y completa su ficha.
 */
export function ModalInvitarEmpresa({ empresa, nombre, abierto, onCerrar }: { empresa: Empresa; nombre: string; abierto: boolean; onCerrar: () => void }) {
  const principal = empresa.contactos.find((c) => c.es_principal) ?? empresa.contactos[0];
  const [nombreContacto = '', ...resto] = (principal?.nombre ?? '').split(' ');
  const { register, handleSubmit, formState } = useForm<Datos>({
    resolver: zodResolver(esquema),
    values: { nombre_contacto: nombreContacto, apellido_contacto: resto.join(' '), correo: principal?.correo ?? '' },
  });
  const accion = useAccionInvitacion();
  const cliente = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [enviada, setEnviada] = useState<boolean | null>(null);

  const enviar = handleSubmit(async (d) => {
    setError(null);
    try {
      const inv = await accion.mutateAsync({ tipo: 'crear', datos: { ...d, nombre_empresa: nombre, id_ec: empresa.id_ec } });
      setEnviada(inv.correo_enviado !== false);
      await cliente.invalidateQueries({ queryKey: ['/empresas'] });
    } catch (err) {
      setError(mensajeDeError(err));
    }
  });

  if (enviada !== null) {
    return (
      <Aviso
        abierto
        titulo="Invitación enviada"
        mensaje={enviada
          ? 'La empresa recibió el enlace por correo. Se publicará cuando acepte la invitación y complete su ficha.'
          : 'La invitación quedó registrada, pero el correo no se pudo enviar. Reenvíala desde «Invitar empresas».'}
        onCerrar={() => {
          setEnviada(null);
          onCerrar();
        }}
      />
    );
  }

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo="Enviar invitación"
      subtitulo={`${nombre} se publicará en el directorio cuando acepte la invitación, autorice el uso de sus datos y su marca y complete su ficha.`}
      ancho={520}
    >
      <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Entrada etiqueta="Nombre del contacto" obligatorio error={formState.errors.nombre_contacto?.message} {...register('nombre_contacto')} />
          <Entrada etiqueta="Apellido del contacto" obligatorio error={formState.errors.apellido_contacto?.message} {...register('apellido_contacto')} />
        </div>
        <Entrada etiqueta="Correo del contacto" obligatorio type="email" error={formState.errors.correo?.message} {...register('correo')} />
        {error && <p role="alert" className="rounded-lg bg-rojo-claro px-4 py-3 text-caption text-rojo">{error}</p>}
        <div className="flex justify-end gap-2.5">
          <button type="button" onClick={onCerrar} className="h-[42px] cursor-pointer rounded-lg border border-[#e2e8f0] px-5 text-body font-semibold text-[#64748b] hover:bg-fondo">
            Cancelar
          </button>
          <Boton type="submit" pildora className="bg-rojo-vivo! text-small! shadow-none!" cargando={formState.isSubmitting}>
            Enviar invitación
          </Boton>
        </div>
      </form>
    </Modal>
  );
}
