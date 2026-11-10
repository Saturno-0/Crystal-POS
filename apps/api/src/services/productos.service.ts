import type Database from 'better-sqlite3';
import { DESCUENTOS_VESTIDO, TALLAS_POR_TIPO, type TipoDescuento, type TipoTalla } from '@crystal/shared';
import { NotFoundError, ValidationError } from '../lib/errors.js';
import { registrar as registrarAuditoria } from './auditoria.service.js';

interface CategoriaRow {
  id: number;
  nombre: string;
  tipo_talla: TipoTalla;
}

interface ProductoRow {
  id: number;
  sku: string;
  nombre: string;
  marca: string;
  categoria_id: number;
  talla: string | null;
  precio: number;
  stock: number;
  vendidos: number;
  descuento_tipo: TipoDescuento | null;
  descuento_valor: number | null;
  activo: number;
}

function aPublico(row: ProductoRow) {
  return {
    id: row.id,
    sku: row.sku,
    nombre: row.nombre,
    marca: row.marca,
    categoriaId: row.categoria_id,
    talla: row.talla,
    precio: row.precio,
    stock: row.stock,
    vendidos: row.vendidos,
    descuentoTipo: row.descuento_tipo,
    descuentoValor: row.descuento_valor,
    activo: row.activo === 1,
  };
}

function buscarCategoria(db: Database.Database, id: number): CategoriaRow {
  const categoria = db.prepare('SELECT * FROM categorias WHERE id = ?').get(id) as
    | CategoriaRow
    | undefined;
  if (!categoria) throw new ValidationError('Categoría inválida');
  return categoria;
}

function buscarProductoActivo(db: Database.Database, id: number): ProductoRow {
  const producto = db.prepare('SELECT * FROM productos WHERE id = ? AND activo = 1').get(id) as
    | ProductoRow
    | undefined;
  if (!producto) throw new NotFoundError('Producto no encontrado');
  return producto;
}

// SKU con reintento en colisión (decisión: rango amplio para catálogos grandes).
function generarSku(db: Database.Database, marca: string, categoriaNombre: string): string {
  const prefijoMarca = marca.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase() || 'GEN';
  const prefijoCategoria = categoriaNombre.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase() || 'XX';
  let sku: string;
  do {
    const numero = Math.floor(10000 + Math.random() * 90000);
    sku = `${prefijoMarca}-${prefijoCategoria}-${numero}`;
  } while (db.prepare('SELECT 1 FROM productos WHERE sku = ?').get(sku));
  return sku;
}

// Regla 7: pantalones 1–15, el resto XS–XL; regla 6: vestidos sin talla ('Única').
function normalizarTalla(categoria: CategoriaRow, tallaInput: string | null | undefined): string | null {
  if (categoria.tipo_talla === 'sin_talla') return 'Única';
  const opciones = TALLAS_POR_TIPO[categoria.tipo_talla] as readonly string[];
  if (!tallaInput || !opciones.includes(tallaInput)) {
    throw new ValidationError('Selecciona una talla válida para esta categoría');
  }
  return tallaInput;
}

// Regla 6: solo los vestidos llevan descuento automático de producto (10 %, $100 o $40).
function normalizarDescuentoVestido(
  categoria: CategoriaRow,
  tipo: TipoDescuento | null | undefined,
  valor: number | null | undefined,
) {
  if (categoria.tipo_talla !== 'sin_talla' || tipo == null || valor == null) {
    return { descuentoTipo: null as TipoDescuento | null, descuentoValor: null as number | null };
  }
  const valido = DESCUENTOS_VESTIDO.some((d) => d.tipo === tipo && d.valor === valor);
  if (!valido) {
    throw new ValidationError('El descuento de vestido debe ser 10%, $100 o $40');
  }
  return { descuentoTipo: tipo, descuentoValor: valor };
}

export interface FiltrosProducto {
  busqueda?: string;
  categoriaId?: number;
}

export function listar(db: Database.Database, filtros: FiltrosProducto = {}) {
  const condiciones = ['activo = 1'];
  const params: Record<string, unknown> = {};
  if (filtros.categoriaId) {
    condiciones.push('categoria_id = @categoriaId');
    params.categoriaId = filtros.categoriaId;
  }
  if (filtros.busqueda) {
    condiciones.push('(nombre LIKE @busqueda OR marca LIKE @busqueda OR sku LIKE @busqueda)');
    params.busqueda = `%${filtros.busqueda}%`;
  }
  const filas = db
    .prepare(`SELECT * FROM productos WHERE ${condiciones.join(' AND ')} ORDER BY nombre`)
    .all(params) as ProductoRow[];
  return filas.map(aPublico);
}

