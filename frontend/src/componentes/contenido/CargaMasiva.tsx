import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, FileUp, ImagePlus } from 'lucide-react';
import { useRef, useState } from 'react';
import { ErrorApi, api, mensajeDeError, urlDescarga } from '../../api/cliente';
import { Boton } from '../ui/Boton';
import { Modal } from '../ui/Modal';

const MAXIMO = 50;

function textoGuardar(total: number | null, conInvitaciones?: boolean) {
  if (conInvitaciones) {
    if (total === null) return 'Crear y enviar invitaciones';
    return total === 1 ? 'Crear 1 empresa y enviar la invitación' : `Crear ${total} empresas y enviar invitaciones`;
  }
  if (total === null) return 'Guardar';
  return total === 1 ? 'Guardar 1 registro' : `Guardar ${total} registros`;
}

interface ErrorCarga {
  fila: number;
  columna?: string;
  mensaje: string;
}

interface Revision {
  total: number;
  validos: number;
  errores: ErrorCarga[];
  registros: { fila: number; resumen: string; imagenes: Record<string, string> }[];
}

interface Resultado {
  importados: number;
  creados: { fila: number; id: number; imagenes: Record<string, string> }[];
  invitaciones_enviadas?: number;
  correos_fallidos?: string[];
}

interface Props {
  /** Ruta del módulo en la API, p. ej. "/flash". */
  ruta: string;
  /** Nombre del módulo para los textos (p. ej. "Flash Informativo"). */
  modulo: string;
  /** Rutas de consultas que se refrescan al guardar (además de `ruta`). */
  refrescar?: string[];
  /** Empresas: cada fila crea la empresa y envía la invitación. */
  conInvitaciones?: boolean;
  /** El módulo tiene imágenes: se pueden adjuntar (opcionales) junto con el Excel. */
  conImagenes?: boolean;
  className?: string;
}

/** Busca la imagen adjunta por su nombre (sin importar mayúsculas). */
const buscarImagen = (imagenes: File[], nombre: string) => imagenes.find((f) => f.name.toLowerCase() === nombre.toLowerCase());

/**
 * Carga masiva desde Excel (máximo 50 registros): descargar la plantilla, subir el
 * archivo, revisar los errores por fila y columna y guardar todo junto.
 */
export function CargaMasiva({ ruta, modulo, refrescar = [], conInvitaciones, conImagenes, className }: Props) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <Boton variante="secundario" pildora className={className} icono={<FileUp className="size-4" aria-hidden />} onClick={() => setAbierto(true)}>
        Carga masiva
      </Boton>
      {abierto && (
        <ModalCargaMasiva ruta={ruta} modulo={modulo} refrescar={refrescar} conInvitaciones={conInvitaciones} conImagenes={conImagenes} onCerrar={() => setAbierto(false)} />
      )}
    </>
  );
}

