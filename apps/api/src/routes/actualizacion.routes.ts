import { Router } from 'express';
import { dbPath } from '../db/client.js';
import { handleError, ValidationError } from '../lib/errors.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import * as actualizacionService from '../services/actualizacion.service.js';

const router = Router();

// Actualización del sistema: solo Admin.
router.get('/', authenticate, requireRole('admin'), (_req, res) => {
  res.json(actualizacionService.obtenerEstado(dbPath));
});

router.post('/', authenticate, requireRole('admin'), (_req, res) => {
  if (actualizacionService.obtenerEstado(dbPath).estado === 'en_progreso') {
    return handleError(res, new ValidationError('Ya hay una actualización en curso'));
  }
  // No se espera: corre en segundo plano, el frontend sondea GET /.
  void actualizacionService.ejecutarActualizacion(dbPath);
  res.status(202).json(actualizacionService.obtenerEstado(dbPath));
});

export default router;
