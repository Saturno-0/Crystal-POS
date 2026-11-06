import { expect, test } from '@playwright/test';
import { irA, login } from './helpers';

test.describe('Personal y accesos (Épica 1)', () => {
  test('registrar, editar, cambiar rol y entrar como otro usuario sin pedir NIP a un vendedor', async ({ page }) => {
    await login(page, 'Crystal Domínguez');
    await irA(page, 'Personal');

    await page.getByPlaceholder('Nombre y apellido').fill('Pedro UX Test');
    await page.getByPlaceholder('0000').fill('5555');
    await page.getByRole('button', { name: 'Registrar usuario' }).click();
    await expect(page.getByText(/Usuario registrado:/)).toBeVisible();
    await expect(page.getByText('Pedro UX Test')).toBeVisible();

    const filaPedro = page.locator('text=Pedro UX Test').locator('..').locator('..');
    await filaPedro.getByRole('button', { name: 'Editar', exact: true }).click();

    // Al entrar en modo edición, "Pedro UX Test" deja de ser texto (ahora vive
    // en un <input>), así que no se puede seguir usando `filaPedro` para
    // ubicar la fila: se vuelve a derivar por el botón "Guardar", único de
    // la fila en edición. La fila en edición muestra 3 inputs: nombre, usuario, comisión.
    const filaEnEdicion = page
      .locator('div')
      .filter({ has: page.getByRole('button', { name: 'Guardar', exact: true }) })
      .last();
    const inputNombreEdicion = filaEnEdicion.locator('input').first();
    await expect(inputNombreEdicion).toHaveValue('Pedro UX Test');
    await inputNombreEdicion.fill('Pedro UX Editado');
    await filaEnEdicion.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page.getByText('Datos actualizados')).toBeVisible();
    await expect(page.getByText('Pedro UX Editado')).toBeVisible();

    const filaPedroEditado = page.locator('text=Pedro UX Editado').locator('..').locator('..');
    await filaPedroEditado.getByRole('button', { name: 'Cambiar rol', exact: true }).click();
    await expect(page.getByText('Pedro UX Editado ahora es Admin')).toBeVisible();

    // Entrar como un vendedor normal no debe pedir NIP (solo lo pide hacia un Admin).
    const filaMarisol = page.locator('text=Marisol Rivas').locator('..').locator('..');
    await filaMarisol.getByRole('button', { name: 'Entrar como', exact: true }).click();
    await expect(page.getByText('Ahora operas como Marisol Rivas')).toBeVisible();
    await expect(page.getByText('NIP de Marisol Rivas')).not.toBeVisible();
  });
});
