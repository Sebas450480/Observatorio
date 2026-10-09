import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { mensajeDeError, urlDescarga } from '../../api/cliente';
import { registrarActividad, useDetalle, useEliminar } from '../../api/consultas';
import type { Empresa } from '../../api/tipos';
import actividad14 from '../../assets/figma/perfil/actividad-14.svg';
import actividad16 from '../../assets/figma/perfil/actividad-16.svg';
import calendario16 from '../../assets/figma/perfil/calendario-16.svg';
import compartir14 from '../../assets/figma/perfil/compartir-14.svg';
import contacto14 from '../../assets/figma/perfil/contacto-14.svg';
import correo16 from '../../assets/figma/perfil/correo-16.svg';
import descargar14 from '../../assets/figma/perfil/descargar-14.svg';
import direccion16 from '../../assets/figma/perfil/direccion-16.svg';
import documento from '../../assets/figma/perfil/documento.svg';
import editar from '../../assets/figma/perfil/editar.svg';
import etiqueta from '../../assets/figma/perfil/etiqueta.svg';
import maletin16 from '../../assets/figma/perfil/maletin-16.svg';
import mapa16 from '../../assets/figma/perfil/mapa-16.svg';
import numeral from '../../assets/figma/perfil/numeral.svg';
import personas16 from '../../assets/figma/perfil/personas-16.svg';
import premio16 from '../../assets/figma/perfil/premio-16.svg';
import telefono16 from '../../assets/figma/perfil/telefono-16.svg';
import ubicacion14 from '../../assets/figma/perfil/ubicacion-14.svg';
import ubicacion16 from '../../assets/figma/perfil/ubicacion-16.svg';
import volver from '../../assets/figma/perfil/volver.svg';
import web16 from '../../assets/figma/perfil/web-16.svg';
import iconoCorreo from '../../assets/figma/modal/correo.svg';
import iconoMaletin from '../../assets/figma/modal/maletin.svg';
import iconoTelefono from '../../assets/figma/modal/telefono.svg';
import iconoUbicacion from '../../assets/figma/modal/ubicacion.svg';
import { ModalCompartir } from '../../componentes/contenido/Controles';
import { Cargando, MensajeError } from '../../componentes/ui/Elementos';
import { Aviso, Confirmacion, Modal } from '../../componentes/ui/Modal';
import { useSesion } from '../../sesion/sesion';
import { nombreEmpresa, Portada } from './DirectorioEmpresas';

/** Migas de pan: "← Empresas coformadoras / Ver perfil". */
export function Migas({ actual }: { actual: string }) {
  return (
    <nav aria-label="Migas de pan" className="mb-6 mt-0.5 flex items-center gap-2 text-small font-medium text-[#64748b]">
      <Link to="/empresas" className="flex items-center gap-2 hover:underline">
        <img src={volver} alt="" aria-hidden className="size-3.5" /> Empresas coformadoras
      </Link>
      <span aria-hidden>/</span>
      <span className="font-semibold text-[#0a3eb3]">{actual}</span>
    </nav>
  );
}

