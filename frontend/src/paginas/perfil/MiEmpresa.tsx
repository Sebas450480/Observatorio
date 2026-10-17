import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link } from 'react-router';
import { z } from 'zod';
import { ErrorApi, mensajeDeError } from '../../api/cliente';
import { useGuardarMiEmpresa, useMiEmpresa, type MiEmpresa as Empresa } from '../../api/miEmpresa';
import { TAMANOS } from '../../api/tipos';
import { CampoImagen } from '../../componentes/contenido/Controles';
import { Boton } from '../../componentes/ui/Boton';
import { AreaTexto, Entrada, Selector } from '../../componentes/ui/Campos';
import { Cargando, MensajeError } from '../../componentes/ui/Elementos';
import { Aviso } from '../../componentes/ui/Modal';
import { DEPARTAMENTOS } from '../../utilidades/colombia';
import { enlaceValido, normalizarEnlace } from '../../utilidades/formato';
import { VistaMapa } from '../empresas/RegistroEmpresa';
import { EncabezadoTarjeta, TARJETA } from './TarjetaPerfil';

const correoOpcional = z.union([z.literal(''), z.email('Correo inválido')]);

const esquema = z.object({
  razon_social: z.string().trim().min(1, 'Escribe la razón social').max(150),
  nombre_comercial: z.string().trim().max(100),
  nit: z.string().trim().min(1, 'Escribe el NIT').max(20),
  sector_economico: z.string().trim().min(1, 'Escribe el sector').max(50),
  descripcion: z.string().trim().max(5000),
  tamano_empresa: z.string(),
  anio_constitucion: z.string().regex(/^(\d{4})?$/, 'Escribe un año de 4 dígitos'),
  estudiantes_recibidos: z.string().regex(/^\d+$/, 'Escribe solo números (0 si aún no ha recibido)'),
  link: z.string().refine((v) => !v.trim() || enlaceValido(v), 'Escribe un enlace válido, por ejemplo www.sitio.com'),
  telefono: z.string().trim().max(20),
  correo: correoOpcional,
  departamento: z.string().min(1, 'Elige el departamento'),
  municipio: z.string().trim().min(1, 'Escribe el municipio').max(60),
  direccion: z.string().trim().max(150),
});
type Datos = z.infer<typeof esquema>;

/** Valores provisionales del registro corto: en el formulario se muestran vacíos. */
const provisional = (v: string) => (v === 'Por definir' || v.startsWith('PENDIENTE-') ? '' : v);

const valores = (e: Empresa): Datos => ({
  razon_social: e.razon_social,
  nombre_comercial: e.nombre_comercial ?? '',
  nit: provisional(e.nit),
  sector_economico: provisional(e.sector_economico),
  descripcion: e.descripcion ?? '',
  tamano_empresa: e.tamano_empresa ?? '',
  anio_constitucion: e.anio_constitucion ? String(e.anio_constitucion) : '',
  estudiantes_recibidos: String(e.estudiantes_recibidos ?? 0),
  link: e.link ?? '',
  telefono: e.telefono ?? '',
  correo: e.correo ?? '',
  departamento: provisional(e.departamento),
  municipio: provisional(e.municipio),
  direccion: e.direccion ?? '',
});

/**
 * Mi empresa (rol Empresa Coformadora): en Mi perfil, en lugar de intereses, alertas y
 * favoritos, la cuenta ve y edita en cualquier momento la ficha de su empresa.
 */
export function MiEmpresa() {
  const { data: empresa, isLoading, error, refetch } = useMiEmpresa(true);
  if (isLoading) return <Cargando />;
  if (error || !empresa) {
    return (
      <section className={TARJETA}>
        <EncabezadoTarjeta titulo="Mi empresa" detalle="La ficha de tu empresa en el directorio de empresas coformadoras." />
        {error instanceof ErrorApi && error.estado === 404 ? (
          <p className="rounded-xl bg-fondo px-4 py-6 text-center text-small text-gris-azulado">{error.message}</p>
        ) : (
          <MensajeError mensaje={mensajeDeError(error)} onReintentar={() => refetch()} />
        )}
      </section>
    );
  }
  return <Formulario key={empresa.id_ec} empresa={empresa} />;
}

