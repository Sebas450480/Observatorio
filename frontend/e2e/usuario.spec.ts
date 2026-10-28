import { expect, test } from '@playwright/test';
import { iniciarSesion } from './ayudas';

test.describe('Usuario registrado', () => {
  test.beforeEach(async ({ page }) => {
    await iniciarSesion(page, 'usuario');
  });

  test('no ve las opciones de administración', async ({ page }) => {
    const menu = page.getByRole('complementary', { name: 'Menú principal' });
    await expect(menu.getByRole('link', { name: 'Flash Informativo', exact: true })).toBeVisible();
    await expect(menu.getByRole('link', { name: 'Usuarios' })).toHaveCount(0);
    await expect(menu.getByRole('link', { name: 'Estadísticas' })).toHaveCount(0);
    await page.goto('/estadisticas');
    await expect(page.getByRole('heading', { name: 'No tienes permiso para ver esta página' })).toBeVisible();
    await page.goto('/faro-empresarial');
    await expect(page.getByRole('heading', { name: 'Faro', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Crear registro' })).toHaveCount(0);
  });

  test('actualiza su perfil e intereses', async ({ page }) => {
    await page.goto('/mi-perfil');
    await page.getByLabel('Ciudad').fill('Medellín');
    await page.getByRole('button', { name: 'Becas' }).click();
    await page.getByText('Cada 2 días', { exact: true }).click();
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page.getByRole('dialog', { name: 'Perfil actualizado' })).toBeVisible();
    await page.getByRole('button', { name: 'Aceptar' }).click();
    await page.reload();
    await expect(page.getByLabel('Ciudad')).toHaveValue('Medellín');
    await expect(page.getByRole('button', { name: 'Becas' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('radio', { name: /Cada 2 días/ })).toBeChecked();
  });

  test('elige el boletín diario y luego silencia todos los correos', async ({ page }) => {
    await page.goto('/mi-perfil');
    const recordatorios = page.getByRole('checkbox', { name: /Recordatorios de eventos favoritos/ });
    await expect(recordatorios).toBeChecked();
    await page.getByText('Resumen diario').click();
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await page.getByRole('dialog', { name: 'Perfil actualizado' }).getByRole('button', { name: 'Aceptar' }).click();
    await page.reload();
    await expect(page.getByRole('radio', { name: /Resumen diario/ })).toBeChecked();

    await page.getByRole('button', { name: 'Silenciar todos los correos' }).click();
    await expect(page.getByText('Todos los correos están silenciados')).toBeVisible();
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await page.getByRole('dialog', { name: 'Perfil actualizado' }).getByRole('button', { name: 'Aceptar' }).click();
    await page.reload();
    await expect(page.getByRole('radio', { name: /No recibir el boletín/ })).toBeChecked();
    await expect(page.getByRole('checkbox', { name: /Recordatorios de eventos favoritos/ })).not.toBeChecked();
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

test.describe('Favoritos', () => {
  test('guarda con la banderita, lo ve en Mi perfil y lo quita', async ({ page }) => {
    await iniciarSesion(page, 'usuario');
    await page.goto('/flash-informativo');
    const banderita = page.getByRole('button', { name: /^Guardar en favoritos: / }).first();
    const titulo = (await banderita.getAttribute('aria-label'))!.replace('Guardar en favoritos: ', '');
    await banderita.click();
    await expect(page.getByRole('button', { name: `Quitar de favoritos: ${titulo}` })).toHaveAttribute('aria-pressed', 'true');

    // En el detalle también aparece marcada.
    await page.getByRole('button', { name: `Acceder : ${titulo}` }).click();
    await expect(page.getByRole('dialog').getByRole('button', { name: `Quitar de favoritos: ${titulo}` })).toBeVisible();

    await page.goto('/mi-perfil');
    const panel = page.getByRole('region', { name: 'Mis favoritos' });
    await expect(panel.getByRole('link', { name: titulo })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Flash Informativo (1)' })).toBeVisible();

    await panel.getByRole('button', { name: `Quitar de favoritos: ${titulo}` }).click();
    await expect(panel.getByText('Aún no tienes favoritos')).toBeVisible();
  });

  test('el invitado no ve la banderita', async ({ page }) => {
    await page.goto('/flash-informativo');
    await expect(page.getByRole('button', { name: 'Acceder', exact: false }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /favoritos/ })).toHaveCount(0);
  });
});

test.describe('Perfil de empresa', () => {
  test('el usuario no ve el estado de la empresa', async ({ page }) => {
    await iniciarSesion(page, 'usuario');
    await page.goto('/empresas');
    // Las empresas van de la más reciente a la más antigua: se filtra para no depender de la página.
    await page.getByLabel('Sector').selectOption('Agroindustrial');
    await page.getByRole('button', { name: 'Buscar', exact: true }).click();
    await page.getByRole('link', { name: /AgroAndes/ }).first().click();
    await expect(page.getByRole('button', { name: 'Ver contacto principal' })).toBeVisible();
    await expect(page.getByText('Activo', { exact: true })).toHaveCount(0);
  });

  test('el administrador sí ve el estado de la empresa', async ({ page }) => {
    await iniciarSesion(page, 'superadmin');
    await page.goto('/empresas');
    // Las empresas van de la más reciente a la más antigua: se filtra para no depender de la página.
    await page.getByLabel('Sector').selectOption('Agroindustrial');
    await page.getByRole('button', { name: 'Buscar', exact: true }).click();
    await page.getByRole('link', { name: /AgroAndes/ }).first().click();
    await expect(page.getByText('Activo', { exact: true })).toBeVisible();
  });
});

test.describe('Registro', () => {
  test('al crear la cuenta hace el recorrido por la plataforma y termina en Mi perfil', async ({ page }) => {
    await page.goto('/registro');
    await page.getByLabel('Nombre').fill('Sara');
    await page.getByLabel('Apellido').fill('Recorrido');
    await page.getByLabel('Correo electrónico').fill(`sara.${Date.now()}@test.co`);
    const requisitos = page.getByRole('list', { name: 'Requisitos de la contraseña' });
    await page.getByLabel('Contraseña', { exact: true }).fill('clavesegura');
    await expect(requisitos.getByText('Una mayúscula (falta)')).toBeVisible();
    await expect(requisitos.getByText('Una minúscula (cumple)')).toBeVisible();
    await page.getByLabel('Contraseña', { exact: true }).fill('Clave-segura-123');
    await expect(requisitos.getByText('(falta)')).toHaveCount(0);
    await page.getByLabel('Confirmar contraseña').fill('Clave-segura-123');
    await page.getByRole('button', { name: /Siguiente/ }).click();
    await page.getByLabel(/Autorizo el tratamiento/).check();
    await page.getByRole('button', { name: 'Crear mi cuenta' }).click();

    const guia = page.getByRole('dialog');
    await expect(guia.getByRole('heading', { name: '¡Te damos la bienvenida al Observatorio Empresarial!' })).toBeVisible();
    await guia.getByRole('button', { name: 'Empezar' }).click();
    await expect(guia.getByText('Paso 2 de 11')).toBeVisible();
    await guia.getByRole('button', { name: 'Siguiente' }).click();
    await expect(guia.getByRole('heading', { name: 'Flash Informativo' })).toBeVisible();
    await guia.getByRole('button', { name: 'Anterior' }).click();
    await expect(guia.getByRole('heading', { name: 'Menú principal' })).toBeVisible();
    for (let i = 0; i < 9; i++) await guia.getByRole('button', { name: 'Siguiente' }).click();
    await expect(page).toHaveURL(/\/mi-perfil$/);
    await expect(guia.getByRole('heading', { name: 'Completa tu perfil' })).toBeVisible();
    await guia.getByRole('button', { name: 'Completar mi perfil' }).click();
    await expect(page.getByRole('heading', { name: 'Mis intereses' })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Mis intereses' })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('el recorrido se puede omitir', async ({ page }) => {
    await page.goto('/registro');
    await page.getByLabel('Nombre').fill('Omar');
    await page.getByLabel('Apellido').fill('Omite');
    await page.getByLabel('Correo electrónico').fill(`omar.${Date.now()}@test.co`);
    await page.getByLabel('Contraseña', { exact: true }).fill('Clave-segura-123');
    await page.getByLabel('Confirmar contraseña').fill('Clave-segura-123');
    await page.getByRole('button', { name: /Siguiente/ }).click();
    await page.getByLabel(/Autorizo el tratamiento/).check();
    await page.getByRole('button', { name: 'Crear mi cuenta' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Omitir recorrido' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Bienvenido al Observatorio Empresarial' })).toBeVisible();
  });
});
