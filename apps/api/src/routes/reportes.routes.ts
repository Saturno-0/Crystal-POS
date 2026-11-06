import { Router } from 'express';
import { db } from '../db/client.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import * as reportesService from '../services/reportes.service.js';

const router = Router();

// Reportes: solo Admin (HU-1.6).
router.get('/', authenticate, requireRole('admin'), (req, res) => {
  res.json(reportesService.generarReporte(db, req.query.periodo));
});

router.get('/export/vendedores.csv', authenticate, requireRole('admin'), (req, res) => {
  const csv = reportesService.exportarVendedoresCsv(db, req.query.periodo);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="comisiones.csv"');
  res.send(csv);
});

export default router;
