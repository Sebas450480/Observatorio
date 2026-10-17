import { Check, X } from 'lucide-react';
import { REQUISITOS_CONTRASENA } from '../../utilidades/contrasena';

/** Lista de requisitos de la contraseña que se marca mientras la persona escribe. */
export function RequisitosContrasena({ valor, className = '' }: { valor: string; className?: string }) {
  return (
    <ul aria-label="Requisitos de la contraseña" className={`grid gap-x-4 gap-y-1 text-caption sm:grid-cols-2 ${className}`}>
      {REQUISITOS_CONTRASENA.map((r) => {
        const ok = r.cumple(valor);
        return (
          <li key={r.texto} className={`flex items-center gap-1.5 ${ok ? 'text-exito' : 'text-texto-suave'}`}>
            {ok ? <Check className="size-3.5 shrink-0" aria-hidden /> : <X className="size-3.5 shrink-0" aria-hidden />}
            <span>
              {r.texto}
              <span className="sr-only">{ok ? ' (cumple)' : ' (falta)'}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
