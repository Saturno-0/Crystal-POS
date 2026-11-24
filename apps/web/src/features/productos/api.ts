import type { Categoria, Producto, TipoDescuento, TipoTalla } from '@crystal/shared';
import { apiFetch } from '../../lib/apiClient';

export function listarCategorias() {
  return apiFetch<Categoria[]>('/api/categorias');
}

export function crearCategoria(input: { nombre: string; tipoTalla: TipoTalla; porColor?: boolean }) {
  return apiFetch<Categoria>('/api/categorias', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function eliminarCategoria(id: number) {
  return apiFetch<void>(`/api/categorias/${id}`, { method: 'DELETE' });
}

export interface FiltrosProducto {
  busqueda?: string;
  categoriaId?: number;
}

export function listarProductos(filtros: FiltrosProducto = {}) {
  const params = new URLSearchParams();
  if (filtros.busqueda) params.set('busqueda', filtros.busqueda);
  if (filtros.categoriaId) params.set('categoriaId', String(filtros.categoriaId));
  const query = params.toString();
  return apiFetch<Producto[]>(`/api/productos${query ? `?${query}` : ''}`);
}

export interface CrearProductoInput {
  nombre: string;
  marca: string;
  categoriaId: number;
  talla?: string;
  color?: string;
  precio: number;
  cantidad?: number;
  descuentoTipo?: TipoDescuento;
  descuentoValor?: number;
}

/** Producto resultante de un alta: `reabastecido` = ya existía y se sumó a su stock. */
export interface ProductoDadoDeAlta extends Producto {
  reabastecido: boolean;
  stockAnterior: number;
}

export function crearProducto(input: CrearProductoInput) {
  return apiFetch<ProductoDadoDeAlta>('/api/productos', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** Talla/color ya registrado de una prenda (aunque esté agotado) y su precio actual. */
export interface ProductoExistente {
  talla: string | null;
  color: string | null;
  precio: number;
}

export function listarExistentes(datos: { nombre: string; marca: string; categoriaId: number }) {
  const params = new URLSearchParams({
    nombre: datos.nombre,
    marca: datos.marca,
    categoriaId: String(datos.categoriaId),
  });
  return apiFetch<ProductoExistente[]>(`/api/productos/existentes?${params.toString()}`);
}

/** Cantidad por talla y, solo en las que difieren del precio general, su precio. */
export interface DistribucionTallas {
  cantidades: Record<string, number>;
  precios: Record<string, number>;
}

export interface FilaColor extends DistribucionTallas {
  color: string;
}

export interface CrearLotePorTallasInput {
  nombre: string;
  marca: string;
  categoriaId: number;
  precio: number;
  cantidades?: Record<string, number>;
  precios?: Record<string, number>;
  porColor?: FilaColor[];
  descuentoTipo?: TipoDescuento;
  descuentoValor?: number;
}

export function crearLotePorTallas(input: CrearLotePorTallasInput) {
  return apiFetch<ProductoDadoDeAlta[]>('/api/productos/lote-tallas', {
    method: 'POST',
    body: JSON.stringify(input),
  });
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

export function editarProducto(id: number, input: EditarProductoInput) {
  return apiFetch<Producto>(`/api/productos/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function eliminarProducto(id: number) {
  return apiFetch<void>(`/api/productos/${id}`, { method: 'DELETE' });
}

export interface FilaImportada {
  fila: number;
  nombre: string;
  marca: string;
  categoria: string;
  talla: string;
  color: string;
  cantidad: number | null;
  estado: 'nueva' | 'suma' | 'error';
  error?: string;
}

export interface ResultadoImportacion {
  aplicado: boolean;
  resumen: { total: number; nuevas: number; sumas: number; errores: number };
  filas: FilaImportada[];
}

/** `aplicar: false` solo valida y devuelve la vista previa; no guarda nada. */
export function importarCsv(csv: string, aplicar: boolean) {
  return apiFetch<ResultadoImportacion>('/api/productos/importar', {
    method: 'POST',
    body: JSON.stringify({ csv, aplicar }),
  });
}
