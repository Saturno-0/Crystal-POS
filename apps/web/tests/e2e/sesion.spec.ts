import { expect, test } from '@playwright/test';
import { irA, login } from './helpers';

test.describe('Sesión expirada', () => {
  test('un 401 real durante el uso de la app expulsa a la pantalla de login', async ({ page }) => {
    await login(page, 'Crystal Domínguez');

    // Simula que el token ya expiró de verdad en el servidor (no uno
    // renovable): la siguiente llamada autenticada que haga la app recibe
    // un 401 "Sesión expirada" sin tocar nada del backend real.
    await page.route('**/api/categorias', (route) =>
      route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Sesión expirada' }) }),
    );

    await irA(page, 'Alta');

    // Antes: la pantalla se quedaba ahí con un toast y datos desincronizados.
    // Ahora: el 401 fuerza un logout limpio de vuelta a Login.
    await expect(page.getByText('Crystal POS · sucursal Centro')).toBeVisible();
    await expect(page.getByRole('button', { name: /Crystal Domínguez/ })).toBeVisible();
  });
});
