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
import { Invitaciones } from './paginas/empresas/Invitaciones';
import { PerfilEmpresa } from './paginas/empresas/PerfilEmpresa';
import { RegistroEmpresa } from './paginas/empresas/RegistroEmpresa';
import { Estadisticas } from './paginas/estadisticas/Estadisticas';
import { FaroEmpresarial } from './paginas/faro/FaroEmpresarial';
import { FlashInformativo } from './paginas/flash/FlashInformativo';
import { Glosario } from './paginas/glosario/Glosario';
import { Inicio } from './paginas/Inicio';
import { PoliticaDatos } from './paginas/legal/PoliticaDatos';
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
  // Enlace del correo de invitación a una empresa coformadora.
  { path: '/registro-empresa', element: <RegistroEmpresa /> },
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
      {
        path: '/empresas/invitaciones',
        element: (
          <RequiereSesion modulo="empresas">
            <Invitaciones />
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
      { path: '/glosario', element: <Glosario /> },
      { path: '/politica-de-datos', element: <PoliticaDatos /> },
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
