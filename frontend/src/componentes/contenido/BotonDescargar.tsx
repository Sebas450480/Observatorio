import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { urlDescarga } from '../../api/cliente';
import { BOTON_MODAL, Modal } from '../ui/Modal';
import { useSesion } from '../../sesion/sesion';

/** Mismas variantes que la banderita de favoritos, para que vayan juntas. */
const VARIANTES = {
  normal: 'size-9 text-texto-suave hover:bg-black/5',
  /** Círculo blanco para que se vea encima de fotos y fondos de color. */
  imagen: 'size-9 bg-white/95 text-texto-suave shadow-[0_1px_4px_rgba(0,0,0,0.18)] hover:bg-white',
  /** Junto a la X del encabezado azul de los modales de detalle. */
  encabezado: 'size-8 bg-white/15 text-white hover:bg-white/25',
};

/**
 * Descargar un registro (ficha en PDF o Excel). Con sesión ofrece los formatos;
 * sin sesión invita a registrarse o iniciar sesión para descargar.
 * `ruta` es la del módulo en la API, por ejemplo "/flash".
 */
export function BotonDescargar({
  ruta,
  id,
  titulo,
  variante = 'normal',
  className = '',
}: {
  ruta: string;
  id: number;
  titulo: string;
  variante?: keyof typeof VARIANTES;
  className?: string;
}) {
  const { usuario } = useSesion();
  const ubicacion = useLocation();
  const [abierto, setAbierto] = useState(false);
  const cerrar = () => setAbierto(false);
  const archivo = (formato: 'pdf' | 'xlsx') => urlDescarga(`${ruta}/${id}/exportar`, { formato });

  return (
    <>
      <button
        type="button"
        aria-label={`Descargar: ${titulo}`}
        title="Descargar"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setAbierto(true);
        }}
        className={`grid shrink-0 cursor-pointer place-items-center rounded-full transition-colors ${VARIANTES[variante]} ${className}`}
      >
        <Download className={variante === 'encabezado' ? 'size-4' : 'size-[18px]'} aria-hidden />
      </button>

      {usuario ? (
        <Modal
          abierto={abierto}
          onCerrar={cerrar}
          titulo="Descargar"
          subtitulo={titulo}
          ancho={480}
          claseCuerpo="flex flex-col gap-3 p-6 sm:p-7"
        >
          <p className="text-body text-[#64748b]">Elige el formato del archivo.</p>
          <a href={archivo('pdf')} onClick={cerrar} className={`${BOTON_MODAL.base} ${BOTON_MODAL.secundario} justify-start text-azul-marino!`}>
            <FileText className="size-5 text-rojo" aria-hidden /> Descargar PDF
          </a>
          <a href={archivo('xlsx')} onClick={cerrar} className={`${BOTON_MODAL.base} ${BOTON_MODAL.secundario} justify-start text-azul-marino!`}>
            <FileSpreadsheet className="size-5 text-exito" aria-hidden /> Descargar Excel
          </a>
        </Modal>
      ) : (
        <Modal
          abierto={abierto}
          onCerrar={cerrar}
          titulo="Descarga para usuarios registrados"
          ancho={500}
          claseCuerpo="flex flex-col gap-3 p-6 sm:p-8"
          pie={
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Link to="/iniciar-sesion" state={{ desde: ubicacion.pathname }} className={`${BOTON_MODAL.base} ${BOTON_MODAL.secundario}`}>
                Iniciar sesión
              </Link>
              <Link to="/registro" className={`${BOTON_MODAL.base} ${BOTON_MODAL.primario}`}>
                Crear cuenta gratis
              </Link>
            </div>
          }
        >
          <p className="text-subtitle font-bold text-[#0a1c40]">Regístrate para descargar este documento</p>
          <p className="text-body text-[#64748b]">
            Crea tu cuenta gratis o inicia sesión para descargar «{titulo}» en PDF o Excel, guardar favoritos y recibir alertas del
            Observatorio Empresarial.
          </p>
        </Modal>
      )}
    </>
  );
}
