import { expect, test } from '@playwright/test';

test.describe('Invitado (sin sesión)', () => {
  test('ve el Inicio con eventos, noticias y oportunidades', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Bienvenido al Observatorio Empresarial' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Eventos destacados' })).toBeVisible();
    for (const columna of ['Próximos eventos', 'Últimas noticias', 'Oportunidades abiertas']) {
      await expect(page.getByRole('heading', { name: columna })).toBeVisible();
    }
    await expect(page.getByRole('button', { name: 'Iniciar sesión' }).or(page.getByRole('link', { name: 'Iniciar sesión' }))).toBeVisible();
  });

  test('consulta el detalle de un Flash informativo pero no puede crear', async ({ page }) => {
    await page.goto('/flash-informativo');
    await expect(page.getByRole('heading', { name: 'Flash Informativo' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Crear Flash informativo' })).toHaveCount(0);
    await page.getByRole('button', { name: /^Acceder/ }).first().click();
    const detalle = page.getByRole('dialog');
    await expect(detalle).toBeVisible();
    await expect(detalle.getByRole('button', { name: 'Editar' })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(detalle).toBeHidden();
  });

  test('usa la búsqueda global para abrir una tendencia', async ({ page }) => {
    await page.goto('/inicio');
    await page.getByRole('combobox', { name: 'Buscar en el Observatorio' }).fill('IA generativa');
    await page.getByRole('option', { name: /IA generativa/ }).first().click();
    await expect(page).toHaveURL(/\/tendencias\/\d+$/);
    await expect(page.getByRole('dialog', { name: 'IA generativa' })).toBeVisible();
  });

  test('las páginas de administración piden iniciar sesión', async ({ page }) => {
    await page.goto('/usuarios');
    await expect(page).toHaveURL(/\/iniciar-sesion$/);
    await expect(page.getByRole('heading', { name: 'Bienvenido de nuevo' })).toBeVisible();
  });

  test('muestra el error de credenciales incorrectas', async ({ page }) => {
    await page.goto('/iniciar-sesion');
    await page.getByLabel('Correo electrónico').fill('nadie@ejemplo.com');
    await page.getByLabel('Contraseña').fill('contrasena-incorrecta');
    await page.getByRole('button', { name: 'Ingresar al portal' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
  });
});
