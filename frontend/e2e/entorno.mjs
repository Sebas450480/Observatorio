/**
 * Datos compartidos por las pruebas de extremo a extremo (E2E).
 * Usan un PostgreSQL de pruebas, el backend real y el frontend en modo desarrollo.
 */
export const BASE_E2E = 'obs_pruebas_e2e';
export const CONTRASENA_BACKEND_E2E = 'obs_backend_e2e';
export const PUERTO_BACKEND = 3100;
export const PUERTO_FRONTEND = 5174;
export const CONTRASENA = 'Prueba-E2E-2026';
/** Código del enlace de la invitación a una empresa que crea preparar-bd.mjs. */
export const CODIGO_INVITACION = 'codigo-e2e-invitacion-empresa-0001';

/** Una cuenta por perfil. */
export const CUENTAS = {
  superadmin: { correo: 'superadmin.e2e@uniempresarial.edu.co', rol: 'Gestor Observatorio', nombre: 'Andrés', apellido: 'Martínez' },
  gestorFlash: { correo: 'gestor.flash.e2e@uniempresarial.edu.co', rol: 'Gestor Flash', nombre: 'Carolina', apellido: 'Ruiz' },
  gestorTendencias: { correo: 'gestor.tendencias.e2e@uniempresarial.edu.co', rol: 'Gestor Tendencias', nombre: 'Diego', apellido: 'Pardo' },
  gestorEmpresas: { correo: 'gestor.empresas.e2e@uniempresarial.edu.co', rol: 'Gestor Empresas Coformadoras', nombre: 'Camila', apellido: 'Torres' },
  usuario: { correo: 'usuario.e2e@gmail.com', rol: 'Usuario', nombre: 'Laura', apellido: 'Gómez' },
  /** Cuenta con dos roles: al entrar elige con cuál. */
  variosRoles: {
    correo: 'varios.roles.e2e@uniempresarial.edu.co', rol: 'Gestor Flash', otrosRoles: ['Gestor Calendario'], nombre: 'Julián', apellido: 'Rojas',
  },
};

export function urlAdmin() {
  return process.env.TEST_ADMIN_URL ?? 'postgresql://postgres@localhost:55432/postgres';
}

export function urlBackend() {
  const url = new URL(urlAdmin());
  url.username = 'obs_backend';
  url.password = CONTRASENA_BACKEND_E2E;
  url.pathname = `/${BASE_E2E}`;
  return url.toString();
}
