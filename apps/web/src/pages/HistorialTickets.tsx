import type { EstadoVenta, MetodoPago, TipoVenta } from '@crystal/shared';
import { useEffect, useState } from 'react';
import { useToast } from '../components/feedback/ToastProvider';
import * as ticketsApi from '../features/tickets/api';
import type { TicketDetalle, TicketResumen } from '../features/tickets/api';
import { ApiError } from '../lib/apiClient';
import styles from './HistorialTickets.module.css';
import { ReciboApartado } from './ReciboApartado';
import { TicketModal } from './TicketModal';

const formatoMXN = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const formatoFechaHora = new Intl.DateTimeFormat('es-MX', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});
// 'YYYY-MM-DD' en hora local, el mismo formato que entrega <input type="date">.
const formatoDia = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' });

const FILTROS: { key: TipoVenta | null; label: string }[] = [
  { key: null, label: 'Todos' },
  { key: 'directa', label: 'Ventas' },
  { key: 'apartado', label: 'Apartados' },
];

const ETIQUETA_METODO: Record<MetodoPago, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
};

const ETIQUETA_ESTADO: Record<EstadoVenta, string> = {
  completada: 'Venta',
  apartado_activo: 'Apartado activo',
  apartado_liquidado: 'Apartado liquidado',
  apartado_penalizado: 'Apartado penalizado',
  cancelada: 'Cancelada',
};

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Historial de un mes para reimprimir un ticket de venta o recibo de apartado. */
export function HistorialTickets({
  tipoInicial = null,
  onCerrar,
}: {
  tipoInicial?: TipoVenta | null;
  onCerrar: () => void;
}) {
  const { mostrar } = useToast();
  const [tickets, setTickets] = useState<TicketResumen[] | null>(null);
  const [tipo, setTipo] = useState<TipoVenta | null>(tipoInicial);
  const [busqueda, setBusqueda] = useState('');
  const [dia, setDia] = useState('');
  const [abriendo, setAbriendo] = useState(false);
  const [detalle, setDetalle] = useState<TicketDetalle | null>(null);

  useEffect(() => {
    ticketsApi
      .listarTickets()
      .then(setTickets)
      .catch((err) => {
        mostrar(err instanceof ApiError ? err.message : 'No se pudo cargar el historial de tickets');
        onCerrar();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function abrir(folio: string) {
    if (abriendo) return;
    setAbriendo(true);
    try {
      setDetalle(await ticketsApi.obtenerTicket(folio));
    } catch (err) {
      mostrar(err instanceof ApiError ? err.message : 'No se pudo abrir el ticket');
    } finally {
      setAbriendo(false);
    }
  }

  const palabras = normalizar(busqueda).split(/[\s#]+/).filter(Boolean);
  const filtrados = (tickets ?? []).filter((t) => {
    if (tipo && t.tipo !== tipo) return false;
    if (dia && formatoDia.format(new Date(t.fecha)) !== dia) return false;
    const texto = normalizar([t.folio, t.vendedor, t.cliente ?? '', ...t.articulos].join(' '));
    return palabras.every((p) => texto.includes(p));
  });

  return (
    <div className={styles.fondo}>
      <div className={styles.modal} role="dialog" aria-label="Reimprimir ticket">
        <div className={styles.encabezado}>
          <div>
            <h2 className={styles.titulo}>Reimprimir ticket</h2>
            <div className={styles.subtitulo}>Ventas y apartados del último mes</div>
          </div>
          <button type="button" className={styles.btnCerrar} onClick={onCerrar} aria-label="Cerrar historial">
            ×
          </button>
        </div>

        <div className={styles.filtros}>
          <input
            className={styles.input}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Folio, prenda, cliente o vendedor…"
          />
          <input
            type="date"
            className={styles.inputFecha}
            value={dia}
            onChange={(e) => setDia(e.target.value)}
            aria-label="Filtrar por día"
          />
          <div className={styles.segmented}>
            {FILTROS.map((f) => (
              <button
                key={f.label}
                type="button"
                className={tipo === f.key ? styles.segmentedBtnActivo : styles.segmentedBtn}
                onClick={() => setTipo(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.lista}>
          {tickets === null && <div className={styles.vacio}>Cargando…</div>}
          {tickets !== null && filtrados.length === 0 && (
            <div className={styles.vacio}>No hay tickets que coincidan.</div>
          )}
          {filtrados.map((t) => (
            <div key={t.folio} className={styles.fila}>
              <div className={styles.info}>
                <div className={styles.filaTitulo}>
                  <span className={styles.folio}>#{t.folio}</span>
                  <span>{formatoFechaHora.format(new Date(t.fecha))}</span>
                  <span className={styles.total}>{formatoMXN.format(t.total)}</span>
                </div>
                <div className={styles.articulos}>{t.articulos.join(' · ')}</div>
                <div className={styles.meta}>
                  {ETIQUETA_ESTADO[t.estado]}
                  {t.metodoPago && ` · ${ETIQUETA_METODO[t.metodoPago]}`}
                  {t.cliente && ` · Cliente: ${t.cliente}`} · Atendió: {t.vendedor}
                </div>
              </div>
              <button
                type="button"
                className={styles.btnVer}
                disabled={abriendo}
                onClick={() => abrir(t.folio)}
                aria-label={`Ver ticket ${t.folio}`}
              >
                Ver ticket
              </button>
            </div>
          ))}
        </div>
      </div>

      {detalle &&
        (detalle.apartado ? (
          <ReciboApartado
            apartado={{
              folio: detalle.folio,
              total: detalle.total,
              abonoInicial: detalle.apartado.abonoInicial,
              resta: detalle.total - detalle.apartado.pagado,
              venceAt: detalle.apartado.venceAt,
              lineas: detalle.lineas,
            }}
            estado={detalle.apartado.estado}
            vendedorNombre={detalle.vendedor}
            fechaOriginal={new Date(detalle.fecha)}
            onListo={() => setDetalle(null)}
          />
        ) : (
          <TicketModal
            venta={{
              folio: detalle.folio,
              total: detalle.total,
              metodoPago: detalle.metodoPago ?? 'efectivo',
              efectivoRecibido: detalle.efectivoRecibido,
              cambio: detalle.cambio ?? 0,
              comisionMonto: detalle.comisionMonto,
            }}
            lineas={detalle.lineas}
            vendedorNombre={detalle.vendedor}
            fechaOriginal={new Date(detalle.fecha)}
            onListo={() => setDetalle(null)}
          />
        ))}
    </div>
  );
}
