import { Router } from 'express';
import { db } from '../db/client.js';
import { handleError } from '../lib/errors.js';
import { emitirToken } from '../lib/jwt.js';
import { authenticate } from '../middleware/auth.js';
import * as usuariosService from '../services/usuarios.service.js';

const router = Router();

router.post('/login', (req, res) => {
  const { usuarioId, nip } = req.body ?? {};
  if (typeof usuarioId !== 'number' || typeof nip !== 'string') {
    return res.status(400).json({ error: 'Datos inválidos' });
  }
  try {
    const usuario = usuariosService.login(db, usuarioId, nip);
    const token = emitirToken({ sub: usuario.id, rol: usuario.rol, nombre: usuario.nombre });
    res.json({ usuario, token });
  } catch (err) {
    handleError(res, err);
  }
});

// Cambio de usuario dentro de una sesión activa (HU-1.3 / docs/README.md § 6):
// hacia un Vendedor no se vuelve a pedir NIP (cambio de turno rápido en una
// terminal compartida); hacia un Admin sí se exige su NIP.
router.post('/switch', authenticate, (req, res) => {
  const { usuarioId, nip } = req.body ?? {};
  if (typeof usuarioId !== 'number') {
    return res.status(400).json({ error: 'Datos inválidos' });
  }
  try {
    const usuario = usuariosService.prepararCambioSesion(db, usuarioId, nip);
    const token = emitirToken({ sub: usuario.id, rol: usuario.rol, nombre: usuario.nombre });
    res.json({ usuario, token });
  } catch (err) {
    handleError(res, err);
  }
});

// Renueva la sesión sin otra acción de negocio (ver AuthContext.tsx en el
// front): el middleware `authenticate` ya reemite X-Renewed-Token en toda
// request autenticada, así que esta ruta solo le da al cliente algo barato
// que llamar cuando hay actividad real del usuario pero ninguna otra
// llamada a la API en curso (p. ej. armando una venta en el carrito).
router.post('/heartbeat', authenticate, (_req, res) => {
  res.status(204).end();
});

router.post('/recuperar-nip', (req, res) => {
  const { usuario, respuestaSeguridad, nuevoNip } = req.body ?? {};
  if (
    typeof usuario !== 'string' ||
    typeof respuestaSeguridad !== 'string' ||
    typeof nuevoNip !== 'string'
  ) {
    return res.status(400).json({ error: 'Datos inválidos' });
  }
  try {
    usuariosService.resetNipConPregunta(db, usuario, respuestaSeguridad, nuevoNip);
    res.status(204).end();
  } catch (err) {
    handleError(res, err);
  }
});

export default router;