export interface CrearProductoInput {
  nombre: string;
  marca: string;
  categoriaId: number;
  talla?: string;
  precio: number;
  cantidad?: number; // >1 = alta por lote (HU-2.2)
  descuentoTipo?: TipoDescuento;
  descuentoValor?: number;
}

export function crear(db: Database.Database, input: CrearProductoInput, actorId: number) {
  const nombre = input.nombre?.trim();
  const marca = input.marca?.trim();
  if (!nombre) throw new ValidationError('Captura el nombre del producto');
  if (!marca) throw new ValidationError('Captura la marca');
  if (!Number.isFinite(input.precio) || input.precio <= 0) {
    throw new ValidationError('Captura un precio válido');
  }
  const cantidad = input.cantidad ?? 1;
  if (!Number.isInteger(cantidad) || cantidad < 1) {
    throw new ValidationError('La cantidad debe ser un entero mayor a 0');
  }

  const categoria = buscarCategoria(db, input.categoriaId);
  const talla = normalizarTalla(categoria, input.talla);
  const descuento = normalizarDescuentoVestido(categoria, input.descuentoTipo, input.descuentoValor);
  const sku = generarSku(db, marca, categoria.nombre);

  const result = db
    .prepare(
      `INSERT INTO productos (sku, nombre, marca, categoria_id, talla, precio, stock, descuento_tipo, descuento_valor)
       VALUES (@sku, @nombre, @marca, @categoriaId, @talla, @precio, @stock, @descuentoTipo, @descuentoValor)`,
    )
    .run({
      sku,
      nombre,
      marca,
      categoriaId: categoria.id,
      talla,
      precio: input.precio,
      stock: cantidad,
      descuentoTipo: descuento.descuentoTipo,
      descuentoValor: descuento.descuentoValor,
    });

  registrarAuditoria(db, {
    usuarioId: actorId,
    accion: 'producto.crear',
    entidad: 'producto',
    entidadId: Number(result.lastInsertRowid),
    detalle: { sku, nombre, cantidad },
  });

  return aPublico(
    db.prepare('SELECT * FROM productos WHERE id = ?').get(result.lastInsertRowid) as ProductoRow,
  );
}

export interface CrearLotePorTallasInput {
  nombre: string;
  marca: string;
  categoriaId: number;
  precio: number;
  cantidades: Record<string, number>;
  descuentoTipo?: TipoDescuento;
  descuentoValor?: number;
}

// Alta rápida para prendas idénticas salvo talla (ej. mismo pantalón en varias
// tallas): una fila/SKU por talla, todas con el mismo nombre/marca/precio/descuento.
export function crearLotePorTallas(
  db: Database.Database,
  input: CrearLotePorTallasInput,
  actorId: number,
) {
  const nombre = input.nombre?.trim();
  const marca = input.marca?.trim();
  if (!nombre) throw new ValidationError('Captura el nombre del producto');
  if (!marca) throw new ValidationError('Captura la marca');
  if (!Number.isFinite(input.precio) || input.precio <= 0) {
    throw new ValidationError('Captura un precio válido');
  }

  const categoria = buscarCategoria(db, input.categoriaId);
  if (categoria.tipo_talla === 'sin_talla') {
    throw new ValidationError('Esta categoría no maneja tallas');
  }
  const descuento = normalizarDescuentoVestido(categoria, input.descuentoTipo, input.descuentoValor);

  const entradas = Object.entries(input.cantidades ?? {}).filter(([, cantidad]) => cantidad > 0);
  if (entradas.length === 0) {
    throw new ValidationError('Captura al menos una cantidad por talla');
  }
  for (const [talla, cantidad] of entradas) {
    normalizarTalla(categoria, talla);
    if (!Number.isInteger(cantidad) || cantidad < 1) {
      throw new ValidationError(`Cantidad inválida para la talla ${talla}`);
    }
  }

  const ejecutar = db.transaction(() =>
    entradas.map(([talla, cantidad]) => {
      const sku = generarSku(db, marca, categoria.nombre);
      const result = db
        .prepare(
          `INSERT INTO productos (sku, nombre, marca, categoria_id, talla, precio, stock, descuento_tipo, descuento_valor)
           VALUES (@sku, @nombre, @marca, @categoriaId, @talla, @precio, @stock, @descuentoTipo, @descuentoValor)`,
        )
        .run({
          sku,
          nombre,
          marca,
          categoriaId: categoria.id,
          talla,
          precio: input.precio,
          stock: cantidad,
          descuentoTipo: descuento.descuentoTipo,
          descuentoValor: descuento.descuentoValor,
        });

      registrarAuditoria(db, {
        usuarioId: actorId,
        accion: 'producto.crear',
        entidad: 'producto',
        entidadId: Number(result.lastInsertRowid),
        detalle: { sku, nombre, talla, cantidad },
      });

      return aPublico(
        db.prepare('SELECT * FROM productos WHERE id = ?').get(result.lastInsertRowid) as ProductoRow,
      );
    }),
  );

  return ejecutar();
}

