import type { Producto } from '@crystal/shared';
import { useEffect, useRef, useState } from 'react';
import { useToast } from '../components/feedback/ToastProvider';
import * as actualizacionApi from '../features/actualizacion/api';
import type { InfoActualizacion } from '../features/actualizacion/api';
import * as productosApi from '../features/productos/api';
import * as reportesApi from '../features/reportes/api';
import type { Periodo, Reporte } from '../features/reportes/api';
import * as respaldosApi from '../features/respaldos/api';
import type { Respaldo } from '../features/respaldos/api';
import { ApiError } from '../lib/apiClient';
import styles from './Reportes.module.css';

const formatoMXN = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const formatoFecha = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' });
const formatoFechaHora = new Intl.DateTimeFormat('es-MX', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

function formatoTamano(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
}

const PERIODOS: { key: Periodo; label: string }[] = [
  { key: 'mes', label: 'Mes' },
  { key: 'trimestre', label: 'Trimestre' },
  { key: 'anio', label: 'Año' },
];

/** Reportes y comisiones (HU-5.1 a HU-5.5) + inventario editable (HU-2.5), solo Admin. */
export function Reportes({ onEditarProducto }: { onEditarProducto: (producto: Producto) => void }) {
  const { mostrar } = useToast();
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const [reporte, setReporte] = useState<Reporte | null>(null);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [exportando, setExportando] = useState(false);
  const [respaldos, setRespaldos] = useState<Respaldo[]>([]);
  const [respaldando, setRespaldando] = useState(false);
  const [actualizacion, setActualizacion] = useState<InfoActualizacion | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    Promise.all([reportesApi.obtenerReporte(periodo), productosApi.listarProductos()])
      .then(([rep, lista]) => {
        if (!vigente) return;
        setReporte(rep);
        setProductos(lista);
      })
      .catch(() => mostrar('No se pudo cargar el reporte'))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo]);

  useEffect(() => {
    respaldosApi.listarRespaldos().then(setRespaldos).catch(() => undefined);
  }, []);

  useEffect(() => {
    actualizacionApi
      .obtenerEstadoActualizacion()
      .then((info) => {
        setActualizacion(info);
        if (info.estado === 'en_progreso') sondearActualizacion();
      })
      .catch(() => undefined);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function sondearActualizacion() {
    if (pollRef.current) return;
    pollRef.current = setInterval(() => {
      actualizacionApi
        .obtenerEstadoActualizacion()
        .then((info) => {
          setActualizacion(info);
          if (info.estado !== 'en_progreso' && pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        })
        // El servicio se reinicia solo a mitad del proceso (nssm restart):
        // los errores de red mientras tanto son esperados, se ignoran y se
        // sigue reintentando hasta que vuelva a responder.
        .catch(() => undefined);
    }, 2000);
  }

  async function actualizarSistema() {
    if (actualizacion?.estado === 'en_progreso') return;
    try {
      const info = await actualizacionApi.iniciarActualizacion();
      setActualizacion(info);
      sondearActualizacion();
    } catch (err) {
      mostrar(err instanceof ApiError ? err.message : 'No se pudo iniciar la actualización');
    }
  }

  async function respaldarAhora() {
    if (respaldando) return;
    setRespaldando(true);
    try {
      await respaldosApi.respaldarAhora();
      setRespaldos(await respaldosApi.listarRespaldos());
      mostrar('Respaldo creado');
    } catch (err) {
      mostrar(err instanceof ApiError ? err.message : 'No se pudo crear el respaldo');
    } finally {
      setRespaldando(false);
    }
  }

  async function exportarCsv() {
    if (exportando) return;
    setExportando(true);
    try {
      await reportesApi.exportarVendedoresCsv(periodo);
    } catch (err) {
      mostrar(err instanceof ApiError ? err.message : 'No se pudo exportar el CSV');
    } finally {
      setExportando(false);
    }
  }

  async function eliminarProducto(p: Producto) {
    try {
      await productosApi.eliminarProducto(p.id);
      setProductos((actual) => actual.filter((x) => x.id !== p.id));
      mostrar(`${p.nombre} eliminado del catálogo`);
    } catch (err) {
      mostrar(err instanceof ApiError ? err.message : 'No se pudo eliminar el producto');
    }
  }

  if (cargando && !reporte) {
    return <div className={styles.cargando}>Cargando reporte…</div>;
  }
  if (!reporte) return null;

  const { kpis, tendencia, vendedores } = reporte;
  const maxTendencia = Math.max(1, ...tendencia.map((p) => p.monto));

  return (
    <div className={styles.contenedor}>
      <div className={styles.encabezado}>
        <div>
          <div className={styles.tituloFila}>
            <h1>Reportes</h1>
            <span className={styles.badgeAdmin}>ADMIN</span>
          </div>
          <div className={styles.rango}>
            {formatoFecha.format(new Date(kpis.rangoInicio.replace(' ', 'T')))} –{' '}
            {formatoFecha.format(new Date(kpis.rangoFin.replace(' ', 'T')))}
          </div>
        </div>
        <div className={styles.segmented}>
          {PERIODOS.map((p) => (
            <button
              key={p.key}
              type="button"
              className={periodo === p.key ? styles.segmentedBtnActivo : styles.segmentedBtn}
              onClick={() => setPeriodo(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.kpis}>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>Ventas totales</span>
          <span className={styles.kpiValor}>{formatoMXN.format(kpis.ventasTotales)}</span>
          {kpis.ventasTotalesVsAnteriorPct !== null && (
            <span className={kpis.ventasTotalesVsAnteriorPct >= 0 ? styles.kpiUp : styles.kpiDown}>
              {kpis.ventasTotalesVsAnteriorPct >= 0 ? '▲' : '▼'}{' '}
              {Math.abs(kpis.ventasTotalesVsAnteriorPct).toFixed(1)}% vs periodo anterior
            </span>
          )}
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>Tickets</span>
          <span className={styles.kpiValor}>{kpis.tickets}</span>
          <span className={styles.kpiMeta}>Promedio {formatoMXN.format(kpis.ticketPromedio)}</span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>Comisiones por pagar</span>
          <span className={styles.kpiValorPrimario}>{formatoMXN.format(kpis.comisionesPorPagar)}</span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>Apartados</span>
          <span className={styles.kpiValorBad}>{kpis.apartadosVencidos} vencidos</span>
          <span className={styles.kpiMetaBad}>{formatoMXN.format(kpis.apartadosMontoPenalizado)} penalizado</span>
        </div>
      </div>

      <div className={styles.panel}>
        <h2 className={styles.tituloPanel}>Tendencia de ventas</h2>
        <div className={styles.barras}>
          {tendencia.map((punto, i) => (
            <div key={i} className={styles.barraCol}>
              <div
                className={punto.monto === maxTendencia && punto.monto > 0 ? styles.barraMax : styles.barra}
                style={{ height: `${Math.max(4, (punto.monto / maxTendencia) * 100)}%` }}
                title={formatoMXN.format(punto.monto)}
              />
              <span className={styles.barraEtiqueta}>{punto.etiqueta}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.panel}>
        <div className={styles.tituloPanelFila}>
          <h2 className={styles.tituloPanel}>Ventas por vendedor</h2>
          <button type="button" className={styles.btnExportar} onClick={exportarCsv} disabled={exportando}>
            Exportar CSV
          </button>
        </div>
        <div className={styles.tablaVendedores}>
          <div className={styles.filaEncabezado}>
            <span>Vendedor</span>
            <span>Tickets</span>
            <span>Ingreso</span>
            <span>Tasa</span>
            <span>Comisión</span>
          </div>
          {vendedores.map((v) => (
            <div key={v.id} className={styles.filaVendedor}>
              <span className={styles.vendedorNombre}>
                <span className={styles.avatar}>{v.ini}</span>
                <span style={{ minWidth: 0 }}>
                  <div>{v.nombre}</div>
                  <div className={styles.vendedorRol}>{v.rol === 'admin' ? 'Admin' : 'Vendedor'}</div>
                </span>
              </span>
              <span>{v.tickets}</span>
              <span>{formatoMXN.format(v.ingreso)}</span>
              <span>{v.tasaComision}%</span>
              <span className={styles.comisionCifra}>{formatoMXN.format(v.comisionMonto)}</span>
            </div>
          ))}
          {vendedores.length === 0 && <div className={styles.vacio}>Sin vendedores activos.</div>}
        </div>
      </div>

      <div className={styles.panel}>
        <div className={styles.tituloPanelFila}>
          <h2 className={styles.tituloPanel}>Respaldos locales</h2>
          <button type="button" className={styles.btnExportar} onClick={respaldarAhora} disabled={respaldando}>
            Respaldar ahora
          </button>
        </div>
        {respaldos.length === 0 ? (
          <div className={styles.vacio}>Todavía no hay respaldos.</div>
        ) : (
          <>
            <div className={styles.rango}>
              Último respaldo: {formatoFechaHora.format(new Date(respaldos[0].creadoEn))} ·{' '}
              {formatoTamano(respaldos[0].tamanoBytes)}
            </div>
            <div className={styles.tablaInventario}>
              {respaldos.slice(0, 5).map((r) => (
                <div key={r.nombre} className={styles.filaProducto} style={{ gridTemplateColumns: '1fr auto' }}>
                  <span className={styles.productoMeta}>{r.nombre}</span>
                  <span>
                    {formatoFechaHora.format(new Date(r.creadoEn))} · {formatoTamano(r.tamanoBytes)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className={styles.panel}>
        <div className={styles.tituloPanelFila}>
          <h2 className={styles.tituloPanel}>Actualizar sistema</h2>
          <button
            type="button"
            className={styles.btnExportar}
            onClick={actualizarSistema}
            disabled={actualizacion?.estado === 'en_progreso'}
          >
            {actualizacion?.estado === 'en_progreso' ? 'Actualizando…' : 'Buscar actualización'}
          </button>
        </div>
        {actualizacion?.estado === 'en_progreso' && (
          <div className={styles.rango}>{actualizacion.pasoActual ?? 'Trabajando…'}</div>
        )}
        {actualizacion?.estado === 'completado' && actualizacion.terminadoEn && (
          <div className={styles.rango}>
            Última actualización completada: {formatoFechaHora.format(new Date(actualizacion.terminadoEn))}
          </div>
        )}
        {actualizacion?.estado === 'error' && (
          <div className={styles.kpiMetaBad}>
            La última actualización falló — el sistema sigue en la versión anterior, sin cambios.
          </div>
        )}
        {actualizacion && actualizacion.log.length > 0 && (
          <pre className={styles.tablaInventario} style={{ padding: 12, whiteSpace: 'pre-wrap', fontSize: 12 }}>
            {actualizacion.log.join('\n')}
          </pre>
        )}
      </div>

      <div className={styles.panel}>
        <h2 className={styles.tituloPanel}>Inventario · {productos.length}</h2>
        <div className={styles.tablaInventario}>
          {productos.map((p) => (
            <div key={p.id} className={styles.filaProducto}>
              <span>
                <div>{p.nombre}</div>
                <div className={styles.productoMeta}>
                  {p.marca} · {p.sku} · talla {p.talla ?? 'Única'}
                  {p.color ? ` · ${p.color}` : ''}
                </div>
              </span>
              <span>{formatoMXN.format(p.precio)}</span>
              <span>{p.stock} stock</span>
              <span>{p.vendidos} vendidos</span>
              <span className={styles.accionesProducto}>
                <button type="button" className={styles.btnAccion} onClick={() => onEditarProducto(p)}>
                  Editar
                </button>
                <button type="button" className={styles.btnPeligro} onClick={() => eliminarProducto(p)}>
                  Eliminar
                </button>
              </span>
            </div>
          ))}
          {productos.length === 0 && <div className={styles.vacio}>Sin productos en el catálogo.</div>}
        </div>
      </div>
    </div>
  );
}
