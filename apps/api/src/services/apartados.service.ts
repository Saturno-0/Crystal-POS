import { calcularLinea, calcularTotales, nombreConColor } from '@crystal/shared';
import type Database from 'better-sqlite3';
import type { TipoDescuento } from '@crystal/shared';
import { NotFoundError, ValidationError } from '../lib/errors.js';
import { registrar as registrarAuditoria } from './auditoria.service.js';

interface ProductoRow {
  id: number;
  nombre: string;
  color: string | null;
  precio: number;
  stock: number;
  descuento_tipo: TipoDescuento | null;
  descuento_valor: number | null;
}

export interface LineaApartadoInput {
  productoId: number;
  cantidad: number;
  probado?: boolean;
  descuentoTipo?: TipoDescuento;
  descuentoValor?: number;
}

export interface CrearApartadoInput {
  lineas: LineaApartadoInput[];
  clienteNombre: string;
  clienteTelefono?: string;
  abonoInicial: number;
}

function siguienteFolio(db: Database.Database): string {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM ventas').get() as { n: number };
  return String(1001 + n);
}

/**
 * Registrar apartado (HU-4.1). A diferencia de la venta directa, aquí SÍ se
 * descuenta el stock de inmediato: un apartado reserva la pieza física hasta
 * 15 días, no es un carrito efímero de un solo dispositivo.
 */
export function crear(db: Database.Database, input: CrearApartadoInput, actorId: number) {
  if (!input.lineas || input.lineas.length === 0) {
    throw new ValidationError('Agrega al menos un producto');
  }
  const clienteNombre = input.clienteNombre?.trim();
  if (!clienteNombre) {
    throw new ValidationError('Captura el nombre del cliente');
  }

  const actor = db.prepare('SELECT tasa_comision FROM usuarios WHERE id = ?').get(actorId) as
    | { tasa_comision: number }
    | undefined;
  if (!actor) throw new ValidationError('Usuario en sesión inválido');

  const transaccion = db.transaction(() => {
    const resultados = input.lineas.map((linea) => {
      if (!Number.isInteger(linea.cantidad) || linea.cantidad <= 0) {
        throw new ValidationError('Cantidad de línea inválida');
      }
      const producto = db
        .prepare(
          'SELECT id, nombre, color, precio, stock, descuento_tipo, descuento_valor FROM productos WHERE id = ? AND activo = 1',
        )
        .get(linea.productoId) as ProductoRow | undefined;
      if (!producto) throw new ValidationError('Producto no encontrado');
      if (producto.stock < linea.cantidad) {
        throw new ValidationError(`Sin existencias suficientes de ${producto.nombre}`);
      }

      const calculo = calcularLinea({
        precio: producto.precio,
        cantidad: linea.cantidad,
        auto: producto.descuento_tipo
          ? { tipo: producto.descuento_tipo, valor: producto.descuento_valor ?? 0 }
          : null,
        manual:
          linea.descuentoTipo && linea.descuentoValor
            ? { tipo: linea.descuentoTipo, valor: linea.descuentoValor }
            : null,
      });

      return { linea, producto, calculo };
    });

    const totales = calcularTotales({ lineas: resultados.map((r) => r.calculo), tipoVenta: 'apartado' });

    // Regla 2: abono > 0 y < total.
    if (!(input.abonoInicial > 0) || !(input.abonoInicial < totales.total)) {
      throw new ValidationError('El abono debe ser mayor a 0 y menor al total');
    }

    const folio = siguienteFolio(db);
    const ventaId = Number(
      db
        .prepare(
          `INSERT INTO ventas (
             folio, tipo, usuario_id, tasa_comision_aplicada, metodo_pago,
             subtotal_bruto, descuento_articulos, descuento_pago, total, estado
           ) VALUES (
             @folio, 'apartado', @usuarioId, @tasaComision, NULL,
             @subtotalBruto, @descuentoArticulos, 0, @total, 'apartado_activo'
           )`,
        )
        .run({
          folio,
          usuarioId: actorId,
          tasaComision: actor.tasa_comision,
          subtotalBruto: totales.subtotalBruto,
          descuentoArticulos: totales.descuentoArticulos,
          total: totales.total,
        }).lastInsertRowid,
    );

    const insertLinea = db.prepare(
      `INSERT INTO venta_lineas (
         venta_id, producto_id, cantidad, precio_unitario, probado,
         descuento_tipo, descuento_valor, descuento_origen, descuento_aplicado, importe_linea
       ) VALUES (
         @ventaId, @productoId, @cantidad, @precioUnitario, @probado,
         @descuentoTipo, @descuentoValor, @descuentoOrigen, @descuentoAplicado, @importeLinea
       )`,
    );
    const descontarStock = db.prepare('UPDATE productos SET stock = stock - ? WHERE id = ?');

    for (const { linea, producto, calculo } of resultados) {
      insertLinea.run({
        ventaId,
        productoId: producto.id,
        cantidad: linea.cantidad,
        precioUnitario: producto.precio,
        probado: linea.probado ? 1 : 0,
        descuentoTipo: linea.descuentoTipo ?? null,
        descuentoValor: linea.descuentoValor ?? null,
        descuentoOrigen: calculo.descuentoOrigen,
        descuentoAplicado: calculo.descuentoAplicado,
        importeLinea: calculo.importeLinea,
      });
      descontarStock.run(linea.cantidad, producto.id);
    }

    const apartadoId = Number(
      db
        .prepare(
          `INSERT INTO apartados (venta_id, cliente_nombre, cliente_telefono, abono_inicial, pagado, vence_at, estado)
           VALUES (@ventaId, @clienteNombre, @clienteTelefono, @abonoInicial, @abonoInicial,
                   date('now', 'localtime', '+15 days') || ' 23:59:59', 'activo')`,
        )
        .run({
          ventaId,
          clienteNombre,
          clienteTelefono: input.clienteTelefono?.trim() || null,
          abonoInicial: input.abonoInicial,
        }).lastInsertRowid,
    );

    registrarAuditoria(db, {
      usuarioId: actorId,
      accion: 'apartado.crear',
      entidad: 'apartado',
      entidadId: apartadoId,
      detalle: { folio, total: totales.total, abonoInicial: input.abonoInicial },
    });

    const venceAt = db.prepare('SELECT vence_at FROM apartados WHERE id = ?').get(apartadoId) as {
      vence_at: string;
    };

    return {
      id: apartadoId,
      folio,
      total: totales.total,
      abonoInicial: input.abonoInicial,
      resta: totales.total - input.abonoInicial,
      venceAt: venceAt.vence_at,
      lineas: resultados.map(({ linea, producto }) => ({
        nombre: nombreConColor(producto.nombre, producto.color),
        cantidad: linea.cantidad,
        probado: !!linea.probado,
      })),
    };
  });

  return transaccion();
}

