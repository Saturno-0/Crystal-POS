// Por defecto, rutas relativas: en producción la API sirve también el build
// del frontend en el mismo origen/puerto (ver apps/api/src/index.ts), y en
// desarrollo el proxy de Vite (vite.config.ts) reenvía /api a la API. Solo
// hace falta VITE_API_URL si la API vive en otro host/puerto que el que
// sirvió la página — p. ej. una instalación no estándar.
const BASE_URL = import.meta.env.VITE_API_URL ?? '';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

let token: string | null = null;
let onTokenRenewed: ((token: string) => void) | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(nuevoToken: string | null) {
  token = nuevoToken;
}

export function setTokenRenewedListener(callback: ((token: string) => void) | null) {
  onTokenRenewed = callback;
}

/**
 * Se dispara en cualquier 401 real (token ya inválido/expirado — no hay nada
 * que renovar, a diferencia de `X-Renewed-Token`). Antes cada pantalla solo
 * mostraba el mensaje de error ("Sesión expirada") y se quedaba ahí mismo
 * con datos desincronizados; esto fuerza un logout limpio a la pantalla de
 * login sin tener que repetir esa lógica en cada `catch`.
 */
export function setUnauthorizedListener(callback: (() => void) | null) {
  onUnauthorized = callback;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  const renewed = res.headers.get('X-Renewed-Token');
  if (renewed) onTokenRenewed?.(renewed);
  if (res.status === 401) onUnauthorized?.();

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(data?.error ?? 'Error de red', res.status);
  }
  return data as T;
}

/** Descarga un archivo autenticado (p.ej. export CSV) disparando el guardado del navegador. */
export async function apiDownload(path: string, nombreArchivo: string): Promise<void> {
  const headers = new Headers();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(`${BASE_URL}${path}`, { headers });

  const renewed = res.headers.get('X-Renewed-Token');
  if (renewed) onTokenRenewed?.(renewed);
  if (res.status === 401) onUnauthorized?.();

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new ApiError(data?.error ?? 'No se pudo descargar el archivo', res.status);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo;
  enlace.click();
  URL.revokeObjectURL(url);
}
