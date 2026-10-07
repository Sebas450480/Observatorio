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
  'obs_gestor_faro',
  'obs_gestor_flash',
  'obs_gestor_empresas',
  'obs_gestor_tendencias',
  'obs_gestor_calendario',
  'obs_superadmin',
  'obs_autenticacion',
] as const;

export type RolBD = (typeof ROLES_BD)[number];

/** Nombre del rol en la tabla `rol` -> rol de PostgreSQL. */
export const ROL_POR_NOMBRE: Record<string, RolBD> = {
  SuperAdmin: 'obs_superadmin',
  Usuario: 'obs_usuario',
  'Gestor Faro Empresarial': 'obs_gestor_faro',
  'Gestor Flash Informativo': 'obs_gestor_flash',
  'Gestor Empresas Coformadoras': 'obs_gestor_empresas',
  'Gestor Tendencias': 'obs_gestor_tendencias',
  'Gestor Calendario': 'obs_gestor_calendario',
};

export function rolBdDesdeNombre(nombreRol: string): RolBD {
  const rol = ROL_POR_NOMBRE[nombreRol];
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
  /** Nombre del rol en la tabla `rol`, o null si es un invitado. */
  nombreRol: string | null;
}

export const SESION_INVITADO: Sesion = { idUsuario: null, rol: 'obs_invitado', nombreRol: null };
