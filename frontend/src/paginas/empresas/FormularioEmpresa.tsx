import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router';
import { z } from 'zod';
import { ErrorApi, api, mensajeDeError } from '../../api/cliente';
import { useDetalle, useGuardar, useSubirImagen } from '../../api/consultas';
import { TAMANOS, type Empresa } from '../../api/tipos';
import iconoDocumento from '../../assets/figma/perfil/documento.svg';
import iconoEtiqueta from '../../assets/figma/perfil/etiqueta.svg';
import { CampoImagen, useVistaPrevia } from '../../componentes/contenido/Controles';
import { Boton } from '../../componentes/ui/Boton';
import { AreaTexto, Entrada, Selector } from '../../componentes/ui/Campos';
import { Cargando, MensajeError } from '../../componentes/ui/Elementos';
import { Aviso, Confirmacion } from '../../componentes/ui/Modal';
import { DEPARTAMENTOS } from '../../utilidades/colombia';
import { useResumenEmpresas } from './DirectorioEmpresas';
import { Migas, TARJETA } from './PerfilEmpresa';

const NATURALEZAS = ['Privada', 'Pública', 'Mixta', 'Sin ánimo de lucro'].map((n) => ({ valor: n, texto: n }));
const entero = z.string().regex(/^\d*$/, 'Escribe solo números');
const correoOpcional = z.union([z.literal(''), z.email('Correo inválido')]);

const esquema = z.object({
  descripcion: z.string().trim(),
  razon_social: z.string().trim().min(1, 'Escribe la razón social').max(150),
  nombre_comercial: z.string().trim().max(100),
  nit: z.string().trim().min(1, 'Escribe el NIT').max(20),
  sector_economico: z.string().trim().min(1, 'Escribe el sector').max(50),
  naturaleza_juridica: z.string(),
  tamano_empresa: z.string(),
  departamento: z.string().min(1, 'Elige el departamento'),
  municipio: z.string().trim().min(1, 'Escribe el municipio').max(60),
  direccion: z.string().trim().max(150),
  telefono: z.string().trim().max(20),
  correo: correoOpcional,
  link: z.union([z.literal(''), z.url('Escribe un enlace válido (https://...)')]),
  codigo_ciiu: z.string().trim().max(30),
  anio_constitucion: z.string().regex(/^(\d{4})?$/, 'Escribe un año de 4 dígitos'),
  estudiantes_recibidos: entero,
  premios_recibidos: entero,
  tiempo_coformadora: z.string().trim().max(20),
  estado_ec: z.enum(['Activo', 'Inactivo']),
  contacto_nombre: z.string().trim().min(1, 'Escribe el nombre del contacto').max(100),
  contacto_cargo: z.string().trim().max(100),
  contacto_correo: z.email('Escribe un correo válido'),
  contacto_telefono: z.string().trim().min(1, 'Escribe el teléfono del contacto').max(20),
});
type Datos = z.infer<typeof esquema>;

function valoresIniciales(e?: Empresa): Datos {
  const c = e?.contactos.find((x) => x.es_principal) ?? e?.contactos[0];
  return {
    descripcion: e?.descripcion ?? '',
    razon_social: e?.razon_social ?? '',
    nombre_comercial: e?.nombre_comercial ?? '',
    nit: e?.nit ?? '',
    sector_economico: e?.sector_economico ?? '',
    naturaleza_juridica: e?.naturaleza_juridica ?? '',
    tamano_empresa: e?.tamano_empresa ?? '',
    departamento: e?.departamento ?? '',
    municipio: e?.municipio ?? '',
    direccion: e?.direccion ?? '',
    telefono: e?.telefono ?? '',
    correo: e?.correo ?? '',
    link: e?.link ?? '',
    codigo_ciiu: e?.codigo_ciiu ?? '',
    anio_constitucion: e?.anio_constitucion ? String(e.anio_constitucion) : '',
    estudiantes_recibidos: String(e?.estudiantes_recibidos ?? 0),
    premios_recibidos: String(e?.premios_recibidos ?? 0),
    tiempo_coformadora: e?.tiempo_coformadora ?? '',
    estado_ec: e?.estado_ec ?? 'Activo',
    contacto_nombre: c?.nombre ?? '',
    contacto_cargo: c?.cargo ?? '',
    contacto_correo: c?.correo ?? '',
    contacto_telefono: c?.telefono ?? '',
  };
}

