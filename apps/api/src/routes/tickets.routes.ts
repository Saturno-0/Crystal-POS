import { Router } from 'express';
import { db } from '../db/client.js';
import { handleError } from '../lib/errors.js';
import { authenticate } from '../middleware/auth.js';
import * as ticketsService from '../services/tickets.service.js';

const router = Router();

// Historial para reimprimir: Admin y Vendedor por igual, como en apartados y cambios.
router.get('/', authenticate, (_req, res) => {
  try {
    res.json(ticketsService.listar(db));
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/:folio', authenticate, (req, res) => {
  try {
    res.json(ticketsService.obtener(db, req.params.folio, req.sesion!));
  } catch (err) {
    handleError(res, err);
  }
});

export default router;
