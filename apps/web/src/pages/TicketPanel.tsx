import { nombreConColor } from '@crystal/shared';
import { calcularTotales } from '@crystal/shared';
import type { UseCarrito } from '../features/ventas/useCarrito';
import styles from './TicketPanel.module.css';

const formatoMXN = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const formatoFecha = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' });

export type ModoTicket = 'directa' | 'apartado';

export interface DatosApartado {
  clienteNombre: string;
  clienteTelefono: string;
  abonoInicial: string;
}

const VENCE_EN_MS = 15 * 24 * 60 * 60 * 1000;

export function TicketPanel({
  carrito,
  modo,
  onModoChange,
  apartado,
  onApartadoChange,
  onCobrar,
  onApartar,
  onCancelar,
}: {
  carrito: UseCarrito;
  modo: ModoTicket;
  onModoChange: (modo: ModoTicket) => void;
  apartado: DatosApartado;
  onApartadoChange: (cambios: Partial<DatosApartado>) => void;
  onCobrar: () => void;
  onApartar: () => void;
  onCancelar: () => void;
}) {
  const { calculadas, piezas, cambiarCantidad, quitar, alternarProbado, setDescuento } = carrito;

  // Aún sin método de pago ni "apartado": este total es solo tras descuentos
  // de artículo. El −$15 de efectivo/transferencia solo existe en venta
  // directa y se calcula en la pasarela de pago (regla 4).
  const totales = calcularTotales({
    lineas: calculadas.map((c) => c.resultado),
    tipoVenta: 'directa',
  });

  const abonoNumero = Number(apartado.abonoInicial) || 0;
  const resta = Math.max(0, totales.total - abonoNumero);
  const fechaVence = formatoFecha.format(new Date(Date.now() + VENCE_EN_MS));

  return (
    <div className={styles.panel}>
      <div className={styles.encabezado}>
        <div className={styles.folio}>Nuevo ticket</div>
        <div className={styles.fecha}>{formatoFecha.format(new Date())}</div>
        <div className={styles.segmentedModo}>
          <button
            type="button"
            className={modo === 'directa' ? styles.segmentedModoBtnActivo : styles.segmentedModoBtn}
            onClick={() => onModoChange('directa')}
          >
            Venta directa
          </button>
          <button
            type="button"
            className={modo === 'apartado' ? styles.segmentedModoBtnActivo : styles.segmentedModoBtn}
            onClick={() => onModoChange('apartado')}
          >
            Apartado
          </button>
        </div>
      </div>

      <div className={styles.cuerpo}>
        {calculadas.length === 0 && (
          <div className={styles.vacio}>Toca un producto para agregarlo al ticket.</div>
        )}
        {calculadas.map(({ linea, resultado }) => (
          <div key={linea.producto.id} className={styles.linea}>
            <div className={styles.filaLinea1}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className={styles.nombreLinea}>
                  {nombreConColor(linea.producto.nombre, linea.producto.color)}
                </div>
                <div className={styles.metaLinea}>
                  {linea.producto.sku} · {formatoMXN.format(linea.producto.precio)}
                </div>
              </div>
              <div className={styles.stepper}>
                <button
                  type="button"
                  className={styles.stepperBtn}
                  onClick={() => cambiarCantidad(linea.producto.id, -1)}
                >
                  −
                </button>
                <span className={styles.cantidad}>{linea.cantidad}</span>
                <button
                  type="button"
                  className={styles.stepperBtn}
                  onClick={() => cambiarCantidad(linea.producto.id, 1)}
                >
                  +
                </button>
              </div>
              <span className={styles.importeLinea}>{formatoMXN.format(resultado.importeLinea)}</span>
              <button
                type="button"
                className={styles.btnQuitar}
                onClick={() => quitar(linea.producto.id)}
                aria-label={`Quitar ${linea.producto.nombre}`}
              >
                ×
              </button>
            </div>

            <div className={styles.filaLinea2}>
              <button
                type="button"
                className={linea.probado ? styles.togglePActivo : styles.togglePBtn}
                onClick={() => alternarProbado(linea.producto.id)}
              >
                P · probado
              </button>
              <div className={styles.segmentedDesc}>
                <button
                  type="button"
                  className={
                    linea.descuentoTipo === 'pct' ? styles.segmentedDescBtnActivo : styles.segmentedDescBtn
                  }
                  onClick={() => setDescuento(linea.producto.id, 'pct', linea.descuentoValor)}
                >
                  %
                </button>
                <button
                  type="button"
                  className={
                    linea.descuentoTipo === 'monto' ? styles.segmentedDescBtnActivo : styles.segmentedDescBtn
                  }
                  onClick={() => setDescuento(linea.producto.id, 'monto', linea.descuentoValor)}
                >
                  $
                </button>
              </div>
              <input
                className={styles.inputDescuento}
                value={linea.descuentoValor || ''}
                onChange={(e) => {
                  const valor = Number(e.target.value.replace(/[^0-9.]/g, '')) || 0;
                  setDescuento(linea.producto.id, linea.descuentoTipo, valor);
                }}
                placeholder="Descuento"
                inputMode="decimal"
              />
            </div>

            {linea.probado && (
              <div className={styles.leyendaProbado}>Prenda probada · sin cambios ni devoluciones</div>
            )}
            {resultado.descuentoOrigen !== 'ninguno' && (
              <div className={styles.leyendaDescuento}>
                {resultado.descuentoOrigen === 'manual' ? 'Descuento manual: ' : 'Descuento de prenda aplicado: '}
                −{formatoMXN.format(resultado.descuentoAplicado)}
              </div>
            )}
          </div>
        ))}

        {modo === 'apartado' && calculadas.length > 0 && (
          <div className={styles.bloqueApartado}>
            <input
              className={styles.inputApartado}
              value={apartado.clienteNombre}
              onChange={(e) => onApartadoChange({ clienteNombre: e.target.value })}
              placeholder="Nombre del cliente"
            />
            <input
              className={styles.inputApartado}
              value={apartado.clienteTelefono}
              onChange={(e) => onApartadoChange({ clienteTelefono: e.target.value })}
              placeholder="Teléfono (opcional)"
            />
            <input
              className={`${styles.inputApartado} ${styles.inputAbono}`}
              value={apartado.abonoInicial}
              onChange={(e) =>
                onApartadoChange({ abonoInicial: e.target.value.replace(/[^0-9.]/g, '') })
              }
              inputMode="decimal"
              placeholder="Abono inicial"
            />
            <div className={styles.avisoVencimiento}>
              VENCE EN 15 DÍAS · {fechaVence}
              <br />
              Si no se liquida, la prenda regresa al stock y el abono se penaliza.
            </div>
          </div>
        )}
      </div>

      <div className={styles.aviso}>
        Regla de stock: se descuenta <strong>1 unidad</strong> del modelo general, sin importar la
        variante de color.
      </div>

      <div className={styles.pie}>
        <div className={styles.filaTotal}>
          <span>Subtotal · {piezas} pzas</span>
          <span>{formatoMXN.format(totales.subtotalBruto)}</span>
        </div>
        {totales.descuentoArticulos > 0 && (
          <div className={styles.filaDescuento}>
            <span>Descuento en artículos</span>
            <span>−{formatoMXN.format(totales.descuentoArticulos)}</span>
          </div>
        )}
        <div className={styles.separador} />
        <div className={styles.filaTotalFinal}>
          <span className={styles.etiquetaTotal}>{modo === 'apartado' ? 'Abono a cobrar' : 'Total a cobrar'}</span>
          <span className={styles.cifraTotal}>
            {formatoMXN.format(modo === 'apartado' ? abonoNumero : totales.total)}
          </span>
        </div>
        {modo === 'apartado' && (
          <div className={styles.filaTotal}>
            <span>Resta al {fechaVence}</span>
            <span>{formatoMXN.format(resta)}</span>
          </div>
        )}
        {modo === 'directa' ? (
          <button
            type="button"
            className={styles.btnCobrar}
            disabled={calculadas.length === 0}
            onClick={onCobrar}
          >
            Cobrar e imprimir ticket
          </button>
        ) : (
          <button
            type="button"
            className={styles.btnCobrar}
            disabled={calculadas.length === 0}
            onClick={onApartar}
          >
            Apartar e imprimir recibo
          </button>
        )}
        <button type="button" className={styles.btnCancelar} onClick={onCancelar}>
          Cancelar ticket
        </button>
      </div>
    </div>
  );
}
