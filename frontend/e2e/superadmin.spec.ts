import { expect, test } from '@playwright/test';
import { iniciarSesion, irA } from './ayudas';

test.describe('SuperAdmin', () => {
  test.beforeEach(async ({ page }) => {
    await iniciarSesion(page, 'superadmin');
  });

  test('crea un usuario gestor y lo encuentra en la tabla', async ({ page }) => {
    await irA(page, 'Usuarios');
    await page.getByRole('button', { name: 'Crear usuario' }).click();
    const formulario = page.getByRole('dialog', { name: 'Crear usuario' });
    await formulario.getByLabel('Nombre').fill('Mateo');
    await formulario.getByLabel('Apellido').fill('Jiménez');
    await formulario.getByLabel('Apodo').fill('mjimenez');
    await formulario.getByLabel('Correo').fill('m.jimenez.e2e@uniempresarial.edu.co');
    await formulario.getByLabel('Contraseña inicial').fill('Temporal-2026');
    await formulario.getByLabel('Rol').selectOption({ label: 'Gestor Tendencias' });
    await formulario.getByLabel(/autorizó el tratamiento/).check();
    await formulario.getByRole('button', { name: 'Guardar nuevo registro' }).click();
    await expect(page.getByRole('dialog', { name: 'Registro creado' })).toBeVisible();
    await page.getByRole('button', { name: 'Aceptar' }).click();

    await page.getByRole('searchbox', { name: 'Buscar usuarios' }).fill('mjimenez');
    await page.getByRole('button', { name: 'Buscar', exact: true }).click();
    const fila = page.getByRole('row', { name: /mjimenez/ });
    await expect(fila).toContainText('Gestor');
    await expect(fila).toContainText('Activo');
  });

  test('consulta el panel de estadísticas', async ({ page }) => {
    await irA(page, 'Estadísticas');
    await expect(page.getByRole('heading', { name: 'Panel de estadísticas' })).toBeVisible();
    for (const indicador of ['Usuarios registrados', 'Contenidos publicados', 'Visitas a la plataforma', 'Suscriptores a alertas']) {
      await expect(page.getByText(indicador, { exact: true })).toBeVisible();
    }
  });

  test('crea un evento institucional y lo ve en el calendario mensual', async ({ page }) => {
    await irA(page, 'Eventos institucionales');
    await page.getByRole('button', { name: 'Crear evento' }).click();
    const formulario = page.getByRole('dialog', { name: 'Crear evento' });
    await formulario.getByLabel('Título del evento').fill('Encuentro E2E de egresados');
    await formulario.getByLabel('Tipo de evento').selectOption('Foro');
    await formulario.getByLabel('Modalidad').selectOption('Presencial');
    const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    await formulario.getByLabel('Fecha de inicio').fill(hoy);
    await formulario.getByLabel('Horario de inicio').fill('10:00');
    await formulario.getByLabel('Horario de finalización').fill('12:00');
    await formulario.getByRole('button', { name: 'Guardar nuevo registro' }).click();
    await expect(page.getByRole('dialog', { name: 'Registro creado' })).toBeVisible();
    await page.getByRole('button', { name: 'Aceptar' }).click();

    await page.getByRole('button', { name: 'Mensual' }).click();
    await page.getByText('Encuentro E2E de egresados').click();
    await expect(page.getByRole('dialog', { name: 'Encuentro E2E de egresados' })).toContainText('10:00');
  });

  test('explora el mapa de tendencias y cambia de vista', async ({ page }) => {
    await irA(page, 'Tendencias');
    await page.getByRole('button', { name: 'Vista en tabla' }).click();
    await expect(page.getByRole('columnheader', { name: 'Megatendencia' })).toBeVisible();
    await page.getByRole('tab', { name: 'Mapa de tendencias' }).click();
    await expect(page.getByRole('heading', { name: 'Top 5 en crecimiento' })).toBeVisible();
    await page.getByRole('button', { name: 'Último año' }).click();
    await expect(page.locator('.recharts-wrapper')).toBeVisible();
  });

  test('crea una tendencia con una megatendencia nueva', async ({ page }) => {
    await irA(page, 'Tendencias');
    await page.getByRole('button', { name: 'Crear nuevo registro' }).click();
    const formulario = page.getByRole('dialog', { name: 'Nueva tendencia' });
    await formulario.getByLabel('Megatendencia').selectOption('__nueva__');
    await formulario.getByLabel('Nueva megatendencia').fill('Megatendencia E2E');
    await formulario.getByLabel('Título de la tendencia').fill('Tendencia E2E');
    await formulario.getByRole('textbox', { name: 'Fuente 1' }).fill('MinTIC — https://www.mintic.gov.co');
    for (let i = 0; i < 4; i++) await formulario.getByRole('button', { name: 'Agregar otra fuente' }).click();
    await expect(formulario.getByRole('textbox', { name: /^Fuente \d$/ })).toHaveCount(5);
    await expect(formulario.getByRole('button', { name: 'Agregar otra fuente' })).toBeDisabled();
    await formulario.getByRole('button', { name: 'Guardar nuevo registro' }).click();
    await expect(page.getByRole('dialog', { name: 'Registro creado' })).toBeVisible();
    await page.getByRole('button', { name: 'Aceptar' }).click();
    await page.getByRole('button', { name: 'Crear nuevo registro' }).click();
    await expect(page.getByRole('dialog', { name: 'Nueva tendencia' }).getByLabel('Megatendencia')).toContainText('Megatendencia E2E');
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await page.getByRole('tab', { name: 'Mapa de tendencias' }).click();
    await expect(page.getByRole('button', { name: 'Megatendencia E2E', exact: true })).toBeVisible();
  });

  test('desde el mapa abre el listado filtrado por la tendencia', async ({ page }) => {
    await irA(page, 'Tendencias');
    await page.getByRole('tab', { name: 'Mapa de tendencias' }).click();
    await page.getByRole('button', { name: 'Tecnología y sociedad', exact: true }).first().click();
    await page.locator('.recharts-treemap-depth-1').first().click({ position: { x: 30, y: 30 } });
    await expect(page.getByRole('tab', { name: 'Tendencias', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('Filtros aplicados:')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Quitar el filtro Tecnología y sociedad' })).toBeVisible();
  });
});
