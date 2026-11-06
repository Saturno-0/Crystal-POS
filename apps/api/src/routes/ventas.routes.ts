import { Router } from 'express';
import { db } from '../db/client.js';
import { handleError } from '../lib/errors.js';
import { authenticate } from '../middleware/auth.js';
import * as ventasService from '../services/ventas.service.js';

const router = Router();

router.post('/', authenticate, (req, res) => {
  try {
    const venta = ventasService.crearVentaDirecta(db, req.body ?? {}, req.sesion!.sub);
    res.status(201).json(venta);
  } catch (err) {
    handleError(res, err);
  }
});

export default router;
