import { describe, expect, it } from 'vitest';
import { calcularLinea, calcularTotales } from './calculo.js';

describe('calcularLinea (docs/README.md § Cálculo de línea)', () => {
  it('sin descuento: importe = precio × cantidad', () => {
    const r = calcularLinea({ precio: 200, cantidad: 2, auto: null, manual: null });
    expect(r.base).toBe(400);
    expect(r.descuentoAplicado).toBe(0);
    expect(r.descuentoOrigen).toBe('ninguno');
    expect(r.importeLinea).toBe(400);
  });

  it('aplica el descuento automático del producto (vestido) si no hay manual', () => {
    const r = calcularLinea({
      precio: 900,
      cantidad: 1,
      auto: { tipo: 'pct', valor: 10 },
      manual: null,
    });
    expect(r.descuentoAplicado).toBe(90);
    expect(r.descuentoOrigen).toBe('automatico');
    expect(r.importeLinea).toBe(810);
  });

  it('el descuento manual sobrescribe al automático (regla 5)', () => {
    const r = calcularLinea({
      precio: 900,
      cantidad: 1,
      auto: { tipo: 'pct', valor: 10 },
      manual: { tipo: 'monto', valor: 40 },
    });
    expect(r.descuentoAplicado).toBe(40);
    expect(r.descuentoOrigen).toBe('manual');
    expect(r.importeLinea).toBe(860);
  });

  it('un descuento manual de $0 no cuenta como manual (usa el automático)', () => {
    const r = calcularLinea({
      precio: 900,
      cantidad: 1,
      auto: { tipo: 'monto', valor: 100 },
      manual: { tipo: 'monto', valor: 0 },
    });
    expect(r.descuentoOrigen).toBe('automatico');
    expect(r.descuentoAplicado).toBe(100);
  });

  it('el descuento nunca excede el importe de la línea (HU-3.3)', () => {
    const r = calcularLinea({
      precio: 100,
      cantidad: 1,
      auto: null,
      manual: { tipo: 'monto', valor: 500 },
    });
    expect(r.descuentoAplicado).toBe(100);
    expect(r.importeLinea).toBe(0);
  });

  it('descuento porcentual manual se calcula sobre la base (precio × cantidad)', () => {
    const r = calcularLinea({
      precio: 150,
      cantidad: 3,
      auto: null,
      manual: { tipo: 'pct', valor: 20 },
    });
    expect(r.base).toBe(450);
    expect(r.descuentoAplicado).toBe(90);
    expect(r.importeLinea).toBe(360);
  });
});

describe('calcularTotales (docs/README.md § Cálculo de línea)', () => {
  const lineas = [
    { base: 400, descuentoAplicado: 0, descuentoOrigen: 'ninguno' as const, importeLinea: 400 },
    { base: 900, descuentoAplicado: 90, descuentoOrigen: 'automatico' as const, importeLinea: 810 },
  ];

  it('suma subtotales y descuentos de todas las líneas', () => {
    const t = calcularTotales({ lineas, tipoVenta: 'directa', metodoPago: 'tarjeta' });
    expect(t.subtotalBruto).toBe(1300);
    expect(t.descuentoArticulos).toBe(90);
    expect(t.subtotal).toBe(1210);
  });

  it('tarjeta no aplica descuento por método de pago', () => {
    const t = calcularTotales({ lineas, tipoVenta: 'directa', metodoPago: 'tarjeta' });
    expect(t.descuentoPago).toBe(0);
    expect(t.total).toBe(1210);
  });

  it('efectivo y transferencia aplican −$15 (regla 4)', () => {
    const efectivo = calcularTotales({ lineas, tipoVenta: 'directa', metodoPago: 'efectivo' });
    const transferencia = calcularTotales({ lineas, tipoVenta: 'directa', metodoPago: 'transferencia' });
    expect(efectivo.descuentoPago).toBe(15);
    expect(efectivo.total).toBe(1195);
    expect(transferencia.descuentoPago).toBe(15);
  });

  it('el descuento por método de pago nunca aplica a un apartado', () => {
    const t = calcularTotales({ lineas, tipoVenta: 'apartado', metodoPago: 'efectivo' });
    expect(t.descuentoPago).toBe(0);
  });

  it('el total nunca es negativo', () => {
    const t = calcularTotales({
      lineas: [{ base: 5, descuentoAplicado: 0, descuentoOrigen: 'ninguno', importeLinea: 5 }],
      tipoVenta: 'directa',
      metodoPago: 'efectivo',
    });
    expect(t.total).toBe(0);
  });

  it('calcula el cambio en efectivo (recibido − total)', () => {
    const t = calcularTotales({
      lineas,
      tipoVenta: 'directa',
      metodoPago: 'efectivo',
      efectivoRecibido: 1300,
    });
    expect(t.total).toBe(1195);
    expect(t.cambio).toBe(105);
  });

  it('el cambio es 0 si el método no es efectivo', () => {
    const t = calcularTotales({
      lineas,
      tipoVenta: 'directa',
      metodoPago: 'tarjeta',
      efectivoRecibido: 5000,
    });
    expect(t.cambio).toBe(0);
  });

  it('el cambio nunca es negativo (recibido menor al total)', () => {
    const t = calcularTotales({
      lineas,
      tipoVenta: 'directa',
      metodoPago: 'efectivo',
      efectivoRecibido: 0,
    });
    expect(t.cambio).toBe(0);
  });
});
