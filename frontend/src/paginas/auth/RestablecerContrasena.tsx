import { zodResolver } from '@hookform/resolvers/zod';
import { LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import { api, mensajeDeError } from '../../api/cliente';
import { Entrada } from '../../componentes/ui/Campos';
import { Aviso } from '../../componentes/ui/Modal';
import { BOTON_AUTH, EncabezadoAuth, ErrorAuth, PantallaAuth } from './PantallaAuth';

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
      <EncabezadoAuth titulo="Crea una nueva contraseña">Escribe y confirma la contraseña con la que ingresarás al portal.</EncabezadoAuth>
      {!codigo ? (
        <ErrorAuth>
          El enlace está incompleto. <Link to="/recuperar-contrasena" className="font-bold underline">Solicita uno nuevo</Link>.
        </ErrorAuth>
      ) : (
        <form onSubmit={enviar} noValidate className="flex flex-col gap-6">
          <div className="flex flex-col gap-[18px]">
            <Entrada
              variante="acceso"
              etiqueta="Nueva contraseña"
              type="password"
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
              error={formState.errors.contrasena?.message}
              {...register('contrasena')}
            />
            <Entrada
              variante="acceso"
              etiqueta="Confirmar contraseña"
              type="password"
              autoComplete="new-password"
              placeholder="Repite la contraseña"
              error={formState.errors.confirmar?.message}
              {...register('confirmar')}
            />
          </div>
          {error && (
            <ErrorAuth>
              {error} <Link to="/recuperar-contrasena" className="font-bold underline">Solicitar otro enlace</Link>
            </ErrorAuth>
          )}
          <button type="submit" disabled={formState.isSubmitting} className={`${BOTON_AUTH.principal} h-[54px]`}>
            {formState.isSubmitting && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
            Guardar contraseña
          </button>
        </form>
      )}
      <hr className="border-[#e8ebf2]" />
      <Link to="/iniciar-sesion" className="flex items-center justify-center gap-2 text-small font-bold text-azul-marino hover:underline">
        <span aria-hidden>←</span> Volver a iniciar sesión
      </Link>
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
