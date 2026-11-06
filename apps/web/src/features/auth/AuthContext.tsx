import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { setAuthToken, setTokenRenewedListener } from '../../lib/apiClient';
import * as authApi from './api';
import type { UsuarioSesion } from './types';

const STORAGE_KEY = 'hilo.sesion';

interface SesionGuardada {
  token: string;
  usuario: UsuarioSesion;
}

function decodificarExpiracion(token: string): number | null {
  try {
    const [, payload] = token.split('.');
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof json.exp === 'number' ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

function leerSesionGuardada(): SesionGuardada | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const sesion = JSON.parse(raw) as SesionGuardada;
    const exp = decodificarExpiracion(sesion.token);
    if (exp && exp < Date.now()) return null;
    return sesion;
  } catch {
    return null;
  }
}

interface AuthContextValue {
  usuario: UsuarioSesion | null;
  iniciarSesion: (usuarioId: number, nip: string) => Promise<UsuarioSesion>;
  cambiarUsuarioActivo: (usuarioId: number, nip?: string) => Promise<UsuarioSesion>;
  cerrarSesion: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<SesionGuardada | null>(() => leerSesionGuardada());

  const guardar = useCallback((nueva: SesionGuardada | null) => {
    setSesion(nueva);
    setAuthToken(nueva?.token ?? null);
    if (nueva) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(nueva));
    else sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  // Al montar, aplica el token restaurado al cliente HTTP.
  useEffect(() => {
    setAuthToken(sesion?.token ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sesión deslizante: cada respuesta autenticada trae un token renovado
  // (20 min desde la última actividad); lo persistimos para no perderlo.
  useEffect(() => {
    setTokenRenewedListener((token) => {
      setSesion((actual) => {
        if (!actual) return actual;
        const actualizada = { ...actual, token };
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(actualizada));
        return actualizada;
      });
    });
    return () => setTokenRenewedListener(null);
  }, []);

  // Cierra sesión sola si el token expiró por inactividad (20 min).
  useEffect(() => {
    if (!sesion) return undefined;
    const exp = decodificarExpiracion(sesion.token);
    if (!exp) return undefined;
    const restante = exp - Date.now();
    if (restante <= 0) {
      guardar(null);
      return undefined;
    }
    const timeout = setTimeout(() => guardar(null), restante);
    return () => clearTimeout(timeout);
  }, [sesion, guardar]);

  const iniciarSesion = useCallback(
    async (usuarioId: number, nip: string) => {
      const { usuario, token } = await authApi.login(usuarioId, nip);
      guardar({ usuario, token });
      return usuario;
    },
    [guardar],
  );

  const cambiarUsuarioActivo = useCallback(
    async (usuarioId: number, nip?: string) => {
      const { usuario, token } = await authApi.cambiarSesion(usuarioId, nip);
      guardar({ usuario, token });
      return usuario;
    },
    [guardar],
  );

  const cerrarSesion = useCallback(() => guardar(null), [guardar]);

  const value = useMemo(
    () => ({
      usuario: sesion?.usuario ?? null,
      iniciarSesion,
      cambiarUsuarioActivo,
      cerrarSesion,
    }),
    [sesion, iniciarSesion, cambiarUsuarioActivo, cerrarSesion],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
