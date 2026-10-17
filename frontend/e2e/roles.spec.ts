import { expect, test } from '@playwright/test';
import { CONTRASENA, CUENTAS } from './entorno.mjs';

test.describe('Cuenta con varios roles', () => {
  test('al iniciar sesión elige el rol y luego lo cambia desde el menú', async ({ page }) => {
    await page.goto('/iniciar-sesion');
    await page.getByLabel('Correo electrónico').fill(CUENTAS.variosRoles.correo);
    await page.getByLabel('Contraseña').fill(CONTRASENA);
    await page.getByRole('button', { name: 'Ingresar al portal' }).click();

    // Modal para elegir el rol: marcado el principal.
    const modal = page.getByRole('dialog', { name: '¿Con qué rol quieres entrar?' });
    await expect(modal).toBeVisible();
    await expect(modal.getByRole('radio')).toHaveCount(2);
    await expect(modal.getByRole('radio', { name: /Gestor Flash/ })).toHaveAttribute('aria-checked', 'true');
    await modal.getByRole('radio', { name: /Gestor Calendario/ }).click();
    await modal.getByRole('button', { name: 'Entrar como Gestor Calendario' }).click();

    // Como Gestor Calendario solo ve y trabaja en Eventos.
    await expect(page).toHaveURL(/\/eventos$/);
    await expect(page.getByRole('button', { name: 'Crear evento' })).toBeVisible();
    const menu = page.getByRole('complementary', { name: 'Menú principal' });
    await expect(menu.getByRole('link', { name: 'Eventos institucionales' })).toBeVisible();
    await expect(menu.getByRole('link', { name: 'Flash Informativo', exact: true })).toHaveCount(0);
    await page.goto('/flash-informativo');
    await expect(page).toHaveURL(/\/eventos$/);

    // Cambia a Gestor Flash desde el menú de la sesión.
    await page.getByRole('button', { name: /Sesión de Julián/ }).click();
    await page.getByRole('menuitem', { name: /Cambiar de rol/ }).click();
    const cambio = page.getByRole('dialog', { name: '¿Con qué rol quieres entrar?' });
    await expect(cambio.getByRole('radio', { name: /Gestor Calendario/ })).toHaveAttribute('aria-checked', 'true');
    await cambio.getByRole('radio', { name: /Gestor Flash/ }).click();
    await cambio.getByRole('button', { name: 'Entrar como Gestor Flash Informativo' }).click();
    await expect(cambio).toBeHidden();

    // Ahora solo ve Flash.
    await expect(page).toHaveURL(/\/flash-informativo$/);
    await expect(page.getByRole('button', { name: 'Crear Flash Informativo' })).toBeVisible();
    await expect(menu.getByRole('link', { name: 'Eventos institucionales' })).toHaveCount(0);
    await expect(menu.getByRole('link', { name: 'Flash Informativo', exact: true })).toBeVisible();
  });
});
