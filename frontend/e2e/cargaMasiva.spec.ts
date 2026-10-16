import { createRequire } from 'node:module';
import { expect, test } from '@playwright/test';
import { iniciarSesion, irA } from './ayudas';

// ExcelJS vive en las dependencias del backend.
const requerir = createRequire(new URL('../../backend/package.json', import.meta.url));
interface Libro {
  xlsx: { readFile(ruta: string): Promise<unknown>; writeBuffer(): Promise<ArrayBuffer> };
  getWorksheet(nombre: string): { getRow(n: number): { getCell(n: number): { value: unknown } } } | undefined;
}
const ExcelJS = requerir('exceljs') as { Workbook: new () => Libro };

/** Llena la hoja de registros de la plantilla descargada y devuelve el archivo. */
async function llenarPlantilla(ruta: string, hoja: string, filas: unknown[][]): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.readFile(ruta);
  const registros = libro.getWorksheet(hoja)!;
  filas.forEach((fila, i) => fila.forEach((valor, j) => { registros.getRow(i + 2).getCell(j + 1).value = valor; }));
  return Buffer.from(await libro.xlsx.writeBuffer());
}

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

test.describe('Carga masiva desde Excel', () => {
  test('el gestor descarga la plantilla, ve los errores por fila y guarda los términos', async ({ page }) => {
    await iniciarSesion(page, 'superadmin');
    await irA(page, 'Glosario');
    await page.getByRole('button', { name: 'Carga masiva' }).click();
    const modal = page.getByRole('dialog', { name: 'Carga masiva · Glosario' });
    await expect(modal).toBeVisible();

    const [descarga] = await Promise.all([page.waitForEvent('download'), modal.getByRole('link', { name: 'Descargar plantilla' }).click()]);
    expect(descarga.suggestedFilename()).toBe('plantilla-glosario.xlsx');
    const plantilla = await descarga.path();

    const termino = `Carga masiva E2E ${Date.now()}`;
    const conErrores = await llenarPlantilla(plantilla, 'Glosario', [
      [`${termino}:`, 'Definición cargada desde Excel.'],
      [termino, 'Repetido'],
      ['Sin definición'],
    ]);
    await modal.getByLabel('Archivo de Excel').setInputFiles({ name: 'glosario.xlsx', mimeType: XLSX, buffer: conErrores });
    await expect(modal.getByText('2 de 3 registros tienen errores')).toBeVisible();
    const errores = modal.getByRole('table');
    await expect(errores.getByRole('row', { name: /3 .*Término repetido en el archivo/ })).toBeVisible();
    await expect(errores.getByRole('row', { name: /4 Definición Es obligatorio/ })).toBeVisible();
    await expect(modal.getByRole('button', { name: 'Guardar' })).toBeDisabled();

    const corregido = await llenarPlantilla(plantilla, 'Glosario', [[`${termino}:`, 'Definición cargada desde Excel.']]);
    await modal.getByLabel('Archivo de Excel').setInputFiles({ name: 'glosario.xlsx', mimeType: XLSX, buffer: corregido });
    await expect(modal.getByText('1 registro listo para guardar.')).toBeVisible();
    await expect(modal.getByText(termino)).toBeVisible();
    await modal.getByRole('button', { name: 'Guardar 1 registro' }).click();
    await expect(modal.getByText('Se guardó 1 registro correctamente.')).toBeVisible();
    await modal.getByRole('button', { name: 'Aceptar' }).click();

    await page.getByRole('searchbox', { name: 'Buscar en el glosario' }).fill(termino);
    await page.getByRole('button', { name: 'Buscar', exact: true }).click();
    await expect(page.getByRole('term').filter({ hasText: termino })).toBeVisible();
  });

  test('las imágenes son opcionales: se adjuntan con el Excel y se suben al guardar', async ({ page }) => {
    await iniciarSesion(page, 'superadmin');
    await irA(page, 'Flash Informativo');
    await page.getByRole('button', { name: 'Carga masiva' }).click();
    const modal = page.getByRole('dialog', { name: 'Carga masiva · Flash Informativo' });
    const [descarga] = await Promise.all([page.waitForEvent('download'), modal.getByRole('link', { name: 'Descargar plantilla' }).click()]);
    const sufijo = Date.now();
    const plantilla = await descarga.path();
    // Columnas de la plantilla: Título, Tipo, Otro tipo, Descripción, Fecha inicio, Hora, Fecha fin, Hora fin, Modalidad, ... Imagen.
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.readFile(plantilla);
    const hoja = libro.getWorksheet('Flash Informativo')!;
    const columna = (titulo: string) => {
      for (let i = 1; i <= 30; i++) if (String(hoja.getRow(1).getCell(i).value).replace(' *', '') === titulo) return i;
      throw new Error(titulo);
    };
    const fila = hoja.getRow(2);
    fila.getCell(columna('Título')).value = `Feria con imagen ${sufijo}`;
    fila.getCell(columna('Tipo de evento')).value = 'Feria';
    fila.getCell(columna('Fecha de inicio')).value = '20/11/2030';
    fila.getCell(columna('Modalidad')).value = 'Presencial';
    fila.getCell(columna('Imagen')).value = 'feria.png';
    const fila3 = hoja.getRow(3);
    fila3.getCell(columna('Título')).value = `Feria sin imagen ${sufijo}`;
    fila3.getCell(columna('Tipo de evento')).value = 'Feria';
    fila3.getCell(columna('Fecha de inicio')).value = '21/11/2030';
    fila3.getCell(columna('Modalidad')).value = 'Virtual';
    const archivo = Buffer.from(await libro.xlsx.writeBuffer());

    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    await modal.getByLabel('Imágenes (opcional)').setInputFiles({ name: 'feria.png', mimeType: 'image/png', buffer: png });
    await modal.getByLabel('Archivo de Excel').setInputFiles({ name: 'flash.xlsx', mimeType: XLSX, buffer: archivo });
    await expect(modal.getByText('2 registros listos para guardar.')).toBeVisible();
    await expect(modal.getByText('Imagen: feria.png')).toBeVisible();
    await modal.getByRole('button', { name: 'Guardar 2 registros' }).click();
    await expect(modal.getByText('Se guardaron 2 registros correctamente.')).toBeVisible();
    await expect(modal.getByText('Se subió 1 imagen.')).toBeVisible();
  });

  test('las empresas cargadas quedan inactivas y su contacto recibe la invitación', async ({ page }) => {
    await iniciarSesion(page, 'superadmin');
    await irA(page, 'Empresas Coformadoras');
    await page.getByRole('button', { name: 'Carga masiva' }).click();
    const modal = page.getByRole('dialog', { name: 'Carga masiva · Empresas Coformadoras' });
    const [descarga] = await Promise.all([page.waitForEvent('download'), modal.getByRole('link', { name: 'Descargar plantilla' }).click()]);
    const sufijo = Date.now();
    const archivo = await llenarPlantilla(await descarga.path(), 'Empresas', [
      ['Laura', 'Gómez', `carga.${sufijo}@test.co`, '3001112233', 'Talento humano', `Precargada E2E ${sufijo} S.A.S.`],
    ]);
    await modal.getByLabel('Archivo de Excel').setInputFiles({ name: 'empresas.xlsx', mimeType: XLSX, buffer: archivo });
    await expect(modal.getByText('1 registro listo para guardar.')).toBeVisible();
    await modal.getByRole('button', { name: 'Crear 1 empresa y enviar la invitación' }).click();
    await expect(modal.getByText('Se creó 1 empresa (inactiva hasta que complete su ficha).')).toBeVisible();
    await expect(modal.getByText('Se envió 1 invitación por correo.')).toBeVisible();
    await modal.getByRole('button', { name: 'Aceptar' }).click();

    await page.getByRole('link', { name: 'Invitar empresa' }).click();
    await expect(page.getByText(`carga.${sufijo}@test.co`)).toBeVisible();
  });
});
