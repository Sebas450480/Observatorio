import { expect, test } from '@playwright/test';
import { iniciarSesion } from './ayudas';

/**
 * Capturas de cada pantalla como SuperAdmin, para compararlas con el Figma.
 * Se guardan en test-results/capturas/.
 */
const PANTALLAS = [
  { ruta: '/inicio', nombre: 'inicio', espera: 'Bienvenido al Observatorio Empresarial' },
  { ruta: '/flash-informativo', nombre: 'flash', espera: 'Flash Informativo' },
  { ruta: '/faro-empresarial', nombre: 'faro', espera: 'Faro Empresarial' },
  { ruta: '/empresas', nombre: 'empresas', espera: 'Empresas Coformadoras' },
  { ruta: '/tendencias', nombre: 'tendencias', espera: 'Tendencias Empresariales' },
  { ruta: '/eventos', nombre: 'eventos', espera: 'Calendario de Eventos' },
  { ruta: '/usuarios', nombre: 'usuarios', espera: 'Usuarios' },
  { ruta: '/estadisticas', nombre: 'estadisticas', espera: 'Panel de estadísticas' },
  { ruta: '/mi-perfil', nombre: 'mi-perfil', espera: 'Mi perfil' },
];

test('capturas de las pantallas del SuperAdmin', async ({ page }) => {
  await iniciarSesion(page, 'superadmin');
  for (const p of PANTALLAS) {
    await page.goto(p.ruta);
    await expect(page.getByRole('heading', { name: p.espera, exact: true }).first()).toBeVisible();
    await page.waitForLoadState('networkidle');
    const ancho = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(ancho, `${p.ruta} no debe tener scroll horizontal`).toBeLessThanOrEqual(1440);
    await page.screenshot({ path: `test-results/capturas/${p.nombre}.png`, fullPage: true });
  }
});

test('capturas de las pantallas de acceso', async ({ page }) => {
  for (const ruta of ['/iniciar-sesion', '/registro', '/recuperar-contrasena']) {
    await page.goto(ruta);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `test-results/capturas/${ruta.slice(1)}.png` });
  }
});

test('capturas en celular', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await iniciarSesion(page, 'superadmin');
  for (const ruta of ['/inicio', '/flash-informativo', '/empresas']) {
    await page.goto(ruta);
    await page.waitForLoadState('networkidle');
    const ancho = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(ancho, `${ruta} no debe tener scroll horizontal`).toBeLessThanOrEqual(390);
    await page.screenshot({ path: `test-results/capturas/movil${ruta.replace('/', '-')}.png` });
  }
});
