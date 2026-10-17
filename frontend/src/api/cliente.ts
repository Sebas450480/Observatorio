/**
 * Cliente HTTP del backend. Todas las peticiones van a /api con la cookie de sesión.
 */
export class ErrorApi extends Error {
  constructor(
    public readonly estado: number,
    mensaje: string,
    public readonly detalles?: unknown,
  ) {
    super(mensaje);
    this.name = 'ErrorApi';
  }

  /** Errores de validación por campo: { campo: mensaje }. */
  get erroresPorCampo(): Record<string, string> {
    if (!Array.isArray(this.detalles)) return {};
    return Object.fromEntries(
      (this.detalles as { campo?: string; mensaje?: string }[])
        .filter((d) => d.campo)
        .map((d) => [d.campo as string, d.mensaje ?? 'Valor inválido']),
    );
  }
}

type Consulta = Record<string, string | number | boolean | undefined | null | (string | number)[]>;

interface Opciones {
  metodo?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  cuerpo?: unknown;
  consulta?: Consulta;
  formulario?: FormData;
  senal?: AbortSignal;
}

export function construirConsulta(consulta?: Consulta): string {
  if (!consulta) return '';
  const params = new URLSearchParams();
  for (const [clave, valor] of Object.entries(consulta)) {
    if (valor === undefined || valor === null || valor === '') continue;
    if (Array.isArray(valor)) valor.forEach((v) => params.append(clave, String(v)));
    else params.append(clave, String(valor));
  }
  const texto = params.toString();
  return texto ? `?${texto}` : '';
}

export async function api<T>(ruta: string, opciones: Opciones = {}): Promise<T> {
  const encabezados: Record<string, string> = { Accept: 'application/json' };
  let cuerpo: BodyInit | undefined;
  if (opciones.formulario) {
    cuerpo = opciones.formulario;
  } else if (opciones.cuerpo !== undefined) {
    encabezados['Content-Type'] = 'application/json';
    cuerpo = JSON.stringify(opciones.cuerpo);
  }

  let respuesta: Response;
  try {
    respuesta = await fetch(`/api${ruta}${construirConsulta(opciones.consulta)}`, {
      method: opciones.metodo ?? 'GET',
      headers: encabezados,
      body: cuerpo,
      credentials: 'include',
      signal: opciones.senal,
    });
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    throw new ErrorApi(0, 'No hay conexión con el servidor. Revisa tu conexión e inténtalo de nuevo.');
  }

  if (respuesta.status === 204) return undefined as T;
  const tipo = respuesta.headers.get('content-type') ?? '';
  const datos = tipo.includes('application/json') ? await respuesta.json() : null;
  if (!respuesta.ok) {
    throw new ErrorApi(respuesta.status, datos?.error ?? `Error ${respuesta.status}`, datos?.detalles);
  }
  return datos as T;
}

/** URL de un archivo que se descarga directamente (Excel, PDF). */
export function urlDescarga(ruta: string, consulta?: Consulta): string {
  return `/api${ruta}${construirConsulta(consulta)}`;
}

export function mensajeDeError(error: unknown): string {
  if (error instanceof ErrorApi) return error.message;
  if (error instanceof Error) return error.message;
  return 'Ocurrió un error inesperado';
}
