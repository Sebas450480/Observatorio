import { Building2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { api, mensajeDeError } from '../../api/cliente';
import iconoEncabezado from '../../assets/figma/iconos/empresas-encabezado.svg';
import iconoNit from '../../assets/figma/iconos/nit.svg';
import iconoSector from '../../assets/figma/iconos/sector.svg';
import { useListado } from '../../api/consultas';
import type { Empresa } from '../../api/tipos';
import { BarraFiltros } from '../../componentes/contenido/Controles';
import { Boton } from '../../componentes/ui/Boton';
import { Filtro } from '../../componentes/ui/Campos';
import { Cargando, EncabezadoPagina, EstadoVacio, MensajeError, MenuExportar, Paginacion } from '../../componentes/ui/Elementos';
import { useSesion } from '../../sesion/sesion';
import { DEPARTAMENTOS } from '../../utilidades/colombia';

export interface ResumenEmpresas {
  total: number;
  activas: number;
  inactivas?: number;
  estudiantes_recibidos: number;
  por_sector: { sector: string; empresas: number }[];
  por_tamano: { tamano: string; empresas: number }[];
}

export function useResumenEmpresas() {
  return useQuery({ queryKey: ['/empresas', 'resumen'], queryFn: () => api<ResumenEmpresas>('/empresas/resumen') });
}

export function nombreEmpresa(e: Pick<Empresa, 'nombre_comercial' | 'razon_social'>): string {
  return e.razon_social || e.nombre_comercial || '';
}

/** Portada de la empresa o, si no tiene, un fondo con su logo o ícono. */
export function Portada({ empresa, className = '' }: { empresa: Empresa; className?: string }) {
  if (empresa.imagen_portada) return <img src={empresa.imagen_portada} alt="" className={`object-cover ${className}`} />;
  return (
    <div className={`grid place-items-center bg-gradient-to-br from-[#e3e8f4] to-[#c9d3ec] ${className}`}>
      {empresa.logo_ec ? (
        <img src={empresa.logo_ec} alt="" className="max-h-[60%] max-w-[60%] object-contain" />
      ) : (
        <Building2 className="size-12 text-azul-titulo/30" aria-hidden />
      )}
    </div>
  );
}

function TarjetaEmpresa({ empresa }: { empresa: Empresa }) {
  return (
    <Link
      to={`/empresas/${empresa.id_ec}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-[0_4px_12px_0_rgba(0,0,0,0.02)] transition-shadow hover:shadow-menu focus-visible:outline-2 focus-visible:outline-azul-oscuro"
    >
      <div className="relative">
        <Portada empresa={empresa} className="h-[130px] w-full" />
        {empresa.estado_ec === 'Inactivo' && (
          <span className="absolute right-3 top-3 rounded-md bg-white/90 px-2 py-1 text-[12px] font-bold text-texto-suave">INACTIVA</span>
        )}
      </div>
      <div className="flex flex-col gap-2 px-4 py-5">
        <h2 className="truncate text-subtitle font-bold text-[#0a1c40] group-hover:underline">{nombreEmpresa(empresa)}</h2>
        <div className="flex flex-col gap-1.5 text-small text-[#64748b]">
          <p className="flex items-center gap-2">
            <img src={iconoSector} alt="" aria-hidden className="size-3.5 shrink-0" /> <span className="truncate">{empresa.sector_economico}</span>
          </p>
          <p className="flex min-w-0 items-center gap-3">
            <span className="flex shrink-0 items-center gap-1.5">
              <img src={iconoNit} alt="" aria-hidden className="size-3.5 shrink-0" /> NIT: {empresa.nit}
            </span>
            <span className="truncate">{empresa.departamento}</span>
          </p>
        </div>
      </div>
    </Link>
  );
}

/** Directorio de Empresas Coformadoras (Figma: "Empresas coformadoras — Galería"). */
export function DirectorioEmpresas() {
  const { puedeGestionar } = useSesion();
  const gestiona = puedeGestionar('empresas');
  const { data: resumen } = useResumenEmpresas();

  const [borrador, setBorrador] = useState({ sector: '', departamento: '', estado: '', q: '' });
  const [filtros, setFiltros] = useState(borrador);
  const [pagina, setPagina] = useState(1);
  const consulta = {
    sector: filtros.sector || undefined,
    departamento: filtros.departamento || undefined,
    estado: filtros.estado || undefined,
    q: filtros.q || undefined,
  };
  const { data, isLoading, error, refetch } = useListado<Empresa>('/empresas', { ...consulta, pagina, limite: 12 });

  return (
    <>
      <EncabezadoPagina
        modulo="empresas"
        icono={iconoEncabezado}
        titulo="Empresas Coformadoras"
        subtitulo="Directorio de empresas aliadas y coformadoras comprometidas con la excelencia académica y el crecimiento empresarial."
        acciones={<MenuExportar ruta="/empresas" consulta={consulta} />}
        className="mb-6 xl:mb-[46px]"
      />
      <BarraFiltros className="gap-4">
        <Filtro
          etiqueta="Sector"
          todos="Todos los sectores"
          className="xl:w-[240px]"
          opciones={(resumen?.por_sector ?? []).map((s) => ({ valor: s.sector, texto: s.sector }))}
          valor={borrador.sector}
          onChange={(v) => setBorrador({ ...borrador, sector: v })}
        />
        <Filtro etiqueta="Departamento" todos="Todos los departamentos" className="xl:w-[290px]" opciones={DEPARTAMENTOS} valor={borrador.departamento} onChange={(v) => setBorrador({ ...borrador, departamento: v })} />
        {gestiona && (
          <Filtro
            etiqueta="Estado"
            todos="Todos los estados"
            className="xl:w-[230px]"
            opciones={[{ valor: 'Activo', texto: 'Activas' }, { valor: 'Inactivo', texto: 'Inactivas' }]}
            valor={borrador.estado}
            onChange={(v) => setBorrador({ ...borrador, estado: v })}
          />
        )}
        <Boton pildora className="font-bold! shadow-none!" onClick={() => { setFiltros(borrador); setPagina(1); }}>
          Buscar
        </Boton>
        {gestiona && (
          <Link to="/empresas/nueva" className="inline-flex h-[42px] items-center rounded-full bg-rojo px-5 text-body font-semibold text-white shadow-boton hover:bg-[#c2002e]">
            Crear empresa coformadora
          </Link>
        )}
      </BarraFiltros>

      {isLoading ? (
        <Cargando />
      ) : error ? (
        <MensajeError mensaje={mensajeDeError(error)} onReintentar={() => refetch()} />
      ) : !data?.datos.length ? (
        <EstadoVacio titulo="No hay empresas para estos filtros" detalle="Prueba con otro sector o departamento." />
      ) : (
        <>
          <div className="grid gap-x-5 gap-y-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {data.datos.map((e) => (
              <TarjetaEmpresa key={e.id_ec} empresa={e} />
            ))}
          </div>
          <Paginacion pagina={data.pagina} paginas={data.paginas} onCambiar={setPagina} />
        </>
      )}
    </>
  );
}
