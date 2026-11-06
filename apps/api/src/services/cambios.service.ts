import type Database from 'better-sqlite3';
import type { MetodoPago } from '@crystal/shared';
import { NotFoundError, ValidationError } from '../lib/errors.js';
import { registrar as registrarAuditoria } from './auditoria.service.js';

const METODOS_PAGO: MetodoPago[] = ['efectivo', 'transferencia', 'tarjeta'];
const ESTADOS_ELEGIBLES = "('completada','apartado_liquidado')";

interface VentaRow {
  id: number;
  folio: string;
  estado: string;
}

interface LineaRow {
  id: number;
  venta_id: number;
  producto_id: number;
  cantidad: number;
  probado: number;
  importe_linea: number;
}

/** HU pendiente "cambio por otra prenda" (regla 10): detalle de una venta ya cobrada para elegir qué línea cambiar. */
export function buscarVentaParaCambio(db: Database.Database, folio: string) {
  const venta = db.prepare(`SELECT id, folio, estado FROM ventas WHERE folio = ?`).get(folio) as
    | VentaRow
    | undefined;
  if (!venta) throw new NotFoundError('No existe un ticket con ese folio');
  if (!['completada', 'apartado_liquidado'].includes(venta.estado)) {
    throw new ValidationError('Ese ticket no está cobrado; no admite cambios');
  }

  const lineas = db
    .prepare(
      `SELECT vl.id, vl.cantidad, vl.probado, vl.importe_linea,
              p.id AS productoId, p.nombre, p.sku, p.talla,
              (SELECT COUNT(*) FROM cambios c WHERE c.venta_linea_id = vl.id) AS yaCambiada
       FROM venta_lineas vl JOIN productos p ON p.id = vl.producto_id
       WHERE vl.venta_id = ?`,
    )
    .all(venta.id) as {
    id: number;
    cantidad: number;
    probado: number;
    importe_linea: number;
    productoId: number;
    nombre: string;
    sku: string;
    talla: string | null;
    yaCambiada: number;
  }[];

  return {
    folio: venta.folio,
    lineas: lineas.map((l) => ({
      ventaLineaId: l.id,
      productoId: l.productoId,
      nombre: l.nombre,
      sku: l.sku,
      talla: l.talla,
      cantidad: l.cantidad,
      precioPagado: l.importe_linea / l.cantidad,
      probado: l.probado === 1,
      yaCambiada: l.yaCambiada > 0,
      // Regla: solo se cambian líneas de 1 unidad (si compraron varias piezas
      // iguales en una sola línea, no hay forma de aislar cuál se cambia).
      elegible: l.probado === 0 && l.yaCambiada === 0 && l.cantidad === 1,
    })),
  };
}

export interface CrearCambioInput {
  ventaLineaId: number;
  productoNuevoId: number;
  metodoPago?: MetodoPago;
}

/**
 * Cambio por otra prenda: solo por un producto de igual o mayor precio que lo
 * que el cliente ya pagó por esa línea (con descuentos incluidos) — comparar
 * contra el precio de lista original subestimaría lo cobrado si esa línea
 * tuvo descuento, y la tienda perdería margen al entregar gratis la
 * diferencia. Sin devolución de dinero si el nuevo producto es más barato.
 */
