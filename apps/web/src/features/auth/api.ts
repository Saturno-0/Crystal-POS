import { apiFetch } from '../../lib/apiClient';
import type { UsuarioSesion } from './types';

export interface LoginResponse {
  usuario: UsuarioSesion;
  token: string;
}

export function listarUsuarios() {
  return apiFetch<UsuarioSesion[]>('/api/usuarios');
}

export function login(usuarioId: number, nip: string) {
  return apiFetch<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ usuarioId, nip }),
  });
}

export function cambiarSesion(usuarioId: number, nip?: string) {
  return apiFetch<LoginResponse>('/api/auth/switch', {
    method: 'POST',
    body: JSON.stringify({ usuarioId, nip }),
  });
}

export function recuperarNip(usuario: string, respuestaSeguridad: string, nuevoNip: string) {
  return apiFetch<void>('/api/auth/recuperar-nip', {
    method: 'POST',
    body: JSON.stringify({ usuario, respuestaSeguridad, nuevoNip }),
  });
}

export interface CrearUsuarioInput {
  nombre: string;
  usuario?: string;
  nip: string;
  tasaComision?: number;
  rol: 'admin' | 'vendedor';
  preguntaSeguridad?: string;
  respuestaSeguridad?: string;
}

export function crearUsuario(input: CrearUsuarioInput) {
  return apiFetch<UsuarioSesion>('/api/usuarios', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function actualizarPerfil(id: number, cambios: { nombre?: string; usuario?: string }) {
  return apiFetch<UsuarioSesion>(`/api/usuarios/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(cambios),
  });
}

export function cambiarRol(id: number, rol: 'admin' | 'vendedor') {
  return apiFetch<UsuarioSesion>(`/api/usuarios/${id}/rol`, {
    method: 'PATCH',
    body: JSON.stringify({ rol }),
  });
}

export function cambiarComision(id: number, tasaComision: number) {
  return apiFetch<UsuarioSesion>(`/api/usuarios/${id}/comision`, {
    method: 'PATCH',
    body: JSON.stringify({ tasaComision }),
  });
}

export function cambiarNip(id: number, nip: string) {
  return apiFetch<void>(`/api/usuarios/${id}/nip`, {
    method: 'PATCH',
    body: JSON.stringify({ nip }),
  });
}

export function darDeBaja(id: number) {
  return apiFetch<void>(`/api/usuarios/${id}`, { method: 'DELETE' });
}
