import { useRef, useState } from 'react';
import { useToast } from '../components/feedback/ToastProvider';
import * as productosApi from '../features/productos/api';
import { ApiError } from '../lib/apiClient';

const PLANTILLA = [
  'nombre,marca,categoria,talla,color,precio,cantidad,descuento_tipo,descuento_valor',
  'Blusa lino,Zara,Blusas,M,,420,2,,',
  'Jean recto,Levis,Mezclilla,7,,590,1,,',
  'Vestido flores,Shein,Vestidos,,,500,1,pct,10',
].join('\n');

function descargarPlantilla() {
  const blob = new Blob(['﻿', PLANTILLA, '\n'], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = 'plantilla-productos.csv';
  enlace.click();
  URL.revokeObjectURL(url);
}

const ETIQUETA_ESTADO = { nueva: 'Nueva', suma: 'Suma stock', error: 'Error' } as const;

const boton = {
  height: 48,
  border: 'none',
  borderRadius: 9,
  font: '600 15px/1 var(--font-ui)',
  cursor: 'pointer',
} as const;

export function ModalImportarCsv({ onCerrar }: { onCerrar: () => void }) {
  const { mostrar } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [csv, setCsv] = useState<string | null>(null);
  const [archivo, setArchivo] = useState('');
  const [resultado, setResultado] = useState<productosApi.ResultadoImportacion | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  async function elegirArchivo(file: File | undefined) {
    if (!file) return;
    setTrabajando(true);
    setResultado(null);
    try {
      const texto = await file.text();
      setCsv(texto);
      setArchivo(file.name);
      setResultado(await productosApi.importarCsv(texto, false));
    } catch (err) {
      setCsv(null);
      setArchivo('');
      mostrar(err instanceof ApiError ? err.message : 'No se pudo leer el archivo');
    } finally {
      setTrabajando(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function confirmar() {
    if (csv === null) return;
    setTrabajando(true);
    try {
      const r = await productosApi.importarCsv(csv, true);
      if (!r.aplicado) {
        setResultado(r);
        mostrar('El archivo cambió o tiene errores: no se importó nada');
        return;
      }
      mostrar(`Importadas ${r.resumen.total} filas (${r.resumen.nuevas} nuevas, ${r.resumen.sumas} suman stock)`);
      onCerrar();
    } catch (err) {
      mostrar(err instanceof ApiError ? err.message : 'No se pudo importar el archivo');
    } finally {
      setTrabajando(false);
    }
  }

  const resumen = resultado?.resumen;
  const puedeImportar = !!resumen && resumen.errores === 0 && resumen.total > 0;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10,10,12,.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        zIndex: 100,
      }}
    >
      <div
        style={{
          width: 560,
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
        <div style={{ font: '700 16px/1.3 var(--font-ui)', color: 'var(--text)' }}>Importar productos desde CSV</div>
        <div style={{ font: '400 12px/1.5 var(--font-ui)', color: 'var(--muted)' }}>
          Columnas: <strong>nombre, marca, categoria, precio</strong> (obligatorias), talla, color, cantidad (1 si va
          vacía), descuento_tipo (<code>pct</code> o <code>monto</code>) y descuento_valor (solo vestidos). Si una
          prenda ya existe (mismo nombre, marca, categoría, talla y color) se suma a su stock. Si una sola fila trae
          error, no se importa nada. Borra las filas de ejemplo de la plantilla antes de subirla.
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          aria-label="Archivo CSV"
          style={{ display: 'none' }}
          onChange={(e) => void elegirArchivo(e.target.files?.[0])}
        />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            disabled={trabajando}
            onClick={() => inputRef.current?.click()}
            style={{ ...boton, flex: 1, minWidth: 180, background: 'var(--primary)', color: 'var(--pfg)' }}
          >
            {archivo ? 'Elegir otro archivo' : 'Elegir archivo CSV'}
          </button>
          <button
            type="button"
            onClick={descargarPlantilla}
            style={{ ...boton, background: 'var(--chip)', color: 'var(--text)', padding: '0 16px' }}
          >
            Descargar plantilla
          </button>
        </div>

        {archivo && (
          <div style={{ font: '500 12.5px/1.4 var(--font-ui)', color: 'var(--muted)' }}>
            {archivo}
            {trabajando && ' · revisando…'}
          </div>
        )}

        {resumen && resultado && (
          <>
            <div
              role="status"
              style={{
                font: '600 13px/1.4 var(--font-ui)',
                color: resumen.errores > 0 ? 'var(--badtext)' : 'var(--ptext)',
              }}
            >
              {resumen.errores > 0
                ? `${resumen.errores} ${resumen.errores === 1 ? 'fila con error' : 'filas con error'}: corrige el archivo y vuelve a elegirlo. No se importó nada.`
                : `${resumen.total} filas listas: ${resumen.nuevas} nuevas, ${resumen.sumas} suman stock.`}
            </div>
            <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', font: '400 12.5px/1.4 var(--font-ui)' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--muted)' }}>
                    {['Fila', 'Prenda', 'Talla', 'Cant.', 'Estado'].map((h) => (
                      <th key={h} style={{ padding: '8px 10px', fontWeight: 600 }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...resultado.filas]
                    .sort((a, b) => Number(b.estado === 'error') - Number(a.estado === 'error') || a.fila - b.fila)
                    .map((f) => (
                      <tr key={f.fila} style={{ borderTop: '1px solid var(--border)', color: 'var(--text)' }}>
                        <td style={{ padding: '8px 10px' }}>{f.fila}</td>
                        <td style={{ padding: '8px 10px' }}>
                          {f.nombre} · {f.marca}
                          <div style={{ color: 'var(--muted)' }}>
                            {f.categoria}
                            {f.color && ` · ${f.color}`}
                          </div>
                        </td>
                        <td style={{ padding: '8px 10px' }}>{f.talla || '—'}</td>
                        <td style={{ padding: '8px 10px' }}>{f.cantidad ?? '—'}</td>
                        <td
                          style={{
                            padding: '8px 10px',
                            color: f.estado === 'error' ? 'var(--badtext)' : 'var(--text)',
                          }}
                        >
                          {ETIQUETA_ESTADO[f.estado]}
                          {f.error && <div>{f.error}</div>}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <button
          type="button"
          disabled={trabajando || !puedeImportar}
          onClick={() => void confirmar()}
          style={{
            ...boton,
            background: puedeImportar ? 'var(--primary)' : 'var(--chip)',
            color: puedeImportar ? 'var(--pfg)' : 'var(--faint)',
            cursor: puedeImportar ? 'pointer' : 'not-allowed',
          }}
        >
          {trabajando && resultado ? 'Importando…' : `Importar ${puedeImportar ? resumen!.total : ''} filas`.replace('  ', ' ')}
        </button>
        <button
          type="button"
          onClick={onCerrar}
          disabled={trabajando}
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
