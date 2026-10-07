import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import { z } from 'zod';
import { api, mensajeDeError } from '../../api/cliente';
import { Boton } from '../../componentes/ui/Boton';
import { Entrada } from '../../componentes/ui/Campos';
import { Aviso } from '../../componentes/ui/Modal';
import { PantallaAuth } from './PantallaAuth';

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
      <h1 className="text-[26px] font-bold text-azul-titulo">Recuperar contraseña</h1>
      <p className="mt-1 text-small text-texto-suave">
        Escribe el correo de tu cuenta y te enviaremos un enlace para crear una nueva contraseña.
      </p>
      <form onSubmit={enviar} noValidate className="mt-7 flex flex-col gap-5">
        <Entrada
          etiqueta="Correo electrónico"
          type="email"
          autoComplete="email"
          placeholder="usuario@ejemplo.com"
          error={formState.errors.correo?.message}
          {...register('correo')}
        />
        {error && (
          <p role="alert" className="rounded-lg bg-rojo-claro px-4 py-3 text-caption text-rojo">
            {error}
          </p>
        )}
        <Boton type="submit" tamano="lg" cargando={formState.isSubmitting}>
          Enviar enlace
        </Boton>
      </form>
      <p className="mt-6 text-center text-caption text-texto-suave">
        <Link to="/iniciar-sesion" className="font-bold text-azul-titulo hover:underline">
          Volver a iniciar sesión
        </Link>
      </p>
      <Aviso
        abierto={enviado}
        titulo="Enlace enviado"
        mensaje="Revisa tu correo electrónico."
        detalle="Si el correo está registrado, recibirás un enlace para restablecer tu contraseña. El enlace vence en 60 minutos."
        onCerrar={() => navegar('/iniciar-sesion')}
      />
    </PantallaAuth>
  );
}
