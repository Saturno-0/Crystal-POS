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

  test('alta por tallas crea una fila por talla con el mismo precio', async ({ page }) => {
    await login(page, 'Crystal Domínguez');
    await irA(page, 'Alta');

    await page.getByPlaceholder('Ej. Jean recto tiro alto').fill('Pantalon Ciclon UX test');
    await page.getByPlaceholder('Marca').fill('Ciclon');
    await page.getByPlaceholder('$0.00').fill('350');
    await page.getByRole('button', { name: 'Mezclilla', exact: true }).click();

    await page.getByRole('button', { name: 'Por lote' }).click();

    await page.getByRole('button', { name: 'Alta por tallas (varias cantidades a la vez)' }).click();
    await expect(page.getByLabel('Cantidad talla 1', { exact: true })).toBeVisible();

    await page.getByLabel('Cantidad talla 1', { exact: true }).fill('3');
    await page.getByLabel('Cantidad talla 3', { exact: true }).fill('5');
    await expect(page.getByText('Total: 8 piezas')).toBeVisible();

    await page.getByRole('button', { name: 'Dar de alta 8 piezas' }).click();
    await expect(page.getByText('8 piezas dadas de alta en 2 tallas')).toBeVisible();

    await irA(page, 'Venta');
    await page.getByPlaceholder('Buscar nombre, marca o SKU…').fill('Pantalon Ciclon UX test');
    // En Venta las 2 tallas se ven como un solo producto con el stock sumado.
    await expect(page.getByText('Pantalon Ciclon UX test')).toHaveCount(1);
    await expect(page.getByText('tallas 1, 3')).toBeVisible();
    await expect(page.getByText('8 u', { exact: true })).toBeVisible();

    // Al tocarlo se elige la talla, con su existencia.
    await page.getByText('Pantalon Ciclon UX test').click();
    const selector = page.getByRole('dialog', { name: 'Elegir talla de Pantalon Ciclon UX test' });
    await expect(selector.getByRole('button', { name: 'Talla 1 · 3 disponibles' })).toBeVisible();
    await expect(selector.getByRole('button', { name: 'Talla 3 · 5 disponibles' })).toBeVisible();
    await selector.getByRole('button', { name: 'Talla 3 · 5 disponibles' }).click();
    await expect(selector).not.toBeVisible();

    await expect(page.getByText('Subtotal · 1 pzas')).toBeVisible();
  });

  test('pieza única no ofrece alta por tallas', async ({ page }) => {
    await login(page, 'Crystal Domínguez');
    await irA(page, 'Alta');
    await page.getByRole('button', { name: 'Mezclilla', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Alta por tallas (varias cantidades a la vez)' }),
    ).not.toBeVisible();
    await page.getByRole('button', { name: 'Por lote' }).click();
    await expect(
      page.getByRole('button', { name: 'Alta por tallas (varias cantidades a la vez)' }),
    ).toBeVisible();
  });

  test('alta por tallas: el botón de confirmar queda deshabilitado sin cantidades', async ({ page }) => {
    await login(page, 'Crystal Domínguez');
    await irA(page, 'Alta');

    await page.getByPlaceholder('Ej. Jean recto tiro alto').fill('Pantalon vacio UX test');
    await page.getByPlaceholder('Marca').fill('Ciclon');
    await page.getByPlaceholder('$0.00').fill('350');
    await page.getByRole('button', { name: 'Mezclilla', exact: true }).click();
    await page.getByRole('button', { name: 'Por lote' }).click();
    await page.getByRole('button', { name: 'Alta por tallas (varias cantidades a la vez)' }).click();

    await expect(page.getByRole('button', { name: 'Dar de alta 0 piezas' })).toBeDisabled();
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByLabel('Cantidad talla 1', { exact: true })).not.toBeVisible();
  });

  test('alta por tallas: ningún campo de cantidad se desborda del modal (2 columnas)', async ({ page }) => {
    await login(page, 'Crystal Domínguez');
    await irA(page, 'Alta');

    await page.getByPlaceholder('Ej. Jean recto tiro alto').fill('Pantalon overflow UX test');
    await page.getByPlaceholder('Marca').fill('Ciclon');
    await page.getByPlaceholder('$0.00').fill('350');
    await page.getByRole('button', { name: 'Mezclilla', exact: true }).click();
    await page.getByRole('button', { name: 'Por lote' }).click();
    await page.getByRole('button', { name: 'Alta por tallas (varias cantidades a la vez)' }).click();

    const tarjeta = page.getByText('Cantidad por talla').locator('..');
    const cajaTarjeta = await tarjeta.boundingBox();
    expect(cajaTarjeta).not.toBeNull();

    // Regla 7: pantalones usan 8 tallas numéricas → 4 filas de 2 columnas.
    // Ningún input (ni el de la segunda columna) debe salirse del borde
    // derecho de la tarjeta del modal.
    for (const talla of ['1', '3', '5', '7', '9', '11', '13', '15']) {
      const caja = await page.getByLabel(`Cantidad talla ${talla}`, { exact: true }).boundingBox();
      expect(caja).not.toBeNull();
      expect(caja!.x + caja!.width).toBeLessThanOrEqual(cajaTarjeta!.x + cajaTarjeta!.width + 1);
    }
  });

  test('alta por tallas en móvil: la tarjeta y los campos caben en la pantalla', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await login(page, 'Crystal Domínguez');
    await irA(page, 'Alta');

    await page.getByPlaceholder('Ej. Jean recto tiro alto').fill('Pantalon movil UX test');
    await page.getByPlaceholder('Marca').fill('Ciclon');
    await page.getByPlaceholder('$0.00').fill('350');
    await page.getByRole('button', { name: 'Mezclilla', exact: true }).click();
    await page.getByRole('button', { name: 'Por lote' }).click();
    await page.getByRole('button', { name: 'Alta por tallas (varias cantidades a la vez)' }).click();

    const cajaTarjeta = await page.getByText('Cantidad por talla').locator('..').boundingBox();
    expect(cajaTarjeta).not.toBeNull();
    // La tarjeta no debe ser más ancha que la pantalla (antes medía 420 px fijos).
    expect(cajaTarjeta!.x + cajaTarjeta!.width).toBeLessThanOrEqual(360);

    for (const talla of ['1', '3', '5', '7', '9', '11', '13', '15']) {
      const campo = page.getByLabel(`Cantidad talla ${talla}`, { exact: true });
      const caja = await campo.boundingBox();
      expect(caja).not.toBeNull();
      expect(caja!.x + caja!.width).toBeLessThanOrEqual(cajaTarjeta!.x + cajaTarjeta!.width + 1);
      await expect(campo).toHaveAttribute('maxlength', '3');
    }
  });

  test('alta por tallas no aparece para vestidos (sin_talla)', async ({ page }) => {
    await login(page, 'Crystal Domínguez');
    await irA(page, 'Alta');

    await page.getByPlaceholder('Ej. Jean recto tiro alto').fill('Vestido sin boton UX test');
    await page.getByPlaceholder('Marca').fill('TestMarca');
    await page.getByPlaceholder('$0.00').fill('800');
    await page.getByRole('button', { name: 'Vestidos', exact: true }).click();

    await page.getByRole('button', { name: 'Por lote' }).click();

    await expect(
      page.getByRole('button', { name: 'Alta por tallas (varias cantidades a la vez)' }),
    ).not.toBeVisible();
  });
});
