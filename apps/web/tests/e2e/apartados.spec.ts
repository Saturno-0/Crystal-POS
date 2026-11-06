import { expect, test } from '@playwright/test';
import { crearProducto, irA, login } from './helpers';

async function apartarProducto(page: import('@playwright/test').Page, cliente: string, nombreProducto: string) {
  await irA(page, 'Venta');
  await page.getByPlaceholder('Buscar nombre, marca o SKU…').fill(nombreProducto);
  await page.getByText(nombreProducto).click();
  await page.getByRole('button', { name: 'Apartado', exact: true }).click();
  await page.getByPlaceholder('Nombre del cliente').fill(cliente);
  await page.getByPlaceholder('Abono inicial').fill('200');
  await page.getByRole('button', { name: 'Apartar e imprimir recibo' }).click();
  await expect(page.getByText('Apartado registrado')).toBeVisible();
  await expect(page.getByText(/Vence el/)).toBeVisible();
  await page.getByRole('button', { name: 'Listo', exact: true }).click();
}

test.describe('Apartados (HU-4.1 a HU-4.4)', () => {
  test('apartar, prorrogar y penalizar devuelve la unidad al stock', async ({ page }) => {
    await login(page, 'Crystal Domínguez');
    await crearProducto(page, { nombre: 'Apartado UX prorroga', marca: 'TestMarca', precio: 500, categoria: 'Blusas', talla: 'S' });
    await apartarProducto(page, 'Cliente Prorroga', 'Apartado UX prorroga');

    await irA(page, 'Apartados');
    await expect(page.getByText('Cliente Prorroga')).toBeVisible();
    await expect(page.getByText('Abonado $200.00 de $500.00')).toBeVisible();

    await page.getByRole('button', { name: 'Prorrogar 15 días' }).click();
    await expect(page.getByText('Plazo de Cliente Prorroga extendido 15 días más')).toBeVisible();

    await page.getByRole('button', { name: 'Penalizar', exact: true }).click();
    await expect(page.getByText(/Abono de \$200\.00 penalizado/)).toBeVisible();
    await expect(page.getByText('Cliente Prorroga')).not.toBeVisible();
  });

  test('liquidar un apartado cobra el remanente y lo quita de la lista', async ({ page }) => {
    await login(page, 'Crystal Domínguez');
    await crearProducto(page, { nombre: 'Apartado UX liquidar', marca: 'TestMarca', precio: 500, categoria: 'Blusas', talla: 'L' });
    await apartarProducto(page, 'Cliente Liquida', 'Apartado UX liquidar');

    await irA(page, 'Apartados');
    await expect(page.getByText('Cliente Liquida')).toBeVisible();
    await page.getByRole('button', { name: 'Registrar 2º pago' }).click();
    await expect(page.getByText(/Apartado liquidado · remanente \$300\.00 cobrado/)).toBeVisible();
    await expect(page.getByText('Cliente Liquida')).not.toBeVisible();
  });
});
