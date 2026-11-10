import type { Producto } from '@crystal/shared';
import type { ModeloCatalogo } from '../features/productos/agrupar';

const formatoMXN = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

/**
 * Al tocar en Venta un modelo con varias tallas, pide cuál se lleva el
 * cliente. Cada botón muestra la existencia de esa talla; las agotadas se ven
 * pero no se pueden elegir. En categorías por color, una sección por color.
 */
export function SelectorTalla({
  modelo,
  onElegir,
  onCerrar,
}: {
  modelo: ModeloCatalogo;
  onElegir: (producto: Producto) => void;
  onCerrar: () => void;
}) {
  const porColor = new Map<string, Producto[]>();
  for (const v of modelo.variantes) {
    const color = v.color ?? '';
    porColor.set(color, [...(porColor.get(color) ?? []), v]);
  }

  return (
    <div
      onClick={onCerrar}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10,10,12,.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        zIndex: 100,
      }}
    >
      <div
        role="dialog"
        aria-label={`Elegir talla de ${modelo.base.nombre}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 400,
          maxWidth: '100%',
          maxHeight: '90%',
          overflowY: 'auto',
          background: 'var(--surface)',
          borderRadius: 14,
          padding: 22,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div>
          <div style={{ font: '700 16px/1.3 var(--font-ui)', color: 'var(--text)' }}>{modelo.base.nombre}</div>
          <div style={{ font: '400 12px/1.4 var(--font-ui)', color: 'var(--muted)' }}>
            {modelo.base.marca} · {formatoMXN.format(modelo.base.precio)} · elige la talla
          </div>
        </div>

        {[...porColor.entries()].map(([color, variantes]) => (
          <div key={color} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {color && (
              <div style={{ font: '600 13px/1.2 var(--font-ui)', color: 'var(--text)' }}>{color}</div>
            )}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))',
                gap: 8,
              }}
            >
              {variantes.map((v) => {
                const agotada = v.stock === 0;
                return (
                  <button
                    key={v.id}
                    type="button"
                    disabled={agotada}
                    aria-label={`Talla ${v.talla}${color ? ` ${color}` : ''} · ${v.stock} disponibles`}
                    onClick={() => onElegir(v)}
                    style={{
                      minHeight: 56,
                      borderRadius: 9,
                      border: '1px solid var(--border2)',
                      background: agotada ? 'var(--chip)' : 'var(--surface)',
                      color: agotada ? 'var(--faint)' : 'var(--text)',
                      cursor: agotada ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      padding: '6px 4px',
                    }}
                  >
                    <span style={{ font: '700 15px/1 var(--font-mono)' }}>{v.talla}</span>
                    <span
                      style={{
                        font: '500 10.5px/1 var(--font-mono)',
                        color: agotada ? 'var(--badtext)' : v.stock <= 5 ? 'var(--warntext)' : 'var(--muted)',
                      }}
                    >
                      {agotada ? 'agotada' : `${v.stock} u`}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={onCerrar}
          style={{
            height: 44,
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
