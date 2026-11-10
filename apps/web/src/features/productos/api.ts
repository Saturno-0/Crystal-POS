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

export function crearProducto(input: CrearProductoInput) {
  return apiFetch<Producto>('/api/productos', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export interface FilaColor {
  color: string;
  cantidades: Record<string, number>;
}

export interface CrearLotePorTallasInput {
  nombre: string;
  marca: string;
  categoriaId: number;
  precio: number;
  cantidades?: Record<string, number>;
  porColor?: FilaColor[];
  descuentoTipo?: TipoDescuento;
  descuentoValor?: number;
}

export function crearLotePorTallas(input: CrearLotePorTallasInput) {
  return apiFetch<Producto[]>('/api/productos/lote-tallas', {
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
