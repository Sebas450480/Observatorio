import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { LoaderCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import { ErrorApi, mensajeDeError } from '../../api/cliente';
import { completarRegistroEmpresa, useDatosInvitacion } from '../../api/invitaciones';
import { TAMANOS, type TamanoEmpresa } from '../../api/tipos';
import { AreaTexto, Casilla, Entrada, Selector } from '../../componentes/ui/Campos';
import { Aviso } from '../../componentes/ui/Modal';
import { CLAVE_SESION, useSesion } from '../../sesion/sesion';
import { DEPARTAMENTOS } from '../../utilidades/colombia';
import { BOTON_AUTH, EncabezadoAuth, ErrorAuth, PantallaAuth } from '../auth/PantallaAuth';
import { useResumenEmpresas } from './DirectorioEmpresas';

const ANIO_ACTUAL = new Date().getFullYear();

const esquema = z
  .object({
    contrasena: z.string().min(8, 'Mínimo 8 caracteres').max(72),
    confirmar: z.string(),
    razon_social: z.string().trim().min(1, 'Escribe la razón social').max(150),
    nombre_comercial: z.string().trim().max(100),
    nit: z.string().trim().min(1, 'Escribe el NIT').max(20),
    sector_economico: z.string().trim().min(1, 'Escribe el sector').max(50),
    descripcion: z.string().trim().min(1, 'Describe brevemente la empresa').max(5000),
    tamano_empresa: z.string().min(1, 'Elige el tamaño'),
    anio_constitucion: z
      .string()
      .regex(/^\d{4}$/, 'Escribe un año de 4 dígitos')
      .refine((v) => Number(v) >= 1800 && Number(v) <= ANIO_ACTUAL, `Escribe un año entre 1800 y ${ANIO_ACTUAL}`),
    departamento: z.string().min(1, 'Elige el departamento'),
    municipio: z.string().trim().min(1, 'Escribe el municipio').max(60),
    direccion: z.string().trim().max(150),
    estudiantes_recibidos: z.string().regex(/^\d+$/, 'Escribe solo números (0 si aún no ha recibido)'),
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
    <PantallaAuth ancha tituloBeneficios="Como empresa coformadora podrás:" beneficios={BENEFICIOS}>
      <EncabezadoAuth titulo="Estás a un paso de ser parte de nuestra familia">
        Crea tu contraseña y completa la información de tu empresa en el Observatorio Empresarial.
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
  const { data: resumen } = useResumenEmpresas();
  const [autoriza, setAutoriza] = useState(false);
  const [errorAutoriza, setErrorAutoriza] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [idEmpresa, setIdEmpresa] = useState<number | null>(null);

  const { register, handleSubmit, control, setError: errorCampo, formState } = useForm<Datos>({
    resolver: zodResolver(esquema),
    defaultValues: {
      contrasena: '', confirmar: '', razon_social: nombreEmpresa ?? '', nombre_comercial: '', nit: '', sector_economico: '',
      descripcion: '', tamano_empresa: '', anio_constitucion: '', departamento: '', municipio: '', direccion: '', estudiantes_recibidos: '',
    },
  });
  const [departamento = '', municipio = '', direccion = ''] = useWatch({ control, name: ['departamento', 'municipio', 'direccion'] });
  const e = formState.errors;

  const enviar = handleSubmit(async (d) => {
    if (!autoriza) {
      setErrorAutoriza('Debes autorizar el tratamiento de los datos personales para completar el registro');
      return;
    }
    setError(null);
    try {
      const { confirmar: _confirmar, ...datos } = d;
      const respuesta = await completarRegistroEmpresa({
        ...datos,
        codigo,
        acepta_tratamiento_datos: true,
        tamano_empresa: d.tamano_empresa as TamanoEmpresa,
        anio_constitucion: Number(d.anio_constitucion),
        estudiantes_recibidos: Number(d.estudiantes_recibidos),
      });
      // La cuenta nueva queda con la sesión iniciada: se descarta lo consultado como invitado.
      clienteConsultas.removeQueries({ predicate: (q) => q.queryKey[0] !== CLAVE_SESION[0] });
      establecerUsuario(respuesta.usuario);
      setIdEmpresa(respuesta.id_ec);
    } catch (err) {
      if (err instanceof ErrorApi) {
        for (const [campo, mensaje] of Object.entries(err.erroresPorCampo)) {
          if (campo in esquema.shape) errorCampo(campo as keyof Datos, { message: mensaje });
        }
      }
      setError(mensajeDeError(err));
    }
  });

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-5">
      <div className="rounded-xl bg-fondo px-4 py-3 text-small text-gris-azulado">
        Contacto: <strong className="text-azul-marino">{contacto}</strong>
        <br />
        Correo de ingreso: <strong className="text-azul-marino [overflow-wrap:anywhere]">{correo}</strong>
      </div>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-3 text-body font-bold text-azul-marino">Tu contraseña</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Entrada etiqueta="Contraseña" obligatorio type="password" autoComplete="new-password" placeholder="Mínimo 8 caracteres" error={e.contrasena?.message} {...register('contrasena')} />
          <Entrada etiqueta="Confirmar contraseña" obligatorio type="password" autoComplete="new-password" placeholder="Repite la contraseña" error={e.confirmar?.message} {...register('confirmar')} />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-3 text-body font-bold text-azul-marino">Información de la empresa</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Entrada etiqueta="Razón social" obligatorio placeholder="Ej. TecnoSoluciones S.A.S." error={e.razon_social?.message} {...register('razon_social')} />
          <Entrada etiqueta="Nombre comercial" placeholder="Ej. TecnoSoluciones" {...register('nombre_comercial')} />
          <Entrada etiqueta="NIT" obligatorio placeholder="900.000.000-0" error={e.nit?.message} {...register('nit')} />
          <Entrada etiqueta="Sector" obligatorio placeholder="Ej. Tecnología" list="sectores-registro" error={e.sector_economico?.message} {...register('sector_economico')} />
        </div>
        <datalist id="sectores-registro">
          {(resumen?.por_sector ?? []).map((s) => (
            <option key={s.sector} value={s.sector} />
          ))}
        </datalist>
        <AreaTexto etiqueta="Descripción" obligatorio rows={3} placeholder="Actividad principal y enfoque de la empresa." error={e.descripcion?.message} {...register('descripcion')} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Selector etiqueta="Tamaño" obligatorio vacio="Selecciona el tamaño" opciones={TAMANOS.map((t) => ({ valor: t, texto: t }))} error={e.tamano_empresa?.message} {...register('tamano_empresa')} />
          <Entrada etiqueta="Año de constitución" obligatorio inputMode="numeric" placeholder="Ej. 2015" error={e.anio_constitucion?.message} {...register('anio_constitucion')} />
        </div>
        <Entrada
          etiqueta="Estudiantes recibidos"
          obligatorio
          inputMode="numeric"
          placeholder="Ej. 12"
          ayuda="Número de estudiantes de Uniempresarial que la empresa ha recibido como coformadora (aprendices o practicantes). Escribe 0 si aún no ha recibido."
          error={e.estudiantes_recibidos?.message}
          {...register('estudiantes_recibidos')}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-3 text-body font-bold text-azul-marino">Ubicación</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Selector etiqueta="Departamento" obligatorio vacio="Selecciona el departamento" opciones={DEPARTAMENTOS} error={e.departamento?.message} {...register('departamento')} />
          <Entrada etiqueta="Municipio" obligatorio placeholder="Ej. Bogotá" error={e.municipio?.message} {...register('municipio')} />
        </div>
        <Entrada etiqueta="Dirección" placeholder="Ej. Cra 7 # 12-34" {...register('direccion')} />
        <VistaMapa departamento={departamento} municipio={municipio} direccion={direccion} />
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
        Completar registro
      </button>

      <Aviso
        abierto={idEmpresa !== null}
        titulo="Registro completado"
        mensaje="¡Ya perteneces a la familia Observatorio Empresarial!"
        detalle="Tu empresa ya aparece en el directorio de empresas coformadoras y tu cuenta quedó con la sesión iniciada."
        onCerrar={() => navegar(`/empresas/${idEmpresa}`, { replace: true })}
      />
    </form>
  );
}
