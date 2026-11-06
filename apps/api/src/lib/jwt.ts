import jwt from 'jsonwebtoken';
import type { Rol } from '@crystal/shared';

const SECRET = process.env.JWT_SECRET ?? 'dev-secret-cambiar-en-produccion';

// Sesión expira a los 20 min de inactividad: cada request autenticado
// reemite un token con la ventana renovada (ver middleware/auth.ts).
export const SESION_TTL_SEGUNDOS = 20 * 60;

export interface SesionPayload {
  sub: number;
  rol: Rol;
  nombre: string;
}

export function emitirToken(payload: SesionPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: SESION_TTL_SEGUNDOS });
}

export function verificarToken(token: string): SesionPayload {
  const decoded = jwt.verify(token, SECRET) as unknown as SesionPayload;
  // Solo los campos propios de la sesión: si se reenvía el payload completo
  // a emitirToken(), jsonwebtoken rechaza volver a firmar porque ya trae
  // `exp`/`iat` (choca con la opción `expiresIn`).
  return { sub: decoded.sub, rol: decoded.rol, nombre: decoded.nombre };
}
