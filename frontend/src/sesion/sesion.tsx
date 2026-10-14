import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { ErrorApi, api } from '../api/cliente';
import type { Perfil } from '../api/tipos';

/** Módulos de contenido; cada uno tiene su gestor. */
export type Modulo = 'flash' | 'faro' | 'empresas' | 'tendencias' | 'calendario';

/** Nombres del rol gestor de cada módulo ("Gestor Flash Informativo" es el nombre anterior de "Gestor Flash"). */
const GESTOR_DE: Record<Modulo, string[]> = {
  flash: ['Gestor Flash', 'Gestor Flash Informativo'],
  faro: ['Gestor Faro Empresarial'],
  empresas: ['Gestor Empresas Coformadoras'],
  tendencias: ['Gestor Tendencias'],
  calendario: ['Gestor Calendario'],
};

/** Página de cada módulo; un gestor solo puede entrar a la de su módulo. */
export const RUTA_MODULO: Record<Modulo, string> = {
  flash: '/flash-informativo',
  faro: '/faro-empresarial',
  empresas: '/empresas',
  tendencias: '/tendencias',
  calendario: '/eventos',
};

/** Roles con todas las funciones del SuperAdmin. */
export const ROLES_SUPERADMIN = ['SuperAdmin', 'SuperAdmin Superior'];

/** ¿Es el mismo rol? Sin importar mayúsculas ni espacios de más ("SuperAdmin superior" = "SuperAdmin Superior"). */
export const mismoRol = (a: string | undefined, b: string) =>
  !!a && a.trim().replace(/\s+/g, ' ').toLowerCase() === b.toLowerCase();
const rolEnLista = (nombreRol: string | undefined, lista: string[]) => lista.some((r) => mismoRol(nombreRol, r));

export const esRolSuperAdmin = (nombreRol: string | undefined) => rolEnLista(nombreRol, ROLES_SUPERADMIN);

/** Cuenta que representa a una empresa coformadora (registro por invitación). */
export const ROL_EMPRESA = 'Empresa Coformadora';
export const esRolEmpresa = (nombreRol: string | undefined) => mismoRol(nombreRol, ROL_EMPRESA);

/** Texto del botón del menú de sesión, como en el Figma. */
export function etiquetaRol(nombreRol: string | undefined): string {
  if (!nombreRol) return 'Iniciar sesión';
  if (esRolSuperAdmin(nombreRol)) return 'SuperAdmin';
  if (nombreRol.startsWith('Gestor')) return 'Gestor';
  if (esRolEmpresa(nombreRol)) return 'Empresa';
  return 'Usuario';
}

/** Descripción del rol para el menú de sesión y Mi perfil. */
export function descripcionRol(nombreRol: string): string {
  if (mismoRol(nombreRol, 'SuperAdmin')) return 'Superadministrador';
  if (mismoRol(nombreRol, 'SuperAdmin Superior')) return 'Superadministrador superior';
  return nombreRol;
}

interface ContextoSesion {
  usuario: Perfil | null;
  cargando: boolean;
  esSuperAdmin: boolean;
  esGestor: boolean;
  /** Módulo del gestor (solo ve y entra a ese módulo); null para los demás roles. */
  moduloGestor: Modulo | null;
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

  const cerrarSesion = useCallback(async () => {
    await api('/auth/logout', { metodo: 'POST' }).catch(() => undefined);
    clienteConsultas.removeQueries({ predicate: (q) => q.queryKey[0] !== CLAVE_SESION[0] });
    establecerUsuario(null);
  }, [clienteConsultas, establecerUsuario]);

  const valor = useMemo<ContextoSesion>(() => {
    const rol = usuario?.nombre_rol;
    return {
      usuario,
      cargando: isLoading,
      esSuperAdmin: esRolSuperAdmin(rol),
      esGestor: !!rol?.startsWith('Gestor'),
      moduloGestor: (Object.keys(GESTOR_DE) as Modulo[]).find((m) => rolEnLista(rol, GESTOR_DE[m])) ?? null,
      puedeGestionar: (modulo) => esRolSuperAdmin(rol) || rolEnLista(rol, GESTOR_DE[modulo]),
      iniciarSesion,
      cerrarSesion,
      establecerUsuario,
    };
  }, [usuario, isLoading, iniciarSesion, cerrarSesion, establecerUsuario]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSesion(): ContextoSesion {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error('useSesion debe usarse dentro de <ProveedorSesion>');
  return contexto;
}
