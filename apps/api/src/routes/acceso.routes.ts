import { networkInterfaces } from 'node:os';
import { Router } from 'express';

const router = Router();

// Rangos de red local privada (RFC 1918): la IP con la que un celular en el
// Wi-Fi de la tienda llega a esta laptop.
function esIpPrivada(ip: string): boolean {
  return /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);
}

/**
 * Público (sin sesión): lo usa el QR de la pantalla de inicio de sesión para
 * que el personal abra el sistema desde su celular. Solo expone IPs de la red
 * local, que cualquiera en ese Wi-Fi ya podría ver.
 */
router.get('/', (_req, res) => {
  const ips = Object.values(networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal && esIpPrivada(i.address))
    .map((i) => i!.address)
    // 192.168.x.x primero: es lo típico de un router doméstico (Megacable).
    .sort((a, b) => Number(b.startsWith('192.168.')) - Number(a.startsWith('192.168.')));
  res.json({ ips: [...new Set(ips)] });
});

export default router;
