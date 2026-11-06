import { Router } from 'express';
import { db } from '../db/client.js';
import * as cambiosService from '../services/cambios.service.js';
import { handleError } from '../lib/errors.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Cambio por otra prenda: Admin y Vendedor operan por igual, como en apartados.
router.get('/venta/:folio', authenticate, (req, res) => {
  try {
    res.json(cambiosService.buscarVentaParaCambio(db, req.params.folio));
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/', authenticate, (req, res) => {
  try {
    const cambio = cambiosService.crear(db, req.body ?? {}, req.sesion!.sub);
    res.status(201).json(cambio);
  } catch (err) {
    handleError(res, err);
  }
});

export default router;
