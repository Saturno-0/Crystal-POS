import type Database from 'better-sqlite3';
import {
  COLOR_MAX_CARACTERES,
  DESCUENTOS_VESTIDO,
  TALLAS_POR_TIPO,
  normalizarColor,
  type TipoDescuento,
  type TipoTalla,
} from '@crystal/shared';
import { NotFoundError, ValidationError } from '../lib/errors.js';
import { registrar as registrarAuditoria } from './auditoria.service.js';

interface CategoriaRow {
  id: number;
  nombre: string;
  tipo_talla: TipoTalla;
  por_color: number;
}

interface ProductoRow {
  id: number;
  sku: string;
  nombre: string;
  marca: string;
  categoria_id: number;
  talla: string | null;
  color: string | null;
  precio: number;
  stock: number;
  vendidos: number;
  descuento_tipo: TipoDescuento | null;
  descuento_valor: number | null;
  activo: number;
  created_at: string;
}

function aPublico(row: ProductoRow) {
  return {
    id: row.id,
    sku: row.sku,
    nombre: row.nombre,
    marca: row.marca,
    categoriaId: row.categoria_id,
    talla: row.talla,
    color: row.color,
    precio: row.precio,
    stock: row.stock,
    vendidos: row.vendidos,
    descuentoTipo: row.descuento_tipo,
    descuentoValor: row.descuento_valor,
    activo: row.activo === 1,
    createdAt: row.created_at,
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

// Categorías por color (sacos, pantalones de vestir): color obligatorio.
// El resto no guarda color (regla 1: sin variantes de color).
function normalizarColorProducto(categoria: CategoriaRow, colorInput: string | null | undefined): string | null {
  if (categoria.por_color !== 1) return null;
  const color = normalizarColor(colorInput);
  if (!color) throw new ValidationError('Captura el color del producto');
  if (color.length > COLOR_MAX_CARACTERES) {
    throw new ValidationError(`El color no puede pasar de ${COLOR_MAX_CARACTERES} caracteres`);
  }
  return color;
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

// Para reconocer una prenda que ya existe al darla de alta otra vez: sin
// importar mayúsculas, acentos ni espacios de más ("Pantalón  Slim" = "pantalon slim").
function claveTexto(texto: string | null): string {
  return (texto ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('es-MX')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// Mismo nombre, marca, categoría, talla y color = la misma prenda. Incluye
// productos agotados o eliminados (activo = 0): al volver a llegar se reusan
// en vez de crear un duplicado. Prefiere uno activo, y el más reciente.
function buscarExistente(
  db: Database.Database,
  datos: { nombre: string; marca: string; categoriaId: number; talla: string | null; color: string | null },
): ProductoRow | undefined {
  const candidatos = db
    .prepare(
      `SELECT * FROM productos WHERE categoria_id = ? AND talla IS ?
       ORDER BY activo DESC, id DESC`,
    )
    .all(datos.categoriaId, datos.talla) as ProductoRow[];
  return candidatos.find(
    (p) =>
      claveTexto(p.nombre) === claveTexto(datos.nombre) &&
      claveTexto(p.marca) === claveTexto(datos.marca) &&
      claveTexto(p.color) === claveTexto(datos.color),
  );
}

interface AltaUnidad {
  nombre: string;
  marca: string;
  categoria: CategoriaRow;
  talla: string | null;
  color: string | null;
  precio: number;
  cantidad: number;
  descuento: { descuentoTipo: TipoDescuento | null; descuentoValor: number | null };
}

/**
 * Da de alta `cantidad` unidades: si la prenda ya existe (ver buscarExistente)
 * suma al stock de ese producto —y lo reactiva si estaba eliminado— en lugar
 * de crear otro SKU. El precio y descuento quedan con lo capturado en esta alta.
 */
function darDeAlta(db: Database.Database, alta: AltaUnidad, actorId: number) {
  const existente = buscarExistente(db, {
    nombre: alta.nombre,
    marca: alta.marca,
    categoriaId: alta.categoria.id,
    talla: alta.talla,
    color: alta.color,
  });

  if (existente) {
    db.prepare(
      `UPDATE productos SET stock = stock + @cantidad, precio = @precio,
         descuento_tipo = @descuentoTipo, descuento_valor = @descuentoValor,
         activo = 1, updated_at = datetime('now')
       WHERE id = @id`,
    ).run({ id: existente.id, cantidad: alta.cantidad, precio: alta.precio, ...alta.descuento });
    registrarAuditoria(db, {
      usuarioId: actorId,
      accion: 'producto.reabastecer',
      entidad: 'producto',
      entidadId: existente.id,
      detalle: {
        sku: existente.sku,
        cantidad: alta.cantidad,
        stockAnterior: existente.stock,
        ...(existente.precio !== alta.precio
          ? { precioAnterior: existente.precio, precioNuevo: alta.precio }
          : {}),
        ...(existente.activo === 0 ? { reactivado: true } : {}),
      },
    });
    return {
      ...aPublico(db.prepare('SELECT * FROM productos WHERE id = ?').get(existente.id) as ProductoRow),
      reabastecido: true,
      stockAnterior: existente.activo === 1 ? existente.stock : 0,
    };
  }

  const sku = generarSku(db, alta.marca, alta.categoria.nombre);
  const result = db
    .prepare(
      `INSERT INTO productos (sku, nombre, marca, categoria_id, talla, color, precio, stock, descuento_tipo, descuento_valor)
       VALUES (@sku, @nombre, @marca, @categoriaId, @talla, @color, @precio, @stock, @descuentoTipo, @descuentoValor)`,
    )
    .run({
      sku,
      nombre: alta.nombre,
      marca: alta.marca,
      categoriaId: alta.categoria.id,
      talla: alta.talla,
      color: alta.color,
      precio: alta.precio,
      stock: alta.cantidad,
      ...alta.descuento,
    });

  registrarAuditoria(db, {
    usuarioId: actorId,
    accion: 'producto.crear',
    entidad: 'producto',
    entidadId: Number(result.lastInsertRowid),
    detalle: {
      sku,
      nombre: alta.nombre,
      talla: alta.talla,
      cantidad: alta.cantidad,
      ...(alta.color ? { color: alta.color } : {}),
    },
  });

  return {
    ...aPublico(db.prepare('SELECT * FROM productos WHERE id = ?').get(result.lastInsertRowid) as ProductoRow),
    reabastecido: false,
    stockAnterior: 0,
  };
}

export interface FiltrosProducto {
  busqueda?: string;
  categoriaId?: number;
}

export function listar(db: Database.Database, filtros: FiltrosProducto = {}) {
  // Agotados (stock 0) no se listan: ni en Venta ni en Inventario. Siguen en
  // la BD (las ventas los referencian) y reaparecen solos si la unidad
  // regresa (cancelación, penalización) o si se vuelven a dar de alta.
  const condiciones = ['activo = 1', 'stock > 0'];
  const params: Record<string, unknown> = {};
  if (filtros.categoriaId) {
    condiciones.push('categoria_id = @categoriaId');
    params.categoriaId = filtros.categoriaId;
  }
  if (filtros.busqueda) {
    condiciones.push(
      '(nombre LIKE @busqueda OR marca LIKE @busqueda OR sku LIKE @busqueda OR color LIKE @busqueda)',
    );
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
  color?: string;
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
  const color = normalizarColorProducto(categoria, input.color);
  const descuento = normalizarDescuentoVestido(categoria, input.descuentoTipo, input.descuentoValor);

  return db.transaction(() =>
    darDeAlta(db, { nombre, marca, categoria, talla, color, precio: input.precio, cantidad, descuento }, actorId),
  )();
}

export interface CrearLotePorTallasInput {
  nombre: string;
  marca: string;
  categoriaId: number;
  precio: number;
  // Categorías sin color: cantidad por talla.
  cantidades?: Record<string, number>;
  // Categorías por color: una fila de tallas por cada color.
  porColor?: { color: string; cantidades: Record<string, number> }[];
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

  // Una entrada = un SKU: (talla, color, cantidad). Sin color → color null.
  const entradas: { talla: string; color: string | null; cantidad: number }[] = [];
  const agregar = (cantidades: Record<string, number>, color: string | null) => {
    for (const [talla, cantidad] of Object.entries(cantidades ?? {})) {
      if (cantidad === 0) continue;
      normalizarTalla(categoria, talla);
      if (!Number.isInteger(cantidad) || cantidad < 1) {
        throw new ValidationError(
          `Cantidad inválida para la talla ${talla}${color ? ` en color ${color}` : ''}`,
        );
      }
      entradas.push({ talla, color, cantidad });
    }
  };

  if (categoria.por_color === 1) {
    const vistos = new Set<string>();
    for (const fila of input.porColor ?? []) {
      const color = normalizarColorProducto(categoria, fila.color);
      if (vistos.has(color!)) throw new ValidationError(`El color ${color} está repetido`);
      vistos.add(color!);
      agregar(fila.cantidades, color);
    }
  } else {
    agregar(input.cantidades ?? {}, null);
  }
  if (entradas.length === 0) {
    throw new ValidationError(
      categoria.por_color === 1
        ? 'Captura al menos una cantidad por color y talla'
        : 'Captura al menos una cantidad por talla',
    );
  }

  const ejecutar = db.transaction(() =>
    entradas.map(({ talla, color, cantidad }) =>
      darDeAlta(
        db,
        { nombre, marca, categoria, talla, color, precio: input.precio, cantidad, descuento },
        actorId,
      ),
    ),
  );

  return ejecutar();
}

export interface EditarProductoInput {
  nombre?: string;
  marca?: string;
  precio?: number;
  stock?: number;
  talla?: string;
  color?: string;
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
    // Igual con el color: si no, quedaría un color huérfano o faltaría uno.
    if (nuevaCategoria.por_color !== categoriaActual.por_color) {
      throw new ValidationError('Solo puedes mover el producto a una categoría que también maneje color (o que no lo maneje)');
    }
    categoriaDestino = nuevaCategoria;
  }

  const talla =
    cambios.talla !== undefined ? normalizarTalla(categoriaDestino, cambios.talla) : actual.talla;
  const color =
    cambios.color !== undefined ? normalizarColorProducto(categoriaDestino, cambios.color) : actual.color;

  const tocaDescuento = cambios.descuentoTipo !== undefined || cambios.descuentoValor !== undefined;
  const descuento = tocaDescuento
    ? normalizarDescuentoVestido(categoriaDestino, cambios.descuentoTipo, cambios.descuentoValor)
    : { descuentoTipo: actual.descuento_tipo, descuentoValor: actual.descuento_valor };

  db.prepare(
    `UPDATE productos SET nombre=@nombre, marca=@marca, precio=@precio, stock=@stock,
       talla=@talla, color=@color, categoria_id=@categoriaId,
       descuento_tipo=@descuentoTipo, descuento_valor=@descuentoValor, updated_at=datetime('now')
     WHERE id=@id`,
  ).run({
    id,
    nombre,
    marca,
    precio,
    stock,
    talla,
    color,
    categoriaId: categoriaDestino.id,
    descuentoTipo: descuento.descuentoTipo,
    descuentoValor: descuento.descuentoValor,
  });

  const detalleCambios = {
    ...(stock !== actual.stock ? { stockAnterior: actual.stock, stockNuevo: stock } : {}),
    ...(talla !== actual.talla ? { tallaAnterior: actual.talla, tallaNueva: talla } : {}),
    ...(color !== actual.color ? { colorAnterior: actual.color, colorNuevo: color } : {}),
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
