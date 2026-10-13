import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Servidor propio: con FRONTEND_DIR la misma aplicación entrega la página web compilada.
describe('Página web desde el backend (FRONTEND_DIR)', () => {
  let app: import('express').Express;

  beforeAll(async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'frontend-'));
    mkdirSync(path.join(dir, 'assets'));
    writeFileSync(path.join(dir, 'index.html'), '<!doctype html><div id="raiz"></div>');
    writeFileSync(path.join(dir, 'assets', 'app-123.js'), 'console.log(1)');
    process.env.FRONTEND_DIR = dir;
    vi.resetModules();
    const { crearApp } = await import('../src/app.js');
    app = crearApp();
  });

  afterAll(() => {
    delete process.env.FRONTEND_DIR;
    vi.resetModules();
  });

  it('devuelve index.html en las rutas de la página y permite el mapa de Google', async () => {
    const r = await request(app).get('/empresas/1');
    expect(r.status).toBe(200);
    expect(r.text).toContain('id="raiz"');
    expect(r.headers['cache-control']).toBe('no-cache');
    expect(r.headers['content-security-policy']).toContain('frame-src https://maps.google.com');
  });

  it('entrega los archivos compilados con caché larga', async () => {
    const r = await request(app).get('/assets/app-123.js');
    expect(r.status).toBe(200);
    expect(r.headers['cache-control']).toContain('immutable');
    expect((await request(app).get('/assets/no-existe.js')).status).toBe(404);
  });

  it('la API sigue respondiendo JSON, también en rutas que no existen', async () => {
    expect((await request(app).get('/api/salud')).body.estado).toBe('ok');
    const r = await request(app).get('/api/no-existe');
    expect(r.status).toBe(404);
    expect(r.headers['content-type']).toContain('application/json');
  });
});
