import { Building2, Check, ShieldCheck, SquarePen, UserRound } from 'lucide-react';
import { useState } from 'react';
import { mensajeDeError } from '../api/cliente';
import { esRolEmpresa, esRolSuperAdmin, mismoRol, nombreRol, useSesion } from '../sesion/sesion';
import { BotonModal, Modal } from './ui/Modal';

function IconoRol({ rol }: { rol: string }) {
  const clase = 'size-5';
  if (esRolSuperAdmin(rol)) return <ShieldCheck className={clase} aria-hidden />;
  if (esRolEmpresa(rol)) return <Building2 className={clase} aria-hidden />;
  if (nombreRol(rol).startsWith('Gestor')) return <SquarePen className={clase} aria-hidden />;
  return <UserRound className={clase} aria-hidden />;
}

/**
 * Cuentas con varios roles: elegir con cuál usar la plataforma (al iniciar sesión
 * o desde el menú de la sesión). Si se cierra sin elegir, sigue con el rol actual.
 * Se monta al abrirlo, así cada vez empieza marcado el rol actual.
 */
export function ModalElegirRol({ onCerrar }: { onCerrar: (rolElegido?: string) => void }) {
  const { rolesCuenta, rolActivo, roles, elegirRol } = useSesion();
  const actual = rolActivo ?? roles[0] ?? '';
  const [elegido, setElegido] = useState(actual);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const entrar = async () => {
    setError(null);
    if (mismoRol(elegido, actual) && rolActivo) return onCerrar(elegido);
    setGuardando(true);
    try {
      await elegirRol(elegido);
      onCerrar(elegido);
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      abierto
      onCerrar={() => onCerrar()}
      titulo="¿Con qué rol quieres entrar?"
      subtitulo="Tu cuenta tiene varios roles. Puedes cambiarlo cuando quieras desde el menú de tu sesión."
      ancho={560}
      pie={
        <div className="flex justify-end">
          <BotonModal cargando={guardando} disabled={!elegido} onClick={entrar}>
            Entrar como {nombreRol(elegido)}
          </BotonModal>
        </div>
      }
    >
      <div role="radiogroup" aria-label="Roles de tu cuenta" className="flex flex-col gap-3">
        {rolesCuenta.map((rol) => {
          const marcado = mismoRol(elegido, rol);
          return (
            <button
              key={rol}
              type="button"
              role="radio"
              aria-checked={marcado}
              onClick={() => setElegido(rol)}
              className={`flex w-full cursor-pointer items-center gap-4 rounded-2xl border-2 p-4 text-left transition-colors ${
                marcado ? 'border-rojo bg-rojo-claro/60' : 'border-[#e2e8f0] bg-white hover:border-[#c5d0de] hover:bg-fondo'
              }`}
            >
              <span
                className={`grid size-11 shrink-0 place-items-center rounded-full ${marcado ? 'bg-rojo text-white' : 'bg-azul-marino/10 text-azul-marino'}`}
              >
                <IconoRol rol={rol} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-body font-bold text-azul-marino">
                  {nombreRol(rol)}
                  {mismoRol(actual, rol) && rolActivo && <span className="ml-2 text-caption font-semibold text-texto-suave">(actual)</span>}
                </span>
              </span>
              <span
                className={`grid size-6 shrink-0 place-items-center rounded-full border-2 ${marcado ? 'border-rojo bg-rojo text-white' : 'border-[#c5d0de]'}`}
              >
                {marcado && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
              </span>
            </button>
          );
        })}
        {error && (
          <p role="alert" className="text-small font-semibold text-rojo-vivo">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
