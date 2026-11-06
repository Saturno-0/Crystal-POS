import { expect, test } from '@playwright/test';
import { crearProducto, irA, login } from './helpers';

async function venderYObtenerFolio(
  page: import('@playwright/test').Page,
  nombreProducto: string,
  { probado = false } = {},
): Promise<string> {
  await irA(page, 'Venta');
  await page.getByPlaceholder('Buscar nombre, marca o SKU…').fill(nombreProducto);
  await page.getByText(nombreProducto).click();
  if (probado) await page.getByRole('button', { name: 'P · probado' }).click();
  await page.getByRole('button', { name: 'Cobrar e imprimir ticket' }).click();
  await page.getByRole('button', { name: 'Tarjeta', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar e imprimir ticket' }).click();
  const texto = await page.getByText(/Folio #\d+/).textContent();
  await page.getByRole('button', { name: 'Listo', exact: true }).click();
  return texto!.match(/#(\d+)/)![1];
}

test.describe('Cambio por otra prenda (regla 10)', () => {
  test('cambia por un producto más caro cobrando la diferencia en efectivo', async ({ page }) => {
    await login(page, 'Crystal Domínguez');
    await crearProducto(page, { nombre: 'Cambio UX original', marca: 'TestMarca', precio: 300, categoria: 'Blusas', talla: 'S' });
    await crearProducto(page, { nombre: 'Cambio UX reemplazo', marca: 'TestMarca', precio: 400, categoria: 'Blusas', talla: 'M' });

    const folio = await venderYObtenerFolio(page, 'Cambio UX original');

    await irA(page, 'Cambios');
    await page.getByPlaceholder('Folio del ticket').fill(folio);
    await page.getByRole('button', { name: 'Buscar', exact: true }).click();
    await expect(page.getByText('Cambio UX original')).toBeVisible();

    await page.getByRole('button', { name: 'Cambiar', exact: true }).click();
    await page
      .locator('input[placeholder="Buscar nombre, marca o SKU…"]')
      .fill('Cambio UX reemplazo');
    await page.getByText('Cambio UX reemplazo', { exact: false }).click();

    await expect(page.getByText('Diferencia a cobrar')).toBeVisible();
    await expect(page.getByText('$100.00')).toBeVisible();
    await page.getByRole('button', { name: 'Efectivo', exact: true }).click();
    await page.getByRole('button', { name: 'Cobrar diferencia y confirmar cambio' }).click();

    await expect(page.getByText(`Cambio registrado · ticket #${folio}`)).toBeVisible();
  });

  test('una prenda marcada como probada no se puede cambiar', async ({ page }) => {
    await login(page, 'Crystal Domínguez');
    await crearProducto(page, { nombre: 'Cambio UX probada', marca: 'TestMarca', precio: 300, categoria: 'Blusas', talla: 'S' });

    const folio = await venderYObtenerFolio(page, 'Cambio UX probada', { probado: true });

    await irA(page, 'Cambios');
    await page.getByPlaceholder('Folio del ticket').fill(folio);
    await page.getByRole('button', { name: 'Buscar', exact: true }).click();

    await expect(page.getByText('Prenda probada · sin cambios ni devoluciones')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cambiar', exact: true })).toBeDisabled();
  });
});
