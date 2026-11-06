import type { TipoDescuento } from '@crystal/shared';
import { apiFetch } from '../../lib/apiClient';

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

export interface LineaApartadoCreado {
  nombre: string;
  cantidad: number;
  probado: boolean;
}

export interface ApartadoCreado {
  id: number;
  folio: string;
  total: number;
  abonoInicial: number;
  resta: number;
  venceAt: string;
  lineas: LineaApartadoCreado[];
}

export function crearApartado(input: CrearApartadoInput) {
  return apiFetch<ApartadoCreado>('/api/apartados', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export type Salud = 'verde' | 'amarillo' | 'rojo';

export interface ArticuloApartado {
  productoId: number;
  nombre: string;
  cantidad: number;
  probado: number;
}

export interface ApartadoResumen {
  id: number;
  folio: string;
  clienteNombre: string;
  clienteTelefono: string | null;
  total: number;
  pagado: number;
  resto: number;
  venceAt: string;
  salud: Salud;
  diasRestantes: number;
  articulos: ArticuloApartado[];
}

export function listarApartadosActivos() {
  return apiFetch<ApartadoResumen[]>('/api/apartados');
}

export interface LiquidarResultado {
  remanente: number;
  comisionMonto: number;
  total: number;
}

export function liquidarApartado(id: number) {
  return apiFetch<LiquidarResultado>(`/api/apartados/${id}/liquidar`, { method: 'POST' });
}

export interface PenalizarResultado {
  abonoPerdido: number;
  unidades: number;
}

export function penalizarApartado(id: number) {
  return apiFetch<PenalizarResultado>(`/api/apartados/${id}/penalizar`, { method: 'POST' });
}

export function extenderApartado(id: number) {
  return apiFetch<{ venceAnterior: string; venceNuevo: string }>(`/api/apartados/${id}/extender`, {
    method: 'POST',
  });
}
