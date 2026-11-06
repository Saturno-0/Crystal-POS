import { useEffect, useState } from 'react';
import { useToast } from '../components/feedback/ToastProvider';
import * as apartadosApi from '../features/apartados/api';
import type { ApartadoResumen, Salud } from '../features/apartados/api';
import { ApiError } from '../lib/apiClient';
import styles from './Apartados.module.css';

const formatoMXN = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const formatoFecha = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' });

const COLUMNAS: { salud: Salud; titulo: string }[] = [
  { salud: 'verde', titulo: 'En tiempo' },
  { salud: 'amarillo', titulo: 'Por vencer' },
  { salud: 'rojo', titulo: 'Vencidos · acción requerida' },
];

function formatoTiempo(diasRestantes: number): string {
  if (diasRestantes < 0) return `VENCIDO ${Math.ceil(Math.abs(diasRestantes))}d`;
  const dias = Math.floor(diasRestantes);
  const horas = Math.round((diasRestantes - dias) * 24);
  return `${dias}d ${horas}h`;
}

function descripcionArticulos(articulos: ApartadoResumen['articulos']): string {
  return articulos.map((a) => (a.cantidad > 1 ? `${a.cantidad}× ${a.nombre}` : a.nombre)).join(' · ');
}

export function Apartados() {
  const { mostrar } = useToast();
  const [lista, setLista] = useState<ApartadoResumen[]>([]);
  const [cargando, setCargando] = useState(true);

  async function recargar() {
    setLista(await apartadosApi.listarApartadosActivos());
  }

  useEffect(() => {
    recargar()
      .catch(() => mostrar('No se pudo cargar la lista de apartados'))
      .finally(() => setCargando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function liquidar(a: ApartadoResumen) {
    try {
      const resultado = await apartadosApi.liquidarApartado(a.id);
      await recargar();
      mostrar(`Apartado liquidado · remanente ${formatoMXN.format(resultado.remanente)} cobrado`);
    } catch (err) {
      mostrar(err instanceof ApiError ? err.message : 'No se pudo liquidar el apartado');
    }
  }

  async function penalizar(a: ApartadoResumen) {
    try {
      const resultado = await apartadosApi.penalizarApartado(a.id);
      await recargar();
      mostrar(
        `Abono de ${formatoMXN.format(resultado.abonoPerdido)} penalizado · ${resultado.unidades} unidad(es) regresaron al stock`,
      );
    } catch (err) {
      mostrar(err instanceof ApiError ? err.message : 'No se pudo penalizar el apartado');
    }
  }

  async function extender(a: ApartadoResumen) {
    try {
      await apartadosApi.extenderApartado(a.id);
      await recargar();
      mostrar(`Plazo de ${a.clienteNombre} extendido 15 días más`);
    } catch (err) {
      mostrar(err instanceof ApiError ? err.message : 'No se pudo extender el plazo');
    }
  }

  const totalPorCobrar = lista.reduce((acc, a) => acc + a.resto, 0);
  const vencidos = lista.filter((a) => a.salud === 'rojo').length;

  return (
    <div className={styles.contenedor}>
      <div className={styles.encabezado}>
        <h1>Apartados activos</h1>
        <div className={styles.resumen}>
          {lista.length} activos · {formatoMXN.format(totalPorCobrar)} por cobrar · {vencidos} vencidos
        </div>
      </div>

      {!cargando && lista.length === 0 && (
        <div className={styles.vacioColumna}>No hay apartados activos por ahora.</div>
      )}

      <div className={styles.kanban}>
        {COLUMNAS.map((col) => {
          const apartadosCol = lista.filter((a) => a.salud === col.salud);
          return (
            <div key={col.salud} className={col.salud === 'rojo' ? styles.columnaRoja : styles.columna}>
              <div className={styles.tituloColumna}>
                {col.titulo} · {apartadosCol.length}
              </div>
              {apartadosCol.length === 0 && <div className={styles.vacioColumna}>Sin apartados aquí.</div>}
              {apartadosCol.map((a) => {
                const progreso = Math.min(100, (a.pagado / a.total) * 100);
                const claseTarjeta =
                  a.salud === 'rojo' ? styles.tarjetaRoja : a.salud === 'amarillo' ? styles.tarjetaAmarilla : styles.tarjeta;
                return (
                  <div key={a.id} className={claseTarjeta}>
                    <div className={styles.filaCliente}>
                      <span className={styles.nombreCliente}>{a.clienteNombre}</span>
                      <span className={a.salud === 'rojo' ? styles.badgeVencido : styles.badgeTiempo}>
                        {formatoTiempo(a.diasRestantes)}
                      </span>
                    </div>
                    <div className={styles.descripcion}>{descripcionArticulos(a.articulos)}</div>
                    <div className={styles.barraFondo}>
                      <div className={styles.barraRelleno} style={{ width: `${progreso}%` }} />
                    </div>
                    <div className={styles.leyendaAbono}>
                      Abonado {formatoMXN.format(a.pagado)} de {formatoMXN.format(a.total)}
                    </div>
                    <div className={styles.nota} style={{ color: a.salud === 'rojo' ? 'var(--badtext)' : 'var(--muted)' }}>
                      {a.salud === 'rojo'
                        ? `Venció ${formatoFecha.format(new Date(a.venceAt.replace(' ', 'T')))} · abono a penalizar`
                        : `Vence ${formatoFecha.format(new Date(a.venceAt.replace(' ', 'T')))}`}
                    </div>
                    <div className={styles.acciones}>
                      <button type="button" className={styles.btnAccion} onClick={() => liquidar(a)}>
                        Registrar 2º pago
                      </button>
                      <button type="button" className={styles.btnAccion} onClick={() => extender(a)}>
                        Prorrogar 15 días
                      </button>
                      <button type="button" className={styles.btnPenalizar} onClick={() => penalizar(a)}>
                        {a.salud === 'rojo' ? 'Penalizar y regresar a stock' : 'Penalizar'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
