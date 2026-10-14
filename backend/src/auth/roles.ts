/**
 * Roles del Observatorio.
 *
 * Cada rol de la tabla `rol` corresponde a un rol de PostgreSQL (obs_*), creado en la
 * Fase 1. En cada petición el backend toma ese rol para que la base de datos aplique
 * los permisos y las políticas por fila.
 */
export const ROLES_BD = [
  'obs_invitado',
  'obs_usuario',
  'obs_empresa',
  'obs_gestor_faro',
  'obs_gestor_flash',
  'obs_gestor_empresas',
  'obs_gestor_tendencias',
  'obs_gestor_calendario',
  'obs_gestor_glosario',
  'obs_superadmin',
  'obs_autenticacion',
] as const;

export type RolBD = (typeof ROLES_BD)[number];

/** Nombre del rol en la tabla `rol` -> rol de PostgreSQL. */
export const ROL_POR_NOMBRE: Record<string, RolBD> = {
  /** Control total; solo otro Super Admin puede asignar este rol o cambiar a quien lo tiene. */
  'Super Admin': 'obs_superadmin',
  /** Rol transversal (antes "SuperAdmin"): las mismas funciones, sin poder tocar a un Super Admin. */
  'Gestor Observatorio': 'obs_superadmin',
  Usuario: 'obs_usuario',
  /** Usuario que además edita la ficha de su propia empresa (registro por invitación). */
  'Empresa Coformadora': 'obs_empresa',
  'Gestor Faro Empresarial': 'obs_gestor_faro',
  'Gestor Flash': 'obs_gestor_flash',
  'Gestor Empresas Coformadoras': 'obs_gestor_empresas',
  'Gestor Tendencias': 'obs_gestor_tendencias',
  'Gestor Calendario': 'obs_gestor_calendario',
  /** Rol delegado por el Super Admin para administrar el glosario. */
  'Gestor Glosario': 'obs_gestor_glosario',
};

export const SUPER_ADMIN = 'Super Admin';

/** Compara nombres de rol sin importar mayúsculas ni espacios de más ("Super admin" = "Super Admin"). */
const clave = (nombre: string) => nombre.trim().replace(/\s+/g, ' ').toLowerCase();

/** Nombres anteriores (bases que aún no tienen la migración que los renombra). */
const NOMBRES_ANTERIORES: Record<string, string> = {
  'superadmin superior': 'Super Admin',
  superadmin: 'Gestor Observatorio',
  'gestor flash informativo': 'Gestor Flash',
};

const NOMBRE_POR_CLAVE = new Map([
  ...Object.entries(NOMBRES_ANTERIORES),
  ...Object.keys(ROL_POR_NOMBRE).map((nombre) => [clave(nombre), nombre] as [string, string]),
]);

/** Nombre oficial del rol, aunque en la base esté escrito con otras mayúsculas o con su nombre anterior. */
export function nombreRolCanonico(nombreRol: string): string {
  return NOMBRE_POR_CLAVE.get(clave(nombreRol)) ?? nombreRol;
}

/**
 * Alcance de cada rol de PostgreSQL. Con varios roles, el principal es el de más
 * alcance; cada módulo usa el rol de la cuenta que lo gestiona (ver usarRol).
 */
const PRIORIDAD: RolBD[] = [
  'obs_superadmin',
  'obs_gestor_faro',
  'obs_gestor_flash',
  'obs_gestor_empresas',
  'obs_gestor_tendencias',
  'obs_gestor_calendario',
  'obs_gestor_glosario',
  'obs_empresa',
  'obs_usuario',
];

export function rolPrincipal(roles: RolBD[]): RolBD {
  return PRIORIDAD.find((r) => roles.includes(r)) ?? 'obs_usuario';
}

/** Nombre del rol principal entre los nombres de una cuenta. */
export function nombreRolPrincipal(nombres: string[]): string | null {
  const canonicos = nombres.map(nombreRolCanonico).filter((n) => ROL_POR_NOMBRE[n]);
  if (canonicos.includes(SUPER_ADMIN)) return SUPER_ADMIN;
  const principal = rolPrincipal(canonicos.map((n) => ROL_POR_NOMBRE[n]!));
  return canonicos.find((n) => ROL_POR_NOMBRE[n] === principal) ?? null;
}

export function rolBdDesdeNombre(nombreRol: string): RolBD {
  const rol = ROL_POR_NOMBRE[nombreRolCanonico(nombreRol)];
  if (!rol) {
    throw new Error(`El rol "${nombreRol}" no tiene un rol de PostgreSQL asociado`);
  }
  return rol;
}

export function esRolBd(valor: string): valor is RolBD {
  return (ROLES_BD as readonly string[]).includes(valor);
}

/** Datos de la persona que hace la petición. */
export interface Sesion {
  /** Id del usuario, o null si es un invitado. */
  idUsuario: number | null;
  /** Rol de PostgreSQL con el que se ejecutan sus consultas. */
  rol: RolBD;
  /** Nombre del rol principal en la tabla `rol`, o null si es un invitado. */
  nombreRol: string | null;
  /** Todos los roles de PostgreSQL de la cuenta (una cuenta puede tener varios). */
  roles: RolBD[];
  /** Nombres de todos los roles de la cuenta. */
  nombresRoles: string[];
}

export const SESION_INVITADO: Sesion = { idUsuario: null, rol: 'obs_invitado', nombreRol: null, roles: [], nombresRoles: [] };
