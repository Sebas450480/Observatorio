import { Trash2 } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { mensajeDeError } from '../../api/cliente';
import { Boton } from '../ui/Boton';
import { Aviso, Confirmacion, Modal } from '../ui/Modal';

export interface Sustantivo {
  /** "evento", "registro", "tendencia", "empresa", "usuario" */
  palabra: string;
  /** "este" o "esta" */
  demostrativo: 'este' | 'esta';
}

/**
 * Flujo de crear, editar y eliminar de las plantillas del Figma:
 *  - Crear: formulario → aviso "REGISTRO CREADO".
 *  - Editar: formulario → confirmación "¿Está seguro de que desea editar...?" → aviso.
 *  - Eliminar (dentro de editar): confirmación → aviso.
 */
export function FormularioCrud({
  abierto,
  modo,
  titulo,
  sustantivo,
  validar,
  guardar,
  eliminar,
  onCerrar,
  children,
  ancho = 620,
}: {
  abierto: boolean;
  modo: 'crear' | 'editar';
  titulo: string;
  sustantivo: Sustantivo;
  /** Valida el formulario (react-hook-form `trigger`). */
  validar: () => Promise<boolean>;
  /** Guarda en el backend; si falla, lanza el error. */
  guardar: () => Promise<void>;
  eliminar?: () => Promise<void>;
  onCerrar: () => void;
  children: ReactNode;
  ancho?: number;
}) {
  const [confirmar, setConfirmar] = useState<'editar' | 'eliminar' | null>(null);
  const [aviso, setAviso] = useState<'creado' | 'editado' | 'eliminado' | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { palabra, demostrativo } = sustantivo;
  const femenino = demostrativo === 'esta';

  const ejecutar = async (accion: () => Promise<void>, resultado: 'creado' | 'editado' | 'eliminado') => {
    setTrabajando(true);
    setError(null);
    try {
      await accion();
      setConfirmar(null);
      setAviso(resultado);
    } catch (e) {
      setConfirmar(null);
      setError(mensajeDeError(e));
    } finally {
      setTrabajando(false);
    }
  };

  const alEnviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!(await validar())) return;
    if (modo === 'editar') setConfirmar('editar');
    else await ejecutar(guardar, 'creado');
  };

  const textosAviso = {
    creado: {
      titulo: `${palabra} ${femenino ? 'creada' : 'creado'}`,
      mensaje: `${femenino ? 'La' : 'El'} ${palabra} se creó correctamente.`,
    },
    editado: {
      titulo: `${palabra} ${femenino ? 'editada' : 'editado'}`,
      mensaje: `${femenino ? 'La' : 'El'} ${palabra} se editó correctamente.`,
    },
    eliminado: {
      titulo: `${palabra} ${femenino ? 'eliminada' : 'eliminado'}`,
      mensaje: `${femenino ? 'La' : 'El'} ${palabra} se eliminó correctamente.`,
    },
  };

  return (
    <>
      <Modal
        abierto={abierto && !aviso}
        onCerrar={onCerrar}
        titulo={titulo}
        subtitulo="Observatorio Empresarial"
        ancho={ancho}
        pie={
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            {modo === 'editar' && eliminar ? (
              <Boton variante="peligro" icono={<Trash2 className="size-4" />} onClick={() => setConfirmar('eliminar')}>
                Eliminar {palabra}
              </Boton>
            ) : (
              <span />
            )}
            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <Boton variante="secundario" onClick={onCerrar}>
                Cancelar
              </Boton>
              <Boton type="submit" form="formulario-crud" cargando={trabajando && !confirmar}>
                {modo === 'crear' ? 'Guardar nuevo registro' : 'Guardar cambios'}
              </Boton>
            </div>
          </div>
        }
      >
        <form id="formulario-crud" onSubmit={alEnviar} noValidate className="flex flex-col gap-4">
          {children}
          {error && (
            <p role="alert" className="rounded-lg bg-rojo-claro px-4 py-3 text-caption text-rojo">
              {error}
            </p>
          )}
        </form>
      </Modal>

      <Confirmacion
        abierto={confirmar === 'editar'}
        titulo={`Editar ${palabra}`}
        pregunta={`¿Está seguro de que desea editar ${demostrativo} ${palabra}?`}
        detalle={`Esta acción actualizará la información ${femenino ? 'de la' : 'del'} ${palabra} y los cambios podrán visualizarse en el Observatorio Empresarial.`}
        textoConfirmar={`Editar ${palabra}`}
        cargando={trabajando}
        onConfirmar={() => ejecutar(guardar, 'editado')}
        onCancelar={() => setConfirmar(null)}
      />
      {eliminar && (
        <Confirmacion
          abierto={confirmar === 'eliminar'}
          titulo={`Eliminar ${palabra}`}
          pregunta={`¿Está seguro de que desea eliminar ${demostrativo} ${palabra}?`}
          detalle={`Esta acción no se puede deshacer. Se removerá toda la información asociada ${femenino ? 'a la' : 'al'} ${palabra} y los usuarios ya no podrán visualizarl${femenino ? 'a' : 'o'} en el Observatorio Empresarial.`}
          textoConfirmar={`Eliminar ${palabra}`}
          peligro
          cargando={trabajando}
          onConfirmar={() => ejecutar(eliminar, 'eliminado')}
          onCancelar={() => setConfirmar(null)}
        />
      )}
      <Aviso
        abierto={!!aviso}
        titulo={aviso ? textosAviso[aviso].titulo : ''}
        mensaje={aviso ? textosAviso[aviso].mensaje : ''}
        detalle={aviso === 'eliminado' ? 'La información ya no estará disponible para los usuarios.' : 'Los cambios ya se pueden visualizar en el Observatorio Empresarial.'}
        onCerrar={() => {
          setAviso(null);
          onCerrar();
        }}
      />
    </>
  );
}
