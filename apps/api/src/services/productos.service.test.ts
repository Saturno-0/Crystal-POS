import type Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import { crearDbDePrueba } from '../test/testDb.js';
import * as productos from './productos.service.js';

let db: Database.Database;
let mezclillaId: number;
let blusasId: number;
let vestidosId: number;

const ACTOR_ID = 1;

beforeEach(() => {
  db = crearDbDePrueba();
  db.prepare("INSERT INTO usuarios (id, nombre, usuario, nip_hash, rol) VALUES (1,'Test','test','x','admin')").run();

  mezclillaId = Number(
    db.prepare("INSERT INTO categorias (nombre, tipo_talla) VALUES ('Mezclilla','numerica_pantalon')").run()
      .lastInsertRowid,
  );
  blusasId = Number(
    db.prepare("INSERT INTO categorias (nombre, tipo_talla) VALUES ('Blusas','estandar_ropa')").run()
      .lastInsertRowid,
  );
  vestidosId = Number(
    db.prepare("INSERT INTO categorias (nombre, tipo_talla) VALUES ('Vestidos','sin_talla')").run()
      .lastInsertRowid,
  );
});

describe('crear (HU-2.1 / HU-2.2)', () => {
  it('genera un SKU con el formato MARCA-CATEGORIA-NUMERO', () => {
    const p = productos.crear(
      db,
      { nombre: 'Jean recto', marca: 'Levis', categoriaId: mezclillaId, talla: '7', precio: 590 },
      ACTOR_ID,
    );
    expect(p.sku).toMatch(/^LEV-ME-\d{5}$/);
  });

  it('alta de pieza única deja stock en 1', () => {
    const p = productos.crear(
      db,
      { nombre: 'Blusa lino', marca: 'Zara', categoriaId: blusasId, talla: 'M', precio: 420 },
      ACTOR_ID,
    );
    expect(p.stock).toBe(1);
  });

  it('alta por lote deja stock en la cantidad indicada', () => {
    const p = productos.crear(
      db,
      { nombre: 'Blusa lino', marca: 'Zara', categoriaId: blusasId, talla: 'M', precio: 420, cantidad: 10 },
      ACTOR_ID,
    );
    expect(p.stock).toBe(10);
  });

  it('rechaza una talla inválida para la categoría', () => {
    expect(() =>
      productos.crear(
        db,
        { nombre: 'Jean recto', marca: 'Levis', categoriaId: mezclillaId, talla: '2', precio: 590 },
        ACTOR_ID,
      ),
    ).toThrow('Selecciona una talla válida para esta categoría');
  });

  it('los vestidos se guardan como talla Única sin importar el input', () => {
    const p = productos.crear(
      db,
      { nombre: 'Vestido gala', marca: 'Cklass', categoriaId: vestidosId, precio: 899 },
      ACTOR_ID,
    );
    expect(p.talla).toBe('Única');
  });

  it('permite el descuento automático de vestido cuando es una combinación válida', () => {
    const p = productos.crear(
      db,
      {
        nombre: 'Vestido gala',
        marca: 'Cklass',
        categoriaId: vestidosId,
        precio: 899,
        descuentoTipo: 'pct',
        descuentoValor: 10,
      },
      ACTOR_ID,
    );
    expect(p.descuentoTipo).toBe('pct');
    expect(p.descuentoValor).toBe(10);
  });

  it('rechaza un descuento de vestido que no sea 10%, $100 o $40', () => {
    expect(() =>
      productos.crear(
        db,
        {
          nombre: 'Vestido gala',
          marca: 'Cklass',
          categoriaId: vestidosId,
          precio: 899,
          descuentoTipo: 'pct',
          descuentoValor: 25,
        },
        ACTOR_ID,
      ),
    ).toThrow('El descuento de vestido debe ser 10%, $100 o $40');
  });

  it('ignora el descuento automático en categorías que no son vestidos', () => {
    const p = productos.crear(
      db,
      {
        nombre: 'Blusa lino',
        marca: 'Zara',
        categoriaId: blusasId,
        talla: 'M',
        precio: 420,
        descuentoTipo: 'pct',
        descuentoValor: 10,
      },
      ACTOR_ID,
    );
    expect(p.descuentoTipo).toBeNull();
  });

  it('rechaza precio inválido', () => {
    expect(() =>
      productos.crear(
        db,
        { nombre: 'Blusa lino', marca: 'Zara', categoriaId: blusasId, talla: 'M', precio: 0 },
        ACTOR_ID,
      ),
    ).toThrow('Captura un precio válido');
  });
});