/** Página para crear o editar una empresa (Figma: "Nueva empresa" y "Editar empresa"). */
export function FormularioEmpresa() {
  const { id } = useParams();
  const idEmpresa = id ? Number(id) : undefined;
  const { data: empresa, isLoading, error } = useDetalle<Empresa>('/empresas', idEmpresa);
  if (idEmpresa && isLoading) return <Cargando />;
  if (idEmpresa && (error || !empresa)) return <MensajeError mensaje={error ? mensajeDeError(error) : 'No encontramos esta empresa.'} />;
  return <Formulario key={empresa?.id_ec ?? 'nueva'} empresa={empresa} />;
}

function Formulario({ empresa }: { empresa?: Empresa }) {
  const navegar = useNavigate();
  const cliente = useQueryClient();
  const { data: resumen } = useResumenEmpresas();
  const guardarApi = useGuardar<Empresa>('/empresas');
  const subirImagen = useSubirImagen('/empresas');
  const [portada, setPortada] = useState<File | null>(null);
  const [logo, setLogo] = useState<File | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  const [guardada, setGuardada] = useState<number | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const editar = !!empresa;
  // Si la empresa se creó pero falló un paso posterior (contacto, imágenes), el reintento la edita.
  const [creada, setCreada] = useState<number | undefined>(undefined);
  const vistaPortada = useVistaPrevia(portada);

  const { register, handleSubmit, getValues, setError, formState } = useForm<Datos>({
    resolver: zodResolver(esquema),
    defaultValues: valoresIniciales(empresa),
  });
  const e = formState.errors;

  const guardar = async () => {
    const d = getValues();
    setTrabajando(true);
    setErrorGeneral(null);
    try {
      const datos = {
        descripcion: d.descripcion,
        razon_social: d.razon_social,
        nombre_comercial: d.nombre_comercial,
        nit: d.nit,
        sector_economico: d.sector_economico,
        naturaleza_juridica: d.naturaleza_juridica,
        tamano_empresa: d.tamano_empresa || null,
        departamento: d.departamento,
        municipio: d.municipio,
        direccion: d.direccion,
        telefono: d.telefono,
        correo: d.correo || null,
        link: d.link || null,
        codigo_ciiu: d.codigo_ciiu,
        anio_constitucion: d.anio_constitucion ? Number(d.anio_constitucion) : null,
        estudiantes_recibidos: Number(d.estudiantes_recibidos || 0),
        premios_recibidos: Number(d.premios_recibidos || 0),
        tiempo_coformadora: d.tiempo_coformadora,
        estado_ec: d.estado_ec,
      };
      const guardadaApi = await guardarApi.mutateAsync({ id: empresa?.id_ec ?? creada, datos });
      const idEc = guardadaApi.id_ec;
      setCreada(idEc);

      const contacto = {
        nombre: d.contacto_nombre,
        cargo: d.contacto_cargo,
        correo: d.contacto_correo,
        telefono: d.contacto_telefono,
        es_principal: true,
      };
      const actual =
        empresa?.contactos.find((c) => c.es_principal) ??
        empresa?.contactos[0] ??
        (await api<Empresa>(`/empresas/${idEc}`)).contactos[0];
      if (actual) await api(`/empresas/${idEc}/contactos/${actual.id_contacto}`, { metodo: 'PATCH', cuerpo: contacto });
      else await api(`/empresas/${idEc}/contactos`, { metodo: 'POST', cuerpo: contacto });

      if (portada) await subirImagen.mutateAsync({ id: idEc, campo: 'imagen_portada', archivo: portada });
      if (logo) await subirImagen.mutateAsync({ id: idEc, campo: 'logo_ec', archivo: logo });
      await cliente.invalidateQueries({ queryKey: ['/empresas'] });
      setGuardada(idEc);
    } catch (err) {
      if (err instanceof ErrorApi) {
        for (const [campo, mensaje] of Object.entries(err.erroresPorCampo)) {
          if (campo in esquema.shape) setError(campo as keyof Datos, { message: mensaje });
        }
      }
      setErrorGeneral(mensajeDeError(err));
    } finally {
      setTrabajando(false);
      setConfirmar(false);
    }
  };

  const alEnviar = handleSubmit(() => (editar ? setConfirmar(true) : guardar()));
  const cancelar = () => navegar(editar ? `/empresas/${empresa.id_ec}` : '/empresas');
  const portadaActual = vistaPortada ?? empresa?.imagen_portada ?? null;

  return (
    <form onSubmit={alEnviar} noValidate>
      <Migas actual={editar ? 'Editar empresa' : 'Nueva empresa'} />
      <section className={`overflow-hidden ${TARJETA}`}>
        <div className="relative h-[150px] bg-[#e3e8f0] sm:h-[185px]">
          {portadaActual && <img src={portadaActual} alt="" className="size-full object-cover" />}
          <label className="absolute right-5 top-4 inline-flex h-[41px] cursor-pointer items-center whitespace-pre rounded-full border border-[#d1d9e3] bg-white px-5 text-small font-semibold text-azul-marino hover:bg-fondo sm:right-[34px] sm:top-6">
            {portadaActual ? '📷  Cambiar portada' : '📷  Subir portada'}
            <input type="file" accept="image/png,image/jpeg" className="sr-only" onChange={(ev) => setPortada(ev.target.files?.[0] ?? null)} />
          </label>
        </div>
        <div className="flex flex-col gap-4 px-5 py-6 sm:min-h-[153px] sm:flex-row sm:items-end sm:justify-between sm:px-8">
          <div className="flex flex-col gap-2">
            <h1 className="text-[24px] font-extrabold text-[#0a1c40] sm:text-titulo">{editar ? 'Editar empresa coformadora' : 'Nueva empresa coformadora'}</h1>
            <p className="flex items-center gap-1.5 text-small text-[#788fad] sm:text-body">
              <img src={iconoEtiqueta} alt="" aria-hidden className="size-3.5" />
              {editar ? 'Actualiza los datos de la empresa' : 'Completa los datos para registrar la empresa'}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={cancelar}
              className="h-[41px] cursor-pointer rounded-full border border-[#d1d9e3] bg-white px-5 text-small font-semibold text-azul-marino hover:bg-fondo"
            >
              Cancelar
            </button>
            <Boton type="submit" pildora className="h-[39px]! bg-rojo-vivo! px-5! text-small! shadow-none!" cargando={trabajando && !confirmar}>
              {editar ? 'Guardar cambios' : 'Guardar nuevo registro'}
            </Boton>
          </div>
        </div>
      </section>

      {errorGeneral && (
        <p role="alert" className="mt-4 rounded-lg bg-rojo-claro px-4 py-3 text-caption text-rojo">
          {errorGeneral}
        </p>
      )}

      <div className="mt-6 grid items-start gap-4 lg:grid-cols-[1fr_300px] xl:mt-[43px] xl:grid-cols-[1fr_400px]">
        <section className={`flex flex-col gap-4 p-5 sm:p-8 ${TARJETA}`}>
          <h2 className="flex items-center gap-2.5 text-subtitle font-extrabold text-[#0a1c40]">
            <img src={iconoDocumento} alt="" aria-hidden className="size-[18px]" /> Información de la empresa
          </h2>
          <AreaTexto etiqueta="Descripción de la empresa" rows={3} placeholder="Breve descripción de la empresa, su actividad principal y su enfoque." {...register('descripcion')} />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Entrada etiqueta="Razón social" obligatorio placeholder="Ej. TecnoSoluciones S.A.S." error={e.razon_social?.message} {...register('razon_social')} />
            <Entrada etiqueta="Nombre comercial" placeholder="Ej. TecnoSoluciones" {...register('nombre_comercial')} />
            <Entrada etiqueta="NIT" obligatorio placeholder="900.000.000-0" error={e.nit?.message} {...register('nit')} />
            <Entrada etiqueta="Sector" obligatorio placeholder="Selecciona el sector" list="sectores" error={e.sector_economico?.message} {...register('sector_economico')} />
            <Selector etiqueta="Tipo de empresa" vacio="Selecciona el tipo" opciones={NATURALEZAS} {...register('naturaleza_juridica')} />
            <Selector etiqueta="Tamaño" vacio="Selecciona el tamaño" opciones={TAMANOS.map((t) => ({ valor: t, texto: t }))} {...register('tamano_empresa')} />
            <Selector etiqueta="Departamento" obligatorio vacio="Selecciona el departamento" opciones={DEPARTAMENTOS} error={e.departamento?.message} {...register('departamento')} />
            <Entrada etiqueta="Municipio" obligatorio placeholder="Selecciona el municipio" error={e.municipio?.message} {...register('municipio')} />
            <Entrada etiqueta="Dirección" placeholder="Ej. Cra 43A # 5-10" {...register('direccion')} />
            <Entrada etiqueta="Teléfono" placeholder="Ej. (604) 444 1234" {...register('telefono')} />
            <Entrada etiqueta="Correo electrónico" type="email" placeholder="Ej. info@empresa.com" error={e.correo?.message} {...register('correo')} />
            <Entrada etiqueta="Sitio web" placeholder="https://www.empresa.com" error={e.link?.message} {...register('link')} />
            <Entrada etiqueta="Año de constitución" inputMode="numeric" placeholder="Ej. 2015" error={e.anio_constitucion?.message} {...register('anio_constitucion')} />
            <Selector etiqueta="Estado de la empresa" opciones={[{ valor: 'Activo', texto: 'Activa' }, { valor: 'Inactivo', texto: 'Inactiva' }]} {...register('estado_ec')} />
            <Entrada etiqueta="Código CIIU" placeholder="Ej. 6201" {...register('codigo_ciiu')} />
            <Entrada etiqueta="Estudiantes recibidos" inputMode="numeric" placeholder="Ej. 24" error={e.estudiantes_recibidos?.message} {...register('estudiantes_recibidos')} />
            <Entrada etiqueta="Premios recibidos" inputMode="numeric" placeholder="Ej. 3" error={e.premios_recibidos?.message} {...register('premios_recibidos')} />
            <Entrada etiqueta="Tiempo como coformadora" placeholder="Ej. 7 años" {...register('tiempo_coformadora')} />
          </div>
          <datalist id="sectores">
            {(resumen?.por_sector ?? []).map((s) => (
              <option key={s.sector} value={s.sector} />
            ))}
          </datalist>
          <CampoImagen etiqueta="Logo de la empresa" actual={empresa?.logo_ec} archivo={logo} onCambiar={setLogo} />
        </section>

        <section aria-labelledby="titulo-contacto" className={`flex flex-col gap-5 p-6 ${TARJETA}`}>
          <h2 id="titulo-contacto" className="text-body font-extrabold text-[#0a1c40]">Contacto principal</h2>
          <div className="flex flex-col gap-2.5">
            <Entrada etiqueta="Nombre completo" obligatorio placeholder="Nombre y apellidos" error={e.contacto_nombre?.message} {...register('contacto_nombre')} />
            <Entrada etiqueta="Cargo" placeholder="Ej. Gerente general" {...register('contacto_cargo')} />
            <Entrada etiqueta="Correo corporativo" obligatorio type="email" placeholder="nombre@empresa.com" error={e.contacto_correo?.message} {...register('contacto_correo')} />
            <Entrada etiqueta="Teléfono" obligatorio placeholder="+57 300 000 0000" error={e.contacto_telefono?.message} {...register('contacto_telefono')} />
            <p className="text-caption text-[#788fad]">Los campos marcados con * son obligatorios.</p>
          </div>
        </section>
      </div>

      <Confirmacion
        abierto={confirmar}
        titulo="Editar empresa"
        pregunta="¿Está seguro de que desea editar esta empresa?"
        detalle="Esta acción actualizará la información de la empresa y los cambios podrán visualizarse en el Observatorio Empresarial."
        textoConfirmar="Editar empresa"
        cargando={trabajando}
        onConfirmar={guardar}
        onCancelar={() => setConfirmar(false)}
      />
      <Aviso
        abierto={guardada !== null}
        titulo={editar ? 'Empresa editada' : 'Empresa creada'}
        mensaje={editar ? 'La empresa se editó correctamente.' : 'La empresa se creó correctamente.'}
        detalle="Los cambios ya se pueden visualizar en el Observatorio Empresarial."
        onCerrar={() => navegar(`/empresas/${guardada}`)}
      />
    </form>
  );
}
