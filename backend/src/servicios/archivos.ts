import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { del, put } from '@vercel/blob';
import multer from 'multer';
import { config } from '../config.js';
import { ErrorApi } from '../errores.js';

/**
 * Imágenes subidas. La base de datos guarda solo la dirección pública de la imagen:
 * - Con SUPABASE_URL y SUPABASE_SECRET_KEY: se guardan en Supabase Storage y la dirección es
 *   https://<proyecto>.supabase.co/storage/v1/object/public/<bucket>/<carpeta>/<id>.jpg
 * - Si no, con BLOB_STORE_ID o BLOB_READ_WRITE_TOKEN (Vercel): se guardan en Vercel Blob y la dirección es https://....blob.vercel-storage.com/...
 * - Sin ninguno (desarrollo y pruebas): se guardan como archivo en UPLOADS_DIR y la dirección es /uploads/<carpeta>/<id>.jpg
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

  const nombre = `${randomUUID()}.${tipo.extension}`;
  const supabase = config.uploads.supabase;
  if (supabase) {
    const ruta = `${carpeta}/${nombre}`;
    const respuesta = await fetch(`${supabase.url}/storage/v1/object/${supabase.bucket}/${ruta}`, {
      method: 'POST',
      headers: { ...cabecerasSupabase(supabase.llave), 'Content-Type': tipo.extension === 'png' ? 'image/png' : 'image/jpeg', 'Cache-Control': 'max-age=31536000' },
      body: new Uint8Array(archivo.buffer),
    });
    if (!respuesta.ok) {
      console.error('Supabase Storage rechazó la imagen:', respuesta.status, await respuesta.text().catch(() => ''));
      throw new ErrorApi(502, 'No se pudo guardar la imagen. Intenta de nuevo.');
    }
    return `${supabase.url}/storage/v1/object/public/${supabase.bucket}/${ruta}`;
  }
  if (config.uploads.usarBlob) {
    // Sin token explícito, la librería usa la credencial OIDC de Vercel con BLOB_STORE_ID.
    const blob = await put(`${carpeta}/${nombre}`, archivo.buffer, {
      access: 'public',
      contentType: tipo.extension === 'png' ? 'image/png' : 'image/jpeg',
      token: config.uploads.tokenBlob,
    });
    return blob.url;
  }

  const directorio = path.join(config.uploads.directorio, carpeta);
  await mkdir(directorio, { recursive: true });
  await writeFile(path.join(directorio, nombre), archivo.buffer);
  return `/uploads/${carpeta}/${nombre}`;
}

/** Las llaves nuevas (sb_secret_...) van solo en `apikey`; la antigua service_role (JWT) también como Bearer. */
function cabecerasSupabase(llave: string): Record<string, string> {
  return llave.startsWith('eyJ') ? { apikey: llave, Authorization: `Bearer ${llave}` } : { apikey: llave };
}

/** Ruta dentro del bucket si la dirección es una imagen pública de nuestro bucket de Supabase. */
function rutaSupabase(direccion: string): string | null {
  const supabase = config.uploads.supabase;
  if (!supabase) return null;
  const prefijo = `${supabase.url}/storage/v1/object/public/${supabase.bucket}/`;
  if (!direccion.startsWith(prefijo)) return null;
  const ruta = direccion.slice(prefijo.length);
  return /^[\w-]+\/[\w-]+\.(jpg|png)$/.test(ruta) ? ruta : null;
}

/** ¿Es una imagen guardada en Vercel Blob? */
function esBlob(direccion: string): boolean {
  try {
    const url = new URL(direccion);
    return url.protocol === 'https:' && url.hostname.endsWith('.blob.vercel-storage.com');
  } catch {
    return false;
  }
}

/** Borra una imagen guardada antes. Ignora rutas fuera de la carpeta de imágenes. */
export async function borrarImagen(rutaPublica: string | null | undefined): Promise<void> {
  const enSupabase = rutaPublica ? rutaSupabase(rutaPublica) : null;
  if (enSupabase) {
    const { url, bucket, llave } = config.uploads.supabase!;
    await fetch(`${url}/storage/v1/object/${bucket}/${enSupabase}`, { method: 'DELETE', headers: cabecerasSupabase(llave) })
      .then((r) => (r.ok || r.status === 404 ? undefined : console.error('No se pudo borrar la imagen:', r.status)))
      .catch((e) => console.error('No se pudo borrar la imagen:', e));
    return;
  }
  if (rutaPublica && config.uploads.usarBlob && esBlob(rutaPublica)) {
    await del(rutaPublica, { token: config.uploads.tokenBlob }).catch((e) => console.error('No se pudo borrar la imagen:', e));
    return;
  }
  if (!rutaPublica?.startsWith('/uploads/')) return;
  const absoluta = path.resolve(config.uploads.directorio, rutaPublica.slice('/uploads/'.length));
  if (!absoluta.startsWith(config.uploads.directorio + path.sep)) return;
  await unlink(absoluta).catch(() => undefined);
}
