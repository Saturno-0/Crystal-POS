import type Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import { crearDbDePrueba } from '../test/testDb.js';
import * as apartados from './apartados.service.js';
import * as productos from './productos.service.js';
import * as reportes from './reportes.service.js';
import * as ventas from './ventas.service.js';

let db: Database.Database;
let vendedorId: number;
let categoriaId: number;

const AHORA = new Date('2026-06-15T12:00:00Z');

function fijarFecha(tabla: 'ventas' | 'apartados', id: number, fecha: string, columna = 'created_at') {
  db.prepare(`UPDATE ${tabla} SET ${columna} = ? WHERE id = ?`).run(fecha, id);
}

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
    { nombre: 'Blusa lino', marca: 'Zara', categoriaId, talla: 'M', precio: 400, cantidad: 10, ...overrides },
    vendedorId,
  );
}

describe('calcularKpis (HU-5.1/5.2)', () => {
  it('solo cuenta ventas completadas/apartado_liquidado dentro del rango', () => {
    const p = crearProducto();
    const dentro = ventas.crearVentaDirecta(
      db,
      { lineas: [{ productoId: p.id, cantidad: 1 }], metodoPago: 'tarjeta' },
      vendedorId,
    );
    fijarFecha('ventas', dentro.id, '2026-06-10 10:00:00');

    const fuera = ventas.crearVentaDirecta(
      db,
      { lineas: [{ productoId: p.id, cantidad: 1 }], metodoPago: 'tarjeta' },
      vendedorId,
    );
    fijarFecha('ventas', fuera.id, '2025-01-01 10:00:00');

    const kpis = reportes.calcularKpis(db, 'mes', AHORA);
    expect(kpis.ventasTotales).toBe(400);
    expect(kpis.tickets).toBe(1);
  });

  it('excluye ventas canceladas y apartados penalizados', () => {
    const p = crearProducto({ cantidad: 1 });
    const apartado = apartados.crear(
      db,
      { lineas: [{ productoId: p.id, cantidad: 1 }], clienteNombre: 'Ana', abonoInicial: 100 },
      vendedorId,
    );
    apartados.penalizar(db, apartado.id, vendedorId);
    fijarFecha('ventas', apartado.id, '2026-06-10 10:00:00');

    const kpis = reportes.calcularKpis(db, 'mes', AHORA);
    expect(kpis.ventasTotales).toBe(0);
    expect(kpis.tickets).toBe(0);
  });

  it('calcula el % vs el periodo anterior de igual duración', () => {
    const p = crearProducto();
    const actual = ventas.crearVentaDirecta(
      db,
      { lineas: [{ productoId: p.id, cantidad: 1 }], metodoPago: 'tarjeta' },
      vendedorId,
    );
    fijarFecha('ventas', actual.id, '2026-06-10 10:00:00'); // dentro del mes actual

    const previa = ventas.crearVentaDirecta(
      db,
      { lineas: [{ productoId: p.id, cantidad: 1 }], metodoPago: 'tarjeta' },
      vendedorId,
    );
    fijarFecha('ventas', previa.id, '2026-04-20 10:00:00'); // mes anterior al rango actual

    const kpis = reportes.calcularKpis(db, 'mes', AHORA);
    expect(kpis.ventasTotalesVsAnteriorPct).toBe(0); // 400 vs 400 => 0%
  });

  it('retorna null de comparación si no hubo ventas en el periodo anterior', () => {
    const kpis = reportes.calcularKpis(db, 'mes', AHORA);
    expect(kpis.ventasTotalesVsAnteriorPct).toBeNull();
  });

  it('cuenta apartados vencidos como snapshot actual, sin importar el periodo', () => {
    const p = crearProducto({ cantidad: 1 });
    const apartado = apartados.crear(
      db,
      { lineas: [{ productoId: p.id, cantidad: 1 }], clienteNombre: 'Ana', abonoInicial: 100 },
      vendedorId,
    );
    fijarFecha('apartados', apartado.id, '2026-05-01 00:00:00', 'vence_at');

    const kpis = reportes.calcularKpis(db, 'mes', AHORA);
    expect(kpis.apartadosVencidos).toBe(1);
  });

  it('suma el abono perdido de apartados penalizados dentro del rango (monto penalizado)', () => {
    const p = crearProducto({ cantidad: 1 });
    const apartado = apartados.crear(
      db,
      { lineas: [{ productoId: p.id, cantidad: 1 }], clienteNombre: 'Ana', abonoInicial: 150 },
      vendedorId,
    );
    apartados.penalizar(db, apartado.id, vendedorId);
    fijarFecha('apartados', apartado.id, '2026-06-05 00:00:00', 'penalizado_at');

    const kpis = reportes.calcularKpis(db, 'mes', AHORA);
    expect(kpis.apartadosMontoPenalizado).toBe(150);
  });
});

