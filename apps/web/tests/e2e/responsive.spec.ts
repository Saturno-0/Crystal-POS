import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { login } from './helpers';

// El rail de escritorio y la barra inferior móvil son los dos <nav> del
// AppShell, en ese orden en el DOM (ver AppShell.tsx).
async function irAMovil(page: Page, label: string) {
  await page.locator('nav').nth(1).getByRole('button', { name: label, exact: true }).click();
}

async function sinScrollHorizontal(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
}

test.describe('Responsive móvil (HU-6.1, breakpoint 768px)', () => {
  test.use({ viewport: { width: 390, height: 812 } });

  test('rail se convierte en barra inferior con botones táctiles ≥44px y sin scroll horizontal', async ({
    page,
  }) => {
    await login(page, 'Crystal Domínguez');

    const rail = page.locator('nav').nth(0);
    const barraInferior = page.locator('nav').nth(1);
    await expect(rail).toBeHidden();
    await expect(barraInferior).toBeVisible();

    const botones = await barraInferior.getByRole('button').all();
    expect(botones.length).toBeGreaterThan(0);
    for (const boton of botones) {
      const caja = await boton.boundingBox();
      expect(caja?.height ?? 0).toBeGreaterThanOrEqual(44);
    }

    await sinScrollHorizontal(page);

    for (const pantalla of ['Alta', 'Apartados', 'Cambios', 'Reportes', 'Personal']) {
      await irAMovil(page, pantalla);
      await sinScrollHorizontal(page);
    }
  });
});
