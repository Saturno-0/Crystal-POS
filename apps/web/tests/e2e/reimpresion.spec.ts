import { expect, test } from '@playwright/test';
import { crearProducto, irA, login } from './helpers';

test.describe('Reimprimir tickets y recibos', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __printCalls: number };
      w.__printCalls = 0;
      window.print = () => {
        w.__printCalls += 1;
      };
    });
  });

  const impresiones = (page: import('@playwright/test').Page) =>
    page.evaluate(() => (window as unknown as { __printCalls: number }).__printCalls);

  test('busca una venta y la reimprime sin perder el ticket en captura', async ({ page }) => {
    await login(page, 'Crystal Domínguez');
    await crearProducto(page, { nombre: 'Reimpresion venta', marca: 'TestMarca', precio: 250, categoria: 'Blusas', talla: 'S', lote: true });

    await irA(page, 'Venta');
    await page.getByPlaceholder('Buscar nombre, marca o SKU…').fill('Reimpresion venta');
    await page.getByText('Reimpresion venta').click();
    await page.getByRole('button', { name: 'Cobrar e imprimir ticket' }).click();
    const pasarela = page.getByText('Pasarela de pago').locator('..').locator('..');
    await pasarela.getByRole('button', { name: 'Tarjeta', exact: true }).click();
    await pasarela.getByRole('button', { name: 'Confirmar e imprimir ticket' }).click();
    await expect(page.getByText('Venta completada')).toBeVisible();
    const folio = (await page.getByText(/^Folio #/).innerText()).replace('Folio #', '');
    await page.getByRole('button', { name: 'Listo', exact: true }).click();

    // Ticket nuevo a medio capturar.
    await page.getByText('Reimpresion venta').click();
    await expect(page.getByText('Subtotal · 1 pzas')).toBeVisible();

    const antes = await impresiones(page);
    await page.getByRole('button', { name: 'Reimprimir ticket' }).click();
    const historial = page.getByRole('dialog', { name: 'Reimprimir ticket' });
    await historial.getByPlaceholder('Folio, prenda, cliente o vendedor…').fill(`#${folio}`);
    await historial.getByRole('button', { name: `Ver ticket ${folio}` }).click();

    const recibo = page.locator('.recibo-imprimible');
    await expect(recibo.getByText(`Folio #${folio}`)).toBeVisible();
    await expect(recibo.getByText('1 × Reimpresion venta')).toBeVisible();
    await expect(recibo.getByText(/^Reimpresión:/)).toBeVisible();
    // Se revisa primero en pantalla: abrir no imprime.
    expect(await impresiones(page)).toBe(antes);
    await recibo.getByRole('button', { name: 'Reimprimir', exact: true }).click();
    expect(await impresiones(page)).toBe(antes + 1);

    // En papel: folio en negro puro, al ancho del rollo y en una sola tira.
    await page.emulateMedia({ media: 'print' });
    await expect(recibo.getByText(`Folio #${folio}`)).toHaveCSS('color', 'rgb(0, 0, 0)');
    const enPapel = await recibo.boundingBox();
    expect(enPapel!.x).toBe(0);
    expect(enPapel!.y).toBe(0);
    expect(Math.round(enPapel!.width)).toBe(181);
    await page.emulateMedia({ media: 'screen' });

    await recibo.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await page.getByRole('button', { name: 'Cerrar historial' }).click();
    await expect(page.getByText('Subtotal · 1 pzas')).toBeVisible();
  });

  test('reimprime el recibo de un apartado desde Apartados', async ({ page }) => {
    await login(page, 'Crystal Domínguez');
    await crearProducto(page, { nombre: 'Reimpresion apartado', marca: 'TestMarca', precio: 400, categoria: 'Blusas', talla: 'M' });
    await irA(page, 'Venta');
    await page.getByPlaceholder('Buscar nombre, marca o SKU…').fill('Reimpresion apartado');
    await page.getByText('Reimpresion apartado').click();
    await page.getByRole('button', { name: 'Apartado', exact: true }).click();
    await page.getByPlaceholder('Nombre del cliente').fill('Lucía Reimpresión');
    await page.getByPlaceholder('Abono inicial').fill('150');
    await page.getByRole('button', { name: 'Apartar e imprimir recibo' }).click();
    await page.getByRole('button', { name: 'Listo', exact: true }).click();

    await irA(page, 'Apartados');
    const historial = page.getByRole('dialog', { name: 'Reimprimir ticket' });
    const recibo = page.locator('.recibo-imprimible');
    const abrir = async () => {
      await page.getByRole('button', { name: 'Reimprimir recibo' }).click();
      // Sin acentos, por nombre de cliente.
      await historial.getByPlaceholder('Folio, prenda, cliente o vendedor…').fill('lucia reimpresion');
      await historial.getByRole('button', { name: /^Ver ticket / }).click();
    };

    await abrir();
    await expect(recibo.getByText('Apartado registrado')).toBeVisible();
    await expect(recibo.getByText('$250.00')).toBeVisible();
    await recibo.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await page.getByRole('button', { name: 'Cerrar historial' }).click();

    const tarjeta = page.locator('[class*="tarjeta"]').filter({ hasText: 'Lucía Reimpresión' });
    await tarjeta.getByRole('button', { name: 'Registrar 2º pago' }).click();
    await expect(page.getByText(/Apartado liquidado · remanente/)).toBeVisible();
    await abrir();
    await expect(recibo.getByText('Apartado liquidado')).toBeVisible();
    await expect(recibo.getByText('$400.00')).toBeVisible();
    await expect(recibo.getByText('Resta por pagar')).not.toBeVisible();
  });

  test('en móvil el historial cabe en pantalla', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await login(page, 'Crystal Domínguez');
    await page.getByRole('button', { name: 'Reimprimir ticket' }).click();
    const caja = await page.getByRole('dialog', { name: 'Reimprimir ticket' }).boundingBox();
    expect(caja!.x).toBeGreaterThanOrEqual(0);
    expect(caja!.x + caja!.width).toBeLessThanOrEqual(360);
  });
});
