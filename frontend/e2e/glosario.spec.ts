import { expect, test } from '@playwright/test';
import { iniciarSesion, irA } from './ayudas';

test.describe('Glosario y páginas legales', () => {
  test('la administración agrega un término y el público lo encuentra por letra y búsqueda', async ({ page }) => {
    await iniciarSesion(page, 'superadmin');
    await irA(page, 'Glosario');
    await expect(page.getByRole('heading', { name: 'Glosario', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Agregar término' }).click();
    const formulario = page.getByRole('dialog', { name: 'Nuevo término' });
    await formulario.getByLabel('Término').fill('Coformación E2E');
    await formulario.getByLabel('Definición').fill('Formación compartida entre la universidad y la empresa.');
    await formulario.getByRole('button', { name: 'Guardar nuevo registro' }).click();
    await expect(page.getByRole('dialog', { name: 'Registro creado' })).toBeVisible();
    await page.getByRole('button', { name: 'Aceptar' }).click();

    await page.context().clearCookies();
    await page.goto('/glosario');
    await expect(page.getByRole('button', { name: 'Agregar término' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Letra C' }).click();
    await expect(page.getByRole('term').filter({ hasText: 'Coformación E2E' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Letra Z' })).toBeDisabled();

    await page.getByRole('button', { name: 'Letra C' }).click();
    await page.getByRole('searchbox', { name: 'Buscar en el glosario' }).fill('universidad y la empresa');
    await page.getByRole('button', { name: 'Buscar', exact: true }).click();
    await expect(page.getByRole('term').filter({ hasText: 'Coformación E2E' })).toBeVisible();
  });

  test('la política de tratamiento de datos está publicada y enlazada desde el menú', async ({ page }) => {
    await page.goto('/politica-de-datos');
    await expect(page.getByRole('heading', { name: 'Política de tratamiento de datos personales' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '4. Derechos de los titulares' })).toBeVisible();
    await expect(page.getByRole('complementary', { name: 'Menú principal' }).getByRole('link', { name: 'Política de tratamiento de datos' })).toBeVisible();
  });

  test('«¿Olvidaste tu contraseña?» lleva al formulario de recuperación', async ({ page }) => {
    await page.goto('/iniciar-sesion');
    await page.getByRole('link', { name: '¿Olvidaste tu contraseña?' }).click();
    await expect(page).toHaveURL(/\/recuperar-contrasena$/);
    await page.getByLabel('Correo electrónico').fill('usuario.e2e@gmail.com');
    await page.getByRole('button', { name: 'Enviar enlace' }).click();
    await expect(page.getByRole('dialog', { name: 'Enlace enviado' })).toBeVisible();
  });
});
