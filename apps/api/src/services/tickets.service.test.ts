import type Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import { crearDbDePrueba } from '../test/testDb.js';
import * as apartados from './apartados.service.js';
import * as cambios from './cambios.service.js';
import * as productos from './productos.service.js';
import * as tickets from './tickets.service.js';
import * as ventas from './ventas.service.js';

let db: Database.Database;
let blusaId: number;
const marisol = { sub: 1, rol: 'vendedor' as const };
const otra = { sub: 2, rol: 'vendedor' as const };
const admin = { sub: 3, rol: 'admin' as const };

beforeEach(() => {
  db = crearDbDePrueba();
  const usuario = db.prepare(
    'INSERT INTO usuarios (nombre, usuario, nip_hash, rol, tasa_comision) VALUES (?, ?, ?, ?, 6)',
  );
  usuario.run('Marisol', 'marisol.r', 'x', 'vendedor');
  usuario.run('Daniela', 'daniela.o', 'x', 'vendedor');
  usuario.run('Crystal', 'crystal.d', 'x', 'admin');
  const categoriaId = Number(
    db.prepare("INSERT INTO categorias (nombre, tipo_talla) VALUES ('Blusas','estandar_ropa')").run()
      .lastInsertRowid,
  );
  const alta = (nombre: string, precio: number) =>
    productos.crear(db, { nombre, marca: 'Zara', categoriaId, talla: 'M', precio, cantidad: 5 }, 1).id;
  blusaId = alta('Blusa lino', 400);
  alta('Blusa seda', 500);
});

function vender() {
  return ventas.crearVentaDirecta(
    db,
    { lineas: [{ productoId: blusaId, cantidad: 1 }], metodoPago: 'efectivo', efectivoRecibido: 400 },
    marisol.sub,
  );
}

function apartar() {
  return apartados.crear(
    db,
    { lineas: [{ productoId: blusaId, cantidad: 2 }], clienteNombre: 'Lucía', abonoInicial: 100 },
    marisol.sub,
  );
}

function envejecer(folio: string, dias: number) {
  db.prepare(
    `UPDATE ventas SET created_at = datetime('now', ?), updated_at = datetime('now', ?) WHERE folio = ?`,
  ).run(`-${dias} days`, `-${dias} days`, folio);
}

describe('historial de tickets para reimprimir', () => {
  it('lista ventas y apartados, el más reciente primero', () => {
    const venta = vender();
    const apartado = apartar();
    const lista = tickets.listar(db);
    expect(lista.map((t) => t.folio)).toEqual([apartado.folio, venta.folio]);
    expect(lista[0]).toMatchObject({ tipo: 'apartado', cliente: 'Lucía', articulos: ['2× Blusa lino'] });
    expect(lista[1]).toMatchObject({ tipo: 'directa', cliente: null, vendedor: 'Marisol', total: 385 });
    expect(lista[1].fecha).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
  });

  it('solo conserva un mes hacia atrás', () => {
    const reciente = vender();
    const vieja = vender();
    envejecer(reciente.folio, 30);
    envejecer(vieja.folio, 33);
    expect(tickets.listar(db).map((t) => t.folio)).toEqual([reciente.folio]);
    expect(() => tickets.obtener(db, vieja.folio, admin)).toThrow('No hay un ticket con ese folio');
  });

  it('mantiene apartados viejos si siguen activos o se liquidaron en el último mes', () => {
    const activo = apartar();
    const liquidado = apartar();
    envejecer(activo.folio, 40);
    envejecer(liquidado.folio, 40);
    apartados.liquidar(db, liquidado.id, marisol.sub);
    expect(tickets.listar(db)).toHaveLength(2);
    expect(tickets.obtener(db, liquidado.folio, admin).apartado).toMatchObject({
      estado: 'liquidado',
      abonoInicial: 100,
      pagado: 800,
    });
  });

  it('devuelve los importes cobrados aunque el precio del producto cambie después', () => {
    const { folio } = vender();
    db.prepare('UPDATE productos SET precio = 999 WHERE id = ?').run(blusaId);
    expect(tickets.obtener(db, folio, marisol)).toMatchObject({
      folio,
      vendedor: 'Marisol',
      metodoPago: 'efectivo',
      total: 385,
      efectivoRecibido: 400,
      cambio: 15,
      apartado: null,
      lineas: [{ nombre: 'Blusa lino', cantidad: 1, probado: false, importe: 400, cambio: null }],
    });
  });

  it('la comisión solo la ven quien vendió y el admin', () => {
    const { folio } = vender();
    expect(tickets.obtener(db, folio, marisol).comisionMonto).toBeCloseTo(23.1);
    expect(tickets.obtener(db, folio, admin).comisionMonto).toBeCloseTo(23.1);
    expect(tickets.obtener(db, folio, otra).comisionMonto).toBeNull();
  });

  it('indica las líneas que después se cambiaron por otra prenda', () => {
    const { folio } = vender();
    const { lineas } = cambios.buscarVentaParaCambio(db, folio);
    cambios.crear(
      db,
      { ventaLineaId: lineas[0].ventaLineaId, productoNuevoId: blusaId + 1, metodoPago: 'tarjeta' },
      marisol.sub,
    );
    expect(tickets.obtener(db, folio, marisol).lineas[0].cambio).toEqual({
      nombre: 'Blusa seda',
      diferencia: 100,
    });
  });
});
