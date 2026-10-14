/** Tarjetas blancas de Mi perfil (Mis datos, Mis intereses, Alertas, Mis favoritos). */
export const TARJETA = 'flex flex-col gap-5 rounded-2xl border border-[#e5ebf2] bg-white p-5 shadow-[0_4px_16px_0_rgba(13,26,64,0.06)] sm:p-8';

export function EncabezadoTarjeta({ titulo, detalle }: { titulo: string; detalle: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-subtitle font-bold text-azul-marino">{titulo}</h2>
      <p className="text-small text-gris-azulado">{detalle}</p>
    </div>
  );
}
