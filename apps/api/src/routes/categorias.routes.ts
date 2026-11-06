import { Router } from 'express';
import { db } from '../db/client.js';
import { handleError } from '../lib/errors.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import * as categoriasService from '../services/categorias.service.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json(categoriasService.listar(db));
});

router.post('/', authenticate, requireRole('admin'), (req, res) => {
  try {
    const categoria = categoriasService.crear(db, req.body ?? {}, req.sesion!.sub);
    res.status(201).json(categoria);
  } catch (err) {
    handleError(res, err);
  }
});

router.delete('/:id', authenticate, requireRole('admin'), (req, res) => {
  try {
    categoriasService.eliminar(db, Number(req.params.id), req.sesion!.sub);
    res.status(204).end();
  } catch (err) {
    handleError(res, err);
  }
});

export default router;
