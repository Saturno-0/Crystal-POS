import type { MetodoPago } from '@crystal/shared';
import { useEffect } from 'react';
import type { LineaCarritoCalculada } from '../features/ventas/useCarrito';
import { DATOS_NEGOCIO, LEYENDA_APARTADOS, LEYENDA_PROBADA } from '../lib/datosNegocio';

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
        display: 'grid',
        placeItems: 'center',
        padding: 24,
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
          <div style={{ font: "700 17px/1.2 var(--font-ui)" }}>{DATOS_NEGOCIO.nombre}</div>
          <div style={{ font: "400 10.5px/1.4 var(--font-ui)", color: 'var(--muted)' }}>
            {DATOS_NEGOCIO.direccion}
          </div>
          <div style={{ font: "400 10.5px/1.4 var(--font-ui)", color: 'var(--muted)' }}>
            IG {DATOS_NEGOCIO.instagram} · FB {DATOS_NEGOCIO.facebook}
          </div>
        </div>
        <div style={{ borderTop: '1px dashed var(--border2)' }} />

        <div
          style={{
            alignSelf: 'flex-start',
            background: 'var(--oksoft)',
            color: 'var(--oktext)',
            borderRadius: 6,
            padding: '4px 8px',
            font: "700 11px/1 var(--font-mono)",
          }}
        >
          Folio #{venta.folio}
        </div>
        <div style={{ font: "700 19px/1.2 var(--font-ui)" }}>Venta completada</div>
        <div style={{ font: "400 11.5px/1.4 var(--font-mono)", color: 'var(--muted)' }}>
          {formatoFechaHora.format(new Date())} · Atendió: {vendedorNombre}
        </div>
        <div style={{ font: "400 12.5px/1.4 var(--font-ui)", color: 'var(--muted)' }}>
          Método: {ETIQUETA_METODO[venta.metodoPago]} · Comisión acreditada:{' '}
          {formatoMXN.format(venta.comisionMonto)}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {lineas.map(({ linea, resultado }) => (
            <div
              key={linea.producto.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 8,
                paddingBottom: 8,
                borderBottom: '1px dashed var(--border2)',
                font: "400 12.5px/1.4 var(--font-ui)",
              }}
            >
              <span>
                {linea.cantidad} × {linea.producto.nombre}
                {linea.probado ? ' · P' : ''}
              </span>
              <span style={{ font: "600 12.5px/1 var(--font-mono)" }}>
                {formatoMXN.format(resultado.importeLinea)}
              </span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ font: "600 13px/1 var(--font-ui)" }}>Total cobrado</span>
          <span style={{ font: "700 22px/1 var(--font-mono)" }}>{formatoMXN.format(venta.total)}</span>
        </div>

        {venta.metodoPago === 'efectivo' && (
          <div style={{ font: "400 12px/1.4 var(--font-ui)", color: 'var(--muted)' }}>
            Recibido {formatoMXN.format(venta.efectivoRecibido ?? 0)} · Cambio{' '}
            {formatoMXN.format(venta.cambio)}
          </div>
        )}

        <div style={{ borderTop: '1px dashed var(--border2)' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {lineas.some(({ linea }) => linea.probado) && (
            <div style={{ font: "400 10px/1.4 var(--font-ui)", color: 'var(--muted)' }}>
              {LEYENDA_PROBADA}
            </div>
          )}
          <div style={{ font: "400 10px/1.4 var(--font-ui)", color: 'var(--muted)' }}>
            {LEYENDA_APARTADOS}
          </div>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          style={{
            height: 40,
            border: '1px solid var(--border2)',
            borderRadius: 9,
            background: 'var(--surface)',
            color: 'var(--text)',
            font: "600 13px/1 var(--font-ui)",
            cursor: 'pointer',
          }}
        >
          Imprimir de nuevo
        </button>

        <button
          type="button"
          onClick={onListo}
          style={{
            height: 48,
            border: 'none',
            borderRadius: 9,
            background: 'var(--primary)',
            color: 'var(--pfg)',
            font: "600 15px/1 var(--font-ui)",
            cursor: 'pointer',
          }}
        >
          Listo
        </button>
      </div>
    </div>
  );
}