export interface EditarProductoInput {
  nombre?: string;
  marca?: string;
  precio?: number;
  stock?: number;
  talla?: string;
  categoriaId?: number;
  descuentoTipo?: TipoDescuento | null;
  descuentoValor?: number | null;
}

export function editar(
  db: Database.Database,
  id: number,
  cambios: EditarProductoInput,
  actorId: number,
) {
  const actual = buscarProductoActivo(db, id);

  const nombre = cambios.nombre !== undefined ? cambios.nombre.trim() : actual.nombre;
  const marca = cambios.marca !== undefined ? cambios.marca.trim() : actual.marca;
  const precio = cambios.precio !== undefined ? cambios.precio : actual.precio;
  const stock = cambios.stock !== undefined ? cambios.stock : actual.stock;
  if (!nombre) throw new ValidationError('Captura el nombre del producto');
  if (!marca) throw new ValidationError('Captura la marca');
  if (!Number.isFinite(precio) || precio <= 0) {
    throw new ValidationError('Captura un precio válido');
  }
  if (!Number.isInteger(stock) || stock < 0) {
    throw new ValidationError('Captura una cantidad de inventario válida');
  }

  const categoriaActual = buscarCategoria(db, actual.categoria_id);
  // La categoría solo se puede mover a otra con el mismo tipo de talla: así
  // la talla ya guardada sigue siendo válida sin tener que volver a elegirla,
  // y no hace falta decidir qué pasa si el tipo de talla cambiara a mitad
  // de la edición (p. ej. de pantalón numérico a sin_talla).
  let categoriaDestino = categoriaActual;
  if (cambios.categoriaId !== undefined && cambios.categoriaId !== actual.categoria_id) {
    const nuevaCategoria = buscarCategoria(db, cambios.categoriaId);
    if (nuevaCategoria.tipo_talla !== categoriaActual.tipo_talla) {
      throw new ValidationError('Solo puedes mover el producto a una categoría con el mismo tipo de talla');
    }
    categoriaDestino = nuevaCategoria;
  }

  const talla =
    cambios.talla !== undefined ? normalizarTalla(categoriaDestino, cambios.talla) : actual.talla;

  const tocaDescuento = cambios.descuentoTipo !== undefined || cambios.descuentoValor !== undefined;
  const descuento = tocaDescuento
    ? normalizarDescuentoVestido(categoriaDestino, cambios.descuentoTipo, cambios.descuentoValor)
    : { descuentoTipo: actual.descuento_tipo, descuentoValor: actual.descuento_valor };

  db.prepare(
    `UPDATE productos SET nombre=@nombre, marca=@marca, precio=@precio, stock=@stock,
       talla=@talla, categoria_id=@categoriaId,
       descuento_tipo=@descuentoTipo, descuento_valor=@descuentoValor, updated_at=datetime('now')
     WHERE id=@id`,
  ).run({
    id,
    nombre,
    marca,
    precio,
    stock,
    talla,
    categoriaId: categoriaDestino.id,
    descuentoTipo: descuento.descuentoTipo,
    descuentoValor: descuento.descuentoValor,
  });

  const detalleCambios = {
    ...(stock !== actual.stock ? { stockAnterior: actual.stock, stockNuevo: stock } : {}),
    ...(talla !== actual.talla ? { tallaAnterior: actual.talla, tallaNueva: talla } : {}),
    ...(categoriaDestino.id !== actual.categoria_id
      ? { categoriaAnteriorId: actual.categoria_id, categoriaNuevaId: categoriaDestino.id }
      : {}),
  };
  registrarAuditoria(db, {
    usuarioId: actorId,
    accion: 'producto.editar',
    entidad: 'producto',
    entidadId: id,
    detalle: Object.keys(detalleCambios).length > 0 ? detalleCambios : undefined,
  });

  return aPublico(db.prepare('SELECT * FROM productos WHERE id = ?').get(id) as ProductoRow);
}

export function eliminar(db: Database.Database, id: number, actorId: number) {
  buscarProductoActivo(db, id);

  const apartadoActivo = db
    .prepare(
      `SELECT COUNT(*) AS n FROM apartados a
       JOIN venta_lineas vl ON vl.venta_id = a.venta_id
       WHERE vl.producto_id = ? AND a.estado = 'activo'`,
    )
    .get(id) as { n: number };
  if (apartadoActivo.n > 0) {
    throw new ValidationError('No puedes eliminar un producto con apartados activos');
  }

  db.prepare("UPDATE productos SET activo = 0, updated_at = datetime('now') WHERE id = ?").run(id);
  registrarAuditoria(db, {
    usuarioId: actorId,
    accion: 'producto.eliminar',
    entidad: 'producto',
    entidadId: id,
  });
}
