import type { Categoria, TipoTalla } from '@crystal/shared';
import { useState } from 'react';
import { useToast } from '../components/feedback/ToastProvider';
import * as productosApi from '../features/productos/api';
import { ApiError } from '../lib/apiClient';
import styles from './Alta.module.css';

const ETIQUETA_TIPO_TALLA: Record<TipoTalla, string> = {
  numerica_pantalon: 'Numérica (pantalón)',
  estandar_ropa: 'XS–XL',
  sin_talla: 'Sin talla',
};

const TIPOS_TALLA: TipoTalla[] = ['numerica_pantalon', 'estandar_ropa', 'sin_talla'];

/**
 * Alta/baja de categorías — solo Admin. No es parte de HU-2.x del handoff
 * original; se agregó porque la dueña quiere poder ajustar el catálogo de
 * categorías sin tocar código. Eliminar solo se permite sin productos
 * asociados (lo aplica el backend).
 */
export function GestionCategorias({
  categorias,
  onCambio,
}: {
  categorias: Categoria[];
  onCambio: () => void;
}) {
  const { mostrar } = useToast();
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState('');
  const [tipoTalla, setTipoTalla] = useState<TipoTalla>('estandar_ropa');
  const [enviando, setEnviando] = useState(false);

  async function agregar() {
    if (!nombre.trim() || enviando) return;
    setEnviando(true);
    try {
      await productosApi.crearCategoria({ nombre: nombre.trim(), tipoTalla });
      setNombre('');
      onCambio();
      mostrar(`Categoría "${nombre.trim()}" agregada`);
    } catch (err) {
      mostrar(err instanceof ApiError ? err.message : 'No se pudo crear la categoría');
    } finally {
      setEnviando(false);
    }
  }

  async function eliminar(categoria: Categoria) {
    try {
      await productosApi.eliminarCategoria(categoria.id);
      onCambio();
      mostrar(`Categoría "${categoria.nombre}" eliminada`);
    } catch (err) {
      mostrar(err instanceof ApiError ? err.message : 'No se pudo eliminar la categoría');
    }
  }

  return (
    <div className={styles.campo}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        style={{
          border: 'none',
          background: 'transparent',
          color: 'var(--muted)',
          font: "500 12px/1.3 var(--font-ui)",
          cursor: 'pointer',
          textAlign: 'left',
          padding: 0,
        }}
      >
        {abierto ? '▾' : '▸'} Gestionar categorías
      </button>

      {abierto && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            padding: 12,
            borderRadius: 9,
            border: '1px solid var(--border)',
            background: 'var(--surface2)',
          }}
        >
          {categorias.map((c) => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ flex: 1, font: "500 13px/1.3 var(--font-ui)" }}>{c.nombre}</span>
              <span style={{ font: "400 11px/1 var(--font-mono)", color: 'var(--faint)' }}>
                {ETIQUETA_TIPO_TALLA[c.tipoTalla]}
              </span>
              <button
                type="button"
                onClick={() => eliminar(c)}
                style={{
                  height: 28,
                  padding: '0 10px',
                  borderRadius: 6,
                  border: '1px solid var(--bad)',
                  background: 'transparent',
                  color: 'var(--badtext)',
                  font: "600 11px/1 var(--font-ui)",
                  cursor: 'pointer',
                }}
              >
                Eliminar
              </button>
            </div>
          ))}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              className={styles.inputSecundario}
              style={{ flex: 1, minWidth: 140, height: 38 }}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nueva categoría"
            />
            <select
              value={tipoTalla}
              onChange={(e) => setTipoTalla(e.target.value as TipoTalla)}
              style={{
                height: 38,
                borderRadius: 8,
                border: '1px solid var(--border2)',
                background: 'var(--surface)',
                color: 'var(--text)',
                font: "400 12.5px/1 var(--font-ui)",
                padding: '0 8px',
              }}
            >
              {TIPOS_TALLA.map((t) => (
                <option key={t} value={t}>
                  {ETIQUETA_TIPO_TALLA[t]}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={agregar}
              disabled={enviando || !nombre.trim()}
              style={{
                height: 38,
                padding: '0 14px',
                borderRadius: 8,
                border: 'none',
                background: 'var(--primary)',
                color: 'var(--pfg)',
                font: "600 12.5px/1 var(--font-ui)",
                cursor: 'pointer',
              }}
            >
              Agregar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
