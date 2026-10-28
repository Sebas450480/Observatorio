import { expect, test } from '@playwright/test';
import { iniciarSesion } from './ayudas';

test.describe('Descargas', () => {
  test('ya no hay botón global de exportar; el invitado que descarga ve la invitación a registrarse', async ({ page }) => {
    for (const ruta of ['/flash-informativo', '/faro-empresarial', '/tendencias']) {
      await page.goto(ruta);
      await expect(page.getByRole('button', { name: /^Descargar: / }).first()).toBeVisible();
      await expect(page.getByRole('button', { name: 'Exportar' })).toHaveCount(0);
    }

    await page.goto('/flash-informativo');
    await page.getByRole('button', { name: /^Descargar: / }).first().click();
    const modal = page.getByRole('dialog', { name: 'Descarga para usuarios registrados' });
    await expect(modal.getByText('Regístrate para descargar este documento')).toBeVisible();
    await expect(modal.getByRole('link', { name: 'Crear cuenta gratis' })).toHaveAttribute('href', '/registro');
    await modal.getByRole('link', { name: 'Iniciar sesión' }).click();
    await expect(page).toHaveURL(/\/iniciar-sesion$/);
  });

  test('con sesión descarga la ficha de un registro en PDF y en Excel', async ({ page }) => {
    await iniciarSesion(page, 'usuario');
    await page.goto('/tendencias');
    const boton = page.getByRole('button', { name: /^Descargar: / }).first();
    const nombre = (await boton.getAttribute('aria-label'))!.replace('Descargar: ', '');
    await boton.click();
    const modal = page.getByRole('dialog', { name: 'Descargar' });
    await expect(modal.getByText(nombre)).toBeVisible();

    const [pdf] = await Promise.all([page.waitForEvent('download'), modal.getByRole('link', { name: 'Descargar PDF' }).click()]);
    expect(pdf.suggestedFilename()).toMatch(/^tendencias-\d+\.pdf$/);

    await boton.click();
    const [excel] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('dialog', { name: 'Descargar' }).getByRole('link', { name: 'Descargar Excel' }).click(),
    ]);
    expect(excel.suggestedFilename()).toMatch(/^tendencias-\d+\.xlsx$/);
  });

  test('las empresas coformadoras no tienen descargas (información sensible)', async ({ page }) => {
    await iniciarSesion(page, 'superadmin');
    await page.goto('/empresas');
    await expect(page.getByRole('heading', { name: 'Empresas Coformadoras' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Descargar: / })).toHaveCount(0);
    // Las empresas van de la más reciente a la más antigua: se filtra para no depender de la página.
    await page.getByLabel('Sector').selectOption('Agroindustrial');
    await page.getByRole('button', { name: 'Buscar', exact: true }).click();
    await page.getByRole('link', { name: /AgroAndes/ }).first().click();
    await expect(page.getByRole('button', { name: 'Compartir' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Descargar/ })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Descargar/ })).toHaveCount(0);
    await page.getByRole('button', { name: 'Compartir' }).click();
    await expect(page.getByRole('dialog').getByText('Descargar ficha')).toHaveCount(0);
  });
});
