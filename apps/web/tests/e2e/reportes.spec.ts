import { expect, test } from '@playwright/test';
import { crearProducto, irA, login } from './helpers';

test.describe('Reportes y comisiones (HU-5.1 a HU-5.5, HU-2.5, HU-6.5)', () => {
  test('KPIs, tendencia, vendedores, export CSV y respaldo manual', async ({ page }) => {
    await login(page, 'Crystal Domínguez');
    await crearProducto(page, { nombre: 'Reporte UX inventario', marca: 'TestMarca', precio: 600, categoria: 'Blusas', talla: 'M' });

    await irA(page, 'Reportes');
    await expect(page.getByRole('heading', { name: 'Reportes' })).toBeVisible();
    await expect(page.getByText('ADMIN', { exact: true })).toBeVisible();
    await expect(page.getByText('Ventas totales')).toBeVisible();
    await expect(page.getByText('Comisiones por pagar')).toBeVisible();
    await expect(page.getByText('Tendencia de ventas')).toBeVisible();

    // Cambiar de periodo no debe tronar y debe seguir mostrando la sección.
    await page.getByRole('button', { name: 'Trimestre', exact: true }).click();
    await expect(page.getByText('Tendencia de ventas')).toBeVisible();
    await page.getByRole('button', { name: 'Mes', exact: true }).click();

    await expect(page.getByText('Ventas por vendedor')).toBeVisible();
    await expect(page.getByText('Crystal Domínguez')).toBeVisible();

    const descargaPromesa = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exportar CSV' }).click();
    const descarga = await descargaPromesa;
    expect(descarga.suggestedFilename()).toMatch(/comisiones-.*\.csv/);

    // Inventario: editar navega a Alta con el formulario precargado.
    await expect(page.getByText('Reporte UX inventario')).toBeVisible();
    const filaProducto = page.locator('text=Reporte UX inventario').locator('..').locator('..');
    await filaProducto.getByRole('button', { name: 'Editar', exact: true }).click();
    await expect(page.getByText(/Editando/)).toBeVisible();
    await expect(page.getByPlaceholder('Ej. Jean recto tiro alto')).toHaveValue('Reporte UX inventario');
    await expect(page.getByPlaceholder('$0.00')).toHaveValue('600');
    await page.getByRole('button', { name: 'Cancelar edición' }).click();

    // Respaldos locales: disparar uno manual.
    await irA(page, 'Reportes');
    await page.getByRole('button', { name: 'Respaldar ahora' }).click();
    await expect(page.getByText('Respaldo creado')).toBeVisible();
    await expect(page.getByText(/Último respaldo:/)).toBeVisible();
  });

  test('inventario: corregir la cantidad de un producto desde Editar', async ({ page }) => {
    await login(page, 'Crystal Domínguez');
    await crearProducto(page, {
      nombre: 'Ajuste stock UX test',
      marca: 'TestMarca',
      precio: 300,
      categoria: 'Blusas',
      talla: 'M',
      lote: true,
    });

    await irA(page, 'Reportes');
    const filaProducto = page.locator('text=Ajuste stock UX test').locator('..').locator('..');
    await expect(filaProducto.getByText('5 stock')).toBeVisible();

    await filaProducto.getByRole('button', { name: 'Editar', exact: true }).click();
    await expect(page.getByText(/Editando/)).toBeVisible();
    await expect(page.getByLabel('Cantidad en inventario')).toHaveValue('5');
    await page.getByLabel('Cantidad en inventario').fill('2');
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page.getByText('Ajuste stock UX test actualizado')).toBeVisible();

    await irA(page, 'Reportes');
    const filaActualizada = page.locator('text=Ajuste stock UX test').locator('..').locator('..');
    await expect(filaActualizada.getByText('2 stock')).toBeVisible();
  });

  test('el rail de navegación permanece fijo al hacer scroll dentro de Reportes', async ({ page }) => {
    await login(page, 'Crystal Domínguez');
    await irA(page, 'Reportes');

    const rail = page.locator('nav').nth(0);
    const avatar = rail.getByRole('button', { name: 'Cambiar de usuario' });
    await expect(avatar).toBeVisible();
    const cajaAntes = await rail.boundingBox();

    // Relleno forzado para garantizar scroll propio del contenedor, sin
    // depender de cuántas filas de datos haya en la BD de prueba de este run.
    const contenedor = page.locator('[class*="contenedor"]').first();
    await contenedor.evaluate((el) => {
      const relleno = document.createElement('div');
      relleno.style.height = '3000px';
      el.appendChild(relleno);
    });
    await contenedor.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });

    await expect(avatar).toBeVisible();
    const cajaDespues = await rail.boundingBox();
    expect(cajaDespues).toEqual(cajaAntes);
  });
});