interface ApartadoRow {
  id: number;
  venta_id: number;
  cliente_nombre: string;
  cliente_telefono: string | null;
  abono_inicial: number;
  pagado: number;
  vence_at: string;
  estado: 'activo' | 'liquidado' | 'penalizado';
  created_at: string;
}

function salud(venceAt: string, ahora: Date): { salud: 'verde' | 'amarillo' | 'rojo'; diasRestantes: number } {
  const diffMs = new Date(venceAt.replace(' ', 'T')).getTime() - ahora.getTime();
  const diasRestantes = diffMs / (1000 * 60 * 60 * 24);
  if (diasRestantes < 0) return { salud: 'rojo', diasRestantes };
  if (diasRestantes <= 3) return { salud: 'amarillo', diasRestantes };
  return { salud: 'verde', diasRestantes };
}

/** HU-4.2: apartados activos, agrupados por salud (verde/amarillo/rojo). */
export function listarActivos(db: Database.Database) {
  const rows = db
    .prepare(
      `SELECT a.*, v.folio, v.total FROM apartados a
       JOIN ventas v ON v.id = a.venta_id
       WHERE a.estado = 'activo'
       ORDER BY a.vence_at ASC`,
    )
    .all() as (ApartadoRow & { folio: string; total: number })[];

  const ahora = new Date();
  const lineasStmt = db.prepare(
    `SELECT vl.producto_id AS productoId, p.nombre, p.color, vl.cantidad, vl.probado
     FROM venta_lineas vl JOIN productos p ON p.id = vl.producto_id
     WHERE vl.venta_id = ?`,
  );

  return rows.map((row) => {
    const { salud: estadoSalud, diasRestantes } = salud(row.vence_at, ahora);
    return {
      id: row.id,
      folio: row.folio,
      clienteNombre: row.cliente_nombre,
      clienteTelefono: row.cliente_telefono,
      total: row.total,
      pagado: row.pagado,
      resto: row.total - row.pagado,
      venceAt: row.vence_at,
      salud: estadoSalud,
      diasRestantes,
      articulos: (
        lineasStmt.all(row.venta_id) as {
          productoId: number;
          nombre: string;
          color: string | null;
          cantidad: number;
          probado: number;
        }[]
      ).map(({ color, ...a }) => ({ ...a, nombre: nombreConColor(a.nombre, color) })),
    };
  });
}

function buscarActivo(db: Database.Database, id: number): ApartadoRow {
  const row = db.prepare("SELECT * FROM apartados WHERE id = ? AND estado = 'activo'").get(id) as
    | ApartadoRow
    | undefined;
  if (!row) throw new NotFoundError('Apartado no encontrado o ya no está activo');
  return row;
}

