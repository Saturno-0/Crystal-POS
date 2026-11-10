import { expect, type Page, test } from '@playwright/test';
import { irA, login } from './helpers';

async function crearCategoriaPorColor(page: Page, nombre: string, tipo: 'XS–XL' | 'Numérica (pantalón)') {
  await page.getByRole('button', { name: /Gestionar categorías/ }).click();
  await page.getByPlaceholder('Nueva categoría').fill(nombre);
  await page.locator('select').selectOption({ label: tipo });
  await page.getByLabel(/Por color/).check();
  await page.getByRole('button', { name: 'Agregar', exact: true }).click();
  await expect(page.getByText(`Categoría "${nombre}" agregada`)).toBeVisible();
}

test.describe('Alta por color (sacos, pantalones de vestir)', () => {
  test('alta color × talla crea un SKU por combinación y el color se ve en Venta', async ({ page }) => {
    await login(page, 'Crystal Domínguez');
    await irA(page, 'Alta');
    await crearCategoriaPorColor(page, 'Sacos', 'XS–XL');

    await page.getByPlaceholder('Ej. Jean recto tiro alto').fill('Saco color UX test');
    await page.getByPlaceholder('Marca').fill('Sastre');
    await page.getByPlaceholder('$0.00').fill('1500');
    await page.getByRole('button', { name: 'Sacos', exact: true }).click();

    // Pieza única sin color → se exige.
    await page.getByRole('button', { name: 'Dar de alta 1 pieza' }).click();
    await expect(page.getByText('Elige el color del producto')).toBeVisible();

    await page.getByRole('button', { name: 'Alta por color y talla (varias cantidades a la vez)' }).click();
    const modal = page.getByText('Cantidad por color y talla').locator('..');
    await expect(modal).toBeVisible();

    await modal.getByRole('button', { name: 'Negro', exact: true }).click();
    await page.getByLabel('Cantidad Negro talla S', { exact: true }).fill('2');
    await page.getByLabel('Cantidad Negro talla XL', { exact: true }).fill('1');

    await modal.getByLabel('Otro color').fill('verde OLIVO');
    await modal.getByRole('button', { name: 'Agregar', exact: true }).click();
    await page.getByLabel('Cantidad Verde olivo talla XS', { exact: true }).fill('4');

    await page.getByRole('button', { name: 'Dar de alta 7 piezas' }).click();
    await expect(page.getByText('7 piezas dadas de alta en 3 combinaciones de color y talla')).toBeVisible();

    await irA(page, 'Venta');
    await page.getByPlaceholder('Buscar nombre, marca o SKU…').fill('olivo');
    // La búsqueda incluye el color: solo queda el SKU verde olivo.
    await expect(page.getByText('Saco color UX test')).toHaveCount(1);
    await expect(page.getByText(/talla XS\s*· Verde olivo/)).toBeVisible();
  });

  test('en móvil el modal color × talla cabe en la pantalla', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await login(page, 'Crystal Domínguez');
    await irA(page, 'Alta');
    await crearCategoriaPorColor(page, 'Pantalones de vestir', 'Numérica (pantalón)');

    await page.getByPlaceholder('Ej. Jean recto tiro alto').fill('Pantalon vestir movil');
    await page.getByPlaceholder('Marca').fill('Sastre');
    await page.getByPlaceholder('$0.00').fill('800');
    await page.getByRole('button', { name: 'Pantalones de vestir', exact: true }).click();
    await page.getByRole('button', { name: 'Alta por color y talla (varias cantidades a la vez)' }).click();
    const modal = page.getByText('Cantidad por color y talla').locator('..');
    await modal.getByRole('button', { name: 'Gris', exact: true }).click();

    const tarjeta = await modal.boundingBox();
    expect(tarjeta!.x + tarjeta!.width).toBeLessThanOrEqual(360);
    for (const talla of ['1', '3', '5', '7', '9', '11', '13', '15']) {
      const caja = await page.getByLabel(`Cantidad Gris talla ${talla}`, { exact: true }).boundingBox();
      expect(caja!.x + caja!.width).toBeLessThanOrEqual(tarjeta!.x + tarjeta!.width + 1);
    }
  });
});
