import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './cliente';
import type { Categoria, Pagina, Rol, TipoContenido } from './tipos';

/**
 * Consultas reutilizables para los módulos de contenido del backend.
 * `ruta` es la ruta base del módulo, por ejemplo '/flash' o '/empresas'.
 */
type Filtros = Record<string, string | number | boolean | undefined | (string | number)[]>;

export function useListado<T>(ruta: string, filtros: Filtros) {
  return useQuery({
    queryKey: [ruta, 'listado', filtros],
    queryFn: ({ signal }) => api<Pagina<T>>(ruta, { consulta: filtros, senal: signal }),
    placeholderData: keepPreviousData,
  });
}

export function useDetalle<T>(ruta: string, id: number | null | undefined) {
  return useQuery({
    queryKey: [ruta, 'detalle', id],
    queryFn: ({ signal }) => api<T>(`${ruta}/${id}`, { senal: signal }),
    enabled: !!id,
  });
}

/** Crear (sin id) o editar (con id) un registro. Al terminar refresca el módulo. */
export function useGuardar<T>(ruta: string) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: ({ id, datos }: { id?: number; datos: Record<string, unknown> }) =>
      id ? api<T>(`${ruta}/${id}`, { metodo: 'PATCH', cuerpo: datos }) : api<T>(ruta, { metodo: 'POST', cuerpo: datos }),
    onSuccess: () => cliente.invalidateQueries({ queryKey: [ruta] }),
  });
}

export function useEliminar(ruta: string) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<void>(`${ruta}/${id}`, { metodo: 'DELETE' }),
    onSuccess: () => cliente.invalidateQueries({ queryKey: [ruta] }),
  });
}

/** Sube una imagen JPG/PNG a un campo (imagen, logo_ec, imagen_portada). */
export function useSubirImagen(ruta: string) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: ({ id, campo, archivo }: { id: number; campo: string; archivo: File }) => {
      const formulario = new FormData();
      formulario.append('imagen', archivo);
      return api<Record<string, string>>(`${ruta}/${id}/imagen/${campo}`, { metodo: 'POST', formulario });
    },
    onSuccess: () => cliente.invalidateQueries({ queryKey: [ruta] }),
  });
}

export function useCategorias() {
  return useQuery({
    queryKey: ['/categorias'],
    queryFn: () => api<Categoria[]>('/categorias'),
    staleTime: 10 * 60 * 1000,
  });
}

export function useRoles() {
  return useQuery({ queryKey: ['/roles'], queryFn: () => api<Rol[]>('/roles'), staleTime: 10 * 60 * 1000 });
}

/** Registra una vista, un clic en "Acceder" o un compartir (estadísticas). No interrumpe si falla. */
export function registrarActividad(tipo_contenido: TipoContenido, id_contenido: number, accion: 'Vista' | 'Clic_acceder' | 'Compartir') {
  void api('/actividad', { metodo: 'POST', cuerpo: { tipo_contenido, id_contenido, accion } }).catch(() => undefined);
}
