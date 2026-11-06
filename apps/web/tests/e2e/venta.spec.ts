import { expect, test } from '@playwright/test';
import { crearProducto, irA, login } from './helpers';

test.describe('Venta (HU-3.1 a HU-3.6)', () => {
  test('armar ticket, marcar probado, descuento manual y cobrar en efectivo con cambio', async ({ page }) => {
    await login(page, 'Crystal Domínguez');
    // Alta por lote (stock = 5) para poder subir la cantidad del ticket a 2.
    await crearProducto(page, { nombre: 'Venta UX blusa', marca: 'TestMarca', precio: 350, categoria: 'Blusas', talla: 'M', lote: true });

    await irA(page, 'Venta');
    await page.getByPlaceholder('Buscar nombre, marca o SKU…').fill('Venta UX blusa');
    await page.getByText('Venta UX blusa').click();

    // El ticket muestra la línea agregada (desktop: panel visible directamente).
    await expect(page.getByText('Toca un producto para agregarlo al ticket.')).not.toBeVisible();

    const lineaTicket = page.locator('text=Venta UX blusa').locator('..').locator('..').locator('..');

    // Stepper: sube a 2 unidades.
    await lineaTicket.getByRole('button', { name: '+', exact: true }).click();
    await expect(lineaTicket.getByText('2', { exact: true })).toBeVisible();

    // Marca como probada.
    await lineaTicket.getByRole('button', { name: 'P · probado' }).click();
    await expect(page.getByText('Prenda probada · sin cambios ni devoluciones')).toBeVisible();

    // Descuento manual por monto: $50 sobre la línea (2 × 350 = 700 base).
    await lineaTicket.getByRole('button', { name: '$', exact: true }).click();
    await lineaTicket.getByPlaceholder('Descuento').fill('50');
    await expect(page.getByText('Descuento manual: −$50.00')).toBeVisible();

    await page.getByRole('button', { name: 'Cobrar e imprimir ticket' }).click();
    const pasarela = page.getByText('Pasarela de pago').locator('..').locator('..');
    await pasarela.getByRole('button', { name: 'Efectivo', exact: true }).click();
    // Total de la pasarela: 700 − 50 (línea) − 15 (método de pago, regla 4) = 635.
    await expect(pasarela.getByText('−$15.00', { exact: false })).toBeVisible();
    await pasarela.locator('input').fill('700');
    await expect(pasarela.getByText('$65.00', { exact: true })).toBeVisible(); // cambio = 700 − 635
    await pasarela.getByRole('button', { name: 'Confirmar e imprimir ticket' }).click();

    await expect(page.getByText('Venta completada')).toBeVisible();
    await expect(page.getByText(/Folio #\d+/)).toBeVisible();
    await page.getByRole('button', { name: 'Listo', exact: true }).click();
    await expect(page.getByText('Venta completada')).not.toBeVisible();
  });

  test('tarjeta no aplica el descuento de −$15 por método de pago (regla 4)', async ({ page }) => {
    await login(page, 'Crystal Domínguez');
    await crearProducto(page, { nombre: 'Venta UX tarjeta', marca: 'TestMarca', precio: 400, categoria: 'Blusas', talla: 'L' });

    await irA(page, 'Venta');
    await page.getByPlaceholder('Buscar nombre, marca o SKU…').fill('Venta UX tarjeta');
    await page.getByText('Venta UX tarjeta').click();

    await page.getByRole('button', { name: 'Cobrar e imprimir ticket' }).click();
    const pasarela = page.getByText('Pasarela de pago').locator('..').locator('..');
    await pasarela.getByRole('button', { name: 'Tarjeta', exact: true }).click();
    await expect(pasarela.getByText('Descuento por método de pago', { exact: false })).not.toBeVisible();
    await expect(pasarela.getByText('El vendedor recibe').locator('..').getByText('$400.00')).toBeVisible();
    await pasarela.getByRole('button', { name: 'Confirmar e imprimir ticket' }).click();
    await expect(page.getByText('Venta completada')).toBeVisible();
  });
});
