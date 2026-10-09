import { zodResolver } from '@hookform/resolvers/zod';
import { LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import { z } from 'zod';
import { api, mensajeDeError } from '../../api/cliente';
import { Entrada } from '../../componentes/ui/Campos';
import { Aviso } from '../../componentes/ui/Modal';
import { BOTON_AUTH, EncabezadoAuth, ErrorAuth, PantallaAuth } from './PantallaAuth';

const esquema = z.object({ correo: z.email('Escribe un correo válido') });

export function RecuperarContrasena() {
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navegar = useNavigate();
  const { register, handleSubmit, formState } = useForm<z.infer<typeof esquema>>({
    resolver: zodResolver(esquema),
    defaultValues: { correo: '' },
  });

  const enviar = handleSubmit(async ({ correo }) => {
    setError(null);
    try {
      await api('/auth/recuperar', { metodo: 'POST', cuerpo: { correo } });
      setEnviado(true);
    } catch (e) {
      setError(mensajeDeError(e));
    }
  });

  return (
    <PantallaAuth>
      <EncabezadoAuth titulo="Recupera tu contraseña">
        Ingresa el correo con el que te registraste y te enviaremos un enlace para crear una nueva contraseña.
      </EncabezadoAuth>
      <form onSubmit={enviar} noValidate className="flex flex-col gap-6">
        <Entrada
          variante="acceso"
          etiqueta="Correo electrónico"
          type="email"
          autoComplete="email"
          placeholder="usuario@ejemplo.com"
          error={formState.errors.correo?.message}
          {...register('correo')}
        />
        {error && <ErrorAuth>{error}</ErrorAuth>}
        <button type="submit" disabled={formState.isSubmitting} className={`${BOTON_AUTH.principal} h-[54px]`}>
          {formState.isSubmitting && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
          Enviar enlace
        </button>
      </form>
      <hr className="border-[#e8ebf2]" />
      <Link to="/iniciar-sesion" className="flex items-center justify-center gap-2 text-small font-bold text-azul-marino hover:underline">
        <span aria-hidden>←</span> Volver a iniciar sesión
      </Link>
      <Aviso
        abierto={enviado}
        titulo="Enlace enviado"
        mensaje="Revisa tu correo electrónico."
        detalle="Si el correo está registrado, recibirás un enlace para crear una nueva contraseña en los próximos minutos."
        onCerrar={() => navegar('/iniciar-sesion')}
      />
    </PantallaAuth>
  );
}
