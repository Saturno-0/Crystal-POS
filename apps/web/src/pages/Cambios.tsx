import { nombreConColor } from '@crystal/shared';
import type { MetodoPago, Producto } from '@crystal/shared';
import { useState } from 'react';
import { useToast } from '../components/feedback/ToastProvider';
import * as cambiosApi from '../features/cambios/api';
import type { CambioCreado, LineaParaCambio, VentaParaCambio } from '../features/cambios/api';
import * as productosApi from '../features/productos/api';
import { ApiError } from '../lib/apiClient';
import styles from './Cambios.module.css';

const formatoMXN = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

const METODOS: { key: MetodoPago; label: string }[] = [
  { key: 'efectivo', label: 'Efectivo' },
  { key: 'transferencia', label: 'Transferencia' },
  { key: 'tarjeta', label: 'Tarjeta' },
];

function motivoNoElegible(l: LineaParaCambio): string {
  if (l.probado) return 'Prenda probada · sin cambios ni devoluciones';
  if (l.yaCambiada) return 'Esta línea ya fue cambiada';
  if (l.cantidad !== 1) return 'Solo se cambian líneas de 1 unidad';
  return '';
}

/** Cambio por otra prenda (regla 10): solo por un producto de igual o mayor precio pagado. */
export function Cambios() {
  const { mostrar } = useToast();
  const [folioInput, setFolioInput] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState('');
  const [venta, setVenta] = useState<VentaParaCambio | null>(null);

  const [lineaActiva, setLineaActiva] = useState<LineaParaCambio | null>(null);
  const [busquedaProducto, setBusquedaProducto] = useState('');
  const [opciones, setOpciones] = useState<Producto[]>([]);
  const [cargandoOpciones, setCargandoOpciones] = useState(false);
  const [productoElegido, setProductoElegido] = useState<Producto | null>(null);
  const [metodoPago, setMetodoPago] = useState<MetodoPago | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  const [resultado, setResultado] = useState<CambioCreado | null>(null);

  async function buscar() {
    const folio = folioInput.trim();
    if (!folio || buscando) return;
    setBuscando(true);
    setError('');
    setVenta(null);
    setResultado(null);
    try {
      setVenta(await cambiosApi.buscarVentaPorFolio(folio));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo buscar el ticket');
    } finally {
      setBuscando(false);
    }
  }

  async function elegirLinea(linea: LineaParaCambio) {
    setLineaActiva(linea);
    setProductoElegido(null);
    setMetodoPago(null);
    setBusquedaProducto('');
    await cargarOpciones(linea, '');
  }

  async function cargarOpciones(linea: LineaParaCambio, busqueda: string) {
    setCargandoOpciones(true);
    try {
      const lista = await productosApi.listarProductos({ busqueda: busqueda || undefined });
      setOpciones(
        lista.filter((p) => p.id !== linea.productoId && p.stock > 0 && p.precio >= linea.precioPagado),
      );
    } finally {
      setCargandoOpciones(false);
    }
  }

  function diferencia(): number {
    if (!lineaActiva || !productoElegido) return 0;
    return Math.max(0, productoElegido.precio - lineaActiva.precioPagado);
  }

  async function confirmar() {
    if (!lineaActiva || !productoElegido || confirmando) return;
    const dif = diferencia();
    if (dif > 0 && !metodoPago) {
      mostrar('Selecciona el método de pago de la diferencia');
      return;
    }
    setConfirmando(true);
    try {
      const cambio = await cambiosApi.crearCambio({
        ventaLineaId: lineaActiva.ventaLineaId,
        productoNuevoId: productoElegido.id,
        metodoPago: dif > 0 ? metodoPago ?? undefined : undefined,
      });
      setResultado(cambio);
      setVenta(null);
      setLineaActiva(null);
      setProductoElegido(null);
      setFolioInput('');
    } catch (err) {
      mostrar(err instanceof ApiError ? err.message : 'No se pudo registrar el cambio');
    } finally {
      setConfirmando(false);
    }
  }

  function cancelarSeleccion() {
    setLineaActiva(null);
    setProductoElegido(null);
    setMetodoPago(null);
  }

  return (
    <div className={styles.contenedor}>
      <div className={styles.panel}>
        <div className={styles.encabezado}>
          <h1>Cambio por otra prenda</h1>
          <div className={styles.subtitulo}>
            Solo se puede cambiar por una prenda del mismo precio o mayor; si es mayor, el cliente paga la
            diferencia. No hay devolución de dinero.
          </div>
        </div>

        {resultado && (
          <div className={styles.reciboExito}>
            <div className={styles.reciboTitulo}>Cambio registrado · ticket #{resultado.folio}</div>
            <div className={styles.filaResumen}>
              <span>Nuevo producto</span>
              <span>{resultado.productoNuevo.nombre}</span>
            </div>
            <div className={styles.filaResumen}>
              <span>Pagado originalmente</span>
              <span>{formatoMXN.format(resultado.precioPagadoOriginal)}</span>
            </div>
            <div className={styles.filaResumenTotal}>
              <span>Diferencia cobrada</span>
              <span>{formatoMXN.format(resultado.diferenciaCobrada)}</span>
            </div>
            <button type="button" className={styles.btnCancelar} onClick={() => setResultado(null)}>
              Hacer otro cambio
            </button>
          </div>
        )}

        {!resultado && (
          <>
            <div className={styles.buscador}>
              <input
                className={styles.input}
                value={folioInput}
                onChange={(e) => setFolioInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && buscar()}
                placeholder="Folio del ticket"
                inputMode="numeric"
              />
              <button type="button" className={styles.btnBuscar} onClick={buscar} disabled={buscando}>
                Buscar
              </button>
            </div>

            {error && <div className={styles.error}>{error}</div>}

            {venta && (
              <div className={styles.lista}>
                {venta.lineas.map((l) => (
                  <div key={l.ventaLineaId} className={l.elegible ? styles.linea : styles.lineaDeshabilitada}>
                    <div className={styles.lineaInfo}>
                      <div className={styles.lineaNombre}>{l.nombre}</div>
                      <div className={styles.lineaMeta}>
                        {l.sku} · talla {l.talla ?? 'Única'}
                        {l.color ? ` · ${l.color}` : ''} · pagado {formatoMXN.format(l.precioPagado)}
                      </div>
                      {!l.elegible && <div className={styles.lineaMotivo}>{motivoNoElegible(l)}</div>}
                    </div>
                    <button
                      type="button"
                      className={styles.btnAccion}
                      disabled={!l.elegible}
                      onClick={() => elegirLinea(l)}
                    >
                      Cambiar
                    </button>
                  </div>
                ))}
              </div>
            )}

            {lineaActiva && (
              <div className={styles.selectorProducto}>
                <div className={styles.selectorTitulo}>
                  Elige el nuevo producto para {lineaActiva.nombre} (pagado{' '}
                  {formatoMXN.format(lineaActiva.precioPagado)})
                </div>
                <input
                  className={styles.input}
                  style={{ height: 40 }}
                  value={busquedaProducto}
                  onChange={(e) => {
                    setBusquedaProducto(e.target.value);
                    cargarOpciones(lineaActiva, e.target.value);
                  }}
                  placeholder="Buscar nombre, marca o SKU…"
                />
                <div className={styles.opcionesProducto}>
                  {!cargandoOpciones && opciones.length === 0 && (
                    <div className={styles.aviso}>
                      Sin productos con precio igual o mayor a {formatoMXN.format(lineaActiva.precioPagado)}.
                    </div>
                  )}
                  {opciones.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={productoElegido?.id === p.id ? styles.opcionProductoActiva : styles.opcionProducto}
                      onClick={() => {
                        setProductoElegido(p);
                        setMetodoPago(null);
                      }}
                    >
                      <span>
                        {nombreConColor(p.nombre, p.color)} · {p.sku}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                        {formatoMXN.format(p.precio)}
                      </span>
                    </button>
                  ))}
                </div>

                {productoElegido && (
                  <div className={styles.resumenCambio}>
                    <div className={styles.filaResumen}>
                      <span>Pagado originalmente</span>
                      <span>{formatoMXN.format(lineaActiva.precioPagado)}</span>
                    </div>
                    <div className={styles.filaResumen}>
                      <span>Precio del nuevo producto</span>
                      <span>{formatoMXN.format(productoElegido.precio)}</span>
                    </div>
                    <div className={styles.filaResumenTotal}>
                      <span>Diferencia a cobrar</span>
                      <span>{formatoMXN.format(diferencia())}</span>
                    </div>

                    {diferencia() > 0 && (
                      <div className={styles.metodos}>
                        {METODOS.map((m) => (
                          <button
                            key={m.key}
                            type="button"
                            className={metodoPago === m.key ? styles.metodoBtnActivo : styles.metodoBtn}
                            onClick={() => setMetodoPago(m.key)}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    )}

                    <button
                      type="button"
                      className={styles.btnConfirmar}
                      disabled={confirmando || (diferencia() > 0 && !metodoPago)}
                      onClick={confirmar}
                    >
                      {diferencia() > 0 ? 'Cobrar diferencia y confirmar cambio' : 'Confirmar cambio'}
                    </button>
                  </div>
                )}

                <button type="button" className={styles.btnCancelar} onClick={cancelarSeleccion}>
                  Cancelar
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
