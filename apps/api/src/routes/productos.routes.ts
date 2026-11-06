import { Router } from 'express';
import { db } from '../db/client.js';
import { handleError } from '../lib/errors.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import * as productosService from '../services/productos.service.js';

const router = Router();

// Pública: el catálogo de Venta (HU-2.6) necesita listar/buscar sin exigir login previo a la caja.
router.get('/', (req, res) => {
  const { busqueda, categoriaId } = req.query;
  res.json(
    productosService.listar(db, {
      busqueda: typeof busqueda === 'string' ? busqueda : undefined,
      categoriaId: categoriaId ? Number(categoriaId) : undefined,
    }),
  );
});

// Alta de inventario: tanto Admin como Vendedor pueden dar de alta (HU-2.1/2.2).
router.post('/', authenticate, (req, res) => {
  try {
    const producto = productosService.crear(db, req.body ?? {}, req.sesion!.sub);
    res.status(201).json(producto);
  } catch (err) {
    handleError(res, err);
  }
});

// Editar/eliminar catálogo: solo Admin (HU-2.5).
router.patch('/:id', authenticate, requireRole('admin'), (req, res) => {
  try {
    const producto = productosService.editar(db, Number(req.params.id), req.body ?? {}, req.sesion!.sub);
    res.json(producto);
  } catch (err) {
    handleError(res, err);
  }
});

router.delete('/:id', authenticate, requireRole('admin'), (req, res) => {
  try {
    productosService.eliminar(db, Number(req.params.id), req.sesion!.sub);
    res.status(204).end();
  } catch (err) {
    handleError(res, err);
  }
});

export default router;
