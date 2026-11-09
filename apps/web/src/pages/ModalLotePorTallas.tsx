import { useState } from 'react';

export function ModalLotePorTallas({
  tallas,
  enviando,
  onConfirmar,
  onCerrar,
}: {
  tallas: readonly string[];
  enviando?: boolean;
  onConfirmar: (cantidades: Record<string, number>) => void;
  onCerrar: () => void;
}) {
  const [cantidades, setCantidades] = useState<Record<string, number>>({});

  function setCantidad(talla: string, valorCrudo: string) {
    const valor = valorCrudo.replace(/[^0-9]/g, '');
    setCantidades((prev) => ({ ...prev, [talla]: valor === '' ? 0 : Number(valor) }));
  }

  const total = Object.values(cantidades).reduce((acc, n) => acc + (n || 0), 0);

  function confirmar() {
    const limpio = Object.fromEntries(Object.entries(cantidades).filter(([, n]) => n > 0));
    if (Object.keys(limpio).length === 0) return;
    onConfirmar(limpio);
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
          width: 420,
          maxWidth: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--surface)',
          borderRadius: 14,
          padding: 22,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div style={{ font: '700 16px/1.3 var(--font-ui)', color: 'var(--text)' }}>
          Cantidad por talla
        </div>
        <div style={{ font: '400 12px/1.4 var(--font-ui)', color: 'var(--muted)' }}>
          Captura cuántas piezas hay de cada talla. Nombre, marca, precio y descuento ya
          capturados arriba se aplican a todas. Las tallas en 0 no se dan de alta.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {tallas.map((talla) => (
            <div key={talla} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  flex: 'none',
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: 8,
                  background: 'var(--chip)',
                  color: 'var(--text)',
                  font: '700 13.5px/1 var(--font-mono)',
                }}
              >
                {talla}
              </div>
              <input
                aria-label={`Cantidad talla ${talla}`}
                value={cantidades[talla] ? String(cantidades[talla]) : ''}
                onChange={(e) => setCantidad(talla, e.target.value)}
                inputMode="numeric"
                placeholder="0"
                style={{
                  flex: 1,
                  height: 44,
                  borderRadius: 8,
                  border: '1px solid var(--border2)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  padding: '0 10px',
                  font: '600 15px/1 var(--font-mono)',
                  outline: 'none',
                }}
              />
            </div>
          ))}
        </div>

        <div style={{ font: '600 13px/1 var(--font-ui)', color: 'var(--ptext)', textAlign: 'center' }}>
          Total: {total} {total === 1 ? 'pieza' : 'piezas'}
        </div>

        <button
          type="button"
          disabled={enviando || total === 0}
          onClick={confirmar}
          style={{
            height: 48,
            border: 'none',
            borderRadius: 9,
            background: total === 0 ? 'var(--chip)' : 'var(--primary)',
            color: total === 0 ? 'var(--faint)' : 'var(--pfg)',
            font: '600 15px/1 var(--font-ui)',
            cursor: total === 0 ? 'not-allowed' : 'pointer',
          }}
        >
          {enviando ? 'Guardando…' : `Dar de alta ${total} ${total === 1 ? 'pieza' : 'piezas'}`}
        </button>
        <button
          type="button"
          onClick={onCerrar}
          disabled={enviando}
          style={{
            height: 40,
            border: 'none',
            background: 'transparent',
            color: 'var(--muted)',
            font: '500 12.5px/1 var(--font-ui)',
            cursor: 'pointer',
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
