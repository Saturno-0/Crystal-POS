import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/apiClient';
import styles from './AccesoQr.module.css';

const HOSTS_LOCALES = ['localhost', '127.0.0.1', '::1', '[::1]'];

/**
 * Dirección con la que un celular en el Wi-Fi de la tienda abre el sistema.
 * Si esta pantalla ya se abrió por la IP de la red, es esa misma; si se abrió
 * en la laptop como "localhost" (que en un celular no sirve), se pide a la API
 * la IP de la laptop en la red local. Mismo puerto: en producción la API sirve
 * también la web (ver CLAUDE.md, "Mismo origen siempre").
 */
async function direccionParaCelular(): Promise<string | null> {
  const { protocol, hostname, port, origin } = window.location;
  if (!HOSTS_LOCALES.includes(hostname)) return origin;
  const { ips } = await apiFetch<{ ips: string[] }>('/api/acceso');
  if (ips.length === 0) return null;
  return `${protocol}//${ips[0]}${port ? `:${port}` : ''}`;
}

/** QR para que el personal entre desde su celular (panel junto al login). */
export function AccesoQr() {
  const [url, setUrl] = useState<string | null>(null);
  const [svg, setSvg] = useState('');

  useEffect(() => {
    let vigente = true;
    direccionParaCelular()
      .then(async (direccion) => {
        if (!vigente || !direccion) return;
        // Se genera aquí mismo (sin servicios externos): funciona sin internet.
        const codigo = await QRCode.toString(direccion, {
          type: 'svg',
          margin: 1,
          errorCorrectionLevel: 'M',
        });
        if (!vigente) return;
        setUrl(direccion);
        setSvg(codigo);
      })
      .catch(() => undefined);
    return () => {
      vigente = false;
    };
  }, []);

  if (!url) return null;

  return (
    <aside className={styles.panel} aria-label="Entrar desde el celular">
      <div className={styles.titulo}>Entra desde tu celular</div>
      {/* Fondo blanco fijo (también en modo oscuro): el lector del celular
          necesita módulos oscuros sobre claro. */}
      <div className={styles.qr} dangerouslySetInnerHTML={{ __html: svg }} />
      <div className={styles.url}>{url.replace(/^https?:\/\//, '')}</div>
      <div className={styles.nota}>
        Escanéalo con la cámara. El celular debe estar conectado al Wi-Fi de la tienda.
      </div>
    </aside>
  );
}
