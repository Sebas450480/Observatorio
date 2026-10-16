import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { LoaderCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import { mensajeDeError } from '../../api/cliente';
import { completarRegistroEmpresa, useDatosInvitacion } from '../../api/invitaciones';
import { iniciarRecorrido } from '../../componentes/RecorridoGuiado';
import { Casilla, Entrada } from '../../componentes/ui/Campos';
import { CLAVE_SESION, useSesion } from '../../sesion/sesion';
import { BOTON_AUTH, EncabezadoAuth, ErrorAuth, PantallaAuth } from '../auth/PantallaAuth';
import { esquemaContrasena as reglaContrasena } from '../../utilidades/contrasena';
import { RequisitosContrasena } from '../../componentes/ui/RequisitosContrasena';

/** Registro corto: solo la contraseña. La ficha de la empresa se completa después, en Mi perfil. */
const esquema = z
  .object({
    contrasena: reglaContrasena,
    confirmar: z.string(),
  })
  .refine((d) => d.contrasena === d.confirmar, { message: 'Las contraseñas no coinciden', path: ['confirmar'] });
type Datos = z.infer<typeof esquema>;

const BENEFICIOS = [
  'Aparecer en el directorio de empresas coformadoras',
  'Mostrar la ubicación de tu empresa en Google Maps',
  'Recibir novedades del Observatorio Empresarial',
];

/** Devuelve el valor después de una pausa, para no recargar el mapa en cada tecla. */
function useConPausa<T>(valor: T, ms = 800): T {
  const [actual, setActual] = useState(valor);
  useEffect(() => {
    const id = setTimeout(() => setActual(valor), ms);
    return () => clearTimeout(id);
  }, [valor, ms]);
  return actual;
}

export function VistaMapa({ departamento, municipio, direccion }: { departamento: string; municipio: string; direccion: string }) {
  const lugar = useConPausa([direccion.trim(), municipio.trim(), departamento, 'Colombia'].filter(Boolean).join(', '));
  if (!departamento || !municipio.trim()) {
    return <p className="rounded-xl bg-fondo px-4 py-5 text-center text-small text-gris-azulado">Elige el departamento y el municipio para ver la ubicación en el mapa.</p>;
  }
  return (
    <iframe
      title="Vista previa de la ubicación en Google Maps"
      src={`https://maps.google.com/maps?q=${encodeURIComponent(lugar)}&z=${direccion.trim() ? 16 : 12}&hl=es&output=embed`}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
      className="aspect-[16/9] max-h-[320px] w-full rounded-xl border border-[#e2e8f0] bg-[#f1f5f9]"
    />
  );
}

/** Formulario del enlace de invitación: /registro-empresa?codigo=... */
export function RegistroEmpresa() {
  const [parametros] = useSearchParams();
  const codigo = parametros.get('codigo') ?? '';
  const { data: invitacion, isLoading, error: errorInvitacion } = useDatosInvitacion(codigo);

  return (
    <PantallaAuth tituloBeneficios="Como empresa coformadora podrás:" beneficios={BENEFICIOS}>
      <EncabezadoAuth titulo="Estás a un paso de ser parte de nuestra familia">
        Crea tu contraseña para entrar al Observatorio Empresarial. Después te mostramos la plataforma y completas la información de tu empresa.
      </EncabezadoAuth>
      {!codigo ? (
        <ErrorAuth>El enlace está incompleto. Ábrelo de nuevo desde el correo de invitación.</ErrorAuth>
      ) : isLoading ? (
        <div className="flex justify-center py-10">
          <LoaderCircle className="size-6 animate-spin text-azul-marino" aria-label="Cargando" />
        </div>
      ) : errorInvitacion || !invitacion ? (
        <ErrorAuth>{mensajeDeError(errorInvitacion)}</ErrorAuth>
      ) : (
        <Formulario codigo={codigo} contacto={`${invitacion.nombre_contacto} ${invitacion.apellido_contacto}`} correo={invitacion.correo} nombreEmpresa={invitacion.nombre_empresa} />
      )}
      <hr className="border-[#e8ebf2]" />
      <Link to="/inicio" className="flex items-center justify-center gap-2 text-small font-bold text-azul-marino hover:underline">
        <span aria-hidden>←</span> Ir al Observatorio Empresarial
      </Link>
    </PantallaAuth>
  );
}

function Formulario({ codigo, contacto, correo, nombreEmpresa }: { codigo: string; contacto: string; correo: string; nombreEmpresa: string | null }) {
  const navegar = useNavigate();
  const clienteConsultas = useQueryClient();
  const { establecerUsuario } = useSesion();
  const [autoriza, setAutoriza] = useState(false);
  const [errorAutoriza, setErrorAutoriza] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, formState, control } = useForm<Datos>({
    resolver: zodResolver(esquema),
    defaultValues: { contrasena: '', confirmar: '' },
  });
  const clave = useWatch({ control, name: 'contrasena' }) ?? '';
  const e = formState.errors;

  const enviar = handleSubmit(async (d) => {
    if (!autoriza) {
      setErrorAutoriza('Debes autorizar el tratamiento de los datos personales para completar el registro');
      return;
    }
    setError(null);
    try {
      const respuesta = await completarRegistroEmpresa({ codigo, contrasena: d.contrasena, acepta_tratamiento_datos: true });
      // La cuenta nueva queda con la sesión iniciada: se descarta lo consultado como invitado.
      clienteConsultas.removeQueries({ predicate: (q) => q.queryKey[0] !== CLAVE_SESION[0] });
      establecerUsuario(respuesta.usuario);
      // Entra a la plataforma con el recorrido guiado, que termina en la ficha de su empresa.
      iniciarRecorrido();
      navegar('/inicio', { replace: true });
    } catch (err) {
      setError(mensajeDeError(err));
    }
  });

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-5">
      <div className="rounded-xl bg-fondo px-4 py-3 text-small text-gris-azulado">
        {nombreEmpresa && (
          <>
            Empresa: <strong className="text-azul-marino">{nombreEmpresa}</strong>
            <br />
          </>
        )}
        Contacto: <strong className="text-azul-marino">{contacto}</strong>
        <br />
        Correo de ingreso: <strong className="text-azul-marino [overflow-wrap:anywhere]">{correo}</strong>
      </div>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-3 text-body font-bold text-azul-marino">Crea tu contraseña</legend>
        <Entrada etiqueta="Contraseña" obligatorio type="password" autoComplete="new-password" placeholder="Crea una contraseña segura" error={e.contrasena?.message} {...register('contrasena')} />
        <RequisitosContrasena valor={clave} />
        <Entrada etiqueta="Confirmar contraseña" obligatorio type="password" autoComplete="new-password" placeholder="Repite la contraseña" error={e.confirmar?.message} {...register('confirmar')} />
      </fieldset>

      <Casilla
        etiqueta={
          <>
            Autorizo el tratamiento de mis datos personales y los de la empresa según la{' '}
            <a href="/politica-de-datos" target="_blank" rel="noreferrer" className="font-semibold text-azul-marino underline" onClick={(ev) => ev.stopPropagation()}>Política de tratamiento de datos</a> (Ley 1581 de 2012)
          </>
        }
        checked={autoriza}
        error={errorAutoriza}
        onChange={(ev) => {
          setAutoriza(ev.target.checked);
          if (ev.target.checked) setErrorAutoriza(undefined);
        }}
      />

      {error && <ErrorAuth>{error}</ErrorAuth>}
      <button type="submit" disabled={formState.isSubmitting} className={`${BOTON_AUTH.principal} h-[54px]`}>
        {formState.isSubmitting && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
        Crear contraseña y entrar
      </button>
    </form>
  );
}
