import { nombreConColor } from '@crystal/shared';
import type { MetodoPago } from '@crystal/shared';
import { useEffect } from 'react';
import type { LineaCarritoCalculada } from '../features/ventas/useCarrito';
import { DATOS_NEGOCIO, LEYENDA_APARTADOS, LEYENDA_PROBADA } from '../lib/datosNegocio';
import styles from './Ticket.module.css';

const formatoMXN = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const formatoFechaHora = new Intl.DateTimeFormat('es-MX', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const ETIQUETA_METODO: Record<MetodoPago, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
};

export interface VentaParaTicket {
  folio: string;
  total: number;
  metodoPago: MetodoPago;
  efectivoRecibido: number | null;
  cambio: number;
  comisionMonto: number;
}

export function TicketModal({
  venta,
  lineas,
  vendedorNombre,
  onListo,
}: {
  venta: VentaParaTicket;
  lineas: LineaCarritoCalculada[];
  vendedorNombre: string;
  onListo: () => void;
}) {
  // HU-3.6: imprime al abrir el modal, sin esperar una acción extra del
  // vendedor — "Confirmar e imprimir ticket" ya implica que se imprime aquí.
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
        // reposiciona .recibo-imprimible a 48 mm sin depender de él.
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

        <div className={styles.folio}>Folio #{venta.folio}</div>
        <div className={styles.titulo}>Venta completada</div>
        <div className={styles.fechaAtendio}>
          {formatoFechaHora.format(new Date())} · Atendió: {vendedorNombre}
        </div>
        <div className={styles.metaTexto}>
          Método: {ETIQUETA_METODO[venta.metodoPago]} · Comisión acreditada:{' '}
          {formatoMXN.format(venta.comisionMonto)}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {lineas.map(({ linea, resultado }) => (
            <div
              key={linea.producto.id}
              className={styles.lineaProducto}
              style={{ paddingBottom: 8, borderBottom: '1px dashed var(--border2)' }}
            >
              <span>
                {linea.cantidad} × {nombreConColor(linea.producto.nombre, linea.producto.color)}
                {linea.probado ? ' · P' : ''}
              </span>
              <span className={styles.lineaImporte}>{formatoMXN.format(resultado.importeLinea)}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span className={styles.totalLabel}>Total cobrado</span>
          <span className={styles.totalValor}>{formatoMXN.format(venta.total)}</span>
        </div>

        {venta.metodoPago === 'efectivo' && (
          <div className={styles.notaCambio}>
            Recibido {formatoMXN.format(venta.efectivoRecibido ?? 0)} · Cambio{' '}
            {formatoMXN.format(venta.cambio)}
          </div>
        )}

        <div className={styles.separador} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {lineas.some(({ linea }) => linea.probado) && (
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