/** Dato de la ficha: ícono azul en cuadro gris, etiqueta y valor. */
export function Dato({ icono, etiqueta, children }: { icono: string; etiqueta: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#f1f5f9]">
        <img src={icono} alt="" aria-hidden className="size-4" />
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-caption font-medium tracking-[0.5px] text-[#64748b]">{etiqueta}</p>
        <div className="break-words text-small font-semibold text-[#0a1c40]">{children || '—'}</div>
      </div>
    </div>
  );
}

export const TARJETA = 'rounded-2xl border border-[#e2e8f0] bg-white shadow-[0_4px_12px_0_rgba(0,0,0,0.02)]';
const BOTON_ACCION = 'inline-flex h-[43px] w-full cursor-pointer items-center justify-center gap-2 rounded-[10px] px-4 text-small';

/** Perfil de una empresa coformadora (Figma: "Empresas coformadoras — Ver perfil"). */
export function PerfilEmpresa() {
  const { id } = useParams();
  const idEmpresa = Number(id);
  const navegar = useNavigate();
  const { puedeGestionar } = useSesion();
  const gestiona = puedeGestionar('empresas');
  const { data: empresa, isLoading, error } = useDetalle<Empresa>('/empresas', idEmpresa);
  const eliminarApi = useEliminar('/empresas');
  const [modal, setModal] = useState<'contacto' | 'compartir' | 'eliminar' | 'eliminada' | null>(null);

  useEffect(() => {
    if (idEmpresa) registrarActividad('Empresa', idEmpresa, 'Vista');
  }, [idEmpresa]);

  if (modal === 'eliminada') {
    return <Aviso abierto titulo="Empresa eliminada" mensaje="La empresa se eliminó correctamente." onCerrar={() => navegar('/empresas')} />;
  }
  if (isLoading) return <Cargando />;
  if (error || !empresa) return <MensajeError mensaje={error ? mensajeDeError(error) : 'No encontramos esta empresa.'} />;

  const nombre = nombreEmpresa(empresa);
  const principal = empresa.contactos.find((c) => c.es_principal) ?? empresa.contactos[0];
  const ubicacion = [empresa.departamento, empresa.municipio].filter(Boolean).join(', ');

  return (
    <>
      <Migas actual="Ver perfil" />
      <section className={`overflow-hidden ${TARJETA}`}>
        <Portada empresa={empresa} className="h-[150px] w-full sm:h-[185px]" />
        <div className="flex flex-col gap-4 px-5 py-6 sm:min-h-[153px] sm:flex-row sm:items-end sm:justify-between sm:px-8">
          <div className="flex items-start gap-6">
            {empresa.logo_ec && <img src={empresa.logo_ec} alt={`Logo de ${nombre}`} className="size-16 rounded-lg border border-borde bg-white object-contain p-1" />}
            <div className="flex flex-col gap-2">
              <h1 className="text-[24px] font-extrabold text-[#0a1c40] sm:text-titulo">{nombre}</h1>
              <p className="flex items-center gap-1.5 text-small text-[#64748b] sm:text-body">
                <img src={etiqueta} alt="" aria-hidden className="size-3.5" /> {empresa.sector_economico}
              </p>
              <p className="flex flex-wrap gap-x-6 gap-y-1 pt-2 text-small font-medium text-[#1e293b]">
                <span className="flex items-center gap-1.5">
                  <img src={numeral} alt="" aria-hidden className="size-3.5" /> NIT: {empresa.nit}
                </span>
                <span className="flex items-center gap-1.5">
                  <img src={ubicacion14} alt="" aria-hidden className="size-3.5" /> {ubicacion}
                </span>
                <span className="flex items-center gap-1.5">
                  <img src={actividad14} alt="" aria-hidden className="size-3.5" /> Sector: {empresa.sector_economico}
                </span>
              </p>
            </div>
          </div>
          {gestiona && (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => navegar(`/empresas/${empresa.id_ec}/editar`)}
                className="inline-flex h-[42px] cursor-pointer items-center gap-2 rounded-full border border-[#e2e8f0] bg-white px-5 text-body font-semibold text-[#64748b] hover:bg-fondo"
              >
                <img src={editar} alt="" aria-hidden className="size-3.5" /> Editar
              </button>
              <button
                type="button"
                onClick={() => setModal('eliminar')}
                className="inline-flex h-[42px] cursor-pointer items-center rounded-full border border-rojo-activo bg-[#fff2f2] px-5 text-body font-semibold text-rojo-activo hover:bg-rojo-claro"
              >
                Eliminar
              </button>
            </div>
          )}
        </div>
      </section>

      <div className="mt-6 grid items-start gap-4 lg:grid-cols-[1fr_300px] xl:mt-[43px] xl:grid-cols-[1fr_400px]">
        <section className={`flex flex-col gap-6 p-5 sm:p-8 ${TARJETA}`}>
          <h2 className="flex items-center gap-2.5 text-subtitle font-extrabold text-[#0a1c40]">
            <img src={documento} alt="" aria-hidden className="size-[18px]" /> Información de la empresa
          </h2>
          {empresa.descripcion && <p className="whitespace-pre-line text-small text-[#1e293b] sm:text-body">{empresa.descripcion}</p>}
          <hr className="border-[#e2e8f0]" />
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
            <Dato icono={premio16} etiqueta="Nombre comercial">{empresa.nombre_comercial}</Dato>
            <Dato icono={actividad16} etiqueta="Sector">{empresa.sector_economico}</Dato>
            <Dato icono={mapa16} etiqueta="Departamento">{empresa.departamento}</Dato>
            <Dato icono={ubicacion16} etiqueta="Municipio">{empresa.municipio}</Dato>
            <Dato icono={direccion16} etiqueta="Dirección">{empresa.direccion}</Dato>
            <Dato icono={correo16} etiqueta="Correo electrónico">
              {empresa.correo && <a href={`mailto:${empresa.correo}`} className="hover:underline">{empresa.correo}</a>}
            </Dato>
            <Dato icono={telefono16} etiqueta="Teléfono">{empresa.telefono}</Dato>
            <Dato icono={web16} etiqueta="Sitio web">
              {empresa.link && (
                <a href={empresa.link} target="_blank" rel="noreferrer" className="hover:underline">
                  {empresa.link.replace(/^https?:\/\//, '')}
                </a>
              )}
            </Dato>
            {empresa.codigo_ciiu ? <Dato icono={maletin16} etiqueta="Código CIIU">{empresa.codigo_ciiu}</Dato> : <span aria-hidden className="hidden xl:block" />}
            <Dato icono={maletin16} etiqueta="Tipo de empresa">{empresa.naturaleza_juridica}</Dato>
            <Dato icono={personas16} etiqueta="Tamaño">{empresa.tamano_empresa}</Dato>
            <Dato icono={calendario16} etiqueta="Año de constitución">{empresa.anio_constitucion}</Dato>
            <Dato icono={personas16} etiqueta="Estudiantes recibidos">{`${empresa.estudiantes_recibidos} estudiantes`}</Dato>
            <Dato icono={premio16} etiqueta="Premios recibidos">{`${empresa.premios_recibidos} reconocimientos`}</Dato>
            <Dato icono={calendario16} etiqueta="Tiempo como coformadora">{empresa.tiempo_coformadora}</Dato>
          </div>
        </section>

        <section className={`flex flex-col gap-5 p-6 ${TARJETA}`}>
          <div className="flex items-center justify-between">
            <h2 className="text-body font-extrabold text-[#0a1c40]">Estado y acciones</h2>
            <span
              className={`rounded-full px-2 py-1 text-caption font-bold ${
                (empresa.estado_ec ?? 'Activo') === 'Activo' ? 'bg-exito-claro text-[#059669]' : 'bg-etiqueta text-texto-suave'
              }`}
            >
              {empresa.estado_ec ?? 'Activo'}
            </span>
          </div>
          <div className="flex flex-col gap-2.5">
            <button type="button" onClick={() => setModal('contacto')} className={`${BOTON_ACCION} bg-[#0a3eb3] font-bold text-white hover:bg-azul`}>
              <img src={contacto14} alt="" aria-hidden className="size-3.5" /> Ver contacto principal
            </button>
            <a href={urlDescarga('/empresas/exportar', { formato: 'pdf', q: empresa.nit })} className={`${BOTON_ACCION} bg-[#f1f5f9] font-semibold text-[#1e293b] hover:bg-[#e2e8f0]`}>
              <img src={descargar14} alt="" aria-hidden className="size-3.5" /> Descargar información
            </a>
            <button type="button" onClick={() => setModal('compartir')} className={`${BOTON_ACCION} border border-[#e2e8f0] font-semibold text-[#64748b] hover:bg-fondo`}>
              <img src={compartir14} alt="" aria-hidden className="size-3.5" /> Compartir
            </button>
          </div>
        </section>
      </div>

      <Modal
        abierto={modal === 'contacto'}
        onCerrar={() => setModal(null)}
        titulo="Contacto principal"
        subtitulo="Ficha de información de contacto de la empresa coformadora."
        ancho={438}
        pie={
          <div className="flex justify-end">
            <button type="button" onClick={() => setModal(null)} className="h-[42px] cursor-pointer rounded-lg border border-[#e2e8f0] px-5 text-body font-semibold text-[#64748b] hover:bg-fondo">
              Cerrar
            </button>
          </div>
        }
      >
        {principal ? (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-4">
              <span className="grid size-16 shrink-0 place-items-center rounded-full border border-[#e2e8f0] bg-[#f1f5f9] text-subtitle font-bold text-[#071f5d]">
                {principal.nombre
                  .split(' ')
                  .slice(0, 2)
                  .map((p) => p[0])
                  .join('')}
              </span>
              <div className="flex min-w-0 flex-col items-start gap-1">
                <p className="text-subtitle font-bold text-[#071f5d]">{principal.nombre}</p>
                {principal.cargo && <p className="text-small text-[#64748b]">{principal.cargo}</p>}
                {principal.es_principal && <span className="rounded bg-[#dcfce7] px-2 py-0.5 text-caption font-semibold text-[#15803d]">Principal</span>}
              </div>
            </div>
            <ul className="flex flex-col gap-3 text-small text-[#0f172a]">
              {principal.telefono && (
                <li className="flex items-center gap-3">
                  <img src={iconoTelefono} alt="Teléfono" className="size-4 shrink-0" />
                  <a href={`tel:${principal.telefono.replace(/\s/g, '')}`} className="hover:underline">{principal.telefono}</a>
                </li>
              )}
              {principal.correo && (
                <li className="flex min-w-0 items-center gap-3">
                  <img src={iconoCorreo} alt="Correo" className="size-4 shrink-0" />
                  <a href={`mailto:${principal.correo}`} className="truncate hover:underline">{principal.correo}</a>
                </li>
              )}
              {ubicacion && (
                <li className="flex items-center gap-3">
                  <img src={iconoUbicacion} alt="Ubicación" className="size-4 shrink-0" />
                  {[empresa.municipio, empresa.departamento].filter(Boolean).join(', ')}
                </li>
              )}
              <li className="flex items-center gap-3">
                <img src={iconoMaletin} alt="Empresa" className="size-4 shrink-0" />
                {nombre}
              </li>
            </ul>
          </div>
        ) : (
          <p className="text-small text-texto-suave">Esta empresa todavía no tiene un contacto registrado.</p>
        )}
      </Modal>
      <ModalCompartir abierto={modal === 'compartir'} onCerrar={() => setModal(null)} titulo={nombre} ruta={`/empresas/${empresa.id_ec}`} tipo="Empresa" id={empresa.id_ec} nombreTipo="empresa" descarga={urlDescarga('/empresas/exportar', { formato: 'pdf', q: empresa.nit })} />
      <Confirmacion
        abierto={modal === 'eliminar'}
        titulo="Eliminar empresa"
        pregunta="¿Está seguro de que desea eliminar esta empresa?"
        detalle="Esta acción no se puede deshacer. Se removerá toda la información asociada a la empresa, incluidos sus contactos."
        textoConfirmar="Eliminar empresa"
        peligro
        cargando={eliminarApi.isPending}
        onConfirmar={() => eliminarApi.mutate(empresa.id_ec, { onSuccess: () => setModal('eliminada'), onError: () => setModal(null) })}
        onCancelar={() => setModal(null)}
      />
      {eliminarApi.error && modal === null && <p role="alert" className="mt-4 text-caption text-rojo">{mensajeDeError(eliminarApi.error)}</p>}
    </>
  );
}
