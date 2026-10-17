import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorApi, api, construirConsulta, mensajeDeError } from './cliente';

afterEach(() => vi.unstubAllGlobals());

describe('cliente del backend', () => {
  it('arma la consulta sin valores vacíos y con listas repetidas', () => {
    expect(construirConsulta({ q: 'IA', vacio: '', nulo: null, categoria: [1, 2], pagina: 1 })).toBe('?q=IA&categoria=1&categoria=2&pagina=1');
    expect(construirConsulta({})).toBe('');
  });

  it('envía JSON con la cookie de sesión', async () => {
    const fetchFalso = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchFalso);
    await expect(api('/flash', { metodo: 'POST', cuerpo: { titulo: 'x' } })).resolves.toEqual({ ok: true });
    const [url, opciones] = fetchFalso.mock.calls[0]!;
    expect(url).toBe('/api/flash');
    expect(opciones).toMatchObject({ method: 'POST', credentials: 'include', body: '{"titulo":"x"}' });
  });

  it('convierte las respuestas de error en ErrorApi con errores por campo', async () => {
    const cuerpo = { error: 'Datos inválidos', detalles: [{ campo: 'correo', mensaje: 'Correo inválido' }] };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(cuerpo), { status: 400, headers: { 'content-type': 'application/json' } })));
    const error = await api('/perfil').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorApi);
    expect((error as ErrorApi).estado).toBe(400);
    expect((error as ErrorApi).erroresPorCampo).toEqual({ correo: 'Correo inválido' });
    expect(mensajeDeError(error)).toBe('Datos inválidos');
  });

  it('avisa cuando no hay conexión', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(api('/flash')).rejects.toMatchObject({ estado: 0 });
  });
});