function Formulario({ empresa }: { empresa: Empresa }) {
  const guardar = useGuardarMiEmpresa();
  const [logo, setLogo] = useState<File | null>(null);
  const [portada, setPortada] = useState<File | null>(null);
  const [guardada, setGuardada] = useState<'actualizada' | 'publicada' | null>(null);
  const { register, handleSubmit, reset, control, setError, formState } = useForm<Datos>({ resolver: zodResolver(esquema), defaultValues: valores(empresa) });
  const [departamento = '', municipio = '', direccion = ''] = useWatch({ control, name: ['departamento', 'municipio', 'direccion'] });
  const e = formState.errors;

  const enviar = handleSubmit(async (d) => {
    try {
      const nueva = await guardar.mutateAsync({
        datos: {
          ...d,
          tamano_empresa: d.tamano_empresa || null,
          anio_constitucion: d.anio_constitucion ? Number(d.anio_constitucion) : null,
          estudiantes_recibidos: Number(d.estudiantes_recibidos),
          link: normalizarEnlace(d.link),
          correo: d.correo || null,
        },
        logo,
        portada,
      });
      reset(valores(nueva));
      setLogo(null);
      setPortada(null);
      setGuardada(empresa.pendiente && !nueva.pendiente ? 'publicada' : 'actualizada');
    } catch (err) {
      if (err instanceof ErrorApi) {
        for (const [campo, mensaje] of Object.entries(err.erroresPorCampo)) {
          if (campo in esquema.shape) setError(campo as keyof Datos, { message: mensaje });
        }
      }
    }
  });

  // El aviso va fuera del <form>: los eventos de un portal suben por el árbol de React.
  return (
    <>
    <form noValidate onSubmit={enviar} className={TARJETA} aria-labelledby="titulo-mi-empresa" data-recorrido="mi-empresa">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div id="titulo-mi-empresa">
          <EncabezadoTarjeta titulo="Mi empresa" detalle="Esta es la ficha de tu empresa en el directorio de empresas coformadoras. Puedes actualizarla cuando quieras." />
        </div>
        {!empresa.pendiente && (
        <Link
          to={`/empresas/${empresa.id_ec}`}
          className="inline-flex h-[45px] shrink-0 items-center justify-center rounded-control border border-[#d1d9e3] bg-white px-5 text-small font-semibold text-azul-marino hover:bg-fondo"
        >
          Ver ficha pública
        </Link>
        )}
      </div>

      {empresa.pendiente && (
        <p role="status" className="rounded-xl border border-[#f5d48a] bg-[#fdf5e1] px-4 py-3 text-small text-[#7a5a00]">
          <strong>Completa la ficha de tu empresa.</strong> Llena los campos obligatorios (NIT, sector y ubicación)
          y una descripción. Cuando la guardes, tu empresa quedará publicada en el directorio de empresas coformadoras.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl bg-fondo px-4 py-3 text-small text-gris-azulado">
        <span>
          Correo de la invitación: <strong className="text-azul-marino [overflow-wrap:anywhere]">{empresa.correo_cuenta}</strong>
        </span>
        <span>
          Estado:{' '}
          <strong className="text-azul-marino">
            {empresa.pendiente ? 'Pendiente: completa la ficha' : empresa.estado_ec === 'Inactivo' ? 'Oculta del directorio' : 'Publicada en el directorio'}
          </strong>
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Entrada etiqueta="Razón social" obligatorio error={e.razon_social?.message} {...register('razon_social')} />
        <Entrada etiqueta="Nombre comercial" {...register('nombre_comercial')} />
        <Entrada etiqueta="NIT" obligatorio error={e.nit?.message} {...register('nit')} />
        <Entrada etiqueta="Sector" obligatorio error={e.sector_economico?.message} {...register('sector_economico')} />
        <Selector etiqueta="Tamaño" vacio="Selecciona el tamaño" opciones={TAMANOS.map((t) => ({ valor: t, texto: t }))} {...register('tamano_empresa')} />
        <Entrada etiqueta="Año de constitución" inputMode="numeric" placeholder="Ej. 2015" error={e.anio_constitucion?.message} {...register('anio_constitucion')} />
        <Entrada etiqueta="Sitio web" placeholder="https://www.empresa.com" error={e.link?.message} {...register('link')} />
        <Entrada etiqueta="Teléfono" placeholder="Ej. (601) 444 1234" {...register('telefono')} />
        <Entrada etiqueta="Correo de contacto" type="email" placeholder="info@empresa.com" error={e.correo?.message} {...register('correo')} />
      </div>
      <AreaTexto etiqueta="Descripción" rows={3} placeholder="Actividad principal y enfoque de la empresa." {...register('descripcion')} />
      <Entrada
        etiqueta="Estudiantes recibidos"
        obligatorio
        inputMode="numeric"
        className="sm:max-w-[320px]"
        ayuda="Número de estudiantes de Uniempresarial que la empresa ha recibido como coformadora (aprendices o practicantes)."
        error={e.estudiantes_recibidos?.message}
        {...register('estudiantes_recibidos')}
      />

      <div className="flex flex-col gap-4 border-t border-[#e5ebf2] pt-5">
        <p className="text-body font-bold text-azul-marino">Ubicación</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Selector etiqueta="Departamento" obligatorio vacio="Selecciona el departamento" opciones={DEPARTAMENTOS} error={e.departamento?.message} {...register('departamento')} />
          <Entrada etiqueta="Municipio" obligatorio error={e.municipio?.message} {...register('municipio')} />
          <Entrada etiqueta="Dirección" placeholder="Ej. Cra 7 # 12-34" {...register('direccion')} />
        </div>
        <VistaMapa departamento={departamento} municipio={municipio} direccion={direccion} />
      </div>

      <div className="grid gap-4 border-t border-[#e5ebf2] pt-5 sm:grid-cols-2">
        <CampoImagen etiqueta="Logo de la empresa" actual={empresa.logo_ec} archivo={logo} onCambiar={setLogo} />
        <CampoImagen etiqueta="Portada del perfil" actual={empresa.imagen_portada} archivo={portada} onCambiar={setPortada} />
      </div>

      {guardar.error && (
        <p role="alert" className="rounded-lg bg-rojo-claro px-4 py-3 text-caption text-rojo">
          {mensajeDeError(guardar.error)}
        </p>
      )}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={() => {
            reset(valores(empresa));
            setLogo(null);
            setPortada(null);
          }}
          className="h-[50px] cursor-pointer rounded-control border border-[#d1d9e3] bg-white px-7 text-body font-semibold text-azul-marino hover:bg-fondo"
        >
          Descartar cambios
        </button>
        <Boton type="submit" cargando={guardar.isPending} className="h-[50px]! rounded-control! bg-rojo-vivo! px-8! text-body! font-bold! shadow-none!">
          {empresa.pendiente ? 'Guardar y publicar' : 'Guardar empresa'}
        </Boton>
      </div>
    </form>

      <Aviso
        abierto={guardada !== null}
        titulo={guardada === 'publicada' ? '¡Ya perteneces a la familia Observatorio Empresarial!' : 'Empresa actualizada'}
        mensaje={guardada === 'publicada' ? 'Tu empresa ya está publicada en el directorio de empresas coformadoras.' : 'La información de tu empresa se guardó correctamente.'}
        detalle={guardada === 'publicada' ? 'Puedes actualizar su información cuando quieras desde Mi perfil.' : 'Los cambios ya se ven en el directorio de empresas coformadoras.'}
        onCerrar={() => setGuardada(null)}
      />
    </>
  );
}
