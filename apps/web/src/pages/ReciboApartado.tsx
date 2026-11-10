import { useEffect } from 'react';
import type { ApartadoCreado } from '../features/apartados/api';
import { DATOS_NEGOCIO, LEYENDA_APARTADOS, LEYENDA_PROBADA } from '../lib/datosNegocio';
import styles from './Ticket.module.css';

const formatoMXN = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const formatoFecha = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
const formatoFechaHora = new Intl.DateTimeFormat('es-MX', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function ReciboApartado({
  apartado,
  vendedorNombre,
  onListo,
}: {
  apartado: ApartadoCreado;
  vendedorNombre: string;
  onListo: () => void;
}) {
  // HU-3.6/4.1: "Apartar e imprimir recibo" implica imprimir al llegar aquí.
  useEffect(() => {
    window.print();
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10,10,12,.55)',
        // Flex (no grid + placeItems): con grid la tarjeta de 400 px se sale
        // en móvil. Solo es el contenedor en pantalla: al imprimir, print.css
        // reposiciona .recibo-imprimible a 54 mm sin depender de él.
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        zIndex: 100,
      }}
    >
      <div
        className="recibo-imprimible"
        style={{
          width: 400,
          maxWidth: '100%',
          background: 'var(--surface)',
          borderRadius: 14,
          padding: 22,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div className={styles.negocioNombre}>{DATOS_NEGOCIO.nombre}</div>
          <div className={styles.negocioMeta}>{DATOS_NEGOCIO.direccion}</div>
          <div className={styles.negocioMeta}>
            IG {DATOS_NEGOCIO.instagram} · FB {DATOS_NEGOCIO.facebook}
          </div>
        </div>
        <div className={styles.separador} />

        <div className={styles.folio}>Folio #{apartado.folio}</div>
        <div className={styles.titulo}>Apartado registrado</div>
        <div className={styles.fechaAtendio}>
          {formatoFechaHora.format(new Date())} · Atendió: {vendedorNombre}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {apartado.lineas.map((linea, i) => (
            <div key={i} className={styles.lineaProducto}>
              <span>
                {linea.cantidad} × {linea.nombre}
                {linea.probado ? ' · P' : ''}
              </span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span className={styles.totalLabel}>Abono recibido</span>
          <span className={styles.totalValor}>{formatoMXN.format(apartado.abonoInicial)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span className={styles.totalLabel}>Resta por pagar</span>
          <span className={styles.totalValor}>{formatoMXN.format(apartado.resta)}</span>
        </div>

        <div className={styles.vence}>
          Vence el {formatoFecha.format(new Date(apartado.venceAt.replace(' ', 'T')))}. Si no se liquida,
          la prenda regresa al stock y el abono se penaliza.
        </div>

        <div className={styles.separador} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {apartado.lineas.some((l) => l.probado) && (
            <div className={styles.leyenda}>{LEYENDA_PROBADA}</div>
          )}
          <div className={styles.leyenda}>{LEYENDA_APARTADOS}</div>
        </div>

        <button type="button" className={styles.btnSecundario} onClick={() => window.print()}>
          Imprimir de nuevo
        </button>

        <button type="button" className={styles.btnPrimario} onClick={onListo}>
          Listo
        </button>
      </div>
    </div>
  );
}
