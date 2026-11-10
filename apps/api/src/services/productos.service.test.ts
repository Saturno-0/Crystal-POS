import type Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import { crearDbDePrueba } from '../test/testDb.js';
import * as productos from './productos.service.js';

let db: Database.Database;
let mezclillaId: number;
let blusasId: number;
let vestidosId: number;
let chamarrasId: number;

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
  chamarrasId = Number(
    db.prepare("INSERT INTO categorias (nombre, tipo_talla) VALUES ('Chamarras','estandar_ropa')").run()
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

describe('crearLotePorTallas', () => {
  it('crea una fila por talla con cantidades distintas', () => {
    const creados = productos.crearLotePorTallas(
      db,
      {
        nombre: 'Jean recto',
        marca: 'Ciclón',
        categoriaId: mezclillaId,
        precio: 590,
        cantidades: { '1': 3, '3': 5, '5': 0, '7': 8 },
      },
      ACTOR_ID,
    );
    expect(creados).toHaveLength(3);
    expect(creados.map((p) => p.talla).sort()).toEqual(['1', '3', '7']);
    expect(creados.find((p) => p.talla === '7')?.stock).toBe(8);
    const skus = new Set(creados.map((p) => p.sku));
    expect(skus.size).toBe(3);
  });

  it('aplica el mismo precio y nombre a todas las tallas del lote', () => {
    const creados = productos.crearLotePorTallas(
      db,
      {
        nombre: 'Blusa lino',
        marca: 'Zara',
        categoriaId: blusasId,
        precio: 420,
        cantidades: { M: 2, L: 4 },
      },
      ACTOR_ID,
    );
    expect(creados.every((p) => p.nombre === 'Blusa lino' && p.precio === 420)).toBe(true);
  });

  it('rechaza una talla inválida para la categoría', () => {
    expect(() =>
      productos.crearLotePorTallas(
        db,
        { nombre: 'Jean recto', marca: 'Ciclón', categoriaId: mezclillaId, precio: 590, cantidades: { '2': 3 } },
        ACTOR_ID,
      ),
    ).toThrow('Selecciona una talla válida para esta categoría');
  });

  it('rechaza categorías sin talla (vestidos)', () => {
    expect(() =>
      productos.crearLotePorTallas(
        db,
        { nombre: 'Vestido gala', marca: 'Cklass', categoriaId: vestidosId, precio: 899, cantidades: { Única: 2 } },
        ACTOR_ID,
      ),
    ).toThrow('Esta categoría no maneja tallas');
  });

  it('rechaza si no hay ninguna cantidad mayor a cero', () => {
    expect(() =>
      productos.crearLotePorTallas(
        db,
        { nombre: 'Jean recto', marca: 'Ciclón', categoriaId: mezclillaId, precio: 590, cantidades: { '1': 0 } },
        ACTOR_ID,
      ),
    ).toThrow('Captura al menos una cantidad por talla');
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

  it('permite corregir la cantidad en inventario', () => {
    const p = productos.crear(
      db,
      { nombre: 'Blusa lino', marca: 'Zara', categoriaId: blusasId, talla: 'M', precio: 420, cantidad: 10 },
      ACTOR_ID,
    );
    const editado = productos.editar(db, p.id, { stock: 7 }, ACTOR_ID);
    expect(editado.stock).toBe(7);
  });

  it('mantiene el stock actual si no se envía en los cambios', () => {
    const p = productos.crear(
      db,
      { nombre: 'Blusa lino', marca: 'Zara', categoriaId: blusasId, talla: 'M', precio: 420, cantidad: 10 },
      ACTOR_ID,
    );
    const editado = productos.editar(db, p.id, { precio: 450 }, ACTOR_ID);
    expect(editado.stock).toBe(10);
  });

  it('rechaza una cantidad de inventario negativa', () => {
    const p = productos.crear(
      db,
      { nombre: 'Blusa lino', marca: 'Zara', categoriaId: blusasId, talla: 'M', precio: 420 },
      ACTOR_ID,
    );
    expect(() => productos.editar(db, p.id, { stock: -1 }, ACTOR_ID)).toThrow(
      'Captura una cantidad de inventario válida',
    );
  });

  it('rechaza una cantidad de inventario no entera', () => {
    const p = productos.crear(
      db,
      { nombre: 'Blusa lino', marca: 'Zara', categoriaId: blusasId, talla: 'M', precio: 420 },
      ACTOR_ID,
    );
    expect(() => productos.editar(db, p.id, { stock: 2.5 }, ACTOR_ID)).toThrow(
      'Captura una cantidad de inventario válida',
    );
  });

  it('permite corregir la talla dentro de la misma categoría', () => {
    const p = productos.crear(
      db,
      { nombre: 'Jean recto', marca: 'Levis', categoriaId: mezclillaId, talla: '7', precio: 590 },
      ACTOR_ID,
    );
    const editado = productos.editar(db, p.id, { talla: '9' }, ACTOR_ID);
    expect(editado.talla).toBe('9');
  });

  it('rechaza una talla inválida para la categoría actual', () => {
    const p = productos.crear(
      db,
      { nombre: 'Jean recto', marca: 'Levis', categoriaId: mezclillaId, talla: '7', precio: 590 },
      ACTOR_ID,
    );
    expect(() => productos.editar(db, p.id, { talla: 'M' }, ACTOR_ID)).toThrow(
      'Selecciona una talla válida para esta categoría',
    );
  });

  it('permite mover el producto a otra categoría con el mismo tipo de talla', () => {
    const p = productos.crear(
      db,
      { nombre: 'Blusa lino', marca: 'Zara', categoriaId: blusasId, talla: 'M', precio: 420 },
      ACTOR_ID,
    );
    const editado = productos.editar(db, p.id, { categoriaId: chamarrasId }, ACTOR_ID);
    expect(editado.categoriaId).toBe(chamarrasId);
    expect(editado.talla).toBe('M');
  });

  it('rechaza mover el producto a una categoría con otro tipo de talla', () => {
    const p = productos.crear(
      db,
      { nombre: 'Blusa lino', marca: 'Zara', categoriaId: blusasId, talla: 'M', precio: 420 },
      ACTOR_ID,
    );
    expect(() => productos.editar(db, p.id, { categoriaId: mezclillaId }, ACTOR_ID)).toThrow(
      'Solo puedes mover el producto a una categoría con el mismo tipo de talla',
    );
  });
});

describe('categorías por color (sacos, pantalones de vestir)', () => {
  let sacosId: number;
  let pantalonVestirId: number;

  beforeEach(() => {
    sacosId = Number(
      db.prepare("INSERT INTO categorias (nombre, tipo_talla, por_color) VALUES ('Sacos','estandar_ropa',1)").run()
        .lastInsertRowid,
    );
    pantalonVestirId = Number(
      db
        .prepare(
          "INSERT INTO categorias (nombre, tipo_talla, por_color) VALUES ('Pantalones de vestir','numerica_pantalon',1)",
        )
        .run().lastInsertRowid,
    );
  });

  const base = { nombre: 'Saco slim', marca: 'Zara', precio: 1200 };

  it('alta individual exige color y lo guarda normalizado', () => {
    expect(() => productos.crear(db, { ...base, categoriaId: sacosId, talla: 'M' }, ACTOR_ID)).toThrow(
      'Captura el color',
    );
    const p = productos.crear(db, { ...base, categoriaId: sacosId, talla: 'M', color: ' azul MARINO ' }, ACTOR_ID);
    expect(p.color).toBe('Azul marino');
  });

  it('categorías sin color ignoran el color recibido', () => {
    const p = productos.crear(
      db,
      { ...base, categoriaId: blusasId, talla: 'M', color: 'Negro' },
      ACTOR_ID,
    );
    expect(p.color).toBeNull();
  });

  it('lote color × talla crea un SKU por cada combinación con cantidad', () => {
    const creados = productos.crearLotePorTallas(
      db,
      {
        ...base,
        categoriaId: pantalonVestirId,
        porColor: [
          { color: 'Negro', cantidades: { '5': 2, '7': 1, '9': 0 } },
          { color: 'Gris', cantidades: { '7': 3 } },
        ],
      },
      ACTOR_ID,
    );
    expect(creados.map((p) => [p.color, p.talla, p.stock])).toEqual([
      ['Negro', '5', 2],
      ['Negro', '7', 1],
      ['Gris', '7', 3],
    ]);
    expect(new Set(creados.map((p) => p.sku)).size).toBe(3);
  });

  it('rechaza colores repetidos, vacíos o sin cantidades', () => {
    const lote = (porColor: { color: string; cantidades: Record<string, number> }[]) =>
      productos.crearLotePorTallas(db, { ...base, categoriaId: sacosId, porColor }, ACTOR_ID);
    expect(() =>
      lote([
        { color: 'Negro', cantidades: { M: 1 } },
        { color: 'negro', cantidades: { L: 1 } },
      ]),
    ).toThrow('repetido');
    expect(() => lote([{ color: '  ', cantidades: { M: 1 } }])).toThrow('Captura el color');
    expect(() => lote([{ color: 'Negro', cantidades: { M: 0 } }])).toThrow('al menos una cantidad');
    expect(() => lote([{ color: 'Negro', cantidades: { '7': 1 } }])).toThrow('talla válida');
    // Nada quedó a medias.
    expect(productos.listar(db, { categoriaId: sacosId })).toHaveLength(0);
  });

  it('se puede buscar por color', () => {
    productos.crear(db, { ...base, categoriaId: sacosId, talla: 'M', color: 'Vino' }, ACTOR_ID);
    expect(productos.listar(db, { busqueda: 'vino' })).toHaveLength(1);
  });

  it('editar cambia el color y no permite mover a una categoría sin color', () => {
    const p = productos.crear(db, { ...base, categoriaId: sacosId, talla: 'M', color: 'Negro' }, ACTOR_ID);
    expect(productos.editar(db, p.id, { color: 'Beige' }, ACTOR_ID).color).toBe('Beige');
    expect(() => productos.editar(db, p.id, { categoriaId: blusasId }, ACTOR_ID)).toThrow('maneje color');
  });
});