function ModalCargaMasiva({ ruta, modulo, refrescar = [], conInvitaciones, conImagenes, onCerrar }: Omit<Props, 'className'> & { onCerrar: () => void }) {
  const cliente = useQueryClient();
  const entrada = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [revision, setRevision] = useState<Revision | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [imagenes, setImagenes] = useState<File[]>([]);
  const [imagenesSubidas, setImagenesSubidas] = useState(0);
  const [imagenesFallidas, setImagenesFallidas] = useState<string[]>([]);

  /** Sube las imágenes adjuntas a los registros recién creados (una por una; si alguna falla, se sube después). */
  const subirImagenes = async (creados: Resultado['creados']) => {
    let subidas = 0;
    const fallidas: string[] = [];
    for (const { id, imagenes: pedidas } of creados) {
      for (const [campo, nombre] of Object.entries(pedidas)) {
        const archivoImagen = buscarImagen(imagenes, nombre);
        if (!archivoImagen) continue;
        try {
          const formulario = new FormData();
          formulario.append('imagen', archivoImagen);
          await api(`${ruta}/${id}/imagen/${campo}`, { metodo: 'POST', formulario });
          subidas++;
        } catch (e) {
          fallidas.push(`${nombre} (${mensajeDeError(e)})`);
        }
      }
    }
    setImagenesSubidas(subidas);
    setImagenesFallidas(fallidas);
  };

  const enviar = async <T,>(elegido: File, validar: boolean) => {
    const formulario = new FormData();
    formulario.append('archivo', elegido);
    return api<T>(`${ruta}/importar${validar ? '?validar=1' : ''}`, { metodo: 'POST', formulario });
  };

  const revisar = async (elegido: File) => {
    setArchivo(elegido);
    setRevision(null);
    setError(null);
    setTrabajando(true);
    try {
      setRevision(await enviar<Revision>(elegido, true));
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setTrabajando(false);
      if (entrada.current) entrada.current.value = '';
    }
  };

  const guardar = async () => {
    if (!archivo) return;
    setTrabajando(true);
    setError(null);
    try {
      const guardado = await enviar<Resultado>(archivo, false);
      if (conImagenes && imagenes.length) await subirImagenes(guardado.creados);
      setResultado(guardado);
      const prefijos = [ruta, ...refrescar];
      await cliente.invalidateQueries({ predicate: (q) => prefijos.some((p) => String(q.queryKey[0]).startsWith(p)) });
    } catch (e) {
      const detalles = e instanceof ErrorApi ? (e.detalles as { errores?: ErrorCarga[] } | undefined) : undefined;
      if (detalles?.errores && revision) setRevision({ ...revision, errores: detalles.errores, validos: revision.total - new Set(detalles.errores.map((x) => x.fila)).size });
      else setError(mensajeDeError(e));
    } finally {
      setTrabajando(false);
    }
  };

  const listo = revision && revision.errores.length === 0;

  return (
    <Modal abierto onCerrar={onCerrar} titulo={`Carga masiva · ${modulo}`} subtitulo={`Sube hasta ${MAXIMO} registros desde la plantilla de Excel`} ancho={760}>
      {resultado ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center" role="status">
          <CheckCircle2 className="size-12 text-exito" aria-hidden />
          <p className="text-body font-semibold text-azul-titulo">
            {conInvitaciones
              ? resultado.importados === 1
                ? 'Se creó 1 empresa (inactiva hasta que complete su ficha).'
                : `Se crearon ${resultado.importados} empresas (inactivas hasta que completen su ficha).`
              : resultado.importados === 1
                ? 'Se guardó 1 registro correctamente.'
                : `Se guardaron ${resultado.importados} registros correctamente.`}
          </p>
          {imagenesSubidas > 0 && (
            <p className="text-small text-texto">{imagenesSubidas === 1 ? 'Se subió 1 imagen.' : `Se subieron ${imagenesSubidas} imágenes.`}</p>
          )}
          {imagenesFallidas.length > 0 && (
            <p className="rounded-lg bg-[#fff8e1] px-4 py-2 text-caption text-[#7a5a00]">
              No se pudieron subir: {imagenesFallidas.join('; ')}. Puedes subirlas desde el formulario de edición.
            </p>
          )}
          {conInvitaciones && (
            <p className="text-small text-texto">
              Se {resultado.invitaciones_enviadas === 1 ? 'envió 1 invitación' : `enviaron ${resultado.invitaciones_enviadas ?? 0} invitaciones`} por correo.
            </p>
          )}
          {!!resultado.correos_fallidos?.length && (
            <p className="rounded-lg bg-[#fff8e1] px-4 py-2 text-caption text-[#7a5a00]">
              No se pudo enviar el correo a: {resultado.correos_fallidos.join(', ')}. Puedes reenviar la invitación desde «Invitar empresa».
            </p>
          )}
          <Boton className="mt-2 min-w-40" onClick={onCerrar}>
            Aceptar
          </Boton>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <ol className="list-decimal space-y-1 pl-5 text-small text-texto">
            <li>Descarga la plantilla. La hoja «Instrucciones» explica cada columna; las columnas en rojo son obligatorias.</li>
            <li>Escribe un registro por fila (máximo {MAXIMO}) y guarda el archivo.</li>
            <li>Súbelo: revisamos el archivo y te mostramos los errores antes de guardar. Si alguna fila tiene errores, no se guarda ninguna.</li>
            {conInvitaciones && <li>Cada empresa queda inactiva y su contacto recibe la invitación para crear su contraseña y completar la ficha.</li>}
          </ol>
          <div className="flex flex-col gap-3 sm:flex-row">
            <a
              href={urlDescarga(`${ruta}/plantilla`)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-borde px-5 text-small font-semibold text-azul-titulo hover:bg-fondo"
            >
              <Download className="size-4" aria-hidden /> Descargar plantilla
            </a>
            <label className="flex min-h-11 flex-1 cursor-pointer items-center gap-3 rounded-[20px] border border-dashed border-borde bg-[#f9fafb] px-4 py-2 hover:border-azul-oscuro">
              <FileSpreadsheet className="size-5 shrink-0 text-exito" aria-hidden />
              <span className="truncate text-small text-texto-suave">{archivo ? archivo.name : 'Subir el Excel lleno (.xlsx)'}</span>
              <input
                ref={entrada}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="sr-only"
                aria-label="Archivo de Excel"
                onChange={(e) => {
                  const elegido = e.target.files?.[0];
                  if (elegido) void revisar(elegido);
                }}
              />
            </label>
          </div>
          {conImagenes && (
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[20px] border border-dashed border-borde bg-[#f9fafb] px-4 py-2 hover:border-azul-oscuro">
              <ImagePlus className="size-5 shrink-0 text-azul-titulo" aria-hidden />
              <span className="text-small text-texto-suave">
                {imagenes.length
                  ? `${imagenes.length} ${imagenes.length === 1 ? 'imagen adjunta' : 'imágenes adjuntas'} (opcional)`
                  : 'Imágenes (opcional): adjunta los JPG o PNG que nombraste en la columna de imagen'}
              </span>
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png"
                className="sr-only"
                aria-label="Imágenes (opcional)"
                onChange={(e) => setImagenes(Array.from(e.target.files ?? []))}
              />
            </label>
          )}

          {trabajando && !revision && <p className="text-small text-texto-suave" role="status">Revisando el archivo…</p>}
          {error && (
            <p role="alert" className="rounded-lg bg-rojo-claro px-4 py-3 text-caption font-semibold text-rojo">
              {error}
            </p>
          )}

          {revision && (
            <div className="flex flex-col gap-3">
              <p className={`flex items-center gap-2 text-small font-semibold ${listo ? 'text-exito' : 'text-rojo'}`} role="status">
                {listo ? <CheckCircle2 className="size-5" aria-hidden /> : <AlertTriangle className="size-5" aria-hidden />}
                {listo
                  ? `${revision.total} ${revision.total === 1 ? 'registro listo' : 'registros listos'} para guardar.`
                  : `${revision.total - revision.validos} de ${revision.total} ${revision.total === 1 ? 'registro tiene' : 'registros tienen'} errores. Corrige el archivo y vuelve a subirlo.`}
              </p>
              {!listo && (
                <div className="max-h-64 overflow-auto rounded-lg border border-[#f3c2cb]">
                  <table className="w-full text-left text-caption">
                    <thead className="sticky top-0 bg-rojo-claro text-rojo">
                      <tr>
                        <th scope="col" className="px-3 py-2">Fila</th>
                        <th scope="col" className="px-3 py-2">Columna</th>
                        <th scope="col" className="px-3 py-2">Qué corregir</th>
                      </tr>
                    </thead>
                    <tbody>
                      {revision.errores.map((e, i) => (
                        <tr key={`${e.fila}-${e.columna ?? ''}-${i}`} className="border-t border-[#f8dde2]">
                          <td className="px-3 py-1.5 font-semibold">{e.fila}</td>
                          <td className="px-3 py-1.5">{e.columna ?? '—'}</td>
                          <td className="px-3 py-1.5">{e.mensaje}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {listo && (
                <ul className="max-h-56 overflow-auto rounded-lg border border-[#e2e8f0] text-caption">
                  {revision.registros.map((r) => (
                    <li key={r.fila} className="flex gap-3 border-t border-[#eef1f5] px-3 py-1.5 first:border-t-0">
                      <span className="w-12 shrink-0 text-texto-suave">Fila {r.fila}</span>
                      <span className="flex-1 text-texto">{r.resumen}</span>
                      {Object.values(r.imagenes ?? {}).map((nombre) => (
                        <span key={nombre} className={`shrink-0 ${buscarImagen(imagenes, nombre) ? 'text-exito' : 'text-texto-suave'}`}>
                          {buscarImagen(imagenes, nombre) ? `Imagen: ${nombre}` : `${nombre}: sin adjuntar (puedes subirla después)`}
                        </span>
                      ))}
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
            <Boton onClick={guardar} disabled={!listo} cargando={trabajando && !!revision}>
              {textoGuardar(listo ? revision.total : null, conInvitaciones)}
            </Boton>
          </div>
        </div>
      )}
    </Modal>
  );
}
