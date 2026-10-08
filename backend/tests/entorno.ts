/** Datos de conexión de las pruebas automáticas. */
export const BASE_PRUEBAS = 'obs_pruebas_backend';
export const CONTRASENA_BACKEND_PRUEBAS = 'obs_backend_pruebas';

export function urlAdmin(): string {
  return process.env.TEST_ADMIN_URL ?? 'postgresql://postgres@localhost:55432/postgres';
}

/** Misma conexión que usará el backend real: usuario obs_backend. */
export function urlBackend(): string {
  const url = new URL(urlAdmin());
  url.username = 'obs_backend';
  url.password = CONTRASENA_BACKEND_PRUEBAS;
  url.pathname = `/${BASE_PRUEBAS}`;
  return url.toString();
}

/** Conexión de administrador a la base de pruebas (para preparar datos). */
export function urlAdminPruebas(): string {
  const url = new URL(urlAdmin());
  url.pathname = `/${BASE_PRUEBAS}`;
  return url.toString();
}
