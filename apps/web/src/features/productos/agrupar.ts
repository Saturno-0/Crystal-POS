import { TALLAS_POR_TIPO, type Producto } from '@crystal/shared';

/**
 * Un "modelo" del catálogo de venta: las prendas idénticas salvo talla (y
 * color, en categorías por color) — típicamente lo que se dio de alta con
 * "Alta por tallas". En la BD cada talla sigue siendo su propio producto/SKU;
 * solo se agrupan para mostrarse como una sola tarjeta en Venta.
 */
export interface ModeloCatalogo {
  clave: string;
  /** Producto representativo (nombre, marca, precio, categoría). */
  base: Producto;
  /** Variantes (una por talla × color), ordenadas por color y talla. */
  variantes: Producto[];
  stockTotal: number;
}

const ORDEN_TALLAS: string[] = Object.values(TALLAS_POR_TIPO).flatMap((t) => (t ? [...t] : []));

function ordenTalla(talla: string | null): number {
  const i = talla ? ORDEN_TALLAS.indexOf(talla) : -1;
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
}

// Mismo nombre, marca, categoría, precio y descuento = mismo modelo. Si algo
// de eso difiere (p. ej. una talla con otro precio) se muestra aparte, para
// que nunca se cobre un precio distinto al que se ve en la tarjeta.
function claveModelo(p: Producto): string {
  return [
    p.categoriaId,
    p.nombre.trim().toLowerCase(),
    p.marca.trim().toLowerCase(),
    p.precio,
    p.descuentoTipo ?? '',
    p.descuentoValor ?? '',
  ].join('|');
}

export function agruparPorModelo(productos: Producto[]): ModeloCatalogo[] {
  const grupos = new Map<string, Producto[]>();
  for (const p of productos) {
    // Sin talla (vestidos): cada pieza es única, nunca se agrupa.
    const clave = !p.talla || p.talla === 'Única' ? `id:${p.id}` : claveModelo(p);
    const lista = grupos.get(clave);
    if (lista) lista.push(p);
    else grupos.set(clave, [p]);
  }

  return [...grupos.entries()].map(([clave, lista]) => {
    const variantes = [...lista].sort(
      (a, b) =>
        (a.color ?? '').localeCompare(b.color ?? '', 'es') || ordenTalla(a.talla) - ordenTalla(b.talla),
    );
    return {
      clave,
      base: variantes[0],
      variantes,
      stockTotal: variantes.reduce((acc, v) => acc + v.stock, 0),
    };
  });
}
