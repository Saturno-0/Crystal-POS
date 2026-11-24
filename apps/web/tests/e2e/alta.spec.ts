import { expect, test } from '@playwright/test';
import { crearProducto, irA, login } from './helpers';

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

  test('"Dar de alta y vender ahora" lleva la pieza directo al ticket de Venta', async ({ page }) => {
    await login(page, 'Crystal Domínguez');
    await irA(page, 'Alta');
    await page.getByPlaceholder('Ej. Jean recto tiro alto').fill('Blusa vender ya');
    await page.getByPlaceholder('Marca').fill('TestMarca');
    await page.getByPlaceholder('$0.00').fill('380');
    await page.getByRole('button', { name: 'Blusas', exact: true }).click();
    await page.getByRole('button', { name: 'S', exact: true }).click();
    await page.getByRole('button', { name: 'Dar de alta y vender ahora' }).click();

    await expect(page.getByText('Vendiendo como')).toBeVisible();
    await expect(page.getByText('Blusa vender ya agregado al ticket')).toBeVisible();
    await expect(page.getByRole('button', { name: /Cobrar/ })).toBeEnabled();
  });

  test('dar de alta una prenda que ya existe suma a su stock en vez de duplicarla', async ({ page }) => {
    await login(page, 'Crystal Domínguez');
    for (let i = 0; i < 2; i++) {
      await irA(page, 'Alta');
      await page.getByPlaceholder('Ej. Jean recto tiro alto').fill('Blusa repetida');
      await page.getByPlaceholder('Marca').fill('TestMarca');
      await page.getByPlaceholder('$0.00').fill('300');
      await page.getByRole('button', { name: 'Blusas', exact: true }).click();
      await page.getByRole('button', { name: 'L', exact: true }).click();
      await page.getByRole('button', { name: 'Dar de alta 1 pieza' }).click();
    }
    await expect(page.getByText(/Ya existía: \+1 al stock de Blusa repetida · ahora 2 u/)).toBeVisible();

    await irA(page, 'Venta');
    await page.getByPlaceholder('Buscar nombre, marca o SKU…').fill('Blusa repetida');
    await expect(page.getByText('Blusa repetida', { exact: true })).toHaveCount(1);
    await expect(page.getByText('2 u', { exact: true })).toBeVisible();
  });

  test('alta por lote con preset +10 y tallas numéricas de pantalón', async ({ page }) => {
    await login(page, 'Crystal Domínguez');
    await irA(page, 'Alta');

    await page.getByRole('button', { name: 'Por lote' }).click();
    await page.getByPlaceholder('Ej. Jean recto tiro alto').fill('Jean UX test');
    await page.getByPlaceholder('Marca').fill('TestMarca');
    await page.getByPlaceholder('$0.00').fill('900');
    await page.getByRole('button', { name: 'Mezclilla', exact: true }).click();
    // Regla 7: pantalones usan tallas numéricas 1–15, no XS–XXL.
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

  test('XL con precio propio: se vende aparte, se busca por nombre + marca y se conserva al resurtir', async ({ page }) => {
    await login(page, 'Crystal Domínguez');
    await irA(page, 'Alta');

    async function abrirModal() {
      await page.getByPlaceholder('Ej. Jean recto tiro alto').fill('Blusa precio talla');
      await page.getByPlaceholder('Marca').fill('Marquesa');
      await page.getByPlaceholder('$0.00').fill('320');
      await page.getByRole('button', { name: 'Blusas', exact: true }).click();
      await page.getByRole('button', { name: 'Por lote' }).click();
      await page.getByRole('button', { name: 'Alta por tallas (varias cantidades a la vez)' }).click();
      await expect(page.getByLabel('Cantidad talla M', { exact: true })).toBeVisible();
    }

    await abrirModal();
    await page.getByLabel('Cantidad talla M', { exact: true }).fill('2');
    await page.getByLabel('Cantidad talla XXL', { exact: true }).fill('1');
    await expect(page.getByLabel('Precio talla XXL', { exact: true })).not.toBeVisible();
    await page.getByRole('button', { name: 'Poner otro precio a algunas tallas' }).click();
    await page.getByLabel('Precio talla XXL', { exact: true }).fill('0');
    await expect(page.getByText('Precio inválido en talla XXL')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Dar de alta 3 piezas' })).toBeDisabled();
    await page.getByLabel('Precio talla XXL', { exact: true }).fill('350');
    await page.getByRole('button', { name: 'Dar de alta 3 piezas' }).click();
    await expect(page.getByText('3 piezas dadas de alta en 2 tallas')).toBeVisible();

    // Resurtir con el precio general: la XXL llega con sus $350 ya puestos.
    await abrirModal();
    await expect(page.getByLabel('Precio talla XXL', { exact: true })).toHaveValue('350');
    await expect(page.getByLabel('Precio talla M', { exact: true })).toHaveValue('');
    await page.getByLabel('Cantidad talla M', { exact: true }).fill('1');
    await page.getByLabel('Cantidad talla XXL', { exact: true }).fill('1');
    await page.getByRole('button', { name: 'Dar de alta 2 piezas' }).click();
    await expect(page.getByText(/2 ya existían y se sumaron a su stock/)).toBeVisible();

    await irA(page, 'Venta');
    const buscador = page.getByPlaceholder('Buscar nombre, marca o SKU…');
    await buscador.fill('blusa precio marquesa');
    // Espera a que se aplique el filtro (debounce) antes de contar.
    await expect(page.getByText('Blusa UX test')).toHaveCount(0);
    await expect(page.getByText('Blusa precio talla')).toHaveCount(2);
    await expect(page.getByText('$320.00')).toBeVisible();
    await expect(page.getByText('$350.00')).toBeVisible();
    await buscador.fill('marquesa xxl');
    await expect(page.getByText('Blusa precio talla')).toHaveCount(1);
    await expect(page.getByText('$350.00')).toBeVisible();
  });

  test('en móvil los precios por talla caben en el modal', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await login(page, 'Crystal Domínguez');
    await irA(page, 'Alta');
    await page.getByPlaceholder('Ej. Jean recto tiro alto').fill('Blusa precio movil');
    await page.getByPlaceholder('Marca').fill('Marquesa');
    await page.getByPlaceholder('$0.00').fill('320');
    await page.getByRole('button', { name: 'Blusas', exact: true }).click();
    await page.getByRole('button', { name: 'Por lote' }).click();
    await page.getByRole('button', { name: 'Alta por tallas (varias cantidades a la vez)' }).click();
    await page.getByRole('button', { name: 'Poner otro precio a algunas tallas' }).click();

    const tarjeta = (await page.getByText('Cantidad por talla').locator('..').boundingBox())!;
    expect(tarjeta.x + tarjeta.width).toBeLessThanOrEqual(360);
    for (const talla of ['XS', 'S', 'M', 'L', 'XL', 'XXL']) {
      const caja = (await page.getByLabel(`Precio talla ${talla}`, { exact: true }).boundingBox())!;
      expect(caja.x + caja.width).toBeLessThanOrEqual(tarjeta.x + tarjeta.width + 1);
    }
    const confirmar = (await page.getByRole('button', { name: 'Dar de alta 0 piezas' }).boundingBox())!;
    expect(confirmar.height).toBeGreaterThanOrEqual(44);
    await page.getByRole('button', { name: 'Usar $320.00 en todas' }).click();
    await expect(page.getByLabel('Precio talla XL', { exact: true })).not.toBeVisible();
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

  test('recuerda la última categoría elegida al dar de alta y al volver a la sección', async ({ page }) => {
    await login(page, 'Crystal Domínguez');
    await crearProducto(page, { nombre: 'Categoria recordada', marca: 'TestMarca', precio: 300, categoria: 'Mezclilla', talla: '5' });
    const mezclilla = page.getByRole('button', { name: 'Mezclilla', exact: true });
    await expect(page.getByPlaceholder('Ej. Jean recto tiro alto')).toHaveValue('');
    await expect(mezclilla).toHaveClass(/chipCategoriaActiva/);

    await irA(page, 'Venta');
    await irA(page, 'Alta');
    await expect(mezclilla).toHaveClass(/chipCategoriaActiva/);
    await expect(page.getByRole('button', { name: '1', exact: true })).toHaveClass(/chipTallaActiva/);
  });
});
