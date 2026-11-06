import { expect, test } from '@playwright/test';
import { crearProducto, irA, login } from './helpers';

test.describe('Impresión de ticket (HU-3.6, impresora POS-58 confirmada)', () => {
  test.beforeEach(async ({ page }) => {
    // Espía window.print() antes de que cargue la app: en headless no hay
    // impresora real, así que lo que probamos es que SE LLAMÓ, no el resultado físico.
    await page.addInitScript(() => {
      (window as unknown as { __printCalls: number }).__printCalls = 0;
      window.print = () => {
        (window as unknown as { __printCalls: number }).__printCalls += 1;
      };
    });
  });

  test('al confirmar una venta directa se imprime automáticamente', async ({ page }) => {
    await login(page, 'Crystal Domínguez');
    await crearProducto(page, { nombre: 'Impresión UX venta', marca: 'TestMarca', precio: 250, categoria: 'Blusas', talla: 'S' });

    await irA(page, 'Venta');
    await page.getByPlaceholder('Buscar nombre, marca o SKU…').fill('Impresión UX venta');
    await page.getByText('Impresión UX venta').click();
    await page.getByRole('button', { name: 'Cobrar e imprimir ticket' }).click();
    const pasarela = page.getByText('Pasarela de pago').locator('..').locator('..');
    await pasarela.getByRole('button', { name: 'Tarjeta', exact: true }).click();
    await pasarela.getByRole('button', { name: 'Confirmar e imprimir ticket' }).click();

    await expect(page.getByText('Venta completada')).toBeVisible();
    // En dev, <StrictMode> (main.tsx) invoca los efectos dos veces a propósito
    // para detectar efectos no idempotentes — por eso aquí puede salir 1 o 2;
    // en el build de producción (sin StrictMode) imprime una sola vez. Lo que
    // importa es que se haya disparado al menos una.
    const llamadasTrasConfirmar = await page.evaluate(() => (window as unknown as { __printCalls: number }).__printCalls);
    expect(llamadasTrasConfirmar).toBeGreaterThanOrEqual(1);

    // "Imprimir de nuevo" vuelve a disparar la impresión.
    await page.getByRole('button', { name: 'Imprimir de nuevo' }).click();
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __printCalls: number }).__printCalls))
      .toBeGreaterThan(llamadasTrasConfirmar);
  });

  test('al apartar una prenda se imprime el recibo automáticamente', async ({ page }) => {
    await login(page, 'Crystal Domínguez');
    await crearProducto(page, { nombre: 'Impresión UX apartado', marca: 'TestMarca', precio: 400, categoria: 'Blusas', talla: 'M' });

    await irA(page, 'Venta');
    await page.getByPlaceholder('Buscar nombre, marca o SKU…').fill('Impresión UX apartado');
    await page.getByText('Impresión UX apartado').click();
    await page.getByRole('button', { name: 'Apartado', exact: true }).click();
    await page.getByPlaceholder('Nombre del cliente').fill('Cliente Impresión');
    await page.getByPlaceholder('Abono inicial').fill('150');
    await page.getByRole('button', { name: 'Apartar e imprimir recibo' }).click();

    await expect(page.getByText('Apartado registrado')).toBeVisible();
    const llamadas = await page.evaluate(() => (window as unknown as { __printCalls: number }).__printCalls);
    expect(llamadas).toBeGreaterThanOrEqual(1); // StrictMode duplica efectos en dev, ver nota arriba
  });

  test('el recibo imprimible usa el ancho del rollo de 58mm (54mm imprimibles)', async ({ page }) => {
    await login(page, 'Crystal Domínguez');
    await crearProducto(page, { nombre: 'Impresión UX ancho', marca: 'TestMarca', precio: 300, categoria: 'Blusas', talla: 'L' });

    await irA(page, 'Venta');
    await page.getByPlaceholder('Buscar nombre, marca o SKU…').fill('Impresión UX ancho');
    await page.getByText('Impresión UX ancho').click();
    await page.getByRole('button', { name: 'Cobrar e imprimir ticket' }).click();
    const pasarela = page.getByText('Pasarela de pago').locator('..').locator('..');
    await pasarela.getByRole('button', { name: 'Tarjeta', exact: true }).click();
    await pasarela.getByRole('button', { name: 'Confirmar e imprimir ticket' }).click();
    await expect(page.getByText('Venta completada')).toBeVisible();

    await page.emulateMedia({ media: 'print' });
    const recibo = page.locator('.recibo-imprimible');
    const anchoPx = await recibo.evaluate((el) => el.getBoundingClientRect().width);
    // 54mm a 96dpi (unidad CSS estándar para impresión) ≈ 204px. Con margen de
    // tolerancia por redondeo del motor de layout.
    expect(anchoPx).toBeGreaterThan(190);
    expect(anchoPx).toBeLessThan(220);
  });
});
