import type { ErrorRequestHandler, RequestHandler } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';
import { config } from './config.js';

/** Error con código HTTP que se devuelve tal cual al cliente. */
export class ErrorApi extends Error {
  constructor(
    public readonly estado: number,
    mensaje: string,
    public readonly detalles?: unknown,
  ) {
    super(mensaje);
    this.name = 'ErrorApi';
  }
}

export const noEncontrado = (que = 'Recurso') => new ErrorApi(404, `${que} no encontrado`);
export const prohibido = (mensaje = 'No tienes permiso para realizar esta acción') => new ErrorApi(403, mensaje);
export const noAutenticado = (mensaje = 'Debes iniciar sesión') => new ErrorApi(401, mensaje);

interface ErrorPostgres {
  code: string;
  constraint?: string;
  detail?: string;
}

function esErrorPostgres(error: unknown): error is ErrorPostgres {
  return typeof error === 'object' && error !== null && typeof (error as ErrorPostgres).code === 'string'
    && /^[0-9A-Z]{5}$/.test((error as ErrorPostgres).code);
}

/** Traduce los errores de PostgreSQL a respuestas HTTP comprensibles. */
function desdePostgres(error: ErrorPostgres): ErrorApi | null {
  switch (error.code) {
    case '23505':
      return new ErrorApi(409, 'Ya existe un registro con esos datos', { restriccion: error.constraint });
    case '23503':
      return new ErrorApi(409, 'El registro está relacionado con otro que no existe o que aún lo usa', {
        restriccion: error.constraint,
      });
    case '23514':
      return new ErrorApi(400, 'Los datos no cumplen una regla de la base de datos', { restriccion: error.constraint });
    case '23502':
      return new ErrorApi(400, 'Falta un dato obligatorio');
    case '22P02':
    case '22007':
    case '22008':
      return new ErrorApi(400, 'Un dato tiene un formato inválido');
    case '22001':
      return new ErrorApi(400, 'Un texto supera la longitud permitida');
    case '42501':
      return prohibido();
    default:
      return null;
  }
}

export const rutaNoEncontrada: RequestHandler = (_req, _res, next) => {
  next(new ErrorApi(404, 'Ruta no encontrada'));
};

export const manejadorErrores: ErrorRequestHandler = (error, _req, res, _next) => {
  let respuesta: ErrorApi | null = null;

  if (error instanceof ErrorApi) {
    respuesta = error;
  } else if (error instanceof ZodError) {
    respuesta = new ErrorApi(
      400,
      'Datos inválidos',
      error.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message })),
    );
  } else if (error instanceof multer.MulterError) {
    respuesta = error.code === 'LIMIT_FILE_SIZE'
      ? new ErrorApi(413, `El archivo supera el tamaño máximo de ${Math.round(config.uploads.maxBytes / 1048576)} MB`)
      : new ErrorApi(400, `Archivo inválido: ${error.message}`);
  } else if (esErrorPostgres(error)) {
    respuesta = desdePostgres(error);
  } else if (error?.type === 'entity.parse.failed') {
    respuesta = new ErrorApi(400, 'El cuerpo de la petición no es un JSON válido');
  } else if (typeof error?.status === 'number' && error.status >= 400 && error.status < 500) {
    // Errores HTTP de Express y sus módulos (p. ej. una imagen que no existe en /uploads).
    respuesta = new ErrorApi(error.status, error.status === 404 ? 'Recurso no encontrado' : 'Petición inválida');
  }

  if (!respuesta) {
    console.error(error);
    respuesta = new ErrorApi(500, 'Error interno del servidor');
  }

  res.status(respuesta.estado).json({
    error: respuesta.message,
    ...(respuesta.detalles !== undefined ? { detalles: respuesta.detalles } : {}),
  });
};
