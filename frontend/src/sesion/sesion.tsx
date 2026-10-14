import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { ErrorApi, api } from '../api/cliente';
import type { Perfil } from '../api/tipos';

/** Módulos de contenido; cada uno tiene su gestor. */
export type Modulo = 'flash' | 'faro' | 'empresas' | 'tendencias' | 'calendario' | 'glosario';

/** Nombres del rol gestor de cada módulo ("Gestor Flash Informativo" es el nombre anterior de "Gestor Flash"). */
const GESTOR_DE: Record<Modulo, string[]> = {
  flash: ['Gestor Flash', 'Gestor Flash Informativo'],
  faro: ['Gestor Faro Empresarial'],
  empresas: ['Gestor Empresas Coformadoras'],
  tendencias: ['Gestor Tendencias'],
  calendario: ['Gestor Calendario'],
  glosario: ['Gestor Glosario'],
};

/** Página de cada módulo. */
export const RUTA_MODULO: Record<Modulo, string> = {
  flash: '/flash-informativo',
  faro: '/faro-empresarial',
  empresas: '/empresas',
  tendencias: '/tendencias',
  calendario: '/eventos',
  glosario: '/glosario',
};

export const SUPER_ADMIN = 'Super Admin';
export const GESTOR_OBSERVATORIO = 'Gestor Observatorio';
/** Cuenta que representa a una empresa coformadora (registro por invitación). */
export const ROL_EMPRESA = 'Empresa Coformadora';

/** Roles con control de todo el Observatorio. */
export const ROLES_SUPERADMIN = [SUPER_ADMIN, GESTOR_OBSERVATORIO];

const clave = (nombre: string) => nombre.trim().replace(/\s+/g, ' ').toLowerCase();

/** Nombres anteriores de los roles (bases que aún no tienen la migración que los renombra). */
const NOMBRES_ANTERIORES: Record<string, string> = {
  'superadmin superior': SUPER_ADMIN,
  superadmin: GESTOR_OBSERVATORIO,
  'gestor flash informativo': 'Gestor Flash',
};

/** Nombre oficial del rol, sin importar mayúsculas, espacios de más ni el nombre anterior. */
export function nombreRol(nombre: string): string {
  return NOMBRES_ANTERIORES[clave(nombre)] ?? nombre.trim().replace(/\s+/g, ' ');
}

/** ¿Es el mismo rol? ("Super admin" = "Super Admin" = "SuperAdmin Superior"). */
export const mismoRol = (a: string | undefined, b: string) => !!a && clave(nombreRol(a)) === clave(nombreRol(b));
const rolEnLista = (nombre: string | undefined, lista: string[]) => lista.some((r) => mismoRol(nombre, r));

export const esRolSuperAdmin = (nombre: string | undefined) => rolEnLista(nombre, ROLES_SUPERADMIN);
export const esRolEmpresa = (nombre: string | undefined) => mismoRol(nombre, ROL_EMPRESA);
/** ¿Es el gestor de un módulo (Flash, Faro, Empresas, Tendencias, Calendario o Glosario)? */
export const esRolGestorModulo = (nombre: string) => (Object.values(GESTOR_DE) as string[][]).some((lista) => rolEnLista(nombre, lista));

/** Páginas que un gestor de módulo puede abrir además de las de sus módulos. */
const PAGINAS_COMUNES = ['/mi-perfil', '/politica-de-datos'];

/** ¿Puede abrir esta ruta una sesión limitada a estos módulos? (vacío = todas) */
export function rutaPermitida(ruta: string, soloModulos: Modulo[]): boolean {
  if (!soloModulos.length || PAGINAS_COMUNES.includes(ruta)) return true;
  return soloModulos.some((m) => ruta === RUTA_MODULO[m] || ruta.startsWith(`${RUTA_MODULO[m]}/`));
}

/** Nombres de todos los roles de la cuenta. */
export function rolesDe(perfil: Pick<Perfil, 'nombre_rol' | 'roles'> | null | undefined): string[] {
  if (!perfil) return [];
  const nombres = perfil.roles?.length ? perfil.roles.map((r) => r.nombre_rol) : [perfil.nombre_rol];
  return [...new Set(nombres.map(nombreRol))];
}

/** Roles con los que actúa la sesión: el elegido al entrar o, si no eligió, todos los de la cuenta. */
export function rolesActivosDe(perfil: Pick<Perfil, 'nombre_rol' | 'roles' | 'rol_activo'> | null | undefined): string[] {
  return perfil?.rol_activo ? [nombreRol(perfil.rol_activo)] : rolesDe(perfil);
}

/** Texto del botón del menú de sesión según el rol principal. */
export function etiquetaRol(nombre: string | undefined): string {
  if (!nombre) return 'Iniciar sesión';
  if (mismoRol(nombre, SUPER_ADMIN)) return 'Super Admin';
  if (nombreRol(nombre).startsWith('Gestor')) return 'Gestor';
  if (esRolEmpresa(nombre)) return 'Empresa';
  return 'Usuario';
}

/** Nombre del rol para mostrar (con su nombre oficial). */
export function descripcionRol(nombre: string): string {
  return nombreRol(nombre);
}

