import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import { config } from '../config.js';
import { ErrorApi } from '../errores.js';

/**
 * Imágenes subidas: se guardan como archivo en el servidor (carpeta UPLOADS_DIR)
 * y la base de datos guarda solo la ruta pública, p. ej. /uploads/flash/<id>.jpg
 */

/** Recibe un archivo en memoria (campo `nombreCampo`) con el tamaño máximo configurado. */
export const recibirArchivo = (nombreCampo: string) =>
  multer({ storage: multer.memoryStorage(), limits: { fileSize: config.uploads.maxBytes, files: 1 } }).single(nombreCampo);

type TipoImagen = { extension: 'jpg' | 'png' };

/** Reconoce JPG y PNG por su contenido (no por el nombre, que se puede falsificar). */
function detectarImagen(buffer: Buffer): TipoImagen | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { extension: 'jpg' };
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (buffer.length >= 8 && png.every((b, i) => buffer[i] === b)) return { extension: 'png' };
  return null;
}

/** Guarda una imagen y devuelve su ruta pública. */
export async function guardarImagen(archivo: Express.Multer.File | undefined, carpeta: string): Promise<string> {
  if (!archivo) throw new ErrorApi(400, 'Adjunta una imagen en el campo "imagen"');
  const tipo = detectarImagen(archivo.buffer);
  if (!tipo) throw new ErrorApi(415, 'La imagen debe ser JPG o PNG');

  const directorio = path.join(config.uploads.directorio, carpeta);
  await mkdir(directorio, { recursive: true });
  const nombre = `${randomUUID()}.${tipo.extension}`;
  await writeFile(path.join(directorio, nombre), archivo.buffer);
  return `/uploads/${carpeta}/${nombre}`;
}

/** Borra una imagen guardada antes. Ignora rutas fuera de la carpeta de imágenes. */
export async function borrarImagen(rutaPublica: string | null | undefined): Promise<void> {
  if (!rutaPublica?.startsWith('/uploads/')) return;
  const absoluta = path.resolve(config.uploads.directorio, rutaPublica.slice('/uploads/'.length));
  if (!absoluta.startsWith(config.uploads.directorio + path.sep)) return;
  await unlink(absoluta).catch(() => undefined);
}
