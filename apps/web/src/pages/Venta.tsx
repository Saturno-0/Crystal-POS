import { calcularTotales, type MetodoPago, type Producto } from '@crystal/shared';
import { useEffect, useRef, useState } from 'react';
import { useToast } from '../components/feedback/ToastProvider';
import * as apartadosApi from '../features/apartados/api';
import { useAuth } from '../features/auth/AuthContext';
import * as ventasApi from '../features/ventas/api';
import type { LineaCarritoCalculada } from '../features/ventas/useCarrito';
import { useCarrito } from '../features/ventas/useCarrito';
import { ApiError } from '../lib/apiClient';
import { Catalogo } from './Catalogo';
import { PasarelaPago } from './PasarelaPago';
import { ReciboApartado } from './ReciboApartado';
import { TicketModal, type VentaParaTicket } from './TicketModal';
import { TicketPanel, type DatosApartado, type ModoTicket } from './TicketPanel';
import styles from './Venta.module.css';

const APARTADO_INICIAL: DatosApartado = {
  clienteNombre: '',
  clienteTelefono: '',
  abonoInicial: '',
};

export function Venta({
  productoParaVender,
  onProductoAgregado,
  onCambiarUsuario,
}: {
  /** Pieza recién dada de alta con "Dar de alta y vender ahora" (desde Alta). */
  productoParaVender?: Producto | null;
  onProductoAgregado?: () => void;
  onCambiarUsuario: () => void;
}) {
  const { mostrar } = useToast();
  const { usuario } = useAuth();
  const carrito = useCarrito();

  // Ref: en dev, StrictMode corre el efecto dos veces con el mismo producto.
  const ultimoAgregado = useRef<Producto | null>(null);
  useEffect(() => {
    if (!productoParaVender || ultimoAgregado.current === productoParaVender) return;
    ultimoAgregado.current = productoParaVender;
    carrito.agregar(productoParaVender);
    onProductoAgregado?.();
    mostrar(`${productoParaVender.nombre} agregado al ticket`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productoParaVender]);
  const [panelMovil, setPanelMovil] = useState<'catalogo' | 'ticket'>('catalogo');
  const [modo, setModo] = useState<ModoTicket>('directa');
  const [datosApartado, setDatosApartado] = useState<DatosApartado>(APARTADO_INICIAL);
  const [pasarelaAbierta, setPasarelaAbierta] = useState(false);
  const [refrescarSenal, setRefrescarSenal] = useState(0);
  const [recibo, setRecibo] = useState<{
    venta: VentaParaTicket;
    lineas: LineaCarritoCalculada[];
  } | null>(null);
  const [reciboApartado, setReciboApartado] = useState<apartadosApi.ApartadoCreado | null>(null);

  function cobrar() {
    if (carrito.calculadas.length === 0) {
      mostrar('Agrega al menos un producto');
      return;
    }
    setPasarelaAbierta(true);
  }

  function cancelarTicket() {
    carrito.vaciar();
    setDatosApartado(APARTADO_INICIAL);
    setModo('directa');
    setPanelMovil('catalogo');
    mostrar('Ticket cancelado · unidades devueltas al stock');
  }

  function lineasParaApi() {
    return carrito.calculadas.map(({ linea }) => ({
      productoId: linea.producto.id,
      cantidad: linea.cantidad,
      probado: linea.probado,
      descuentoTipo: linea.descuentoValor > 0 ? linea.descuentoTipo : undefined,
      descuentoValor: linea.descuentoValor > 0 ? linea.descuentoValor : undefined,
    }));
  }

  async function confirmarPago(metodoPago: MetodoPago, efectivoRecibido?: number) {
    const lineasSnapshot = carrito.calculadas;
    const venta = await ventasApi.crearVentaDirecta({
      lineas: lineasParaApi(),
      metodoPago,
      efectivoRecibido,
    });

    carrito.vaciar();
    setPasarelaAbierta(false);
    setRefrescarSenal((n) => n + 1);
    setRecibo({ venta, lineas: lineasSnapshot });
  }

  async function apartar() {
    if (carrito.calculadas.length === 0) {
      mostrar('Agrega al menos un producto');
      return;
    }
    if (!datosApartado.clienteNombre.trim()) {
      mostrar('Captura el nombre del cliente');
      return;
    }
    const abono = Number(datosApartado.abonoInicial);
    if (!abono || abono <= 0) {
      mostrar('Captura el abono inicial');
      return;
    }
    const totales = calcularTotales({
      lineas: carrito.calculadas.map((c) => c.resultado),
      tipoVenta: 'apartado',
    });
    if (abono >= totales.total) {
      mostrar('El abono debe ser menor al total');
      return;
    }

    try {
      const apartado = await apartadosApi.crearApartado({
        lineas: lineasParaApi(),
        clienteNombre: datosApartado.clienteNombre.trim(),
        clienteTelefono: datosApartado.clienteTelefono.trim() || undefined,
        abonoInicial: abono,
      });
      carrito.vaciar();
      setDatosApartado(APARTADO_INICIAL);
      setModo('directa');
      setRefrescarSenal((n) => n + 1);
      setReciboApartado(apartado);
    } catch (err) {
      mostrar(err instanceof ApiError ? err.message : 'No se pudo registrar el apartado');
    }
  }

  const totalArticulos = carrito.calculadas.reduce((acc, c) => acc + c.resultado.importeLinea, 0);

  return (
    <div className={styles.pantalla}>
      {/* Siempre visible: la venta y su comisión se acreditan a quien está en
          sesión, así que el personal debe ver de un vistazo a nombre de quién vende. */}
      <div className={styles.vendedor}>
        <div className={styles.vendedorTexto}>
          <span className={styles.vendedorEtiqueta}>Vendiendo como</span>
          <span className={styles.vendedorNombre}>{usuario?.nombre}</span>
        </div>
        <button type="button" className={styles.btnCambiarUsuario} onClick={onCambiarUsuario}>
          ¿No eres tú? Cambiar usuario
        </button>
      </div>
      <div className={styles.layout}>
        <div className={styles.tabsMobile}>
          <button
            type="button"
            className={panelMovil === 'catalogo' ? styles.tabBtnActivo : styles.tabBtn}
            onClick={() => setPanelMovil('catalogo')}
          >
            Catálogo
          </button>
          <button
            type="button"
            className={panelMovil === 'ticket' ? styles.tabBtnActivo : styles.tabBtn}
            onClick={() => setPanelMovil('ticket')}
          >
            Ticket · {carrito.piezas}
          </button>
        </div>

        <div className={`${styles.catalogoWrap} ${panelMovil === 'ticket' ? styles.oculto : ''}`}>
          <Catalogo onAgregar={carrito.agregar} refrescarSenal={refrescarSenal} />
        </div>
        <div className={`${styles.ticketWrap} ${panelMovil === 'catalogo' ? styles.oculto : ''}`}>
          <TicketPanel
            carrito={carrito}
            modo={modo}
            onModoChange={setModo}
            apartado={datosApartado}
            onApartadoChange={(cambios) => setDatosApartado((actual) => ({ ...actual, ...cambios }))}
            onCobrar={cobrar}
            onApartar={apartar}
            onCancelar={cancelarTicket}
          />
        </div>

        {pasarelaAbierta && (
          <PasarelaPago
            totalArticulos={totalArticulos}
            onConfirmar={confirmarPago}
            onCancelar={() => setPasarelaAbierta(false)}
          />
        )}

        {recibo && (
          <TicketModal
            venta={recibo.venta}
            lineas={recibo.lineas}
            vendedorNombre={usuario?.nombre ?? ''}
            onListo={() => setRecibo(null)}
          />
        )}

        {reciboApartado && (
          <ReciboApartado
            apartado={reciboApartado}
            vendedorNombre={usuario?.nombre ?? ''}
            onListo={() => setReciboApartado(null)}
          />
        )}
      </div>
    </div>
  );
}
