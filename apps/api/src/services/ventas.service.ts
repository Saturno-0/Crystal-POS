import { calcularLinea, calcularTotales } from '@crystal/shared';
import type Database from 'better-sqlite3';
import type { MetodoPago, TipoDescuento } from '@crystal/shared';
import { ValidationError } from '../lib/errors.js';
import { registrar as registrarAuditoria } from './auditoria.service.js';

interface ProductoRow {
  id: number;
  nombre: string;
  precio: number;
  stock: number;
  descuento_tipo: TipoDescuento | null;
  descuento_valor: number | null;
}

export interface LineaVentaInput {
  productoId: number;
  cantidad: number;
  probado?: boolean;
  descuentoTipo?: TipoDescuento;
  descuentoValor?: number;
}

export interface CrearVentaDirectaInput {
  lineas: LineaVentaInput[];
  metodoPago: MetodoPago;
  efectivoRecibido?: number;
}

const METODOS_PAGO: MetodoPago[] = ['efectivo', 'transferencia', 'tarjeta'];

function siguienteFolio(db: Database.Database): string {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM ventas').get() as { n: number };
  return String(1001 + n);
}

/**
 * Venta directa (HU-3.1 a HU-3.6). El stock se valida y descuenta aquí, en
 * una sola transacción al cobrar — no al agregar al carrito. Esto evita
 * reservas "fantasma" entre dispositivos (hasta 3 cajas concurrentes) y hace
 * que "cancelar ticket" (HU-3.7) sea gratis: si nunca se cobró, nunca se tocó
 * el stock. El costo es que, en la rara coincidencia de que dos cajas
 * intenten vender la última unidad al mismo tiempo, la segunda transacción
 * en cobrar es la que falla con "sin existencias".
 */
export function crearVentaDirecta(
  db: Database.Database,
  input: CrearVentaDirectaInput,
  actorId: number,
) {
  if (!input.lineas || input.lineas.length === 0) {
    throw new ValidationError('Agrega al menos un producto');
  }
  if (!METODOS_PAGO.includes(input.metodoPago)) {
    throw new ValidationError('Método de pago inválido');
  }

  const actor = db.prepare('SELECT tasa_comision FROM usuarios WHERE id = ?').get(actorId) as
    | { tasa_comision: number }
    | undefined;
  if (!actor) throw new ValidationError('Usuario en sesión inválido');

  const transaccion = db.transaction(() => {
    const productos = new Map<number, ProductoRow>();
    const resultados = input.lineas.map((linea) => {
      if (!Number.isInteger(linea.cantidad) || linea.cantidad <= 0) {
        throw new ValidationError('Cantidad de línea inválida');
      }
      const producto = db
        .prepare('SELECT id, nombre, precio, stock, descuento_tipo, descuento_valor FROM productos WHERE id = ? AND activo = 1')
        .get(linea.productoId) as ProductoRow | undefined;
      if (!producto) throw new ValidationError('Producto no encontrado');
      if (producto.stock < linea.cantidad) {
        throw new ValidationError(`Sin existencias suficientes de ${producto.nombre}`);
      }
      productos.set(producto.id, producto);

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

    const totales = calcularTotales({
      lineas: resultados.map((r) => r.calculo),
      tipoVenta: 'directa',
      metodoPago: input.metodoPago,
      efectivoRecibido: input.efectivoRecibido,
    });

    if (input.metodoPago === 'efectivo' && (input.efectivoRecibido ?? 0) < totales.total) {
      throw new ValidationError('El efectivo recibido es menor al total a cobrar');
    }

    // tasa_comision se guarda como porcentaje entero (6 = 6%), no como fracción.
    const comisionMonto = totales.total * (actor.tasa_comision / 100);
    const folio = siguienteFolio(db);

    const ventaId = Number(
      db
        .prepare(
          `INSERT INTO ventas (
             folio, tipo, usuario_id, tasa_comision_aplicada, comision_monto, metodo_pago,
             subtotal_bruto, descuento_articulos, descuento_pago, total, efectivo_recibido, cambio, estado
           ) VALUES (
             @folio, 'directa', @usuarioId, @tasaComision, @comisionMonto, @metodoPago,
             @subtotalBruto, @descuentoArticulos, @descuentoPago, @total, @efectivoRecibido, @cambio, 'completada'
           )`,
        )
        .run({
          folio,
          usuarioId: actorId,
          tasaComision: actor.tasa_comision,
          comisionMonto,
          metodoPago: input.metodoPago,
          subtotalBruto: totales.subtotalBruto,
          descuentoArticulos: totales.descuentoArticulos,
          descuentoPago: totales.descuentoPago,
          total: totales.total,
          efectivoRecibido: input.metodoPago === 'efectivo' ? (input.efectivoRecibido ?? 0) : null,
          cambio: totales.cambio,
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
    const descontarStock = db.prepare(
      'UPDATE productos SET stock = stock - ?, vendidos = vendidos + ? WHERE id = ?',
    );

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
      descontarStock.run(linea.cantidad, linea.cantidad, producto.id);
    }

    registrarAuditoria(db, {
      usuarioId: actorId,
      accion: 'venta.crear',
      entidad: 'venta',
      entidadId: ventaId,
      detalle: { folio, total: totales.total, metodoPago: input.metodoPago },
    });

    return {
      id: ventaId,
      folio,
      total: totales.total,
      subtotalBruto: totales.subtotalBruto,
      descuentoArticulos: totales.descuentoArticulos,
      descuentoPago: totales.descuentoPago,
      cambio: totales.cambio,
      comisionMonto,
      metodoPago: input.metodoPago,
      efectivoRecibido: input.metodoPago === 'efectivo' ? input.efectivoRecibido ?? 0 : null,
    };
  });

  return transaccion();
}
