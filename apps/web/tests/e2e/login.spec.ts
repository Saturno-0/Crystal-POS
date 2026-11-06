import { expect, test } from '@playwright/test';
import { login } from './helpers';

test.describe('Login (HU-1.1)', () => {
  test('NIP incorrecto muestra el error literal y no entra', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Crystal POS · sucursal Centro')).toBeVisible();
    await page.getByRole('button', { name: /Crystal Domínguez/ }).click();
    await page.getByLabel('NIP').fill('0000');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.getByText('NIP incorrecto para Crystal Domínguez')).toBeVisible();
    // Sigue en el login, no avanzó a la app.
    await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible();
  });

  test('NIP correcto saluda y aterriza en Venta', async ({ page }) => {
    await login(page, 'Crystal Domínguez');
    await expect(page.getByPlaceholder('Buscar nombre, marca o SKU…')).toBeVisible();
  });
});
