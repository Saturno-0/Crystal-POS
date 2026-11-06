import type { MetodoPago, TipoDescuento } from '@crystal/shared';
import { apiFetch } from '../../lib/apiClient';

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

export interface VentaCreada {
  id: number;
  folio: string;
  total: number;
  subtotalBruto: number;
  descuentoArticulos: number;
  descuentoPago: number;
  cambio: number;
  comisionMonto: number;
  metodoPago: MetodoPago;
  efectivoRecibido: number | null;
}

export function crearVentaDirecta(input: CrearVentaDirectaInput) {
  return apiFetch<VentaCreada>('/api/ventas', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
