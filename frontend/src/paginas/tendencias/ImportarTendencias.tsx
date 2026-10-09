import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Download, FileSpreadsheet } from 'lucide-react';
import { useState } from 'react';
import { ErrorApi, api, mensajeDeError, urlDescarga } from '../../api/cliente';
import { Boton } from '../../componentes/ui/Boton';
import { Modal } from '../../componentes/ui/Modal';

interface ErrorFila {
  fila: number;
  mensaje: string;
}

/** Importación masiva de tendencias desde la plantilla de Excel (RF-22). */
export function ImportarTendencias({ onCerrar }: { onCerrar: () => void }) {
  const cliente = useQueryClient();
  const [archivo, setArchivo] = useState<File | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<{ mensaje: string; filas: ErrorFila[] } | null>(null);
  const [importadas, setImportadas] = useState<number | null>(null);

  const importar = async () => {
    if (!archivo) return;
    setTrabajando(true);
    setError(null);
    try {
      const formulario = new FormData();
      formulario.append('archivo', archivo);
      const r = await api<{ importadas: number }>('/tendencias/importar', { metodo: 'POST', formulario });
      setImportadas(r.importadas);
      await cliente.invalidateQueries({ queryKey: ['/tendencias'] });
    } catch (e) {
      const detalles = e instanceof ErrorApi ? (e.detalles as { errores?: ErrorFila[] } | undefined) : undefined;
      setError({ mensaje: mensajeDeError(e), filas: detalles?.errores ?? [] });
    } finally {
      setTrabajando(false);
    }
  };

  return (
    <Modal abierto onCerrar={onCerrar} titulo="Importar tendencias" subtitulo="Carga varias tendencias desde un archivo de Excel" ancho={620}>
      {importadas !== null ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <CheckCircle2 className="size-12 text-exito" aria-hidden />
          <p className="text-body font-semibold text-azul-titulo">Se importaron {importadas} tendencias correctamente.</p>
          <Boton className="mt-2 min-w-40" onClick={onCerrar}>
            Aceptar
          </Boton>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <ol className="list-decimal space-y-1 pl-5 text-small text-texto">
            <li>Descarga la plantilla y llénala siguiendo la hoja de instrucciones.</li>
            <li>Sube el archivo (.xlsx). Si alguna fila tiene errores, no se importa ninguna y te indicamos qué corregir.</li>
          </ol>
          <a
            href={urlDescarga('/tendencias/plantilla')}
            className="inline-flex h-10 items-center gap-2 self-start rounded-control border border-borde px-4 text-caption font-semibold text-azul-titulo hover:bg-fondo"
          >
            <Download className="size-4" aria-hidden /> Descargar plantilla
          </a>
          <label className="flex cursor-pointer items-center gap-3 rounded-control border border-dashed border-borde bg-[#f9fafb] p-4 hover:border-azul-oscuro">
            <FileSpreadsheet className="size-6 text-exito" aria-hidden />
            <span className="text-small text-texto-suave">{archivo ? archivo.name : 'Elegir archivo de Excel (.xlsx)'}</span>
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              onChange={(e) => {
                setArchivo(e.target.files?.[0] ?? null);
                setError(null);
              }}
            />
          </label>
          {error && (
            <div role="alert" className="rounded-lg bg-rojo-claro px-4 py-3 text-caption text-rojo">
              <p className="font-semibold">{error.mensaje}</p>
              {error.filas.length > 0 && (
                <ul className="mt-2 max-h-48 list-disc space-y-0.5 overflow-y-auto pl-5">
                  {error.filas.map((f) => (
                    <li key={`${f.fila}-${f.mensaje}`}>
                      Fila {f.fila}: {f.mensaje}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Boton variante="secundario" onClick={onCerrar}>
              Cancelar
            </Boton>
            <Boton onClick={importar} disabled={!archivo} cargando={trabajando}>
              Importar
            </Boton>
          </div>
        </div>
      )}
    </Modal>
  );
}
