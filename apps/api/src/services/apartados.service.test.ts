import type Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import { crearDbDePrueba } from '../test/testDb.js';
import * as apartados from './apartados.service.js';
import * as productos from './productos.service.js';

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
    { nombre: 'Blusa lino', marca: 'Zara', categoriaId, talla: 'M', precio: 400, cantidad: 5, ...overrides },
    vendedorId,
  );
}

describe('crear (HU-4.1)', () => {
  it('rechaza un abono menor o igual a 0', () => {
    const p = crearProducto();
    expect(() =>
      apartados.crear(
        db,
        { lineas: [{ productoId: p.id, cantidad: 1 }], clienteNombre: 'Ana', abonoInicial: 0 },
        vendedorId,
      ),
    ).toThrow('El abono debe ser mayor a 0 y menor al total');
  });

  it('rechaza un abono igual o mayor al total', () => {
    const p = crearProducto();
    expect(() =>
      apartados.crear(
        db,
        { lineas: [{ productoId: p.id, cantidad: 1 }], clienteNombre: 'Ana', abonoInicial: 400 },
        vendedorId,
      ),
    ).toThrow('El abono debe ser mayor a 0 y menor al total');
  });

  it('exige nombre de cliente', () => {
    const p = crearProducto();
    expect(() =>
      apartados.crear(
        db,
        { lineas: [{ productoId: p.id, cantidad: 1 }], clienteNombre: '  ', abonoInicial: 100 },
        vendedorId,
      ),
    ).toThrow('Captura el nombre del cliente');
  });

  it('descuenta el stock de inmediato al crear (a diferencia de la venta directa)', () => {
    const p = crearProducto({ cantidad: 5 });
    apartados.crear(
      db,
      { lineas: [{ productoId: p.id, cantidad: 2 }], clienteNombre: 'Ana', abonoInicial: 100 },
      vendedorId,
    );
    const actual = productos.listar(db, {})[0];
    expect(actual.stock).toBe(3);
    expect(actual.vendidos).toBe(0); // no cuenta como vendido hasta liquidar
  });

  it('vence a los 15 días a las 23:59:59', () => {
    const p = crearProducto();
    const creado = apartados.crear(
      db,
      { lineas: [{ productoId: p.id, cantidad: 1 }], clienteNombre: 'Ana', abonoInicial: 100 },
      vendedorId,
    );
    expect(creado.venceAt.endsWith('23:59:59')).toBe(true);
  });

  it('admite varios productos en un mismo apartado', () => {
    const p1 = crearProducto({ nombre: 'Blusa A' });
    const p2 = crearProducto({ nombre: 'Blusa B' });
    const creado = apartados.crear(
      db,
      {
        lineas: [
          { productoId: p1.id, cantidad: 1 },
          { productoId: p2.id, cantidad: 1 },
        ],
        clienteNombre: 'Ana',
        abonoInicial: 100,
      },
      vendedorId,
    );
    expect(creado.total).toBe(800);
  });
});

describe('listarActivos (HU-4.2)', () => {
  it('calcula la salud verde/amarillo/rojo según los días restantes', () => {
    const p = crearProducto();
    apartados.crear(
      db,
      { lineas: [{ productoId: p.id, cantidad: 1 }], clienteNombre: 'Ana', abonoInicial: 100 },
      vendedorId,
    );
    const lista = apartados.listarActivos(db);
    expect(lista).toHaveLength(1);
    expect(lista[0].salud).toBe('verde'); // recién creado, vence en 15 días
  });

  it('marca como rojo un apartado ya vencido', () => {
    const p = crearProducto();
    const creado = apartados.crear(
      db,
      { lineas: [{ productoId: p.id, cantidad: 1 }], clienteNombre: 'Ana', abonoInicial: 100 },
      vendedorId,
    );
    db.prepare("UPDATE apartados SET vence_at = datetime('now', '-1 day') WHERE id = ?").run(creado.id);
    const lista = apartados.listarActivos(db);
    expect(lista[0].salud).toBe('rojo');
    expect(lista[0].diasRestantes).toBeLessThan(0);
  });
});

describe('liquidar (HU-4.3)', () => {
  it('cobra el remanente y acredita la comisión neta hasta ahora', () => {
    const p = crearProducto({ precio: 1000, cantidad: 1 });
    const creado = apartados.crear(
      db,
      { lineas: [{ productoId: p.id, cantidad: 1 }], clienteNombre: 'Ana', abonoInicial: 300 },
      vendedorId,
    );
    const resultado = apartados.liquidar(db, creado.id, vendedorId);
    expect(resultado.remanente).toBe(700);
    expect(resultado.comisionMonto).toBeCloseTo(1000 * 0.06);

    const actualizado = productos.listar(db, {})[0];
    expect(actualizado.vendidos).toBe(1); // ahora sí cuenta como vendido
    expect(apartados.listarActivos(db)).toHaveLength(0);
  });

  it('no permite liquidar dos veces', () => {
    const p = crearProducto();
    const creado = apartados.crear(
      db,
      { lineas: [{ productoId: p.id, cantidad: 1 }], clienteNombre: 'Ana', abonoInicial: 100 },
      vendedorId,
    );
    apartados.liquidar(db, creado.id, vendedorId);
    expect(() => apartados.liquidar(db, creado.id, vendedorId)).toThrow(
      'Apartado no encontrado o ya no está activo',
    );
  });
});

describe('penalizar (HU-4.4, regla 3)', () => {
  it('regresa la unidad a stock y retira el descuento del producto', () => {
    const vestido = crearProducto({
      nombre: 'Vestido gala',
      categoriaId: vestidosId,
      talla: undefined,
      precio: 900,
      cantidad: 1,
      descuentoTipo: 'pct',
      descuentoValor: 10,
    });
    const creado = apartados.crear(
      db,
      { lineas: [{ productoId: vestido.id, cantidad: 1 }], clienteNombre: 'Ana', abonoInicial: 100 },
      vendedorId,
    );

    const resultado = apartados.penalizar(db, creado.id, vendedorId);
    expect(resultado.abonoPerdido).toBe(100);
    expect(resultado.unidades).toBe(1);

    const actualizado = productos.listar(db, {})[0];
    expect(actualizado.stock).toBe(1); // regresó
    expect(actualizado.descuentoTipo).toBeNull(); // se retiró
    expect(actualizado.vendidos).toBe(0);
  });
});

describe('extenderPlazo (prórroga)', () => {
  it('agrega 15 días más al vencimiento y deja constancia de quién lo hizo', () => {
    const p = crearProducto();
    const creado = apartados.crear(
      db,
      { lineas: [{ productoId: p.id, cantidad: 1 }], clienteNombre: 'Ana', abonoInicial: 100 },
      vendedorId,
    );
    const { venceAnterior, venceNuevo } = apartados.extenderPlazo(db, creado.id, vendedorId);
    expect(venceNuevo).not.toBe(venceAnterior);

    const extensiones = db.prepare('SELECT * FROM apartado_extensiones WHERE apartado_id = ?').all(creado.id);
    expect(extensiones).toHaveLength(1);
  });
});
