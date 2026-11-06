import { apiFetch } from '../../lib/apiClient';

export interface Respaldo {
  nombre: string;
  tamanoBytes: number;
  creadoEn: string;
}

export function listarRespaldos() {
  return apiFetch<Respaldo[]>('/api/respaldos');
}

export function respaldarAhora() {
  return apiFetch<Respaldo>('/api/respaldos', { method: 'POST' });
}
