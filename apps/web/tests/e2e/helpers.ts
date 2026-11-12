import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export async function login(page: Page, nombre: string) {
  await page.goto('/');
  await page.getByRole('button', { name: new RegExp(nombre) }).click();
  await page.getByLabel('NIP').fill('1234');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByText(`Bienvenida, ${nombre}`)).toBeVisible();
}

/**
 * La navegación existe DOS veces en el DOM (rail de escritorio + barra
 * inferior móvil, ver AppShell.tsx), ambas siempre montadas y solo una
 * visible por CSS según el viewport. `.first()` es el rail (escritorio).
 */
export async function irA(page: Page, label: string) {
  await page.getByRole('button', { name: label, exact: true }).first().click();
}

export interface ProductoUI {
  nombre: string;
  marca: string;
  precio: number;
  categoria: string;
  talla?: string; // omitir para categorías sin_talla (Vestidos)
  /** true = alta por lote (stock = 5 por defecto), útil cuando la prueba necesita >1 unidad. */
  lote?: boolean;
}

/** Crea un producto vía el formulario de Alta real; deja al usuario en esa pantalla. */
export async function crearProducto(page: Page, p: ProductoUI) {
  await irA(page, 'Alta');
  if (p.lote) await page.getByRole('button', { name: 'Por lote' }).click();
  await page.getByPlaceholder('Ej. Jean recto tiro alto').fill(p.nombre);
  await page.getByPlaceholder('Marca').fill(p.marca);
  await page.getByPlaceholder('$0.00').fill(String(p.precio));
  await page.getByRole('button', { name: p.categoria, exact: true }).click();
  if (p.talla) await page.getByRole('button', { name: p.talla, exact: true }).click();
  await page.getByRole('button', { name: /^Dar de alta \d+ (pieza|unidades)$/ }).click();
  await expect(page.getByText(/dada[s]? de alta · SKU/)).toBeVisible();
}
