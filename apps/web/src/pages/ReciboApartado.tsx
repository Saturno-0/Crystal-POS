import type { EstadoApartado } from '@crystal/shared';
import { useEffect } from 'react';
import type { ApartadoCreado } from '../features/apartados/api';
import { DATOS_NEGOCIO, LEYENDA_APARTADOS, LEYENDA_PROBADA } from '../lib/datosNegocio';
import styles from './Ticket.module.css';

const formatoMXN = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const formatoFecha = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
const formatoFechaHora = new Intl.DateTimeFormat('es-MX', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const TITULO: Record<EstadoApartado, string> = {
  activo: 'Apartado registrado',
  liquidado: 'Apartado liquidado',
  penalizado: 'Apartado penalizado',
};

export function ReciboApartado({
  apartado,
  estado = 'activo',
  vendedorNombre,
  fechaOriginal,
  onListo,
}: {
  apartado: Omit<ApartadoCreado, 'id'>;
  estado?: EstadoApartado;
  vendedorNombre: string;
  /** Presente = reimpresión de un recibo anterior, con la fecha en que se apartó. */
  fechaOriginal?: Date;
  onListo: () => void;
}) {
  // HU-3.6/4.1: "Apartar e imprimir recibo" implica imprimir al llegar aquí.
  // Al reimprimir no: primero se revisa en pantalla si es el ticket correcto.
  useEffect(() => {
    if (!fechaOriginal) window.print();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10,10,12,.55)',
        // Flex (no grid + placeItems): con grid la tarjeta de 400 px se sale
        // en móvil. Solo es el contenedor en pantalla: al imprimir, print.css
        // reposiciona .recibo-imprimible a 48 mm sin depender de él.
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        zIndex: 100,
      }}
    >
      <div
        className="recibo-imprimible"
        style={{
          width: 400,
          maxWidth: '100%',
          background: 'var(--surface)',
          borderRadius: 14,
          maxHeight: '100%',
          overflowY: 'auto',
          padding: 22,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div className={styles.negocioNombre}>{DATOS_NEGOCIO.nombre}</div>
          <div className={styles.negocioMeta}>{DATOS_NEGOCIO.direccion}</div>
          <div className={styles.negocioMeta}>
            IG {DATOS_NEGOCIO.instagram} · FB {DATOS_NEGOCIO.facebook}
          </div>
        </div>
        <div className={styles.separador} />

        <div className={styles.folio}>Folio #{apartado.folio}</div>
        <div className={styles.titulo}>{TITULO[estado]}</div>
        <div className={styles.fechaAtendio}>
          {formatoFechaHora.format(fechaOriginal ?? new Date())} · Atendió: {vendedorNombre}
        </div>
        {fechaOriginal && (
          <div className={styles.metaTexto}>Reimpresión: {formatoFechaHora.format(new Date())}</div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {apartado.lineas.map((linea, i) => (
            <div key={i} className={styles.lineaProducto}>
              <span>
                {linea.cantidad} × {linea.nombre}
                {linea.probado ? ' · P' : ''}
              </span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span className={styles.totalLabel}>Abono recibido</span>
          <span className={styles.totalValor}>{formatoMXN.format(apartado.abonoInicial)}</span>
        </div>
        {estado === 'liquidado' && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className={styles.totalLabel}>Total pagado</span>
            <span className={styles.totalValor}>{formatoMXN.format(apartado.total)}</span>
          </div>
        )}
        {estado === 'activo' && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className={styles.totalLabel}>Resta por pagar</span>
            <span className={styles.totalValor}>{formatoMXN.format(apartado.resta)}</span>
          </div>
        )}

        {estado === 'activo' && (
          <div className={styles.vence}>
            Vence el {formatoFecha.format(new Date(apartado.venceAt.replace(' ', 'T')))}. Si no se liquida,
            la prenda regresa al stock y el abono se penaliza.
          </div>
        )}
        {estado === 'penalizado' && (
          <div className={styles.vence}>
            No se liquidó a tiempo: la prenda regresó al stock y el abono se penalizó.
          </div>
        )}

        <div className={styles.separador} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {apartado.lineas.some((l) => l.probado) && (
            <div className={styles.leyenda}>{LEYENDA_PROBADA}</div>
          )}
          <div className={styles.leyenda}>{LEYENDA_APARTADOS}</div>
        </div>

        <button
          type="button"
          className={fechaOriginal ? styles.btnPrimario : styles.btnSecundario}
          onClick={() => window.print()}
        >
          {fechaOriginal ? 'Reimprimir' : 'Imprimir de nuevo'}
        </button>

        <button
          type="button"
          className={fechaOriginal ? styles.btnSecundario : styles.btnPrimario}
          onClick={onListo}
        >
          {fechaOriginal ? 'Cerrar' : 'Listo'}
        </button>
      </div>
    </div>
  );
}
