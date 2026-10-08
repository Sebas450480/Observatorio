import { expect, test } from '@playwright/test';
import { iniciarSesion } from './ayudas';

test.describe('Usuario registrado', () => {
  test.beforeEach(async ({ page }) => {
    await iniciarSesion(page, 'usuario');
  });

  test('no ve las opciones de administración', async ({ page }) => {
    const menu = page.getByRole('complementary', { name: 'Menú principal' });
    await expect(menu.getByRole('link', { name: 'Flash informativo' })).toBeVisible();
    await expect(menu.getByRole('link', { name: 'Usuarios' })).toHaveCount(0);
    await expect(menu.getByRole('link', { name: 'Estadísticas' })).toHaveCount(0);
    await page.goto('/estadisticas');
    await expect(page.getByRole('heading', { name: 'No tienes permiso para ver esta página' })).toBeVisible();
    await page.goto('/faro-empresarial');
    await expect(page.getByRole('heading', { name: 'Faro Empresarial' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Crear registro' })).toHaveCount(0);
  });

  test('actualiza su perfil e intereses', async ({ page }) => {
    await page.goto('/mi-perfil');
    await page.getByLabel('Ciudad').fill('Medellín');
    await page.getByRole('button', { name: 'Becas' }).click();
    await page.getByLabel('Frecuencia de las alertas').selectOption('Inmediata');
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page.getByRole('dialog', { name: 'Perfil actualizado' })).toBeVisible();
    await page.getByRole('button', { name: 'Aceptar' }).click();
    await page.reload();
    await expect(page.getByLabel('Ciudad')).toHaveValue('Medellín');
    await expect(page.getByRole('button', { name: 'Becas' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('no puede cambiar la contraseña sin la actual correcta', async ({ page }) => {
    await page.goto('/mi-perfil');
    await page.getByRole('button', { name: 'Cambiar contraseña' }).click();
    const modal = page.getByRole('dialog', { name: 'Cambiar contraseña' });
    await modal.getByLabel('Contraseña actual').fill('no-es-la-actual');
    await modal.getByLabel('Nueva contraseña', { exact: true }).fill('Nueva-Contrasena-2026');
    await modal.getByLabel('Confirmar nueva contraseña').fill('Nueva-Contrasena-2026');
    await modal.getByRole('button', { name: 'Cambiar contraseña' }).click();
    await expect(modal.getByText('La contraseña actual no es correcta')).toBeVisible();
  });
});
