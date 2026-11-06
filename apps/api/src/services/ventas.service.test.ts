import type Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import { crearDbDePrueba } from '../test/testDb.js';
import * as productos from './productos.service.js';
import * as ventas from './ventas.service.js';

let db: Database.Database;
let vendedorId: number;
let categoriaId: number;
let vestidosId: number;

beforeEach(() => {
  db = crearDbDePrueba();
  db.prepare(
    "INSERT INTO usuarios (nombre, usuario, nip_hash, rol, tasa_comision) VALUES ('Marisol','marisol.r','x','vendedor',6)",
  ).run();
  vendedorId = 1;

  categoriaId = Number(
    db.prepare("INSERT INTO categorias (nombre, tipo_talla) VALUES ('Blusas','estandar_ropa')").run()
      .lastInsertRowid,
  );
  vestidosId = Number(
    db.prepare("INSERT INTO categorias (nombre, tipo_talla) VALUES ('Vestidos','sin_talla')").run()
      .lastInsertRowid,
  );
});

function crearProducto(overrides: Partial<Parameters<typeof productos.crear>[1]> = {}) {
  return productos.crear(
    db,
    {
      nombre: 'Blusa lino',
      marca: 'Zara',
      categoriaId,
      talla: 'M',
      precio: 400,
      cantidad: 5,
      ...overrides,
    },
    vendedorId,
  );
}

describe('crearVentaDirecta (HU-3.1 a HU-3.6)', () => {
  it('rechaza un ticket vacío', () => {
    expect(() => ventas.crearVentaDirecta(db, { lineas: [], metodoPago: 'tarjeta' }, vendedorId)).toThrow(
      'Agrega al menos un producto',
    );
  });

  it('rechaza si no hay existencias suficientes', () => {
    const p = crearProducto({ cantidad: 2 });
    expect(() =>
      ventas.crearVentaDirecta(
        db,
        { lineas: [{ productoId: p.id, cantidad: 3 }], metodoPago: 'tarjeta' },
        vendedorId,
      ),
    ).toThrow('Sin existencias suficientes de Blusa lino');
  });

  it('descuenta el stock y suma vendidos al cobrar (HU-3.1)', () => {
    const p = crearProducto({ cantidad: 5 });
    ventas.crearVentaDirecta(
      db,
      { lineas: [{ productoId: p.id, cantidad: 2 }], metodoPago: 'tarjeta' },
      vendedorId,
    );
    const actualizado = productos.listar(db, {})[0];
    expect(actualizado.stock).toBe(3);
    expect(actualizado.vendidos).toBe(2);
  });

  it('tarjeta no aplica descuento por método de pago', () => {
    const p = crearProducto();
    const venta = ventas.crearVentaDirecta(
      db,
      { lineas: [{ productoId: p.id, cantidad: 1 }], metodoPago: 'tarjeta' },
      vendedorId,
    );
    expect(venta.descuentoPago).toBe(0);
    expect(venta.total).toBe(400);
  });

  it('efectivo aplica −$15 y calcula el cambio (regla 4)', () => {
    const p = crearProducto();
    const venta = ventas.crearVentaDirecta(
      db,
      { lineas: [{ productoId: p.id, cantidad: 1 }], metodoPago: 'efectivo', efectivoRecibido: 500 },
      vendedorId,
    );
    expect(venta.descuentoPago).toBe(15);
    expect(venta.total).toBe(385);
    expect(venta.cambio).toBe(115);
  });

  it('bloquea el cobro si el efectivo recibido es menor al total', () => {
    const p = crearProducto();
    expect(() =>
      ventas.crearVentaDirecta(
        db,
        { lineas: [{ productoId: p.id, cantidad: 1 }], metodoPago: 'efectivo', efectivoRecibido: 100 },
        vendedorId,
      ),
    ).toThrow('El efectivo recibido es menor al total a cobrar');
  });

  it('aplica el descuento automático de vestido cuando no hay descuento manual (regla 6)', () => {
    const vestido = crearProducto({
      nombre: 'Vestido gala',
      categoriaId: vestidosId,
      talla: undefined,
      precio: 900,
      cantidad: 1,
      descuentoTipo: 'pct',
      descuentoValor: 10,
    });
    const venta = ventas.crearVentaDirecta(
      db,
      { lineas: [{ productoId: vestido.id, cantidad: 1 }], metodoPago: 'tarjeta' },
      vendedorId,
    );
    expect(venta.descuentoArticulos).toBe(90);
    expect(venta.total).toBe(810);
  });

  it('el descuento manual de línea sobrescribe al automático (regla 5)', () => {
    const vestido = crearProducto({
      nombre: 'Vestido gala',
      categoriaId: vestidosId,
      talla: undefined,
      precio: 900,
      cantidad: 1,
      descuentoTipo: 'pct',
      descuentoValor: 10,
    });
    const venta = ventas.crearVentaDirecta(
      db,
      {
        lineas: [{ productoId: vestido.id, cantidad: 1, descuentoTipo: 'monto', descuentoValor: 40 }],
        metodoPago: 'tarjeta',
      },
      vendedorId,
    );
    expect(venta.descuentoArticulos).toBe(40);
    expect(venta.total).toBe(860);
  });

  it('acredita la comisión sobre el ingreso neto con la tasa del vendedor en sesión', () => {
    const p = crearProducto({ precio: 1000, cantidad: 1 });
    const venta = ventas.crearVentaDirecta(
      db,
      { lineas: [{ productoId: p.id, cantidad: 1 }], metodoPago: 'tarjeta' },
      vendedorId,
    );
    // tasa_comision del vendedor de prueba = 6 (%), se guarda como porcentaje entero.
    expect(venta.comisionMonto).toBeCloseTo(venta.total * 0.06);
  });

  it('folios consecutivos entre ventas', () => {
    const p = crearProducto({ cantidad: 5 });
    const v1 = ventas.crearVentaDirecta(
      db,
      { lineas: [{ productoId: p.id, cantidad: 1 }], metodoPago: 'tarjeta' },
      vendedorId,
    );
    const v2 = ventas.crearVentaDirecta(
      db,
      { lineas: [{ productoId: p.id, cantidad: 1 }], metodoPago: 'tarjeta' },
      vendedorId,
    );
    expect(Number(v2.folio)).toBe(Number(v1.folio) + 1);
  });

  it('no descuenta stock si la venta se rechaza (rollback de la transacción)', () => {
    const p = crearProducto({ cantidad: 1 });
    expect(() =>
      ventas.crearVentaDirecta(
        db,
        { lineas: [{ productoId: p.id, cantidad: 1 }], metodoPago: 'efectivo', efectivoRecibido: 0 },
        vendedorId,
      ),
    ).toThrow();
    const actual = productos.listar(db, {})[0];
    expect(actual.stock).toBe(1);
  });
});