export function crear(db: Database.Database, input: CrearCambioInput, actorId: number) {
  const linea = db
    .prepare(
      `SELECT vl.id, vl.venta_id, vl.producto_id, vl.cantidad, vl.probado, vl.importe_linea
       FROM venta_lineas vl WHERE vl.id = ?`,
    )
    .get(input.ventaLineaId) as LineaRow | undefined;
  if (!linea) throw new NotFoundError('Línea de venta no encontrada');

  const venta = db.prepare('SELECT id, folio, estado FROM ventas WHERE id = ?').get(linea.venta_id) as
    | VentaRow
    | undefined;
  if (!venta || !['completada', 'apartado_liquidado'].includes(venta.estado)) {
    throw new ValidationError('Ese ticket no está cobrado; no admite cambios');
  }
  if (linea.probado) {
    throw new ValidationError('No se puede cambiar una prenda marcada como probada');
  }
  if (linea.cantidad !== 1) {
    throw new ValidationError('Solo se pueden cambiar líneas de 1 unidad');
  }
  const yaCambiada = db.prepare('SELECT 1 FROM cambios WHERE venta_linea_id = ?').get(linea.id);
  if (yaCambiada) {
    throw new ValidationError('Esta línea ya fue cambiada anteriormente');
  }
  if (input.productoNuevoId === linea.producto_id) {
    throw new ValidationError('Elige un producto distinto al original');
  }

  const productoNuevo = db
    .prepare('SELECT id, nombre, precio, stock FROM productos WHERE id = ? AND activo = 1')
    .get(input.productoNuevoId) as { id: number; nombre: string; precio: number; stock: number } | undefined;
  if (!productoNuevo) throw new ValidationError('Producto no encontrado');
  if (productoNuevo.stock < 1) throw new ValidationError(`Sin existencias de ${productoNuevo.nombre}`);

  const precioPagadoOriginal = linea.importe_linea / linea.cantidad;
  if (productoNuevo.precio < precioPagadoOriginal) {
    throw new ValidationError('Solo puedes cambiar por una prenda del mismo precio o mayor');
  }

  const diferencia = Math.max(0, productoNuevo.precio - precioPagadoOriginal);
  if (diferencia > 0 && !METODOS_PAGO.includes(input.metodoPago as MetodoPago)) {
    throw new ValidationError('Selecciona el método de pago de la diferencia');
  }

  const actor = db.prepare('SELECT tasa_comision FROM usuarios WHERE id = ?').get(actorId) as
    | { tasa_comision: number }
    | undefined;
  if (!actor) throw new ValidationError('Usuario en sesión inválido');

  // Sin descuento por método de pago (regla 4): ese incentivo ya se aplicó
  // una vez en la venta original; no se vuelve a aplicar sobre la diferencia.
  const comisionMonto = diferencia * (actor.tasa_comision / 100);

  const transaccion = db.transaction(() => {
    db.prepare(
      "UPDATE productos SET stock = stock + 1, vendidos = CASE WHEN vendidos > 0 THEN vendidos - 1 ELSE 0 END WHERE id = ?",
    ).run(linea.producto_id);
    db.prepare('UPDATE productos SET stock = stock - 1, vendidos = vendidos + 1 WHERE id = ?').run(
      productoNuevo.id,
    );

    const cambioId = Number(
      db
        .prepare(
          `INSERT INTO cambios (
             venta_linea_id, producto_nuevo_id, usuario_id, precio_pagado_original,
             precio_nuevo, diferencia_cobrada, metodo_pago, tasa_comision_aplicada, comision_monto
           ) VALUES (
             @ventaLineaId, @productoNuevoId, @usuarioId, @precioPagadoOriginal,
             @precioNuevo, @diferencia, @metodoPago, @tasaComision, @comisionMonto
           )`,
        )
        .run({
          ventaLineaId: linea.id,
          productoNuevoId: productoNuevo.id,
          usuarioId: actorId,
          precioPagadoOriginal,
          precioNuevo: productoNuevo.precio,
          diferencia,
          metodoPago: diferencia > 0 ? input.metodoPago : null,
          tasaComision: actor.tasa_comision,
          comisionMonto,
        }).lastInsertRowid,
    );

    registrarAuditoria(db, {
      usuarioId: actorId,
      accion: 'venta.cambiar_prenda',
      entidad: 'venta_linea',
      entidadId: linea.id,
      detalle: {
        folio: venta.folio,
        productoOriginalId: linea.producto_id,
        productoNuevoId: productoNuevo.id,
        diferencia,
      },
    });

    return cambioId;
  });

  const id = transaccion();

  return {
    id,
    folio: venta.folio,
    productoNuevo: { id: productoNuevo.id, nombre: productoNuevo.nombre },
    precioPagadoOriginal,
    precioNuevo: productoNuevo.precio,
    diferenciaCobrada: diferencia,
    comisionMonto,
  };
}
