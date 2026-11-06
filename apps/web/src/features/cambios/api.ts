import type { MetodoPago } from '@crystal/shared';
import { apiFetch } from '../../lib/apiClient';

export interface LineaParaCambio {
  ventaLineaId: number;
  productoId: number;
  nombre: string;
  sku: string;
  talla: string | null;
  cantidad: number;
  precioPagado: number;
  probado: boolean;
  yaCambiada: boolean;
  elegible: boolean;
}

export interface VentaParaCambio {
  folio: string;
  lineas: LineaParaCambio[];
}

export function buscarVentaPorFolio(folio: string) {
  return apiFetch<VentaParaCambio>(`/api/cambios/venta/${encodeURIComponent(folio)}`);
}

export interface CrearCambioInput {
  ventaLineaId: number;
  productoNuevoId: number;
  metodoPago?: MetodoPago;
}

export interface CambioCreado {
  id: number;
  folio: string;
  productoNuevo: { id: number; nombre: string };
  precioPagadoOriginal: number;
  precioNuevo: number;
  diferenciaCobrada: number;
  comisionMonto: number;
}

export function crearCambio(input: CrearCambioInput) {
  return apiFetch<CambioCreado>('/api/cambios', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
