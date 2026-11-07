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

  test('el admin puede cambiar el NIP de otro usuario, y el nuevo NIP funciona para entrar', async ({ page }) => {
    await login(page, 'Crystal Domínguez');
    await irA(page, 'Personal');

    const filaJulio = page.locator('text=Julio Tenorio').locator('..').locator('..');
    await filaJulio.getByRole('button', { name: 'Editar', exact: true }).click();

    const filaEnEdicion = page
      .locator('div')
      .filter({ has: page.getByRole('button', { name: 'Guardar', exact: true }) })
      .last();
    await filaEnEdicion.getByPlaceholder('Nuevo NIP').fill('7890');
    await filaEnEdicion.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page.getByText('Datos actualizados')).toBeVisible();

    // Cerrar sesión y confirmar que el NIP nuevo entra (y el viejo 1234 ya no).
    await page.getByRole('button', { name: 'Cambiar de usuario', exact: true }).click();
    await page.getByRole('button', { name: 'Cerrar sesión y volver al inicio' }).click();

    await page.getByRole('button', { name: /Julio Tenorio/ }).click();
    await page.getByLabel('NIP').fill('1234');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.getByText('NIP incorrecto para Julio Tenorio')).toBeVisible();

    await page.getByLabel('NIP').fill('7890');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.getByText('Bienvenida, Julio Tenorio')).toBeVisible();
  });
});
