import type { MetodoPago } from '@crystal/shared';
import { useEffect } from 'react';
import type { LineaTicket } from '../features/tickets/api';
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
  /** null = no se muestra (reimpresión de la venta de otra persona). */
  comisionMonto: number | null;
}

export function TicketModal({
  venta,
  lineas,
  vendedorNombre,
  fechaOriginal,
  onListo,
}: {
  venta: VentaParaTicket;
  lineas: LineaTicket[];
  vendedorNombre: string;
  /** Presente = reimpresión de un ticket anterior, con la fecha en que se vendió. */
  fechaOriginal?: Date;
  onListo: () => void;
}) {
  // HU-3.6: imprime al abrir el modal, sin esperar una acción extra del
  // vendedor — "Confirmar e imprimir ticket" ya implica que se imprime aquí.
  // Al reimprimir no: primero se revisa en pantalla si es el ticket correcto.
  useEffect(() => {
    if (!fechaOriginal) window.print();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          maxHeight: '100%',
          overflowY: 'auto',
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
          {formatoFechaHora.format(fechaOriginal ?? new Date())} · Atendió: {vendedorNombre}
        </div>
        {fechaOriginal && (
          <div className={styles.metaTexto}>Reimpresión: {formatoFechaHora.format(new Date())}</div>
        )}
        <div className={styles.metaTexto}>
          Método: {ETIQUETA_METODO[venta.metodoPago]}
          {venta.comisionMonto !== null && ` · Comisión acreditada: ${formatoMXN.format(venta.comisionMonto)}`}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {lineas.map((linea, i) => (
            <div
              key={i}
              className={styles.lineaProducto}
              style={{ paddingBottom: 8, borderBottom: '1px dashed var(--border2)' }}
            >
              <span>
                {linea.cantidad} × {linea.nombre}
                {linea.probado ? ' · P' : ''}
                {linea.cambio && (
                  <div className={styles.notaCambio}>
                    Cambiada por {linea.cambio.nombre}
                    {linea.cambio.diferencia > 0 && ` (+${formatoMXN.format(linea.cambio.diferencia)})`}
                  </div>
                )}
              </span>
              <span className={styles.lineaImporte}>{formatoMXN.format(linea.importe)}</span>
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
          {lineas.some((l) => l.probado) && (
            <div className={styles.leyenda}>{LEYENDA_PROBADA}</div>
          )}
          <div className={styles.leyenda}>{LEYENDA_APARTADOS}</div>
        </div>

        <button
          type="button"
          className={fechaOriginal ? styles.btnPrimario : styles.btnSecundario}
          onClick={() => window.print()}
        >
          {fechaOriginal ? 'Reimprimir' : 'Imprimir de nuevo'}
        </button>

        <button
          type="button"
          className={fechaOriginal ? styles.btnSecundario : styles.btnPrimario}
          onClick={onListo}
        >
          {fechaOriginal ? 'Cerrar' : 'Listo'}
        </button>
      </div>
    </div>
  );
}
