import { expect, test } from '@playwright/test';
import { irA, login } from './helpers';

const ENCABEZADO = 'nombre,marca,categoria,talla,color,precio,cantidad,descuento_tipo,descuento_valor\n';

test.describe('Importar productos desde CSV', () => {
  test('con un error no importa nada; corregido, importa y las repetidas suman stock', async ({ page }) => {
    await login(page, 'Crystal Domínguez');
    await irA(page, 'Alta');
    await page.getByRole('button', { name: 'Importar varias prendas desde CSV' }).click();

    // Archivo con una fila de categoría inexistente → vista previa con error, sin botón activo.
    await page.getByLabel('Archivo CSV').setInputFiles({
      name: 'malo.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(
        `${ENCABEZADO}Blusa CSV e2e,Zara,Blusas,M,,420,2,,\nCapa CSV e2e,Zara,CategoriaFalsa,M,,300,1,,\n`,
      ),
    });
    await expect(page.getByText(/1 fila con error/)).toBeVisible();
    await expect(page.getByText('La categoría "CategoriaFalsa" no existe')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Importar\s*filas$/ })).toBeDisabled();

    // Archivo corregido (la misma blusa dos veces: la segunda suma stock).
    await page.getByLabel('Archivo CSV').setInputFiles({
      name: 'bueno.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(
        `${ENCABEZADO}Blusa CSV e2e,Zara,Blusas,M,,420,2,,\nBlusa CSV e2e,Zara,Blusas,M,,420,3,,\n`,
      ),
    });
    await expect(page.getByText('2 filas listas: 1 nuevas, 1 suman stock.')).toBeVisible();
    await page.getByRole('button', { name: 'Importar 2 filas' }).click();
    await expect(page.getByText('Importadas 2 filas (1 nuevas, 1 suman stock)')).toBeVisible();

    // Quedó una sola prenda con stock 5 en el catálogo de Venta.
    await irA(page, 'Venta');
    await expect(page.getByText('Blusa CSV e2e')).toHaveCount(1);
  });
});
