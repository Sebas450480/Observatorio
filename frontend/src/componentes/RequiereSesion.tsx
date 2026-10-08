import { Lock } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router';
import { useSesion, type Modulo } from '../sesion/sesion';
import { Cargando } from './ui/Elementos';

/**
 * Protege una pantalla: exige sesión y, opcionalmente, ser SuperAdmin o gestor de un módulo.
 * El backend vuelve a comprobar los permisos en cada petición.
 */
export function RequiereSesion({ children, superAdmin, modulo }: { children: ReactNode; superAdmin?: boolean; modulo?: Modulo }) {
  const { usuario, cargando, esSuperAdmin, puedeGestionar } = useSesion();
  const ubicacion = useLocation();

  if (cargando) return <Cargando />;
  if (!usuario) return <Navigate to="/iniciar-sesion" replace state={{ desde: ubicacion.pathname }} />;
  if ((superAdmin && !esSuperAdmin) || (modulo && !puedeGestionar(modulo))) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-tarjeta bg-white px-6 py-16 text-center shadow-tarjeta">
        <Lock className="size-10 text-rojo" aria-hidden />
        <h1 className="text-subtitle font-bold text-azul-titulo">No tienes permiso para ver esta página</h1>
        <p className="text-small text-texto-suave">Si crees que es un error, contacta al administrador del Observatorio.</p>
        <Link to="/inicio" className="font-semibold text-rojo underline">
          Volver al inicio
        </Link>
      </div>
    );
  }
  return <>{children}</>;
}
