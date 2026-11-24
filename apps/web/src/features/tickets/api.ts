import type { EstadoApartado, EstadoVenta, MetodoPago, TipoVenta } from '@crystal/shared';
import { apiFetch } from '../../lib/apiClient';

export interface TicketResumen {
  folio: string;
  tipo: TipoVenta;
  estado: EstadoVenta;
  /** ISO en UTC. */
  fecha: string;
  vendedor: string;
  cliente: string | null;
  metodoPago: MetodoPago | null;
  total: number;
  articulos: string[];
}

export interface LineaTicket {
  nombre: string;
  cantidad: number;
  probado: boolean;
  importe: number;
  /** Prenda por la que se cambió después de la venta (regla 10). */
  cambio?: { nombre: string; diferencia: number } | null;
}

export interface TicketDetalle {
  folio: string;
  tipo: TipoVenta;
  estado: EstadoVenta;
  fecha: string;
  vendedor: string;
  metodoPago: MetodoPago | null;
  total: number;
  efectivoRecibido: number | null;
  cambio: number | null;
  /** null = venta de otra persona (solo Admin la ve) o apartado sin liquidar. */
  comisionMonto: number | null;
  lineas: LineaTicket[];
  apartado: {
    abonoInicial: number;
    pagado: number;
    venceAt: string;
    estado: EstadoApartado;
  } | null;
}

export function listarTickets() {
  return apiFetch<TicketResumen[]>('/api/tickets');
}

export function obtenerTicket(folio: string) {
  return apiFetch<TicketDetalle>(`/api/tickets/${encodeURIComponent(folio)}`);
}
