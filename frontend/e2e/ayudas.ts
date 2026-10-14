import { expect, type Page } from '@playwright/test';
import { CONTRASENA, CUENTAS } from './entorno.mjs';

export type Perfil = keyof typeof CUENTAS;

/** Inicia sesión desde la pantalla de acceso y espera a llegar al Inicio (el gestor de un módulo llega a su módulo). */
export async function iniciarSesion(page: Page, perfil: Perfil) {
  await page.goto('/iniciar-sesion');
  await page.getByLabel('Correo electrónico').fill(CUENTAS[perfil].correo);
  await page.getByLabel('Contraseña').fill(CONTRASENA);
  await page.getByRole('button', { name: 'Ingresar al portal' }).click();

  await expect(page).not.toHaveURL(/iniciar-sesion/);
  if (CUENTAS[perfil].rol.startsWith('Gestor ') && CUENTAS[perfil].rol !== 'Gestor Observatorio') {
    await expect(page.getByRole('complementary', { name: 'Menú principal' })).toBeVisible();
  } else {
    await expect(page.getByRole('heading', { name: 'Bienvenido al Observatorio Empresarial' })).toBeVisible();
  }
}

/** Ir a un módulo desde el menú lateral. */
export async function irA(page: Page, opcion: string) {
  await page.getByRole('complementary', { name: 'Menú principal' }).getByRole('link', { name: opcion }).click();
}