/** HU-4.3: liquidar — cobra el remanente y acredita la comisión (neta) hasta ahora. */
export function liquidar(db: Database.Database, id: number, actorId: number) {
  const apartado = buscarActivo(db, id);
  const venta = db
    .prepare('SELECT total, tasa_comision_aplicada FROM ventas WHERE id = ?')
    .get(apartado.venta_id) as { total: number; tasa_comision_aplicada: number };
  const remanente = venta.total - apartado.pagado;
  const comisionMonto = venta.total * (venta.tasa_comision_aplicada / 100);

  const transaccion = db.transaction(() => {
    db.prepare(
      "UPDATE apartados SET pagado = ?, estado = 'liquidado', liquidado_at = datetime('now') WHERE id = ?",
    ).run(venta.total, id);
    db.prepare(
      "UPDATE ventas SET estado = 'apartado_liquidado', comision_monto = ?, updated_at = datetime('now') WHERE id = ?",
    ).run(comisionMonto, apartado.venta_id);

    const lineas = db
      .prepare('SELECT producto_id, cantidad FROM venta_lineas WHERE venta_id = ?')
      .all(apartado.venta_id) as { producto_id: number; cantidad: number }[];
    const incrementarVendidos = db.prepare('UPDATE productos SET vendidos = vendidos + ? WHERE id = ?');
    for (const linea of lineas) {
      incrementarVendidos.run(linea.cantidad, linea.producto_id);
    }

    registrarAuditoria(db, {
      usuarioId: actorId,
      accion: 'apartado.liquidar',
      entidad: 'apartado',
      entidadId: id,
      detalle: { remanente, comisionMonto },
    });
  });
  transaccion();

  return { remanente, comisionMonto, total: venta.total };
}

/** HU-4.4: penalizar — abono perdido, la unidad regresa a stock, se retira el descuento del producto. */
export function penalizar(db: Database.Database, id: number, actorId: number) {
  const apartado = buscarActivo(db, id);

  const transaccion = db.transaction(() => {
    db.prepare(
      "UPDATE apartados SET estado = 'penalizado', penalizado_at = datetime('now') WHERE id = ?",
    ).run(id);
    db.prepare(
      "UPDATE ventas SET estado = 'apartado_penalizado', updated_at = datetime('now') WHERE id = ?",
    ).run(apartado.venta_id);

    const lineas = db
      .prepare('SELECT producto_id, cantidad FROM venta_lineas WHERE venta_id = ?')
      .all(apartado.venta_id) as { producto_id: number; cantidad: number }[];
    const regresarStock = db.prepare(
      // Regla 3: la unidad regresa a stock y se retira cualquier descuento del producto.
      "UPDATE productos SET stock = stock + ?, descuento_tipo = NULL, descuento_valor = NULL WHERE id = ?",
    );
    let unidades = 0;
    for (const linea of lineas) {
      regresarStock.run(linea.cantidad, linea.producto_id);
      unidades += linea.cantidad;
    }

    registrarAuditoria(db, {
      usuarioId: actorId,
      accion: 'apartado.penalizar',
      entidad: 'apartado',
      entidadId: id,
      detalle: { abonoPerdido: apartado.pagado, unidades },
    });

    return { abonoPerdido: apartado.pagado, unidades };
  });

  return transaccion();
}

const DIAS_EXTENSION = 15;

/** Prórroga: agrega otros 15 días al plazo del apartado, con historial de quién y cuándo. */
export function extenderPlazo(db: Database.Database, id: number, actorId: number) {
  const apartado = buscarActivo(db, id);
  const venceAnterior = apartado.vence_at;

  const transaccion = db.transaction(() => {
    db.prepare(
      `UPDATE apartados SET vence_at = date(vence_at, '+${DIAS_EXTENSION} days') || ' 23:59:59' WHERE id = ?`,
    ).run(id);
    const actualizado = db.prepare('SELECT vence_at FROM apartados WHERE id = ?').get(id) as {
      vence_at: string;
    };
    db.prepare(
      `INSERT INTO apartado_extensiones (apartado_id, usuario_id, vence_anterior, vence_nuevo)
       VALUES (?, ?, ?, ?)`,
    ).run(id, actorId, venceAnterior, actualizado.vence_at);

    registrarAuditoria(db, {
      usuarioId: actorId,
      accion: 'apartado.extender',
      entidad: 'apartado',
      entidadId: id,
      detalle: { venceAnterior, venceNuevo: actualizado.vence_at },
    });

    return actualizado.vence_at;
  });

  const venceNuevo = transaccion();
  return { venceAnterior, venceNuevo };
}
