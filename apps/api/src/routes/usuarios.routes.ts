import { Router } from 'express';
import { db } from '../db/client.js';
import { handleError } from '../lib/errors.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import * as usuariosService from '../services/usuarios.service.js';

const router = Router();

// Pública: la pantalla de login necesita listar usuarios antes de autenticar.
router.get('/', (_req, res) => {
  res.json(usuariosService.listar(db));
});

router.post('/', authenticate, requireRole('admin'), (req, res) => {
  try {
    const usuario = usuariosService.crear(db, req.body ?? {});
    res.status(201).json(usuario);
  } catch (err) {
    handleError(res, err);
  }
});

router.patch('/:id', authenticate, requireRole('admin'), (req, res) => {
  try {
    const usuario = usuariosService.actualizarPerfil(
      db,
      Number(req.params.id),
      req.body ?? {},
      req.sesion!.sub,
    );
    res.json(usuario);
  } catch (err) {
    handleError(res, err);
  }
});

router.patch('/:id/rol', authenticate, requireRole('admin'), (req, res) => {
  try {
    const usuario = usuariosService.cambiarRol(
      db,
      Number(req.params.id),
      req.body?.rol,
      req.sesion!.sub,
    );
    res.json(usuario);
  } catch (err) {
    handleError(res, err);
  }
});

router.patch('/:id/comision', authenticate, requireRole('admin'), (req, res) => {
  try {
    const usuario = usuariosService.cambiarComision(
      db,
      Number(req.params.id),
      Number(req.body?.tasaComision),
      req.sesion!.sub,
    );
    res.json(usuario);
  } catch (err) {
    handleError(res, err);
  }
});

router.patch('/:id/nip', authenticate, requireRole('admin'), (req, res) => {
  try {
    usuariosService.cambiarNip(db, Number(req.params.id), req.body?.nip, req.sesion!.sub);
    res.status(204).end();
  } catch (err) {
    handleError(res, err);
  }
});

router.delete('/:id', authenticate, requireRole('admin'), (req, res) => {
  try {
    usuariosService.darDeBaja(db, Number(req.params.id), req.sesion!.sub);
    res.status(204).end();
  } catch (err) {
    handleError(res, err);
  }
});

export default router;
