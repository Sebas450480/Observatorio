import { zodResolver } from '@hookform/resolvers/zod';
import { LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router';
import { z } from 'zod';
import { mensajeDeError } from '../../api/cliente';
import { Casilla, Entrada } from '../../componentes/ui/Campos';
import { useSesion } from '../../sesion/sesion';
import { BOTON_AUTH, EncabezadoAuth, ErrorAuth, PantallaAuth } from './PantallaAuth';

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
      <EncabezadoAuth titulo="Bienvenido de nuevo">Ingresa tus credenciales para acceder</EncabezadoAuth>
      <form onSubmit={enviar} noValidate className="flex flex-col gap-6">
        <div className="flex flex-col gap-[18px]">
          <Entrada
            variante="acceso"
            etiqueta="Correo electrónico"
            type="email"
            autoComplete="email"
            placeholder="usuario@ejemplo.com"
            error={formState.errors.correo?.message}
            {...register('correo')}
          />
          <Entrada
            variante="acceso"
            etiqueta="Contraseña"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••••"
            error={formState.errors.contrasena?.message}
            {...register('contrasena')}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Casilla etiqueta="Recordar sesión" {...register('recordar')} />
          <Link to="/recuperar-contrasena" className="text-small font-semibold text-azul-marino hover:underline">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
        {error && <ErrorAuth>{error}</ErrorAuth>}
        <button type="submit" disabled={formState.isSubmitting} className={`${BOTON_AUTH.principal} h-[54px]`}>
          {formState.isSubmitting && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
          Ingresar al portal
        </button>
      </form>
      <hr className="border-[#e8ebf2]" />
      <p className="text-center text-small text-gris-azulado">
        ¿No tienes una cuenta?{' '}
        <Link to="/registro" className="font-bold text-rojo-vivo hover:underline">
          Regístrate aquí
        </Link>
      </p>
      <Link to="/inicio" className={`${BOTON_AUTH.secundario} h-[52px]`}>
        Explorar como invitado
      </Link>
    </PantallaAuth>
  );
}
