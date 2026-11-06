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
});
