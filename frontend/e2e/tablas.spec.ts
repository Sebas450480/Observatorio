import { expect, test } from '@playwright/test';
import { iniciarSesion, irA } from './ayudas';

test.describe('Tablas', () => {
  test('el público y los usuarios no ven la vista en tabla de Tendencias', async ({ page }) => {
    await page.goto('/tendencias');
    await expect(page.getByRole('button', { name: 'Vista compacta' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Vista en tabla' })).toHaveCount(0);

    await iniciarSesion(page, 'usuario');
    await page.goto('/tendencias');
    await expect(page.getByRole('button', { name: 'Vista compacta' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Vista en tabla' })).toHaveCount(0);
  });

  test('un gestor ve la tabla de Tendencias y la ordena por columna como en Excel', async ({ page }) => {
    await iniciarSesion(page, 'gestorTendencias');
    await page.getByRole('button', { name: 'Vista en tabla' }).click();
    const tabla = page.getByRole('table');
    const encabezadoId = tabla.getByRole('columnheader', { name: /^ID/ });
    const ids = async () => (await tabla.locator('tbody tr td:nth-child(2)').allTextContents()).map(Number);

    await encabezadoId.getByRole('button').click();
    await expect(encabezadoId).toHaveAttribute('aria-sort', 'ascending');
    await expect.poll(ids).toEqual([...(await ids())].sort((a, b) => a - b));

    await encabezadoId.getByRole('button').click();
    await expect(encabezadoId).toHaveAttribute('aria-sort', 'descending');
    await expect.poll(async () => {
      const lista = await ids();
      return lista.length > 1 && lista[0]! > lista[lista.length - 1]!;
    }).toBe(true);

    await encabezadoId.getByRole('button').click();
    await expect(encabezadoId).toHaveAttribute('aria-sort', 'none');
  });

  test('la tabla de usuarios se ordena por nombre', async ({ page }) => {
    await iniciarSesion(page, 'superadmin');
    await irA(page, 'Usuarios');
    const tabla = page.getByRole('table');
    const encabezado = tabla.getByRole('columnheader', { name: /^Nombre/ });
    await encabezado.getByRole('button').click();
    await expect(encabezado).toHaveAttribute('aria-sort', 'ascending');
    const nombres = async () => (await tabla.locator('tbody tr td:nth-child(4)').allTextContents()).map((n) => n.toLowerCase());
    await expect.poll(async () => {
      const lista = await nombres();
      return JSON.stringify(lista) === JSON.stringify([...lista].sort((a, b) => a.localeCompare(b, 'es')));
    }).toBe(true);
  });
});
