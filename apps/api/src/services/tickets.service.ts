import { nombreConColor } from '@crystal/shared';
import type Database from 'better-sqlite3';
import type { EstadoApartado, EstadoVenta, MetodoPago, Rol, TipoVenta } from '@crystal/shared';
import { NotFoundError } from '../lib/errors.js';

const DIAS_HISTORIAL = 31;

// created_at/updated_at se guardan en UTC; el corte es al inicio del día local
// para que el último día del historial salga completo. Se usa updated_at (lo
// mueven liquidar y penalizar) para que un apartado viejo liquidado ayer siga
// disponible, y los apartados activos aparecen siempre, aunque por prórrogas
// ya pasen de un mes.
const EN_HISTORIAL = `(
  v.updated_at >= datetime('now', 'localtime', 'start of day', '-${DIAS_HISTORIAL} days', 'utc')
  OR v.estado = 'apartado_activo'
)`;

const FECHA_ISO = "strftime('%Y-%m-%dT%H:%M:%SZ', v.created_at)";

interface TicketRow {
  id: number;
  folio: string;
  tipo: TipoVenta;
  estado: EstadoVenta;
  fecha: string;
  vendedor: string;
  cliente: string | null;
  metodoPago: MetodoPago | null;
  total: number;
}

/** Ventas y apartados del último mes, del más reciente al más antiguo, para buscar cuál reimprimir. */
export function listar(db: Database.Database) {
  const tickets = db
    .prepare(
      `SELECT v.id, v.folio, v.tipo, v.estado, ${FECHA_ISO} AS fecha, u.nombre AS vendedor,
              a.cliente_nombre AS cliente, v.metodo_pago AS metodoPago, v.total
       FROM ventas v
       JOIN usuarios u ON u.id = v.usuario_id
       LEFT JOIN apartados a ON a.venta_id = v.id
       WHERE ${EN_HISTORIAL}
       ORDER BY v.created_at DESC, v.id DESC`,
    )
    .all() as TicketRow[];

  const lineas = db
    .prepare(
      `SELECT vl.venta_id AS ventaId, vl.cantidad, p.nombre, p.color
       FROM venta_lineas vl
       JOIN ventas v ON v.id = vl.venta_id
       JOIN productos p ON p.id = vl.producto_id
       WHERE ${EN_HISTORIAL}
       ORDER BY vl.id`,
    )
    .all() as { ventaId: number; cantidad: number; nombre: string; color: string | null }[];

  const articulos = new Map<number, string[]>();
  for (const l of lineas) {
    const nombre = nombreConColor(l.nombre, l.color);
    const lista = articulos.get(l.ventaId) ?? [];
    lista.push(l.cantidad > 1 ? `${l.cantidad}× ${nombre}` : nombre);
    articulos.set(l.ventaId, lista);
  }

  return tickets.map(({ id, ...t }) => ({ ...t, articulos: articulos.get(id) ?? [] }));
}

/**
 * Todo lo necesario para volver a imprimir un ticket. Los importes salen de lo
 * guardado al vender, nunca se recalculan. La comisión solo la ve quien hizo la
 * venta o un Admin (los reportes de comisiones son solo de Admin).
 */
export function obtener(db: Database.Database, folio: string, sesion: { sub: number; rol: Rol }) {
  const venta = db
    .prepare(
      `SELECT v.id, v.folio, v.tipo, v.estado, ${FECHA_ISO} AS fecha, v.usuario_id AS usuarioId,
              u.nombre AS vendedor, v.metodo_pago AS metodoPago, v.total,
              v.efectivo_recibido AS efectivoRecibido, v.cambio, v.comision_monto AS comisionMonto
       FROM ventas v
       JOIN usuarios u ON u.id = v.usuario_id
       WHERE v.folio = ? AND ${EN_HISTORIAL}`,
    )
    .get(folio) as
    | (Omit<TicketRow, 'cliente'> & {
        usuarioId: number;
        efectivoRecibido: number | null;
        cambio: number | null;
        comisionMonto: number | null;
      })
    | undefined;
  if (!venta) throw new NotFoundError('No hay un ticket con ese folio en el último mes');

  const lineas = db
    .prepare(
      `SELECT p.nombre, p.color, vl.cantidad, vl.probado, vl.importe_linea AS importe,
              pn.nombre AS nuevoNombre, pn.color AS nuevoColor, c.diferencia_cobrada AS diferencia
       FROM venta_lineas vl
       JOIN productos p ON p.id = vl.producto_id
       LEFT JOIN cambios c ON c.venta_linea_id = vl.id
       LEFT JOIN productos pn ON pn.id = c.producto_nuevo_id
       WHERE vl.venta_id = ?
       ORDER BY vl.id`,
    )
    .all(venta.id) as {
    nombre: string;
    color: string | null;
    cantidad: number;
    probado: number;
    importe: number;
    nuevoNombre: string | null;
    nuevoColor: string | null;
    diferencia: number | null;
  }[];

  const apartado = db
    .prepare(
      `SELECT abono_inicial AS abonoInicial, pagado, vence_at AS venceAt, estado
       FROM apartados WHERE venta_id = ?`,
    )
    .get(venta.id) as
    | { abonoInicial: number; pagado: number; venceAt: string; estado: EstadoApartado }
    | undefined;

  const { id: _id, usuarioId, comisionMonto, ...datos } = venta;
  const veComision = sesion.rol === 'admin' || sesion.sub === usuarioId;

  return {
    ...datos,
    comisionMonto: veComision ? comisionMonto : null,
    lineas: lineas.map((l) => ({
      nombre: nombreConColor(l.nombre, l.color),
      cantidad: l.cantidad,
      probado: l.probado === 1,
      importe: l.importe,
      cambio: l.nuevoNombre
        ? { nombre: nombreConColor(l.nuevoNombre, l.nuevoColor), diferencia: l.diferencia ?? 0 }
        : null,
    })),
    apartado: apartado ?? null,
  };
}
