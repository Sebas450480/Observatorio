import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSesion } from '../sesion/sesion';
import { api } from './cliente';
import type { Favorito, TipoContenido } from './tipos';

const CLAVE_FAVORITOS = ['favoritos'] as const;
const CLAVE_CLAVES = ['favoritos', 'claves'] as const;

export const claveFavorito = (tipo: TipoContenido, id: number) => `${tipo}:${id}`;

/** "Tipo:id" de los favoritos del usuario, para pintar las banderitas. Vacío para el invitado. */
export function useClavesFavoritos() {
  const { usuario } = useSesion();
  return useQuery({
    queryKey: CLAVE_CLAVES,
    queryFn: () => api<string[]>('/favoritos/claves'),
    enabled: !!usuario,
    select: (claves) => new Set(claves),
    staleTime: 60 * 1000,
  });
}

/** Favoritos con sus datos, para Mi perfil. */
export function useFavoritos() {
  return useQuery({ queryKey: CLAVE_FAVORITOS, queryFn: () => api<Favorito[]>('/favoritos') });
}

/** Guarda o quita un favorito. La banderita cambia al instante y vuelve atrás si falla. */
export function useAlternarFavorito() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: ({ tipo, id, guardar }: { tipo: TipoContenido; id: number; guardar: boolean }) =>
      api(`/favoritos/${tipo}/${id}`, { metodo: guardar ? 'PUT' : 'DELETE' }),
    onMutate: async ({ tipo, id, guardar }) => {
      await cliente.cancelQueries({ queryKey: CLAVE_CLAVES });
      const anterior = cliente.getQueryData<string[]>(CLAVE_CLAVES);
      const clave = claveFavorito(tipo, id);
      cliente.setQueryData<string[]>(CLAVE_CLAVES, (claves = []) =>
        guardar ? [...claves.filter((c) => c !== clave), clave] : claves.filter((c) => c !== clave));
      return { anterior };
    },
    onError: (_error, _variables, contexto) => {
      cliente.setQueryData(CLAVE_CLAVES, contexto?.anterior);
    },
    onSettled: () => cliente.invalidateQueries({ queryKey: CLAVE_FAVORITOS }),
  });
}
