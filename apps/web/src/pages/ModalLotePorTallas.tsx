import { useState } from 'react';
import type { FilaColor } from '../features/productos/api';
import { SelectorColor } from './SelectorColor';

type Cantidades = Record<string, number>;

function sumar(cantidades: Cantidades): number {
  return Object.values(cantidades).reduce((acc, n) => acc + (n || 0), 0);
}

function sinCeros(cantidades: Cantidades): Cantidades {
  return Object.fromEntries(Object.entries(cantidades).filter(([, n]) => n > 0));
}

/** Cuadrícula de 2 columnas: chip de talla + campo de cantidad (máx. 3 cifras). */
function CuadriculaTallas({
  tallas,
  cantidades,
  etiqueta,
  onCambio,
}: {
  tallas: readonly string[];
  cantidades: Cantidades;
  etiqueta: (talla: string) => string;
  onCambio: (cantidades: Cantidades) => void;
}) {
  function setCantidad(talla: string, valorCrudo: string) {
    const valor = valorCrudo.replace(/[^0-9]/g, '').slice(0, 3);
    onCambio({ ...cantidades, [talla]: valor === '' ? 0 : Number(valor) });
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
      {tallas.map((talla) => (
        <div key={talla} style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
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
            aria-label={etiqueta(talla)}
            value={cantidades[talla] ? String(cantidades[talla]) : ''}
            onChange={(e) => setCantidad(talla, e.target.value)}
            inputMode="numeric"
            maxLength={3}
            placeholder="0"
            style={{
              // Máximo 3 cifras: ancho fijo chico en vez de estirarse.
              width: 64,
              minWidth: 0,
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
  );
}

/**
 * Alta de varias cantidades a la vez. Sin `porColor`: una cantidad por talla.
 * Con `porColor` (sacos, pantalones de vestir): se agregan colores y cada uno
 * lleva su propia cuadrícula de tallas; cada color × talla es un SKU.
 */
export function ModalLotePorTallas({
  tallas,
  porColor = false,
  enviando,
  onConfirmar,
  onConfirmarPorColor,
  onCerrar,
}: {
  tallas: readonly string[];
  porColor?: boolean;
  enviando?: boolean;
  onConfirmar?: (cantidades: Cantidades) => void;
  onConfirmarPorColor?: (filas: FilaColor[]) => void;
  onCerrar: () => void;
}) {
  const [cantidades, setCantidades] = useState<Cantidades>({});
  const [filas, setFilas] = useState<FilaColor[]>([]);

  const total = porColor ? filas.reduce((acc, f) => acc + sumar(f.cantidades), 0) : sumar(cantidades);

  function agregarColor(color: string) {
    setFilas((prev) => (prev.some((f) => f.color === color) ? prev : [...prev, { color, cantidades: {} }]));
  }

  function quitarColor(color: string) {
    setFilas((prev) => prev.filter((f) => f.color !== color));
  }

  function cambiarFila(color: string, nuevas: Cantidades) {
    setFilas((prev) => prev.map((f) => (f.color === color ? { ...f, cantidades: nuevas } : f)));
  }

  function confirmar() {
    if (total === 0) return;
    if (porColor) {
      onConfirmarPorColor?.(
        filas
          .map((f) => ({ color: f.color, cantidades: sinCeros(f.cantidades) }))
          .filter((f) => Object.keys(f.cantidades).length > 0),
      );
    } else {
      onConfirmar?.(sinCeros(cantidades));
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10,10,12,.55)',
        // Flex (no grid + placeItems): con grid la pista se ensancha al
        // width fijo de la tarjeta y maxWidth:100% nunca la limita en móvil.
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
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
          {porColor ? 'Cantidad por color y talla' : 'Cantidad por talla'}
        </div>
        <div style={{ font: '400 12px/1.4 var(--font-ui)', color: 'var(--muted)' }}>
          {porColor
            ? 'Agrega cada color y captura cuántas piezas hay de cada talla. Nombre, marca y precio ya capturados arriba se aplican a todas. Lo que quede en 0 no se da de alta.'
            : 'Captura cuántas piezas hay de cada talla. Nombre, marca, precio y descuento ya capturados arriba se aplican a todas. Las tallas en 0 no se dan de alta.'}
        </div>

        {porColor ? (
          <>
            {filas.map((fila) => (
              <div
                key={fila.color}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  padding: 12,
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ flex: 1, font: '700 14px/1.3 var(--font-ui)', color: 'var(--text)' }}>
                    {fila.color}
                  </span>
                  <span style={{ font: '500 12px/1 var(--font-ui)', color: 'var(--muted)' }}>
                    {sumar(fila.cantidades)} pzas
                  </span>
                  <button
                    type="button"
                    aria-label={`Quitar color ${fila.color}`}
                    onClick={() => quitarColor(fila.color)}
                    style={{
                      width: 44,
                      height: 44,
                      border: 'none',
                      borderRadius: 8,
                      background: 'transparent',
                      color: 'var(--badtext)',
                      font: '600 18px/1 var(--font-ui)',
                      cursor: 'pointer',
                    }}
                  >
                    ×
                  </button>
                </div>
                <CuadriculaTallas
                  tallas={tallas}
                  cantidades={fila.cantidades}
                  etiqueta={(t) => `Cantidad ${fila.color} talla ${t}`}
                  onCambio={(nuevas) => cambiarFila(fila.color, nuevas)}
                />
              </div>
            ))}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ font: '600 12px/1 var(--font-ui)', color: 'var(--muted)' }}>
                {filas.length === 0 ? 'Elige el primer color' : 'Agregar otro color'}
              </div>
              <SelectorColor
                excluir={filas.map((f) => f.color)}
                textoBoton="Agregar"
                onElegir={agregarColor}
              />
            </div>
          </>
        ) : (
          <CuadriculaTallas
            tallas={tallas}
            cantidades={cantidades}
            etiqueta={(t) => `Cantidad talla ${t}`}
            onCambio={setCantidades}
          />
        )}

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