describe('listar (HU-2.6)', () => {
  it('filtra por búsqueda de nombre, marca o SKU', () => {
    productos.crear(
      db,
      { nombre: 'Jean recto', marca: 'Levis', categoriaId: mezclillaId, talla: '7', precio: 590 },
      ACTOR_ID,
    );
    productos.crear(
      db,
      { nombre: 'Blusa lino', marca: 'Zara', categoriaId: blusasId, talla: 'M', precio: 420 },
      ACTOR_ID,
    );
    expect(productos.listar(db, { busqueda: 'jean' })).toHaveLength(1);
    expect(productos.listar(db, { busqueda: 'zara' })).toHaveLength(1);
    expect(productos.listar(db, {})).toHaveLength(2);
  });

  it('filtra por categoría', () => {
    productos.crear(
      db,
      { nombre: 'Jean recto', marca: 'Levis', categoriaId: mezclillaId, talla: '7', precio: 590 },
      ACTOR_ID,
    );
    productos.crear(
      db,
      { nombre: 'Blusa lino', marca: 'Zara', categoriaId: blusasId, talla: 'M', precio: 420 },
      ACTOR_ID,
    );
    expect(productos.listar(db, { categoriaId: mezclillaId })).toHaveLength(1);
  });
});

describe('eliminar (HU-2.5)', () => {
  it('da de baja un producto sin apartados activos', () => {
    const p = productos.crear(
      db,
      { nombre: 'Blusa lino', marca: 'Zara', categoriaId: blusasId, talla: 'M', precio: 420 },
      ACTOR_ID,
    );
    productos.eliminar(db, p.id, ACTOR_ID);
    expect(productos.listar(db, {})).toHaveLength(0);
  });

  it('bloquea la eliminación si el producto tiene un apartado activo', () => {
    const p = productos.crear(
      db,
      { nombre: 'Blusa lino', marca: 'Zara', categoriaId: blusasId, talla: 'M', precio: 420 },
      ACTOR_ID,
    );

    const ventaId = Number(
      db
        .prepare(
          `INSERT INTO ventas (folio, tipo, usuario_id, tasa_comision_aplicada, subtotal_bruto, total, estado)
           VALUES ('T-1','apartado',1,0,420,420,'apartado_activo')`,
        )
        .run().lastInsertRowid,
    );
    db.prepare(
      `INSERT INTO venta_lineas (venta_id, producto_id, cantidad, precio_unitario, descuento_origen, importe_linea)
       VALUES (?, ?, 1, 420, 'ninguno', 420)`,
    ).run(ventaId, p.id);
    db.prepare(
      `INSERT INTO apartados (venta_id, cliente_nombre, abono_inicial, vence_at, estado)
       VALUES (?, 'Cliente X', 100, datetime('now','+15 days'), 'activo')`,
    ).run(ventaId);

    expect(() => productos.eliminar(db, p.id, ACTOR_ID)).toThrow(
      'No puedes eliminar un producto con apartados activos',
    );
  });
});

describe('editar', () => {
  it('actualiza nombre, marca y precio', () => {
    const p = productos.crear(
      db,
      { nombre: 'Blusa lino', marca: 'Zara', categoriaId: blusasId, talla: 'M', precio: 420 },
      ACTOR_ID,
    );
    const editado = productos.editar(db, p.id, { precio: 450 }, ACTOR_ID);
    expect(editado.precio).toBe(450);
  });
});
