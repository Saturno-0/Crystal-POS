import { useEffect } from 'react';
import type { ApartadoCreado } from '../features/apartados/api';
import { DATOS_NEGOCIO, LEYENDA_APARTADOS, LEYENDA_PROBADA } from '../lib/datosNegocio';

const formatoMXN = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const formatoFecha = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
const formatoFechaHora = new Intl.DateTimeFormat('es-MX', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function ReciboApartado({
  apartado,
  vendedorNombre,
  onListo,
}: {
  apartado: ApartadoCreado;
  vendedorNombre: string;
  onListo: () => void;
}) {
  // HU-3.6/4.1: "Apartar e imprimir recibo" implica imprimir al llegar aquí.
  useEffect(() => {
    window.print();
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10,10,12,.55)',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
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
          padding: 22,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ font: "700 17px/1.2 var(--font-ui)" }}>{DATOS_NEGOCIO.nombre}</div>
          <div style={{ font: "400 10.5px/1.4 var(--font-ui)", color: 'var(--muted)' }}>
            {DATOS_NEGOCIO.direccion}
          </div>
          <div style={{ font: "400 10.5px/1.4 var(--font-ui)", color: 'var(--muted)' }}>
            IG {DATOS_NEGOCIO.instagram} · FB {DATOS_NEGOCIO.facebook}
          </div>
        </div>
        <div style={{ borderTop: '1px dashed var(--border2)' }} />

        <div
          style={{
            alignSelf: 'flex-start',
            background: 'var(--oksoft)',
            color: 'var(--oktext)',
            borderRadius: 6,
            padding: '4px 8px',
            font: "700 11px/1 var(--font-mono)",
          }}
        >
          Folio #{apartado.folio}
        </div>
        <div style={{ font: "700 19px/1.2 var(--font-ui)" }}>Apartado registrado</div>
        <div style={{ font: "400 11.5px/1.4 var(--font-mono)", color: 'var(--muted)' }}>
          {formatoFechaHora.format(new Date())} · Atendió: {vendedorNombre}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {apartado.lineas.map((linea, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                font: "400 12.5px/1.4 var(--font-ui)",
              }}
            >
              <span>
                {linea.cantidad} × {linea.nombre}
                {linea.probado ? ' · P' : ''}
              </span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', font: "400 13px/1.4 var(--font-ui)" }}>
          <span>Abono recibido</span>
          <span style={{ font: "700 15px/1 var(--font-mono)" }}>{formatoMXN.format(apartado.abonoInicial)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', font: "400 13px/1.4 var(--font-ui)" }}>
          <span>Resta por pagar</span>
          <span style={{ font: "700 15px/1 var(--font-mono)" }}>{formatoMXN.format(apartado.resta)}</span>
        </div>

        <div
          style={{
            padding: 10,
            borderRadius: 8,
            background: 'var(--warnsoft)',
            color: 'var(--warntext)',
            font: "500 12px/1.4 var(--font-ui)",
          }}
        >
          Vence el {formatoFecha.format(new Date(apartado.venceAt.replace(' ', 'T')))}. Si no se liquida,
          la prenda regresa al stock y el abono se penaliza.
        </div>

        <div style={{ borderTop: '1px dashed var(--border2)' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {apartado.lineas.some((l) => l.probado) && (
            <div style={{ font: "400 10px/1.4 var(--font-ui)", color: 'var(--muted)' }}>
              {LEYENDA_PROBADA}
            </div>
          )}
          <div style={{ font: "400 10px/1.4 var(--font-ui)", color: 'var(--muted)' }}>
            {LEYENDA_APARTADOS}
          </div>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          style={{
            height: 40,
            border: '1px solid var(--border2)',
            borderRadius: 9,
            background: 'var(--surface)',
            color: 'var(--text)',
            font: "600 13px/1 var(--font-ui)",
            cursor: 'pointer',
          }}
        >
          Imprimir de nuevo
        </button>

        <button
          type="button"
          onClick={onListo}
          style={{
            height: 48,
            border: 'none',
            borderRadius: 9,
            background: 'var(--primary)',
            color: 'var(--pfg)',
            font: "600 15px/1 var(--font-ui)",
            cursor: 'pointer',
          }}
        >
          Listo
        </button>
      </div>
    </div>
  );
}