describe('calcularTendencia (HU-5.4)', () => {
  it('mes: 7 puntos diarios', () => {
    expect(reportes.calcularTendencia(db, 'mes', AHORA)).toHaveLength(7);
  });

  it('trimestre: 3 puntos mensuales', () => {
    expect(reportes.calcularTendencia(db, 'trimestre', AHORA)).toHaveLength(3);
  });

  it('año: 8 puntos mensuales', () => {
    expect(reportes.calcularTendencia(db, 'anio', AHORA)).toHaveLength(8);
  });
});

describe('calcularPorVendedor (HU-5.3, regla 8)', () => {
  it('acredita ingreso y comisión al vendedor en sesión al momento de la venta', () => {
    const p = crearProducto({ precio: 1000 });
    const venta = ventas.crearVentaDirecta(
      db,
      { lineas: [{ productoId: p.id, cantidad: 1 }], metodoPago: 'tarjeta' },
      vendedorId,
    );
    fijarFecha('ventas', venta.id, '2026-06-10 10:00:00');

    const [fila] = reportes.calcularPorVendedor(db, 'mes', AHORA);
    expect(fila.tickets).toBe(1);
    expect(fila.ingreso).toBe(1000);
    expect(fila.comisionMonto).toBeCloseTo(60);
  });

  it('el admin también genera comisión como un vendedor (regla 8)', () => {
    db.prepare(
      "INSERT INTO usuarios (nombre, usuario, nip_hash, rol, tasa_comision) VALUES ('Dueña','duena','x','admin',8)",
    ).run();
    const adminId = 2;
    const p = crearProducto({ precio: 500 });
    const venta = ventas.crearVentaDirecta(
      db,
      { lineas: [{ productoId: p.id, cantidad: 1 }], metodoPago: 'tarjeta' },
      adminId,
    );
    fijarFecha('ventas', venta.id, '2026-06-10 10:00:00');

    const fila = reportes.calcularPorVendedor(db, 'mes', AHORA).find((v) => v.id === adminId);
    expect(fila?.rol).toBe('admin');
    expect(fila?.comisionMonto).toBeCloseTo(40);
  });
});

describe('exportarVendedoresCsv (HU-5.5)', () => {
  it('genera un CSV con encabezado y una fila por vendedor activo', () => {
    const csv = reportes.exportarVendedoresCsv(db, 'mes', AHORA);
    const lineas = csv.split('\n');
    expect(lineas[0]).toBe('vendedor,rol,tickets,ingreso,tasa_comision,comision');
    expect(lineas).toHaveLength(2); // encabezado + Marisol
    expect(lineas[1]).toContain('Marisol');
  });
});

describe('periodoValido', () => {
  it('cae a "mes" ante cualquier valor inválido o ausente', () => {
    expect(reportes.periodoValido(undefined)).toBe('mes');
    expect(reportes.periodoValido('bimestre')).toBe('mes');
    expect(reportes.periodoValido('trimestre')).toBe('trimestre');
  });
});
