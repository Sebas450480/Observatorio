import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import { api, mensajeDeError } from '../../api/cliente';
import { Boton } from '../../componentes/ui/Boton';
import { Entrada } from '../../componentes/ui/Campos';
import { Aviso } from '../../componentes/ui/Modal';
import { PantallaAuth } from './PantallaAuth';

const esquema = z
  .object({ contrasena: z.string().min(8, 'Mínimo 8 caracteres').max(72), confirmar: z.string() })
  .refine((d) => d.contrasena === d.confirmar, { message: 'Las contraseñas no coinciden', path: ['confirmar'] });

/** Página del enlace que llega por correo: /restablecer-contrasena?codigo=... */
export function RestablecerContrasena() {
  const [parametros] = useSearchParams();
  const codigo = parametros.get('codigo') ?? '';
  const [listo, setListo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navegar = useNavigate();
  const { register, handleSubmit, formState } = useForm<z.infer<typeof esquema>>({
    resolver: zodResolver(esquema),
    defaultValues: { contrasena: '', confirmar: '' },
  });

  const enviar = handleSubmit(async ({ contrasena }) => {
    setError(null);
    try {
      await api('/auth/restablecer', { metodo: 'POST', cuerpo: { codigo, contrasena } });
      setListo(true);
    } catch (e) {
      setError(mensajeDeError(e));
    }
  });

  return (
    <PantallaAuth>
      <h1 className="text-[26px] font-bold text-azul-titulo">Crea una nueva contraseña</h1>
      {!codigo ? (
        <p className="mt-4 rounded-lg bg-rojo-claro px-4 py-3 text-caption text-rojo">
          El enlace está incompleto. <Link to="/recuperar-contrasena" className="font-bold underline">Solicita uno nuevo</Link>.
        </p>
      ) : (
        <form onSubmit={enviar} noValidate className="mt-7 flex flex-col gap-5">
          <Entrada
            etiqueta="Nueva contraseña"
            type="password"
            autoComplete="new-password"
            error={formState.errors.contrasena?.message}
            {...register('contrasena')}
          />
          <Entrada
            etiqueta="Confirmar contraseña"
            type="password"
            autoComplete="new-password"
            error={formState.errors.confirmar?.message}
            {...register('confirmar')}
          />
          {error && (
            <p role="alert" className="rounded-lg bg-rojo-claro px-4 py-3 text-caption text-rojo">
              {error} <Link to="/recuperar-contrasena" className="font-bold underline">Solicitar otro enlace</Link>
            </p>
          )}
          <Boton type="submit" tamano="lg" cargando={formState.isSubmitting}>
            Guardar contraseña
          </Boton>
        </form>
      )}
      <Aviso
        abierto={listo}
        titulo="Contraseña actualizada"
        mensaje="Tu contraseña se cambió correctamente."
        detalle="Ya puedes iniciar sesión con tu nueva contraseña."
        onCerrar={() => navegar('/iniciar-sesion')}
      />
    </PantallaAuth>
  );
}
