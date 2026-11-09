import cors from 'cors';
import express from 'express';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, dbPath } from './db/client.js';
import { iniciarRespaldosAutomaticos } from './db/respaldoScheduler.js';
import actualizacionRoutes from './routes/actualizacion.routes.js';
import apartadosRoutes from './routes/apartados.routes.js';
import authRoutes from './routes/auth.routes.js';
import cambiosRoutes from './routes/cambios.routes.js';
import categoriasRoutes from './routes/categorias.routes.js';
import productosRoutes from './routes/productos.routes.js';
import reportesRoutes from './routes/reportes.routes.js';
import respaldosRoutes from './routes/respaldos.routes.js';
import usuariosRoutes from './routes/usuarios.routes.js';
import ventasRoutes from './routes/ventas.routes.js';
import { repararEstadoAlArrancar } from './services/actualizacion.service.js';

const app = express();
app.use(cors({ exposedHeaders: ['X-Renewed-Token'] }));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM sqlite_master WHERE type = ?').get('table') as {
    n: number;
  };
  res.json({ ok: true, tablas: n });
});

app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/categorias', categoriasRoutes);
app.use('/api/productos', productosRoutes);
app.use('/api/ventas', ventasRoutes);
app.use('/api/apartados', apartadosRoutes);
app.use('/api/cambios', cambiosRoutes);
app.use('/api/reportes', reportesRoutes);
app.use('/api/respaldos', respaldosRoutes);
app.use('/api/actualizacion', actualizacionRoutes);

// Producción (laptop de la tienda): servir el build de apps/web desde este
// mismo puerto, para que un celular en la LAN solo necesite
// http://<ip-de-la-laptop>:PORT, sin configurar una segunda URL ni CORS.
// En desarrollo (tsx watch sobre src/, sin build) esta carpeta no existe:
// Vite sirve el frontend aparte en :5173 y le reenvía /api a esta API.
const here = dirname(fileURLToPath(import.meta.url));
const webDist = join(here, '../../web/dist');
if (existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(join(webDist, 'index.html'));
  });
}

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  console.log(`Crystal API escuchando en http://localhost:${port}`);
});

iniciarRespaldosAutomaticos(db, dbPath);
repararEstadoAlArrancar(dbPath);
