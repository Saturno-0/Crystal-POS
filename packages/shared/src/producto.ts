import type { TipoDescuento, TipoTalla } from './types.js';

// Reglas 6 y 7 de CLAUDE.md: pantalones 1–15, el resto XS–XL, vestidos sin talla.
export const TALLAS_POR_TIPO: Record<TipoTalla, readonly string[] | null> = {
  numerica_pantalon: ['1', '3', '5', '7', '9', '11', '13', '15'],
  estandar_ropa: ['XS', 'S', 'M', 'L', 'XL'],
  sin_talla: null,
};

export interface DescuentoVestido {
  tipo: TipoDescuento;
  valor: number;
}

// Regla 6 de CLAUDE.md: cada vestido lleva su propio descuento — 10 %, $100 o $40.
export const DESCUENTOS_VESTIDO: readonly DescuentoVestido[] = [
  { tipo: 'pct', valor: 10 },
  { tipo: 'monto', valor: 100 },
  { tipo: 'monto', valor: 40 },
];

export function tallaValida(tipoTalla: TipoTalla, talla: string | null | undefined): boolean {
  const opciones = TALLAS_POR_TIPO[tipoTalla];
  if (opciones === null) return talla === null || talla === undefined || talla === 'Única';
  return !!talla && opciones.includes(talla);
}

export function descuentoVestidoValido(
  tipo: TipoDescuento | null | undefined,
  valor: number | null | undefined,
): boolean {
  if (tipo == null || valor == null) return true; // el descuento de vestido es opcional
  return DESCUENTOS_VESTIDO.some((d) => d.tipo === tipo && d.valor === valor);
}

// Categorías por color (sacos, pantalones de vestir): botones rápidos en el
// alta; también se puede escribir un color que no esté aquí.
export const COLORES_COMUNES: readonly string[] = [
  'Negro',
  'Azul marino',
  'Gris',
  'Gris oxford',
  'Beige',
  'Café',
  'Blanco',
  'Vino',
];

export const COLOR_MAX_CARACTERES = 30;

// "  azul   MARINO " → "Azul marino". Devuelve null si queda vacío.
export function normalizarColor(color: string | null | undefined): string | null {
  const limpio = (color ?? '').trim().replace(/\s+/g, ' ');
  if (!limpio) return null;
  const minus = limpio.toLocaleLowerCase('es-MX');
  return minus.charAt(0).toLocaleUpperCase('es-MX') + minus.slice(1);
}

// Para ticket, carrito y apartados: "Saco slim — Negro".
export function nombreConColor(nombre: string, color: string | null | undefined): string {
  return color ? `${nombre} — ${color}` : nombre;
}
