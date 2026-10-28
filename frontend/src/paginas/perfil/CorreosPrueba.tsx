import { useMutation } from '@tanstack/react-query';
import { api, mensajeDeError } from '../../api/cliente';
import { Boton } from '../../componentes/ui/Boton';
import { EncabezadoTarjeta, TARJETA } from './TarjetaPerfil';

interface Resultado {
  correo: string;
  enviados: string[];
  fallidos: string[];
}

/**
 * Solo SuperAdmin: envía a su propio correo un ejemplo de cada correo de la plataforma
 * (boletín, recordatorios, invitación y recuperación de contraseña) para revisar el diseño.
 */
export function CorreosPrueba() {
  const enviar = useMutation({ mutationFn: () => api<Resultado>('/alertas/prueba', { metodo: 'POST' }) });
  const r = enviar.data;

  return (
    <section className={`${TARJETA} mt-6`}>
      <EncabezadoTarjeta
        titulo="Correos de prueba"
        detalle="Te envía a tu correo un ejemplo de cada correo de la plataforma: boletín, recordatorios de eventos, invitación a empresas y recuperación de contraseña. Llevan «[Prueba]» en el asunto."
      />
      <Boton pildora className="w-fit" cargando={enviar.isPending} onClick={() => enviar.mutate()}>
        Enviarme los correos de prueba
      </Boton>
      {enviar.isError && (
        <p role="alert" className="text-small text-rojo">
          {mensajeDeError(enviar.error)}
        </p>
      )}
      {r && (
        <div role="status" className="flex flex-col gap-2 rounded-[10px] bg-fondo px-4 py-3 text-small text-gris-azulado">
          <p className="font-semibold text-azul-marino">
            {r.enviados.length} {r.enviados.length === 1 ? 'correo enviado' : 'correos enviados'} a {r.correo}
          </p>
          <ul className="ml-5 list-disc">
            {r.enviados.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
          {r.fallidos.length > 0 && <p className="text-rojo">No se pudieron enviar: {r.fallidos.join(' · ')}</p>}
        </div>
      )}
    </section>
  );
}
