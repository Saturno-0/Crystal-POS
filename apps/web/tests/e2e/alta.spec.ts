import { expect, test } from '@playwright/test';
import { irA, login } from './helpers';

test.describe('Alta de inventario (HU-2.1 a HU-2.3)', () => {
  test('pieza única con talla estándar aparece luego en el catálogo de Venta', async ({ page }) => {
    await login(page, 'Crystal Domínguez');
    await irA(page, 'Alta');

    await page.getByPlaceholder('Ej. Jean recto tiro alto').fill('Blusa UX test');
    await page.getByPlaceholder('Marca').fill('TestMarca');
    await page.getByPlaceholder('$0.00').fill('350');
    await page.getByRole('button', { name: 'Blusas', exact: true }).click();
    await page.getByRole('button', { name: 'M', exact: true }).click();
    await page.getByRole('button', { name: 'Dar de alta 1 pieza' }).click();
    await expect(page.getByText(/Pieza única dada de alta · SKU/)).toBeVisible();

    await irA(page, 'Venta');
    await page.getByPlaceholder('Buscar nombre, marca o SKU…').fill('Blusa UX test');
    await expect(page.getByText('Blusa UX test')).toBeVisible();
    await expect(page.getByText('talla M')).toBeVisible();
  });

  test('alta por lote con preset +10 y tallas numéricas de pantalón', async ({ page }) => {
    await login(page, 'Crystal Domínguez');
    await irA(page, 'Alta');

    await page.getByRole('button', { name: 'Por lote' }).click();
    await page.getByPlaceholder('Ej. Jean recto tiro alto').fill('Jean UX test');
    await page.getByPlaceholder('Marca').fill('TestMarca');
    await page.getByPlaceholder('$0.00').fill('900');
    await page.getByRole('button', { name: 'Mezclilla', exact: true }).click();
    // Regla 7: pantalones usan tallas numéricas 1–15, no XS–XL.
    await expect(page.getByRole('button', { name: 'XS', exact: true })).not.toBeVisible();
    await page.getByRole('button', { name: '7', exact: true }).click();

    await page.getByRole('button', { name: '+10' }).click();
    await expect(page.getByRole('button', { name: 'Dar de alta 15 unidades' })).toBeVisible();
    await page.getByRole('button', { name: 'Dar de alta 15 unidades' }).click();
    await expect(page.getByText(/15 unidades dadas de alta · SKU/)).toBeVisible();
  });

  test('vestido: sin selector de talla y con descuento propio', async ({ page }) => {
    await login(page, 'Crystal Domínguez');
    await irA(page, 'Alta');

    await page.getByPlaceholder('Ej. Jean recto tiro alto').fill('Vestido UX test');
    await page.getByPlaceholder('Marca').fill('TestMarca');
    await page.getByPlaceholder('$0.00').fill('800');
    await page.getByRole('button', { name: 'Vestidos', exact: true }).click();

    await expect(page.getByText('Los vestidos no manejan tallas: cada pieza es única.')).toBeVisible();
    await page.getByRole('button', { name: '10%', exact: true }).click();

    await page.getByRole('button', { name: 'Dar de alta 1 pieza' }).click();
    await expect(page.getByText(/Pieza única dada de alta · SKU/)).toBeVisible();
  });
});
