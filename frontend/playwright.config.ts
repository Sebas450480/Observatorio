import { defineConfig, devices } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PUERTO_BACKEND, PUERTO_FRONTEND, urlBackend } from './e2e/entorno.mjs';

/**
 * Pruebas de extremo a extremo con el backend real y una base de datos de pruebas.
 * Antes de ejecutarlas se prepara la base: `npm run e2e` lo hace automáticamente.
 * Si el Chromium instalado no coincide con esta versión de Playwright, indica su ruta en PW_CHROMIUM.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PUERTO_FRONTEND}`,
    locale: 'es-CO',
    timezoneId: 'America/Bogota',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
      },
    },
  ],
  webServer: [
    {
      command: '../backend/node_modules/.bin/tsx ../backend/src/servidor.ts',
      url: `http://localhost:${PUERTO_BACKEND}/api/salud`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        NODE_ENV: 'development',
        PUERTO: String(PUERTO_BACKEND),
        DATABASE_URL: urlBackend(),
        DATABASE_SSL: 'false',
        JWT_SECRETO: 'secreto-de-pruebas-e2e-con-mas-de-32-caracteres',
        BCRYPT_COSTO: '4',
        FRONTEND_URL: `http://localhost:${PUERTO_FRONTEND}`,
        API_URL_PUBLICA: `http://localhost:${PUERTO_FRONTEND}`,
        UPLOADS_DIR: mkdtempSync(path.join(tmpdir(), 'obs-e2e-')),
        ALERTAS_ACTIVAS: 'false',
        SMTP_HOST: '',
      },
    },
    {
      command: `npx vite --port ${PUERTO_FRONTEND} --strictPort`,
      url: `http://localhost:${PUERTO_FRONTEND}`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: { BACKEND_URL: `http://localhost:${PUERTO_BACKEND}` },
    },
  ],
});
