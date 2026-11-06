import { Router } from 'express';
import { db } from '../db/client.js';
import { handleError } from '../lib/errors.js';
import { authenticate } from '../middleware/auth.js';
import * as apartadosService from '../services/apartados.service.js';

const router = Router();

// Apartados: Admin y Vendedor operan por igual (crear, liquidar, penalizar, prorrogar).
router.get('/', authenticate, (_req, res) => {
  res.json(apartadosService.listarActivos(db));
});

router.post('/', authenticate, (req, res) => {
  try {
    const apartado = apartadosService.crear(db, req.body ?? {}, req.sesion!.sub);
    res.status(201).json(apartado);
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/:id/liquidar', authenticate, (req, res) => {
  try {
    const resultado = apartadosService.liquidar(db, Number(req.params.id), req.sesion!.sub);
    res.json(resultado);
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/:id/penalizar', authenticate, (req, res) => {
  try {
    const resultado = apartadosService.penalizar(db, Number(req.params.id), req.sesion!.sub);
    res.json(resultado);
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/:id/extender', authenticate, (req, res) => {
  try {
    const resultado = apartadosService.extenderPlazo(db, Number(req.params.id), req.sesion!.sub);
    res.json(resultado);
  } catch (err) {
    handleError(res, err);
  }
});

export default router;
