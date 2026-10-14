import { expect, test } from '@playwright/test';
import { irA } from './ayudas';
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
    await expect(page.getByRole('heading', { name: 'Bienvenido al Observatorio Empresarial' })).toBeVisible();

    // Con Gestor Calendario crea eventos, pero no publica en Flash.
    await irA(page, 'Eventos institucionales');
    await expect(page.getByRole('button', { name: 'Crear evento' })).toBeVisible();
    await irA(page, 'Flash');
    await expect(page.getByRole('heading', { name: /Flash/ }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Crear Flash' })).toHaveCount(0);

    // Cambia a Gestor Flash desde el menú de la sesión.
    await page.getByRole('button', { name: /Sesión de Julián/ }).click();
    await page.getByRole('menuitem', { name: /Cambiar de rol/ }).click();
    const cambio = page.getByRole('dialog', { name: '¿Con qué rol quieres entrar?' });
    await expect(cambio.getByRole('radio', { name: /Gestor Calendario/ })).toHaveAttribute('aria-checked', 'true');
    await cambio.getByRole('radio', { name: /Gestor Flash/ }).click();
    await cambio.getByRole('button', { name: 'Entrar como Gestor Flash' }).click();
    await expect(cambio).toBeHidden();

    await irA(page, 'Flash');
    await expect(page.getByRole('button', { name: 'Crear Flash' })).toBeVisible();
    await irA(page, 'Eventos institucionales');
    await expect(page.getByRole('heading', { name: /Eventos/ }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Crear evento' })).toHaveCount(0);
  });
});
