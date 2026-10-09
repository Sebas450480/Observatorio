import { expect, test, type Page } from '@playwright/test';
import { iniciarSesion } from './ayudas';

/** Ninguna pantalla debe desplazarse de lado en un celular. */
async function sinDesbordeHorizontal(page: Page) {
  const anchos = await page.evaluate(() => ({ contenido: document.documentElement.scrollWidth, pantalla: document.documentElement.clientWidth }));
  expect(anchos.contenido).toBeLessThanOrEqual(anchos.pantalla);
}

test.describe('Celular', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await iniciarSesion(page, 'superadmin');
  });

  test('las pantallas principales caben en el ancho del celular', async ({ page }) => {
    for (const ruta of ['/inicio', '/flash-informativo', '/faro-empresarial', '/empresas', '/tendencias', '/eventos', '/usuarios', '/estadisticas', '/mi-perfil']) {
      await page.goto(ruta);
      await page.waitForLoadState('networkidle');
      await sinDesbordeHorizontal(page);
    }
  });

  test('el mapa de tendencias queda dentro de su tarjeta', async ({ page }) => {
    await page.goto('/tendencias');
    await page.getByRole('tab', { name: 'Mapa de tendencias' }).click();
    const mapa = page.locator('.recharts-wrapper').first();
    await expect(mapa).toBeVisible();
    const tarjeta = page.locator('section', { has: page.getByRole('heading', { name: 'Mapa de tendencias' }) });
    const [cajaMapa, cajaTarjeta] = await Promise.all([mapa.boundingBox(), tarjeta.boundingBox()]);
    expect(cajaMapa!.x + cajaMapa!.width).toBeLessThanOrEqual(cajaTarjeta!.x + cajaTarjeta!.width);
    await sinDesbordeHorizontal(page);
  });

  test('los usuarios se muestran como tarjetas en lugar de tabla', async ({ page }) => {
    await page.goto('/usuarios');
    await expect(page.getByRole('table')).toBeHidden();
    await expect(page.getByRole('button', { name: /^Editar a / }).first()).toBeVisible();
  });
});
