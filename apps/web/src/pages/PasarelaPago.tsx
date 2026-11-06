import type { MetodoPago } from '@crystal/shared';
import { useState } from 'react';

const formatoMXN = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const DESCUENTO_PAGO = 15;

const METODOS: { key: MetodoPago; label: string }[] = [
  { key: 'efectivo', label: 'Efectivo' },
  { key: 'transferencia', label: 'Transferencia' },
  { key: 'tarjeta', label: 'Tarjeta' },
];

export function PasarelaPago({
  totalArticulos,
  onConfirmar,
  onCancelar,
}: {
  totalArticulos: number;
  onConfirmar: (metodoPago: MetodoPago, efectivoRecibido?: number) => Promise<void>;
  onCancelar: () => void;
}) {
  const [metodo, setMetodo] = useState<MetodoPago | null>(null);
  const [recibidoInput, setRecibidoInput] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const aplicaDescuentoPago = metodo === 'efectivo' || metodo === 'transferencia';
  const totalFinal = Math.max(0, totalArticulos - (aplicaDescuentoPago ? DESCUENTO_PAGO : 0));
  const recibido = Number(recibidoInput) || 0;
  const cambio = metodo === 'efectivo' ? Math.max(0, recibido - totalFinal) : 0;

  async function confirmar() {
    if (!metodo || enviando) return;
    if (metodo === 'efectivo' && recibido < totalFinal) {
      setError('El efectivo recibido es menor al total a cobrar');
      return;
    }
    setError('');
    setEnviando(true);
    try {
      await onConfirmar(metodo, metodo === 'efectivo' ? recibido : undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo procesar el cobro.');
    } finally {
      setEnviando(false);
    }
  }

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
        style={{
          width: 400,
          maxWidth: '100%',
          background: 'var(--surface)',
          borderRadius: 14,
          padding: 22,
          display: 'flex',
          flexDirection: 'column',
          gap: 13,
        }}
      >
        <div>
          <div style={{ font: "700 20px/1.2 var(--font-ui)" }}>Pasarela de pago</div>
          <div style={{ font: "400 13px/1.4 var(--font-ui)", color: 'var(--muted)' }}>
            Elige cómo paga el cliente antes de imprimir el ticket.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {METODOS.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => {
                setMetodo(m.key);
                setError('');
              }}
              style={{
                flex: 1,
                height: 40,
                borderRadius: 8,
                border: metodo === m.key ? '1.5px solid var(--primary)' : '1px solid var(--border2)',
                background: metodo === m.key ? 'var(--psoft)' : 'var(--surface)',
                color: metodo === m.key ? 'var(--ptext)' : 'var(--text)',
                font: "600 13px/1 var(--font-ui)",
                cursor: 'pointer',
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        {aplicaDescuentoPago && (
          <div style={{ font: "500 12.5px/1.4 var(--font-ui)", color: 'var(--ptext)' }}>
            Descuento por método de pago: −{formatoMXN.format(DESCUENTO_PAGO)}
          </div>
        )}

        {metodo === 'efectivo' && (
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ font: "500 11.5px/1 var(--font-ui)", color: 'var(--muted)' }}>
                Efectivo recibido
              </label>
              <input
                value={recibidoInput}
                onChange={(e) => {
                  setRecibidoInput(e.target.value.replace(/[^0-9.]/g, ''));
                  setError('');
                }}
                inputMode="decimal"
                style={{
                  height: 42,
                  borderRadius: 8,
                  border: '1px solid var(--primary)',
                  padding: '0 10px',
                  font: "600 14px/1 var(--font-mono)",
                  outline: 'none',
                }}
              />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ font: "500 11.5px/1 var(--font-ui)", color: 'var(--muted)' }}>Cambio</label>
              <div
                style={{
                  height: 42,
                  borderRadius: 8,
                  border: '1px solid var(--border2)',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 10px',
                  font: "600 14px/1 var(--font-mono)",
                  color: 'var(--oktext)',
                }}
              >
                {formatoMXN.format(cambio)}
              </div>
            </div>
          </div>
        )}

        {error && (
          <div
            style={{
              background: 'var(--badsoft)',
              border: '1px solid var(--bad)',
              color: 'var(--badtext)',
              borderRadius: 8,
              padding: '8px 10px',
              font: "500 11.5px/1.4 var(--font-ui)",
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            paddingTop: 8,
            borderTop: '1px dashed var(--border2)',
          }}
        >
          <span style={{ font: "500 13px/1 var(--font-ui)" }}>El vendedor recibe</span>
          <span style={{ font: "700 22px/1 var(--font-mono)" }}>{formatoMXN.format(totalFinal)}</span>
        </div>

        <button
          type="button"
          onClick={confirmar}
          disabled={!metodo || enviando}
          style={{
            height: 48,
            border: 'none',
            borderRadius: 9,
            background: metodo ? 'var(--primary)' : 'var(--chip)',
            color: metodo ? 'var(--pfg)' : 'var(--faint)',
            font: "600 15px/1 var(--font-ui)",
            cursor: metodo ? 'pointer' : 'not-allowed',
          }}
        >
          Confirmar e imprimir ticket
        </button>
        <button
          type="button"
          onClick={onCancelar}
          style={{ border: 'none', background: 'transparent', color: 'var(--muted)', font: "500 13px/1 var(--font-ui)", cursor: 'pointer' }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
