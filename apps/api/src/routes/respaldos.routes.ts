import { Router } from 'express';
import { db, dbPath } from '../db/client.js';
import { handleError } from '../lib/errors.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import * as respaldosService from '../services/respaldos.service.js';

const router = Router();

// Respaldos: solo Admin (HU-6.5).
router.get('/', authenticate, requireRole('admin'), (_req, res) => {
  res.json(respaldosService.listarRespaldos(dbPath));
});

router.post('/', authenticate, requireRole('admin'), async (_req, res) => {
  try {
    const respaldo = await respaldosService.ejecutarRespaldo(db, dbPath);
    res.status(201).json(respaldo);
  } catch (err) {
    handleError(res, err);
  }
});

export default router;
