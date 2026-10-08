import { expect, test } from '@playwright/test';
import { iniciarSesion } from './ayudas';

test.describe('Gestor Flash Informativo', () => {
  test('crea, edita y elimina un Flash informativo', async ({ page }) => {
    await iniciarSesion(page, 'gestorFlash');
    await page.goto('/flash-informativo');

    await page.getByRole('button', { name: 'Crear Flash informativo' }).click();
    const formulario = page.getByRole('dialog', { name: 'Nuevo evento' });
    await formulario.getByRole('button', { name: 'Guardar nuevo registro' }).click();
    await expect(formulario.getByText('Escribe el título')).toBeVisible();

    await formulario.getByLabel('Título del evento').fill('Feria E2E de Innovación');
    await formulario.getByLabel('Tipo de evento').selectOption('Foro');
    await formulario.getByLabel('Fecha de inicio').fill('2099-03-10');
    await formulario.getByLabel('Horario de inicio').fill('09:00');
    await formulario.getByLabel('Modalidad').selectOption('Virtual');
    await formulario.getByLabel('Gratuito').check();
    await formulario.getByRole('button', { name: 'Innovación' }).click();
    await formulario.getByRole('button', { name: 'Guardar nuevo registro' }).click();
    await expect(page.getByRole('dialog', { name: 'evento creado' })).toBeVisible();
    await page.getByRole('button', { name: 'Aceptar' }).click();

    await page.getByRole('combobox', { name: 'Buscar en el Observatorio' }).fill('Feria E2E');
    await page.getByRole('option', { name: /Feria E2E de Innovación/ }).click();
    const detalle = page.getByRole('dialog', { name: 'Feria E2E de Innovación' });
    await expect(detalle).toBeVisible();
    await detalle.getByRole('button', { name: 'Editar' }).click();

    const edicion = page.getByRole('dialog', { name: 'Editar evento' });
    await edicion.getByLabel('Título del evento').fill('Feria E2E de Innovación (editada)');
    await edicion.getByRole('button', { name: 'Guardar cambios' }).click();
    await page.getByRole('dialog', { name: 'Editar evento' }).last().getByRole('button', { name: 'Editar evento' }).click();
    await expect(page.getByRole('dialog', { name: 'evento editado' })).toBeVisible();
    await page.getByRole('button', { name: 'Aceptar' }).click();

    await page.getByRole('combobox', { name: 'Buscar en el Observatorio' }).fill('editada');
    await page.getByRole('option', { name: /editada/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Editar' }).click();
    await page.getByRole('button', { name: 'Eliminar evento' }).click();
    await page.getByRole('dialog', { name: 'Eliminar evento' }).getByRole('button', { name: 'Eliminar evento' }).click();
    await expect(page.getByRole('dialog', { name: 'evento eliminado' })).toBeVisible();
  });

  test('no puede gestionar otros módulos', async ({ page }) => {
    await iniciarSesion(page, 'gestorFlash');
    await page.goto('/empresas');
    await expect(page.getByRole('heading', { name: 'Empresas Coformadoras' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Crear empresa coformadora' })).toHaveCount(0);
    await page.goto('/empresas/nueva');
    await expect(page.getByRole('heading', { name: 'No tienes permiso para ver esta página' })).toBeVisible();
  });
});

test.describe('Gestor Empresas Coformadoras', () => {
  test('registra una empresa con su contacto principal', async ({ page }) => {
    await iniciarSesion(page, 'gestorEmpresas');
    await page.goto('/empresas');
    await page.getByRole('link', { name: 'Crear empresa coformadora' }).click();
    await expect(page.getByRole('heading', { name: 'Nueva empresa coformadora' })).toBeVisible();

    await page.getByRole('button', { name: 'Guardar nuevo registro' }).click();
    await expect(page.getByText('Escribe la razón social')).toBeVisible();

    await page.getByLabel('Razón social').fill('Prueba E2E S.A.S.');
    await page.getByLabel('NIT').fill('901.999.000-1');
    await page.getByLabel('Sector').fill('Tecnológico');
    await page.getByLabel('Departamento').selectOption('Antioquia');
    await page.getByLabel('Municipio').fill('Medellín');
    await page.getByLabel('Descripción de la empresa').fill('Empresa creada por las pruebas automáticas.');
    const contacto = page.getByRole('region', { name: 'Contacto principal' });
    await contacto.getByLabel('Nombre completo').fill('María Pérez');
    await contacto.getByLabel('Cargo').fill('Gerente general');
    await contacto.getByLabel('Correo corporativo').fill('maria.perez@pruebae2e.com');
    await contacto.getByLabel('Teléfono').fill('+57 300 000 0000');
    await page.getByRole('button', { name: 'Guardar nuevo registro' }).click();

    await expect(page.getByRole('dialog', { name: 'Empresa creada' })).toBeVisible();
    await page.getByRole('button', { name: 'Aceptar' }).click();
    await expect(page.getByRole('heading', { name: 'Prueba E2E S.A.S.' })).toBeVisible();

    await page.getByRole('button', { name: 'Ver contacto principal' }).click();
    await expect(page.getByRole('dialog', { name: 'Contacto principal' }).getByText('María Pérez')).toBeVisible();
  });
});
