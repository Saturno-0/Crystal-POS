import { claveTexto } from '@crystal/shared';
import { useState } from 'react';
import type { DistribucionTallas, FilaColor, ProductoExistente } from '../features/productos/api';
import { SelectorColor } from './SelectorColor';

type Cantidades = Record<string, number>;
/** Precio por talla tal como se teclea; vacío = usa el precio general. */
type Precios = Record<string, string>;

interface Captura {
  cantidades: Cantidades;
  precios: Precios;
}

const formatoMXN = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

function sumar(cantidades: Cantidades): number {
  return Object.values(cantidades).reduce((acc, n) => acc + (n || 0), 0);
}

function sinCeros(cantidades: Cantidades): Cantidades {
  return Object.fromEntries(Object.entries(cantidades).filter(([, n]) => n > 0));
}

function precioInvalido({ cantidades, precios }: Captura, talla: string): boolean {
  if (!cantidades[talla] || !precios[talla]) return false;
  const n = Number(precios[talla]);
  return !Number.isFinite(n) || n <= 0;
}

function tallasConPrecioInvalido(captura: Captura): string[] {
  return Object.keys(captura.precios).filter((t) => precioInvalido(captura, t));
}

function aDistribucion({ cantidades, precios }: Captura): DistribucionTallas {
  const conPiezas = sinCeros(cantidades);
  return {
    cantidades: conPiezas,
    precios: Object.fromEntries(
      Object.entries(precios)
        .filter(([t, p]) => p !== '' && t in conPiezas)
        .map(([t, p]) => [t, Number(p)]),
    ),
  };
}

/** Cuadrícula de 2 columnas: chip de talla + campo de cantidad (máx. 3 cifras) y,
 * con `conPrecios`, un precio opcional por talla debajo. */
