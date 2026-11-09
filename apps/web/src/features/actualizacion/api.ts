import { apiFetch } from '../../lib/apiClient';

export type EstadoActualizacion = 'inactivo' | 'en_progreso' | 'completado' | 'error';

export interface InfoActualizacion {
  estado: EstadoActualizacion;
  pasoActual: string | null;
  log: string[];
  iniciadoEn: string | null;
  terminadoEn: string | null;
}

export function obtenerEstadoActualizacion() {
  return apiFetch<InfoActualizacion>('/api/actualizacion');
}

export function iniciarActualizacion() {
  return apiFetch<InfoActualizacion>('/api/actualizacion', { method: 'POST' });
}
