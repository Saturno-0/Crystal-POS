import type { NextFunction, Request, Response } from 'express';
import type { Rol } from '@crystal/shared';
import { emitirToken, verificarToken, type SesionPayload } from '../lib/jwt.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      sesion?: SesionPayload;
    }
  }
}

/**
 * Exige un token válido. Si es válido, reemite uno nuevo con la ventana de
 * 20 min renovada (expiración por inactividad, no por tiempo absoluto) y lo
 * expone en el header `X-Renewed-Token` para que el cliente lo reemplace.
 */
export function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  try {
    const sesion = verificarToken(token);
    req.sesion = sesion;
    res.setHeader('X-Renewed-Token', emitirToken(sesion));
    next();
  } catch {
    return res.status(401).json({ error: 'Sesión expirada' });
  }
}

export function requireRole(...roles: Rol[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.sesion || !roles.includes(req.sesion.rol)) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    next();
  };
}
