import {
  Award, Briefcase, CalendarDays, Download, FileText, Globe, GraduationCap, Hash, Landmark, Mail, MapPin, Navigation, Pencil,
  Phone, Ruler, Share2, Tag, Trash2, User, Activity,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { mensajeDeError, urlDescarga } from '../../api/cliente';
import { registrarActividad, useDetalle, useEliminar } from '../../api/consultas';
import type { Empresa } from '../../api/tipos';
import { ModalCompartir } from '../../componentes/contenido/Controles';
import { Boton } from '../../componentes/ui/Boton';
import { Cargando, InsigniaEstado, MensajeError, Tarjeta } from '../../componentes/ui/Elementos';
import { Aviso, Confirmacion, Modal } from '../../componentes/ui/Modal';
import { useSesion } from '../../sesion/sesion';
import { nombreEmpresa, Portada } from './DirectorioEmpresas';

/** Migas de pan: "← Empresas coformadoras / Ver perfil". */
export function Migas({ actual }: { actual: string }) {
  return (
    <nav aria-label="Migas de pan" className="mb-4 flex items-center gap-1.5 text-caption text-texto-suave">
      <Link to="/empresas" className="hover:underline">
        ← Empresas coformadoras
      </Link>
      <span aria-hidden>/</span>
      <span className="font-semibold text-azul-titulo">{actual}</span>
    </nav>
  );
}

function Dato({ icono, etiqueta, children }: { icono: ReactNode; etiqueta: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="grid size-7 shrink-0 place-items-center rounded-md bg-fondo text-azul-titulo [&_svg]:size-3.5">{icono}</span>
      <div className="min-w-0">
        <p className="text-[13px] text-texto-suave">{etiqueta}</p>
        <div className="break-words text-caption font-semibold text-texto">{children || '—'}</div>
      </div>
    </div>
  );
}

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
      <Tarjeta className="overflow-hidden">
        <Portada empresa={empresa} className="h-[150px] w-full sm:h-[190px]" />
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6">
          <div className="flex items-start gap-4">
            {empresa.logo_ec && <img src={empresa.logo_ec} alt={`Logo de ${nombre}`} className="size-16 rounded-lg border border-borde bg-white object-contain p-1" />}
            <div>
              <h1 className="text-[24px] font-bold text-azul-titulo sm:text-titulo">{nombre}</h1>
              <p className="mt-1 flex items-center gap-1.5 text-small text-texto-suave">
                <Tag className="size-4" aria-hidden /> {empresa.sector_economico}
              </p>
              <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-caption text-texto">
                <span className="flex items-center gap-1">
                  <Hash className="size-3.5" aria-hidden /> NIT: {empresa.nit}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="size-3.5" aria-hidden /> {ubicacion}
                </span>
              </p>
            </div>
          </div>
          {gestiona && (
            <div className="flex gap-3">
              <Boton variante="secundario" tamano="sm" pildora icono={<Pencil className="size-3.5" />} onClick={() => navegar(`/empresas/${empresa.id_ec}/editar`)}>
                Editar
              </Boton>
              <Boton variante="peligro" tamano="sm" pildora icono={<Trash2 className="size-3.5" />} onClick={() => setModal('eliminar')}>
                Eliminar
              </Boton>
            </div>
          )}
        </div>
      </Tarjeta>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_250px] xl:grid-cols-[1fr_300px]">
        <Tarjeta className="p-5 sm:p-6">
          <h2 className="mb-3 flex items-center gap-2 text-body font-bold text-azul-titulo">
            <FileText className="size-4" aria-hidden /> Información de la empresa
          </h2>
          {empresa.descripcion && <p className="whitespace-pre-line text-small leading-relaxed text-texto">{empresa.descripcion}</p>}
          <hr className="my-5 border-borde" />
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
            <Dato icono={<Award />} etiqueta="Nombre comercial">{empresa.nombre_comercial}</Dato>
            <Dato icono={<Activity />} etiqueta="Sector">{empresa.sector_economico}</Dato>
            <Dato icono={<MapPin />} etiqueta="Departamento">{empresa.departamento}</Dato>
            <Dato icono={<MapPin />} etiqueta="Municipio">{empresa.municipio}</Dato>
            <Dato icono={<Navigation />} etiqueta="Dirección">{empresa.direccion}</Dato>
            <Dato icono={<Mail />} etiqueta="Correo electrónico">
              {empresa.correo && <a href={`mailto:${empresa.correo}`} className="hover:underline">{empresa.correo}</a>}
            </Dato>
            <Dato icono={<Phone />} etiqueta="Teléfono">{empresa.telefono}</Dato>
            <Dato icono={<Globe />} etiqueta="Sitio web">
              {empresa.link && (
                <a href={empresa.link} target="_blank" rel="noreferrer" className="hover:underline">
                  {empresa.link.replace(/^https?:\/\//, '')}
                </a>
              )}
            </Dato>
            <Dato icono={<Landmark />} etiqueta="Código CIIU">{empresa.codigo_ciiu}</Dato>
            <Dato icono={<Briefcase />} etiqueta="Tipo de empresa">{empresa.naturaleza_juridica}</Dato>
            <Dato icono={<Ruler />} etiqueta="Tamaño">{empresa.tamano_empresa}</Dato>
            <Dato icono={<CalendarDays />} etiqueta="Año de constitución">{empresa.anio_constitucion}</Dato>
            <Dato icono={<GraduationCap />} etiqueta="Estudiantes recibidos">{`${empresa.estudiantes_recibidos} estudiantes`}</Dato>
            <Dato icono={<Award />} etiqueta="Premios recibidos">{`${empresa.premios_recibidos} reconocimientos`}</Dato>
            <Dato icono={<CalendarDays />} etiqueta="Tiempo como coformadora">{empresa.tiempo_coformadora}</Dato>
          </div>
        </Tarjeta>

        <Tarjeta className="h-fit p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-small font-bold text-azul-titulo">Estado y acciones</h2>
            <InsigniaEstado estado={empresa.estado_ec ?? 'Activo'} />
          </div>
          <div className="flex flex-col gap-2.5">
            <Boton variante="azul" tamano="sm" icono={<User className="size-3.5" />} onClick={() => setModal('contacto')}>
              Ver contacto principal
            </Boton>
            <a
              href={urlDescarga('/empresas/exportar', { formato: 'pdf', q: empresa.nit })}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-control bg-fondo text-caption font-semibold text-azul-titulo hover:bg-[#e8ebee]"
            >
              <Download className="size-3.5" aria-hidden /> Descargar información
            </a>
            <Boton variante="secundario" tamano="sm" icono={<Share2 className="size-3.5" />} onClick={() => setModal('compartir')}>
              Compartir
            </Boton>
          </div>
        </Tarjeta>
      </div>

      <Modal abierto={modal === 'contacto'} onCerrar={() => setModal(null)} titulo="Contacto principal" subtitulo={nombre} ancho={480}>
        {principal ? (
          <div className="flex flex-col gap-4">
            <Dato icono={<User />} etiqueta="Nombre">{principal.nombre}</Dato>
            <Dato icono={<Briefcase />} etiqueta="Cargo">{principal.cargo}</Dato>
            <Dato icono={<Mail />} etiqueta="Correo corporativo">
              {principal.correo && <a href={`mailto:${principal.correo}`} className="hover:underline">{principal.correo}</a>}
            </Dato>
            <Dato icono={<Phone />} etiqueta="Teléfono">
              {principal.telefono && <a href={`tel:${principal.telefono.replace(/\s/g, '')}`} className="hover:underline">{principal.telefono}</a>}
            </Dato>
          </div>
        ) : (
          <p className="text-small text-texto-suave">Esta empresa todavía no tiene un contacto registrado.</p>
        )}
      </Modal>
      <ModalCompartir abierto={modal === 'compartir'} onCerrar={() => setModal(null)} titulo={nombre} ruta={`/empresas/${empresa.id_ec}`} tipo="Empresa" id={empresa.id_ec} />
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
