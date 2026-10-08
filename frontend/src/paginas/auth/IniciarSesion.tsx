import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router';
import { z } from 'zod';
import { mensajeDeError } from '../../api/cliente';
import { Boton } from '../../componentes/ui/Boton';
import { Casilla, Entrada } from '../../componentes/ui/Campos';
import { useSesion } from '../../sesion/sesion';
import { PantallaAuth } from './PantallaAuth';

const esquema = z.object({
  correo: z.email('Escribe un correo válido'),
  contrasena: z.string().min(1, 'Escribe tu contraseña'),
  recordar: z.boolean(),
});
type Datos = z.infer<typeof esquema>;

export function IniciarSesion() {
  const { iniciarSesion } = useSesion();
  const navegar = useNavigate();
  const ubicacion = useLocation();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<Datos>({
    resolver: zodResolver(esquema),
    defaultValues: { correo: '', contrasena: '', recordar: true },
  });

  const enviar = handleSubmit(async (datos) => {
    setError(null);
    try {
      await iniciarSesion(datos.correo, datos.contrasena, datos.recordar);
      const destino = (ubicacion.state as { desde?: string } | null)?.desde ?? '/inicio';
      navegar(destino, { replace: true });
    } catch (e) {
      setError(mensajeDeError(e));
    }
  });

  return (
    <PantallaAuth>
      <h1 className="text-[26px] font-bold text-azul-titulo">Bienvenido de nuevo</h1>
      <p className="mt-1 text-small text-texto-suave">Ingresa tus credenciales para acceder</p>
      <form onSubmit={enviar} noValidate className="mt-7 flex flex-col gap-5">
        <Entrada
          etiqueta="Correo electrónico"
          type="email"
          autoComplete="email"
          placeholder="usuario@ejemplo.com"
          error={formState.errors.correo?.message}
          {...register('correo')}
        />
        <Entrada
          etiqueta="Contraseña"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          error={formState.errors.contrasena?.message}
          {...register('contrasena')}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Casilla etiqueta="Recordar sesión" {...register('recordar')} />
          <Link to="/recuperar-contrasena" className="text-caption font-semibold text-azul-titulo hover:underline">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
        {error && (
          <p role="alert" className="rounded-lg bg-rojo-claro px-4 py-3 text-caption text-rojo">
            {error}
          </p>
        )}
        <Boton type="submit" tamano="lg" cargando={formState.isSubmitting}>
          Ingresar al portal
        </Boton>
      </form>
      <hr className="my-6 border-[#eceef1]" />
      <p className="text-center text-caption text-texto-suave">
        ¿No tienes una cuenta?{' '}
        <Link to="/registro" className="font-bold text-rojo hover:underline">
          Regístrate aquí
        </Link>
      </p>
      <Link
        to="/inicio"
        className="mt-5 flex h-[52px] items-center justify-center rounded-control border border-borde font-semibold text-azul-titulo hover:bg-fondo"
      >
        Explorar como invitado
      </Link>
    </PantallaAuth>
  );
}
