import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './cliente';
import type { Empresa } from './tipos';

/** Ficha de la empresa de la cuenta (rol Empresa Coformadora). */
export type MiEmpresa = Omit<Empresa, 'contactos' | 'premios_recibidos' | 'tiempo_coformadora' | 'creado_por' | 'fecha_creacion'> & {
  /** Correo de la cuenta: el mismo al que llegó la invitación. */
  correo_cuenta: string;
  /** Registrada por invitación y aún sin completar la ficha (no está publicada). */
  pendiente: boolean;
};

const CLAVE = ['mi-empresa'] as const;

export function useMiEmpresa(activo: boolean) {
  return useQuery({ queryKey: CLAVE, queryFn: () => api<MiEmpresa>('/mi-empresa'), enabled: activo, retry: false });
}

/** Guarda los datos y, si se eligieron, el logo y la portada. */
export function useGuardarMiEmpresa() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: async ({ datos, logo, portada }: { datos: Record<string, unknown>; logo: File | null; portada: File | null }) => {
      await api<MiEmpresa>('/mi-empresa', { metodo: 'PATCH', cuerpo: datos });
      for (const [campo, archivo] of [['logo_ec', logo], ['imagen_portada', portada]] as const) {
        if (!archivo) continue;
        const formulario = new FormData();
        formulario.append('imagen', archivo);
        await api(`/mi-empresa/imagen/${campo}`, { metodo: 'POST', formulario });
      }
      return api<MiEmpresa>('/mi-empresa');
    },
    onSuccess: (empresa) => {
      cliente.setQueryData(CLAVE, empresa);
      // El directorio y la ficha pública muestran los datos nuevos.
      cliente.invalidateQueries({ queryKey: ['/empresas'] });
    },
  });
}