function CuadriculaTallas({
  tallas,
  captura,
  conPrecios,
  precioGeneral,
  prefijo = '',
  onCambio,
}: {
  tallas: readonly string[];
  captura: Captura;
  conPrecios: boolean;
  precioGeneral: number;
  /** Para distinguir las etiquetas accesibles de cada color ("Negro "). */
  prefijo?: string;
  onCambio: (captura: Captura) => void;
}) {
  const { cantidades, precios } = captura;


  function setCantidad(talla: string, valorCrudo: string) {
    const valor = valorCrudo.replace(/[^0-9]/g, '').slice(0, 3);
    onCambio({ ...captura, cantidades: { ...cantidades, [talla]: valor === '' ? 0 : Number(valor) } });
  }

  function setPrecio(talla: string, valorCrudo: string) {
    const valor = valorCrudo.replace(/[^0-9.]/g, '').slice(0, 9);
    onCambio({ ...captura, precios: { ...precios, [talla]: valor } });
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
      {tallas.map((talla) => (
        <div key={talla} style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
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
              aria-label={`Cantidad ${prefijo}talla ${talla}`}
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
          {conPrecios && (
            <input
              aria-label={`Precio ${prefijo}talla ${talla}`}
              value={precios[talla] ?? ''}
              onChange={(e) => setPrecio(talla, e.target.value)}
              inputMode="decimal"
              placeholder={formatoMXN.format(precioGeneral)}
              style={{
                // Igual de ancho que chip + cantidad (44 + 8 + 64).
                width: 116,
                maxWidth: '100%',
                minWidth: 0,
                height: 44,
                borderRadius: 8,
                border: `1px solid ${precioInvalido(captura, talla) ? 'var(--badtext)' : 'var(--border2)'}`,
                background: 'var(--surface)',
                color: 'var(--text)',
                padding: '0 10px',
                font: '600 14px/1 var(--font-mono)',
                outline: 'none',
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Alta de varias cantidades a la vez. Sin `porColor`: una cantidad por talla.
 * Con `porColor` (sacos, pantalones de vestir): se agregan colores y cada uno
 * lleva su propia cuadrícula de tallas; cada color × talla es un SKU.
 * Las tallas que ya existen con un precio distinto al general (`existentes`)
 * llegan con ese precio puesto, para no pisarlo al resurtir.
 */
export function ModalLotePorTallas({
  tallas,
  porColor = false,
  precioGeneral,
  existentes = [],
  enviando,
  onConfirmar,
  onConfirmarPorColor,
  onCerrar,
}: {
  tallas: readonly string[];
  porColor?: boolean;
  precioGeneral: number;
  existentes?: ProductoExistente[];
  enviando?: boolean;
  onConfirmar?: (distribucion: DistribucionTallas) => void;
  onConfirmarPorColor?: (filas: FilaColor[]) => void;
  onCerrar: () => void;
}) {
  const conOtroPrecio = existentes.filter((e) => e.talla && e.precio !== precioGeneral);

  function preciosActuales(color: string | null): Precios {
    return Object.fromEntries(
      conOtroPrecio
        .filter((e) => claveTexto(e.color) === claveTexto(color))
        .map((e) => [e.talla as string, String(e.precio)]),
    );
  }

  const [captura, setCaptura] = useState<Captura>(() => ({
    cantidades: {},
    precios: porColor ? {} : preciosActuales(null),
  }));
  const [filas, setFilas] = useState<(Captura & { color: string })[]>([]);
  const [conPrecios, setConPrecios] = useState(conOtroPrecio.length > 0);
  const [preciosDescartados, setPreciosDescartados] = useState(false);

  const capturas: Captura[] = porColor ? filas : [captura];
  const total = capturas.reduce((acc, c) => acc + sumar(c.cantidades), 0);
  const invalidas = [...new Set(capturas.flatMap(tallasConPrecioInvalido))];
  const bloqueado = total === 0 || invalidas.length > 0;

  function usarPrecioGeneral() {
    setCaptura((prev) => ({ ...prev, precios: {} }));
    setFilas((prev) => prev.map((f) => ({ ...f, precios: {} })));
    setPreciosDescartados(true);
    setConPrecios(false);
  }

  function agregarColor(color: string) {
    const precios = preciosDescartados ? {} : preciosActuales(color);
    setFilas((prev) =>
      prev.some((f) => f.color === color) ? prev : [...prev, { color, cantidades: {}, precios }],
    );
  }

  function quitarColor(color: string) {
    setFilas((prev) => prev.filter((f) => f.color !== color));
  }

  function cambiarFila(color: string, nueva: Captura) {
    setFilas((prev) => prev.map((f) => (f.color === color ? { ...nueva, color } : f)));
  }

  function confirmar() {
    if (bloqueado) return;
    if (porColor) {
      onConfirmarPorColor?.(
        filas
          .map((f) => ({ color: f.color, ...aDistribucion(f) }))
          .filter((f) => Object.keys(f.cantidades).length > 0),
      );
    } else {
      onConfirmar?.(aDistribucion(captura));
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
            ? 'Agrega cada color y captura cuántas piezas hay de cada talla. Nombre y marca ya capturados arriba se aplican a todas. Lo que quede en 0 no se da de alta.'
            : 'Captura cuántas piezas hay de cada talla. Nombre, marca y descuento ya capturados arriba se aplican a todas. Las tallas en 0 no se dan de alta.'}
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
                  captura={fila}
                  conPrecios={conPrecios}
                  precioGeneral={precioGeneral}
                  prefijo={`${fila.color} `}
                  onCambio={(nueva) => cambiarFila(fila.color, nueva)}
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
            captura={captura}
            conPrecios={conPrecios}
            precioGeneral={precioGeneral}
            onCambio={setCaptura}
          />
        )}

        {conPrecios && (
          <div style={{ font: '400 12px/1.4 var(--font-ui)', color: 'var(--muted)' }}>
            {conOtroPrecio.length > 0 && !preciosDescartados
              ? `Esta prenda ya tiene tallas con otro precio y se conserva el que tienen. Si dejas vacío el precio de una talla, se usa ${formatoMXN.format(precioGeneral)}.`
              : `Captura solo el precio de las tallas que cuestan distinto; las vacías usan ${formatoMXN.format(precioGeneral)}.`}
          </div>
        )}
        <button
          type="button"
          onClick={conPrecios ? usarPrecioGeneral : () => setConPrecios(true)}
          style={{
            minHeight: 44,
            border: '1px solid var(--border2)',
            borderRadius: 9,
            background: 'transparent',
            color: 'var(--text)',
            font: '600 13px/1.2 var(--font-ui)',
            cursor: 'pointer',
          }}
        >
          {conPrecios
            ? `Usar ${formatoMXN.format(precioGeneral)} en todas`
            : 'Poner otro precio a algunas tallas'}
        </button>

        {invalidas.length > 0 && (
          <div role="alert" style={{ font: '600 12.5px/1.4 var(--font-ui)', color: 'var(--badtext)' }}>
            Precio inválido en talla {invalidas.join(', ')}
          </div>
        )}

        <div style={{ font: '600 13px/1 var(--font-ui)', color: 'var(--ptext)', textAlign: 'center' }}>
          Total: {total} {total === 1 ? 'pieza' : 'piezas'}
        </div>

        <button
          type="button"
          disabled={enviando || bloqueado}
          onClick={confirmar}
          style={{
            height: 48,
            // Si el contenido no cabe, que haga scroll el modal, no que se encoja el botón.
            flex: 'none',
            border: 'none',
            borderRadius: 9,
            background: bloqueado ? 'var(--chip)' : 'var(--primary)',
            color: bloqueado ? 'var(--faint)' : 'var(--pfg)',
            font: '600 15px/1 var(--font-ui)',
            cursor: bloqueado ? 'not-allowed' : 'pointer',
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
