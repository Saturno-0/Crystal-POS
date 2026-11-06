import type Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import { crearDbDePrueba } from '../test/testDb.js';
import * as cambios from './cambios.service.js';
import * as productos from './productos.service.js';
import * as ventas from './ventas.service.js';

let db: Database.Database;
let vendedorId: number;
let categoriaId: number;

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
});

function crearProducto(overrides: Partial<Parameters<typeof productos.crear>[1]> = {}) {
  return productos.crear(
    db,
    { nombre: 'Blusa lino', marca: 'Zara', categoriaId, talla: 'M', precio: 400, cantidad: 5, ...overrides },
    vendedorId,
  );
}

function venderUna(productoId: number, overrides: Partial<Parameters<typeof ventas.crearVentaDirecta>[1]> = {}) {
  return ventas.crearVentaDirecta(
    db,
    { lineas: [{ productoId, cantidad: 1 }], metodoPago: 'tarjeta', ...overrides },
    vendedorId,
  );
}

function primeraLineaId(ventaId: number): number {
  return (
    db.prepare('SELECT id FROM venta_lineas WHERE venta_id = ?').get(ventaId) as { id: number }
  ).id;
}

describe('cambios.crear (regla 10: cambio por otra prenda)', () => {
  it('cambia sin costo si el nuevo producto tiene el mismo precio', () => {
    const original = crearProducto({ nombre: 'Blusa M', precio: 400 });
    const reemplazo = crearProducto({ nombre: 'Blusa L', talla: 'L', precio: 400 });
    const venta = venderUna(original.id);
    const lineaId = primeraLineaId(venta.id);

    const resultado = cambios.crear(db, { ventaLineaId: lineaId, productoNuevoId: reemplazo.id }, vendedorId);

    expect(resultado.diferenciaCobrada).toBe(0);
    expect(resultado.comisionMonto).toBe(0);
    expect(productos.listar(db, {}).find((p) => p.id === original.id)?.stock).toBe(4 + 1); // regresó
    expect(productos.listar(db, {}).find((p) => p.id === reemplazo.id)?.stock).toBe(4); // salió
  });

  it('cobra la diferencia y comisión cuando el nuevo producto es más caro', () => {
    const original = crearProducto({ nombre: 'Blusa barata', precio: 400 });
    const reemplazo = crearProducto({ nombre: 'Blusa cara', talla: 'L', precio: 550 });
    const venta = venderUna(original.id);
    const lineaId = primeraLineaId(venta.id);

    const resultado = cambios.crear(
      db,
      { ventaLineaId: lineaId, productoNuevoId: reemplazo.id, metodoPago: 'efectivo' },
      vendedorId,
    );

    expect(resultado.diferenciaCobrada).toBe(150);
    // Sin descuento de -$15 por método de pago sobre la diferencia (decisión de alcance).
    expect(resultado.comisionMonto).toBeCloseTo(150 * 0.06);
  });

  it('rechaza cambiar por un producto más barato', () => {
    const original = crearProducto({ nombre: 'Blusa cara', precio: 550 });
    const reemplazo = crearProducto({ nombre: 'Blusa barata', talla: 'L', precio: 400 });
    const venta = venderUna(original.id);
    const lineaId = primeraLineaId(venta.id);

    expect(() => cambios.crear(db, { ventaLineaId: lineaId, productoNuevoId: reemplazo.id }, vendedorId)).toThrow(
      'Solo puedes cambiar por una prenda del mismo precio o mayor',
    );
  });

  it('rechaza cambiar una prenda marcada como probada', () => {
    const original = crearProducto({ precio: 400 });
    const reemplazo = crearProducto({ nombre: 'Otra', talla: 'L', precio: 400 });
    const venta = ventas.crearVentaDirecta(
      db,
      { lineas: [{ productoId: original.id, cantidad: 1, probado: true }], metodoPago: 'tarjeta' },
      vendedorId,
    );
    const lineaId = primeraLineaId(venta.id);

    expect(() => cambios.crear(db, { ventaLineaId: lineaId, productoNuevoId: reemplazo.id }, vendedorId)).toThrow(
      'No se puede cambiar una prenda marcada como probada',
    );
  });

  it('rechaza cambiar la misma línea dos veces', () => {
    const original = crearProducto({ precio: 400 });
    const reemplazo = crearProducto({ nombre: 'Otra', talla: 'L', precio: 400 });
    const otraMas = crearProducto({ nombre: 'Tercera', talla: 'S', precio: 400 });
    const venta = venderUna(original.id);
    const lineaId = primeraLineaId(venta.id);

    cambios.crear(db, { ventaLineaId: lineaId, productoNuevoId: reemplazo.id }, vendedorId);

    expect(() => cambios.crear(db, { ventaLineaId: lineaId, productoNuevoId: otraMas.id }, vendedorId)).toThrow(
      'Esta línea ya fue cambiada anteriormente',
    );
  });

  it('exige método de pago cuando hay diferencia a cobrar', () => {
    const original = crearProducto({ precio: 400 });
    const reemplazo = crearProducto({ nombre: 'Cara', talla: 'L', precio: 500 });
    const venta = venderUna(original.id);
    const lineaId = primeraLineaId(venta.id);

    expect(() => cambios.crear(db, { ventaLineaId: lineaId, productoNuevoId: reemplazo.id }, vendedorId)).toThrow(
      'Selecciona el método de pago de la diferencia',
    );
  });

  it('rechaza cambiar sin existencias del producto nuevo', () => {
    const original = crearProducto({ precio: 400 });
    const reemplazo = crearProducto({ nombre: 'Sin stock', talla: 'L', precio: 400, cantidad: 1 });
    db.prepare('UPDATE productos SET stock = 0 WHERE id = ?').run(reemplazo.id);
    const venta = venderUna(original.id);
    const lineaId = primeraLineaId(venta.id);

    expect(() => cambios.crear(db, { ventaLineaId: lineaId, productoNuevoId: reemplazo.id }, vendedorId)).toThrow(
      'Sin existencias de Sin stock',
    );
  });

  it('compara contra el precio pagado (con descuento), no el de lista', () => {
    // Vestido con descuento automático: se vendió a $720 (10% de descuento de $800).
    const vestidosId = Number(
      db.prepare("INSERT INTO categorias (nombre, tipo_talla) VALUES ('Vestidos','sin_talla')").run()
        .lastInsertRowid,
    );
    const vestido = productos.crear(
      db,
      {
        nombre: 'Vestido gala',
        marca: 'X',
        categoriaId: vestidosId,
        precio: 800,
        cantidad: 1,
        descuentoTipo: 'pct',
        descuentoValor: 10,
      },
      vendedorId,
    );
    const reemplazo = crearProducto({ nombre: 'Blusa', precio: 750 }); // menor al precio de lista del vestido, pero mayor a lo pagado
    const venta = venderUna(vestido.id);
    const lineaId = primeraLineaId(venta.id);

    const resultado = cambios.crear(db, { ventaLineaId: lineaId, productoNuevoId: reemplazo.id, metodoPago: 'tarjeta' }, vendedorId);

    expect(resultado.precioPagadoOriginal).toBe(720);
    expect(resultado.diferenciaCobrada).toBe(30);
  });
});

describe('buscarVentaParaCambio', () => {
  it('marca como no elegible una línea probada o ya cambiada', () => {
    const p1 = crearProducto({ precio: 400 });
    const p2 = crearProducto({ nombre: 'Otra', talla: 'L', precio: 400 });
    const venta = ventas.crearVentaDirecta(
      db,
      {
        lineas: [
          { productoId: p1.id, cantidad: 1, probado: true },
          { productoId: p2.id, cantidad: 1 },
        ],
        metodoPago: 'tarjeta',
      },
      vendedorId,
    );

    const detalle = cambios.buscarVentaParaCambio(db, venta.folio);
    const lineaProbada = detalle.lineas.find((l) => l.productoId === p1.id)!;
    const lineaSana = detalle.lineas.find((l) => l.productoId === p2.id)!;
    expect(lineaProbada.elegible).toBe(false);
    expect(lineaSana.elegible).toBe(true);
  });

  it('rechaza un folio inexistente', () => {
    expect(() => cambios.buscarVentaParaCambio(db, '9999')).toThrow('No existe un ticket con ese folio');
  });
});
