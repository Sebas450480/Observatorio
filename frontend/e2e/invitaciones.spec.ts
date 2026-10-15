import { expect, test } from '@playwright/test';
import { iniciarSesion } from './ayudas';
import { CODIGO_INVITACION } from './entorno.mjs';

test.describe('Empresas por invitación', () => {
  test('el gestor invita varias empresas a la vez y ve sus invitaciones', async ({ page }) => {
    await iniciarSesion(page, 'gestorEmpresas');
    await page.goto('/empresas');
    await page.getByRole('link', { name: 'Invitar empresa' }).click();
    await expect(page.getByRole('heading', { name: 'Invitar empresas' })).toBeVisible();

    await page.getByRole('button', { name: 'Enviar invitación' }).click();
    await expect(page.getByText('Escribe el nombre')).toBeVisible();

    const empresa = (n: number) => page.getByRole('group', { name: new RegExp(`^Empresa ${n}`) });
    await empresa(1).getByLabel('Nombre del contacto').fill('Sofía');
    await empresa(1).getByLabel('Apellido del contacto').fill('Castro');
    await empresa(1).getByLabel('Correo del contacto').fill('sofia.castro.e2e@empresa.co');
    await empresa(1).getByLabel('Nombre de la empresa').fill('Nueva Aliada E2E');
    await page.getByRole('button', { name: '+ Agregar otra empresa' }).click();
    await empresa(2).getByLabel('Nombre del contacto').fill('Julián');
    await empresa(2).getByLabel('Apellido del contacto').fill('Mora');
    await empresa(2).getByLabel('Correo del contacto').fill('julian.mora.e2e@empresa.co');
    await page.getByRole('button', { name: '+ Agregar otra empresa' }).click();
    // Un correo que ya tiene cuenta no se envía; las demás sí.
    await empresa(3).getByLabel('Nombre del contacto').fill('Laura');
    await empresa(3).getByLabel('Apellido del contacto').fill('Gómez');
    await empresa(3).getByLabel('Correo del contacto').fill('usuario.e2e@gmail.com');
    await page.getByRole('button', { name: 'Enviar 3 invitaciones' }).click();

    const aviso = page.getByRole('dialog', { name: 'Invitaciones enviadas' });
    await expect(aviso.getByText('Enviamos 2 invitaciones.')).toBeVisible();
    await aviso.getByRole('button', { name: 'Aceptar' }).click();
    await expect(empresa(1).getByLabel('Correo del contacto')).toHaveValue('usuario.e2e@gmail.com');
    await expect(empresa(1).getByText('Ya existe una cuenta con ese correo')).toBeVisible();

    const fila = page.getByRole('listitem').filter({ hasText: 'sofia.castro.e2e@empresa.co' });
    await expect(fila.getByText('Pendiente')).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: 'julian.mora.e2e@empresa.co' }).getByText('Pendiente')).toBeVisible();
    await fila.getByRole('button', { name: 'Anular' }).click();
    await page.getByRole('dialog', { name: 'Anular invitación' }).getByRole('button', { name: 'Anular invitación' }).click();
    await expect(fila.getByText('Anulada')).toBeVisible();
  });

  test('con el enlace solo crea la contraseña, hace el recorrido y publica su empresa desde Mi perfil', async ({ page }) => {
    await page.goto(`/registro-empresa?codigo=${CODIGO_INVITACION}`);
    await expect(page.getByRole('heading', { name: 'Estás a un paso de ser parte de nuestra familia' })).toBeVisible();
    await expect(page.getByText('empresa.invitada.e2e@empresa.co')).toBeVisible();
    // El formulario es corto: no pide los datos de la empresa.
    await expect(page.getByLabel('NIT')).toHaveCount(0);

    await page.getByRole('button', { name: 'Crear contraseña y entrar' }).click();
    await expect(page.getByText('Mínimo 8 caracteres').first()).toBeVisible();
    await page.getByRole('textbox', { name: 'Contraseña', exact: true }).fill('Empresa-E2E-2026');
    await page.getByLabel('Confirmar contraseña').fill('Empresa-E2E-2026');
    await page.getByRole('button', { name: 'Crear contraseña y entrar' }).click();
    await expect(page.getByText(/Debes autorizar el tratamiento/)).toBeVisible();
    await page.getByLabel(/Autorizo el tratamiento/).check();
    await page.getByRole('button', { name: 'Crear contraseña y entrar' }).click();

    // Entra a la plataforma con el recorrido guiado, que termina en la ficha de su empresa.
    const guia = page.getByRole('dialog');
    await expect(guia.getByRole('heading', { name: '¡Te damos la bienvenida al Observatorio Empresarial!' })).toBeVisible();
    await guia.getByRole('button', { name: 'Empezar' }).click();
    await expect(guia.getByRole('heading', { name: 'Menú principal' })).toBeVisible();
    for (let i = 0; i < 9; i++) await guia.getByRole('button', { name: 'Siguiente' }).click();
    await expect(page).toHaveURL(/\/mi-perfil$/);
    await expect(guia.getByRole('heading', { name: 'Completa la ficha de tu empresa' })).toBeVisible();
    await guia.getByRole('button', { name: 'Completar mi perfil' }).click();
    await expect(guia).toHaveCount(0);

    // La ficha está pendiente: aún no se publica.
    const miEmpresa = page.getByRole('form', { name: /Mi empresa/ });
    await expect(miEmpresa.getByText('Completa la ficha de tu empresa.')).toBeVisible();
    await expect(miEmpresa.getByRole('link', { name: 'Ver ficha pública' })).toHaveCount(0);
    await expect(miEmpresa.getByLabel('Razón social')).toHaveValue('Invitada E2E S.A.S.');
    await miEmpresa.getByLabel('NIT').fill('901.234.567-8');
    await miEmpresa.getByLabel('Sector').fill('Tecnología');
    await miEmpresa.getByLabel('Descripción').fill('Empresa de software registrada por invitación.');
    await miEmpresa.getByLabel('Estudiantes recibidos').fill('15');
    await miEmpresa.getByLabel('Departamento').selectOption('Antioquia');
    await miEmpresa.getByLabel('Municipio').fill('Medellín');
    await miEmpresa.getByRole('button', { name: 'Guardar y publicar' }).click();
    await expect(page.getByRole('dialog', { name: '¡Ya perteneces a la familia Observatorio Empresarial!' })).toBeVisible();
    await page.getByRole('button', { name: 'Aceptar' }).click();
    await miEmpresa.getByRole('link', { name: 'Ver ficha pública' }).click();
    await expect(page.getByRole('heading', { name: 'Invitada E2E S.A.S.' })).toBeVisible();
    await expect(page.getByText('15 estudiantes')).toBeVisible();

    // Al volver a entrar ya no ve el recorrido.
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Invitada E2E S.A.S.' })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // El enlace ya no sirve.
    await page.goto(`/registro-empresa?codigo=${CODIGO_INVITACION}`);
    await expect(page.getByText(/no es válido, ya se usó o venció/)).toBeVisible();
  });
});
