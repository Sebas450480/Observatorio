import { expect, test } from '@playwright/test';
import { iniciarSesion } from './ayudas';
import { CODIGO_INVITACION } from './entorno.mjs';

test.describe('Empresas por invitación', () => {
  test('el gestor invita una empresa y ve sus invitaciones', async ({ page }) => {
    await iniciarSesion(page, 'gestorEmpresas');
    await page.goto('/empresas');
    await page.getByRole('link', { name: 'Invitar empresa' }).click();
    await expect(page.getByRole('heading', { name: 'Invitar una empresa' })).toBeVisible();

    await page.getByRole('button', { name: 'Enviar invitación' }).click();
    await expect(page.getByText('Escribe el nombre del contacto')).toBeVisible();

    await page.getByLabel('Nombre del contacto').fill('Sofía');
    await page.getByLabel('Apellido del contacto').fill('Castro');
    await page.getByLabel('Correo del contacto').fill('sofia.castro.e2e@empresa.co');
    await page.getByLabel('Nombre de la empresa').fill('Nueva Aliada E2E');
    await page.getByRole('button', { name: 'Enviar invitación' }).click();
    await expect(page.getByRole('dialog', { name: 'Invitación enviada' })).toBeVisible();
    await page.getByRole('button', { name: 'Aceptar' }).click();

    const fila = page.getByRole('listitem').filter({ hasText: 'sofia.castro.e2e@empresa.co' });
    await expect(fila.getByText('Pendiente')).toBeVisible();
    await fila.getByRole('button', { name: 'Anular' }).click();
    await page.getByRole('dialog', { name: 'Anular invitación' }).getByRole('button', { name: 'Anular invitación' }).click();
    await expect(fila.getByText('Anulada')).toBeVisible();
  });

  test('la empresa completa el registro con el enlace del correo y queda publicada', async ({ page }) => {
    await page.goto(`/registro-empresa?codigo=${CODIGO_INVITACION}`);
    await expect(page.getByRole('heading', { name: 'Estás a un paso de ser parte de nuestra familia' })).toBeVisible();
    await expect(page.getByText('empresa.invitada.e2e@empresa.co')).toBeVisible();
    await expect(page.getByLabel('Razón social')).toHaveValue('Invitada E2E S.A.S.');

    await page.getByRole('button', { name: 'Completar registro' }).click();
    await expect(page.getByText('Escribe el NIT')).toBeVisible();

    await page.getByLabel('Contraseña').first().fill('Empresa-E2E-2026');
    await page.getByLabel('Confirmar contraseña').fill('Empresa-E2E-2026');
    await page.getByLabel('NIT').fill('901.234.567-8');
    await page.getByLabel('Sector').fill('Tecnología');
    await page.getByLabel('Descripción').fill('Empresa de software registrada por invitación.');
    await page.getByLabel('Tamaño').selectOption('Mediana');
    await page.getByLabel('Año de constitución').fill('2012');
    await page.getByLabel('Estudiantes recibidos').fill('8');
    await page.getByLabel('Departamento').selectOption('Antioquia');
    await page.getByLabel('Municipio').fill('Medellín');
    await page.getByLabel('Dirección').fill('Cra 43A # 5-10');
    await expect(page.getByTitle('Vista previa de la ubicación en Google Maps')).toBeVisible();

    await page.getByRole('button', { name: 'Completar registro' }).click();
    await expect(page.getByText(/Debes autorizar el tratamiento/)).toBeVisible();
    await page.getByLabel(/Autorizo el tratamiento/).check();
    await page.getByRole('button', { name: 'Completar registro' }).click();

    const modal = page.getByRole('dialog', { name: 'Registro completado' });
    await expect(modal.getByText('¡Ya perteneces a la familia Observatorio Empresarial!')).toBeVisible();
    await modal.getByRole('button', { name: 'Aceptar' }).click();
    await expect(page.getByRole('heading', { name: 'Invitada E2E S.A.S.' })).toBeVisible();

    // Aparece en el directorio público.
    await page.goto('/empresas');
    await expect(page.getByRole('link', { name: /Invitada E2E S\.A\.S\./ })).toBeVisible();

    // El enlace ya no sirve.
    await page.goto(`/registro-empresa?codigo=${CODIGO_INVITACION}`);
    await expect(page.getByText(/no es válido, ya se usó o venció/)).toBeVisible();
  });
});
