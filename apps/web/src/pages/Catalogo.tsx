import type { Categoria, Producto } from '@crystal/shared';
import { useEffect, useMemo, useState } from 'react';
import { useToast } from '../components/feedback/ToastProvider';
import { agruparPorModelo, type ModeloCatalogo } from '../features/productos/agrupar';
import * as productosApi from '../features/productos/api';
import { ordenar, SelectorOrden, useOrdenGuardado } from '../features/productos/orden';
import styles from './Catalogo.module.css';
import { SelectorTalla } from './SelectorTalla';

const formatoMXN = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

/** Catálogo de búsqueda y filtro (HU-2.6/2.7), usado como panel izquierdo de Venta. */
export function Catalogo({
  onAgregar,
  refrescarSenal,
}: {
  onAgregar: (producto: Producto) => void;
  refrescarSenal?: number;
}) {
  const { mostrar } = useToast();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriaId, setCategoriaId] = useState<number | null>(null);
  const [busquedaInput, setBusquedaInput] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [productos, setProductos] = useState<Producto[]>([]);
  const [totalCatalogo, setTotalCatalogo] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [modeloAbierto, setModeloAbierto] = useState<ModeloCatalogo | null>(null);
  // Las prendas dadas de alta por tallas son un producto/SKU por talla; aquí
  // se juntan en una sola tarjeta y la talla se elige al agregarla.
  const [orden, setOrden] = useOrdenGuardado('venta');
  const modelos = useMemo(
    () =>
      ordenar(agruparPorModelo(productos), orden, (m) => {
        // "Más recientes" en un modelo agrupado = su talla/color más nuevo.
        const masNueva = m.variantes.reduce((a, b) =>
          b.createdAt.localeCompare(a.createdAt) > 0 || (b.createdAt === a.createdAt && b.id > a.id) ? b : a,
        );
        return { nombre: m.base.nombre, marca: m.base.marca, createdAt: masNueva.createdAt, id: masNueva.id };
      }),
    [productos, orden],
  );

  useEffect(() => {
    productosApi.listarCategorias().then(setCategorias);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => setBusqueda(busquedaInput), 250);
    return () => clearTimeout(timeout);
  }, [busquedaInput]);

  useEffect(() => {
    setCargando(true);
    productosApi
      .listarProductos({ busqueda: busqueda || undefined, categoriaId: categoriaId ?? undefined })
      .then(setProductos)
      .finally(() => setCargando(false));
    productosApi.listarProductos().then((lista) => setTotalCatalogo(agruparPorModelo(lista).length));
    // refrescarSenal cambia tras cada venta, para reflejar el stock recién descontado.
  }, [busqueda, categoriaId, refrescarSenal]);

  function badgeStyle(stock: number): React.CSSProperties {
    if (stock === 0) return { background: 'var(--badsoft)', color: 'var(--badtext)' };
    if (stock <= 5) return { background: 'var(--warnsoft)', color: 'var(--warntext)' };
    return { background: 'var(--chip)', color: 'var(--muted)' };
  }

  return (
    <div className={styles.contenedor}>
      <div className={styles.barra}>
        <div className={styles.filaBusqueda}>
          <input
            className={styles.buscador}
            value={busquedaInput}
            onChange={(e) => setBusquedaInput(e.target.value)}
            placeholder="Buscar nombre, marca o SKU…"
          />
          <SelectorOrden valor={orden} onChange={setOrden} />
        </div>
        <div className={styles.categorias}>
          <button
            type="button"
            className={categoriaId === null ? styles.chipActivo : styles.chip}
            onClick={() => setCategoriaId(null)}
          >
            Todo · {totalCatalogo}
          </button>
          {categorias.map((c) => (
            <button
              key={c.id}
              type="button"
              className={categoriaId === c.id ? styles.chipActivo : styles.chip}
              onClick={() => setCategoriaId(c.id)}
            >
              {c.nombre}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.grid}>
        {!cargando && modelos.length === 0 && (
          <div className={styles.vacio}>Sin resultados para esa búsqueda.</div>
        )}
        {modelos.map((m) => {
          const p = m.base;
          const varias = m.variantes.length > 1;
          const colores = [...new Set(m.variantes.map((v) => v.color).filter(Boolean))];
          const tallasDisponibles = [...new Set(m.variantes.filter((v) => v.stock > 0).map((v) => v.talla))];
          return (
            <button
              key={m.clave}
              type="button"
              className={m.stockTotal === 0 ? styles.tarjetaAgotada : styles.tarjeta}
              onClick={() => {
                if (m.stockTotal === 0) mostrar(`Sin existencias de ${p.nombre}`);
                else if (varias) setModeloAbierto(m);
                else onAgregar(p);
              }}
            >
              <div className={styles.filaSuperior}>
                <span className={styles.sku}>
                  {varias ? `${m.variantes.length} ${colores.length > 1 ? 'variantes' : 'tallas'}` : p.sku}
                </span>
                <span className={styles.badgeStock} style={badgeStyle(m.stockTotal)}>
                  {m.stockTotal} u
                </span>
              </div>
              <div className={styles.nombre}>{p.nombre}</div>
              <div className={styles.detalle}>
                {varias ? (
                  <>
                    {p.marca} · tallas {tallasDisponibles.join(', ') || '—'}
                    {colores.length > 1 ? ` · ${colores.length} colores` : colores[0] ? ` · ${colores[0]}` : ''}
                  </>
                ) : (
                  <>
                    {p.marca} · talla {p.talla ?? 'Única'}
                    {p.color ? ` · ${p.color}` : ''}
                  </>
                )}
              </div>
              <div className={styles.pie}>
                <span className={styles.precio}>{formatoMXN.format(p.precio)}</span>
                <span className={styles.agregar}>{varias ? '+ elegir talla' : '+ agregar'}</span>
              </div>
            </button>
          );
        })}
      </div>

      {modeloAbierto && (
        <SelectorTalla
          modelo={modeloAbierto}
          onCerrar={() => setModeloAbierto(null)}
          onElegir={(producto) => {
            onAgregar(producto);
            setModeloAbierto(null);
          }}
        />
      )}
    </div>
  );
}
