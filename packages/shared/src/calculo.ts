import type { DescuentoOrigen, MetodoPago, TipoDescuento, TipoVenta } from './types.js';

export interface DescuentoCapturado {
  tipo: TipoDescuento;
  valor: number;
}

export interface EntradaLinea {
  precio: number;
  cantidad: number;
  /** Descuento automático del producto (p.ej. vestidos, regla 6). */
  auto: DescuentoCapturado | null;
  /** Descuento capturado a mano en esa línea del ticket (regla 5: sobrescribe al automático). */
  manual: DescuentoCapturado | null;
}

export interface ResultadoLinea {
  base: number;
  descuentoAplicado: number;
  descuentoOrigen: DescuentoOrigen;
  importeLinea: number;
}

function montoDescuento(base: number, descuento: DescuentoCapturado | null): number {
  if (!descuento || descuento.valor <= 0) return 0;
  return descuento.tipo === 'pct' ? (base * descuento.valor) / 100 : descuento.valor;
}

/** Pseudocódigo de docs/README.md § "Cálculo de línea". */
export function calcularLinea({ precio, cantidad, auto, manual }: EntradaLinea): ResultadoLinea {
  const base = precio * cantidad;
  const montoAuto = montoDescuento(base, auto);
  const montoManual = montoDescuento(base, manual);

  const descuentoOrigen: DescuentoOrigen = montoManual > 0 ? 'manual' : montoAuto > 0 ? 'automatico' : 'ninguno';
  const descuentoAplicado = Math.min(montoManual > 0 ? montoManual : montoAuto, base);

  return { base, descuentoAplicado, descuentoOrigen, importeLinea: base - descuentoAplicado };
}

export interface EntradaTotales {
  lineas: ResultadoLinea[];
  tipoVenta: TipoVenta;
  metodoPago?: MetodoPago | null;
  efectivoRecibido?: number | null;
}

export interface ResultadoTotales {
  subtotalBruto: number;
  descuentoArticulos: number;
  subtotal: number;
  descuentoPago: number;
  total: number;
  cambio: number;
}

const DESCUENTO_METODO_PAGO = 15;

/** Pseudocódigo de docs/README.md § "Cálculo de línea" (totales del ticket). */
export function calcularTotales({
  lineas,
  tipoVenta,
  metodoPago,
  efectivoRecibido,
}: EntradaTotales): ResultadoTotales {
  const subtotalBruto = lineas.reduce((acc, l) => acc + l.base, 0);
  const descuentoArticulos = lineas.reduce((acc, l) => acc + l.descuentoAplicado, 0);
  const subtotal = subtotalBruto - descuentoArticulos;

  // Regla 4: −$15 en Efectivo/Transferencia, nunca en Tarjeta ni en un apartado.
  const descuentoPago =
    tipoVenta === 'directa' && (metodoPago === 'efectivo' || metodoPago === 'transferencia')
      ? DESCUENTO_METODO_PAGO
      : 0;
  const total = Math.max(0, subtotal - descuentoPago);
  const cambio = metodoPago === 'efectivo' ? Math.max(0, (efectivoRecibido ?? 0) - total) : 0;

  return { subtotalBruto, descuentoArticulos, subtotal, descuentoPago, total, cambio };
}