/** Roles con los que actúa, en una línea ("Gestor Faro Empresarial · Empresa Coformadora"). */
export function descripcionRoles(perfil: Pick<Perfil, 'nombre_rol' | 'roles' | 'rol_activo'>): string {
  return rolesActivosDe(perfil).join(' · ');
}

interface ContextoSesion {
  usuario: Perfil | null;
  cargando: boolean;
  esSuperAdmin: boolean;
  /** ¿Gestiona al menos un módulo? */
  esGestor: boolean;
  /** Módulos que gestiona (de los demás ve lo mismo que un usuario: solo lectura). */
  modulosGestor: Modulo[];
  /**
   * Sesión solo de gestor de módulo (p. ej. entró como Gestor Tendencias): ve y
   * navega únicamente sus módulos. Vacío si ve todo el Observatorio.
   */
  soloModulos: Modulo[];
  /** ¿Tiene el rol Empresa Coformadora? */
  esEmpresa: boolean;
  /** Roles con los que actúa ahora (el elegido al entrar, si la cuenta tiene varios). */
  roles: string[];
  /** Todos los roles de la cuenta. */
  rolesCuenta: string[];
  /** Rol elegido al entrar (cuentas con varios roles). */
  rolActivo: string | null;
  /** Cambia el rol con el que actúa la sesión. */
  elegirRol: (rol: string) => Promise<Perfil>;
  /** ¿Puede crear, editar y eliminar en este módulo? */
  puedeGestionar: (modulo: Modulo) => boolean;
  iniciarSesion: (correo: string, contrasena: string, recordar: boolean) => Promise<Perfil>;
  cerrarSesion: () => Promise<void>;
  establecerUsuario: (perfil: Perfil | null) => void;
}

const Contexto = createContext<ContextoSesion | null>(null);

export const CLAVE_SESION = ['sesion'] as const;

async function consultarSesion(): Promise<Perfil | null> {
  try {
    return await api<Perfil>('/auth/yo');
  } catch (error) {
    if (error instanceof ErrorApi && error.estado === 401) return null;
    throw error;
  }
}

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const clienteConsultas = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: CLAVE_SESION, queryFn: consultarSesion, staleTime: 5 * 60 * 1000 });
  const usuario = data ?? null;

  const establecerUsuario = useCallback(
    (perfil: Perfil | null) => clienteConsultas.setQueryData(CLAVE_SESION, perfil),
    [clienteConsultas],
  );

  const iniciarSesion = useCallback(
    async (correo: string, contrasena: string, recordar: boolean) => {
      const perfil = await api<Perfil>('/auth/login', { metodo: 'POST', cuerpo: { correo, contrasena, recordar } });
      // Los datos visibles cambian según el rol: se descarta lo consultado como invitado.
      clienteConsultas.removeQueries({ predicate: (q) => q.queryKey[0] !== CLAVE_SESION[0] });
      establecerUsuario(perfil);
      return perfil;
    },
    [clienteConsultas, establecerUsuario],
  );

  const elegirRol = useCallback(
    async (rol: string) => {
      const perfil = await api<Perfil>('/auth/rol', { metodo: 'POST', cuerpo: { rol } });
      // Lo que se ve y se puede editar cambia con el rol: se descarta lo consultado con el anterior.
      clienteConsultas.removeQueries({ predicate: (q) => q.queryKey[0] !== CLAVE_SESION[0] });
      establecerUsuario(perfil);
      return perfil;
    },
    [clienteConsultas, establecerUsuario],
  );

  const cerrarSesion = useCallback(async () => {
    await api('/auth/logout', { metodo: 'POST' }).catch(() => undefined);
    clienteConsultas.removeQueries({ predicate: (q) => q.queryKey[0] !== CLAVE_SESION[0] });
    establecerUsuario(null);
  }, [clienteConsultas, establecerUsuario]);

  const valor = useMemo<ContextoSesion>(() => {
    const roles = rolesActivosDe(usuario);
    const esSuperAdmin = roles.some((r) => esRolSuperAdmin(r));
    const modulosGestor = (Object.keys(GESTOR_DE) as Modulo[]).filter((m) => roles.some((r) => rolEnLista(r, GESTOR_DE[m])));
    return {
      usuario,
      cargando: isLoading,
      esSuperAdmin,
      esGestor: modulosGestor.length > 0,
      modulosGestor,
      soloModulos: !esSuperAdmin && roles.length > 0 && roles.every((r) => esRolGestorModulo(r)) ? modulosGestor : [],
      esEmpresa: roles.some((r) => esRolEmpresa(r)),
      roles,
      rolesCuenta: rolesDe(usuario),
      rolActivo: usuario?.rol_activo ? nombreRol(usuario.rol_activo) : null,
      elegirRol,
      puedeGestionar: (modulo) => esSuperAdmin || modulosGestor.includes(modulo),
      iniciarSesion,
      cerrarSesion,
      establecerUsuario,
    };
  }, [usuario, isLoading, iniciarSesion, elegirRol, cerrarSesion, establecerUsuario]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSesion(): ContextoSesion {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error('useSesion debe usarse dentro de <ProveedorSesion>');
  return contexto;
}
