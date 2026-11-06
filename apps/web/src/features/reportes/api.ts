import { apiDownload, apiFetch } from '../../lib/apiClient';

export type Periodo = 'mes' | 'trimestre' | 'anio';

export interface Kpis {
  rangoInicio: string;
  rangoFin: string;
  ventasTotales: number;
  ventasTotalesVsAnteriorPct: number | null;
  tickets: number;
  ticketPromedio: number;
  comisionesPorPagar: number;
  apartadosVencidos: number;
  apartadosMontoPenalizado: number;
}

export interface PuntoTendencia {
  etiqueta: string;
  monto: number;
}

export interface VendedorReporte {
  id: number;
  nombre: string;
  ini: string;
  rol: 'admin' | 'vendedor';
  tickets: number;
  ingreso: number;
  tasaComision: number;
  comisionMonto: number;
}

export interface Reporte {
  periodo: Periodo;
  kpis: Kpis;
  tendencia: PuntoTendencia[];
  vendedores: VendedorReporte[];
}

export function obtenerReporte(periodo: Periodo) {
  return apiFetch<Reporte>(`/api/reportes?periodo=${periodo}`);
}

export function exportarVendedoresCsv(periodo: Periodo) {
  return apiDownload(`/api/reportes/export/vendedores.csv?periodo=${periodo}`, `comisiones-${periodo}.csv`);
}
