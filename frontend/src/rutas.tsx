import { createBrowserRouter, Navigate } from 'react-router';
import { Estructura } from './componentes/estructura/Estructura';
import { RequiereSesion } from './componentes/RequiereSesion';
import { Cargando } from './componentes/ui/Elementos';
import { IniciarSesion } from './paginas/auth/IniciarSesion';
import { RecuperarContrasena } from './paginas/auth/RecuperarContrasena';
import { Registro } from './paginas/auth/Registro';
import { RestablecerContrasena } from './paginas/auth/RestablecerContrasena';
import { DirectorioEmpresas } from './paginas/empresas/DirectorioEmpresas';
import { FormularioEmpresa } from './paginas/empresas/FormularioEmpresa';
import { PerfilEmpresa } from './paginas/empresas/PerfilEmpresa';
import { Estadisticas } from './paginas/estadisticas/Estadisticas';
import { FaroEmpresarial } from './paginas/faro/FaroEmpresarial';
import { FlashInformativo } from './paginas/flash/FlashInformativo';
import { Inicio } from './paginas/Inicio';
import { NoEncontrada } from './paginas/NoEncontrada';
import { MiPerfil } from './paginas/perfil/MiPerfil';
import { Usuarios } from './paginas/usuarios/Usuarios';

/**
 * Rutas de la aplicación. Las rutas con ":id" abren el detalle del registro
 * (son las que usan la búsqueda global y los enlaces de los correos de alerta).
 */
export const enrutador = createBrowserRouter([
  { path: '/iniciar-sesion', element: <IniciarSesion /> },
  { path: '/registro', element: <Registro /> },
  { path: '/recuperar-contrasena', element: <RecuperarContrasena /> },
  { path: '/restablecer-contrasena', element: <RestablecerContrasena /> },
  {
    element: <Estructura />,
    // Mientras se descarga una página que se carga aparte (Eventos, Tendencias).
    hydrateFallbackElement: <Cargando />,
    children: [
      { path: '/', element: <Navigate to="/inicio" replace /> },
      { path: '/inicio', element: <Inicio /> },
      { path: '/flash-informativo/:id?', element: <FlashInformativo /> },
      { path: '/faro-empresarial/:id?', element: <FaroEmpresarial /> },
      { path: '/empresas', element: <DirectorioEmpresas /> },
      {
        path: '/empresas/nueva',
        element: (
          <RequiereSesion modulo="empresas">
            <FormularioEmpresa />
          </RequiereSesion>
        ),
      },
      { path: '/empresas/:id', element: <PerfilEmpresa /> },
      {
        path: '/empresas/:id/editar',
        element: (
          <RequiereSesion modulo="empresas">
            <FormularioEmpresa />
          </RequiereSesion>
        ),
      },
      // El calendario (FullCalendar) y los gráficos (Recharts) se cargan solo al abrir su página.
      { path: '/tendencias/:id?', lazy: () => import('./paginas/tendencias/Tendencias').then((m) => ({ Component: m.Tendencias })) },
      { path: '/eventos/:id?', lazy: () => import('./paginas/eventos/Eventos').then((m) => ({ Component: m.Eventos })) },
      {
        path: '/usuarios',
        element: (
          <RequiereSesion superAdmin>
            <Usuarios />
          </RequiereSesion>
        ),
      },
      {
        path: '/estadisticas',
        element: (
          <RequiereSesion superAdmin>
            <Estadisticas />
          </RequiereSesion>
        ),
      },
      {
        path: '/mi-perfil',
        element: (
          <RequiereSesion>
            <MiPerfil />
          </RequiereSesion>
        ),
      },
      { path: '*', element: <NoEncontrada /> },
    ],
  },
]);
