import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './cliente';
import type { Perfil } from './tipos';

export type EstadoInvitacion = 'Pendiente' | 'Vencida' | 'Completada' | 'Anulada';

export interface Invitacion {
  id_invitacion: number;
  nombre_contacto: string;
  apellido_contacto: string;
  correo: string;
  nombre_empresa: string | null;
  id_ec: number | null;
  estado: EstadoInvitacion;
  fecha_creacion: string;
  fecha_envio: string;
  fecha_vencimiento: string;
  fecha_completada: string | null;
  /** Solo al crear o reenviar: si el correo salió. */
  correo_enviado?: boolean;
}

export interface NuevaInvitacion {
  nombre_contacto: string;
  apellido_contacto: string;
  correo: string;
  nombre_empresa: string;
}

/** Datos de la invitación que ve la empresa al abrir el enlace del correo. */
export interface DatosInvitacion {
  nombre_contacto: string;
  apellido_contacto: string;
  correo: string;
  nombre_empresa: string | null;
}

/** Registro corto: con el enlace solo se crea la contraseña; la ficha se completa en Mi perfil. */
export interface RegistroEmpresa {
  codigo: string;
  contrasena: string;
  acepta_tratamiento_datos: true;
}

const CLAVE = ['invitaciones'] as const;

export function useInvitaciones() {
  return useQuery({ queryKey: CLAVE, queryFn: () => api<Invitacion[]>('/invitaciones') });
}

/** Crear, reenviar o anular una invitación; al terminar se recarga la lista. */
export function useAccionInvitacion() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (accion: { tipo: 'crear'; datos: NuevaInvitacion } | { tipo: 'reenviar' | 'anular'; id: number }) =>
      accion.tipo === 'crear'
        ? api<Invitacion>('/invitaciones', { metodo: 'POST', cuerpo: accion.datos })
        : api<Invitacion>(`/invitaciones/${accion.id}/${accion.tipo}`, { metodo: 'POST' }),
    onSettled: () => cliente.invalidateQueries({ queryKey: CLAVE }),
  });
}

export interface ResultadoLote {
  enviadas: number;
  resultados: ({ correo: string; ok: true; invitacion: Invitacion } | { correo: string; ok: false; error: string })[];
}

/** Varias invitaciones a la vez (una por empresa); las que fallan no detienen las demás. */
export function useInvitarVarias() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (invitaciones: NuevaInvitacion[]) => api<ResultadoLote>('/invitaciones/lote', { metodo: 'POST', cuerpo: { invitaciones } }),
    onSettled: () => cliente.invalidateQueries({ queryKey: CLAVE }),
  });
}

export function useDatosInvitacion(codigo: string) {
  return useQuery({
    queryKey: ['invitacion', codigo],
    queryFn: () => api<DatosInvitacion>(`/invitaciones/codigo/${encodeURIComponent(codigo)}`),
    enabled: !!codigo,
    retry: false,
  });
}

export const completarRegistroEmpresa = (datos: RegistroEmpresa) =>
  api<{ id_ec: number; usuario: Perfil }>('/invitaciones/completar', { metodo: 'POST', cuerpo: datos });
