import { useState } from 'react';
import styles from './orden.module.css';

export type OrdenProductos = 'alfabetico' | 'recientes' | 'marca';

const OPCIONES: { valor: OrdenProductos; etiqueta: string }[] = [
  { valor: 'alfabetico', etiqueta: 'A–Z' },
  { valor: 'recientes', etiqueta: 'Más recientes' },
  { valor: 'marca', etiqueta: 'Marca' },
];

/** Lo mínimo para ordenar un producto (o un modelo agrupado de Venta). */
export interface DatosOrden {
  nombre: string;
  marca: string;
  /** created_at de SQLite ('YYYY-MM-DD HH:MM:SS'): se compara como texto. */
  createdAt: string;
  id: number;
}

const texto = (a: string, b: string) => a.localeCompare(b, 'es', { sensitivity: 'base' });

export function ordenar<T>(items: T[], orden: OrdenProductos, datos: (item: T) => DatosOrden): T[] {
  return [...items].sort((x, y) => {
    const a = datos(x);
    const b = datos(y);
    if (orden === 'recientes') return b.createdAt.localeCompare(a.createdAt) || b.id - a.id;
    if (orden === 'marca') return texto(a.marca, b.marca) || texto(a.nombre, b.nombre);
    return texto(a.nombre, b.nombre) || texto(a.marca, b.marca);
  });
}

/** Orden elegido, recordado por pantalla en este navegador (solo comodidad). */
export function useOrdenGuardado(clave: string) {
  const llave = `crystal.orden.${clave}`;
  const [orden, setOrdenEstado] = useState<OrdenProductos>(() => {
    try {
      const guardado = localStorage.getItem(llave);
      if (OPCIONES.some((o) => o.valor === guardado)) return guardado as OrdenProductos;
    } catch {
      // Sin almacenamiento disponible: se usa el orden por defecto.
    }
    return 'alfabetico';
  });

  function setOrden(nuevo: OrdenProductos) {
    setOrdenEstado(nuevo);
    try {
      localStorage.setItem(llave, nuevo);
    } catch {
      // Ignorado: el orden solo no se recordará.
    }
  }

  return [orden, setOrden] as const;
}

export function SelectorOrden({
  valor,
  onChange,
}: {
  valor: OrdenProductos;
  onChange: (orden: OrdenProductos) => void;
}) {
  return (
    <label className={styles.selector}>
      <span className={styles.etiqueta}>Orden</span>
      <select
        className={styles.select}
        value={valor}
        onChange={(e) => onChange(e.target.value as OrdenProductos)}
        aria-label="Ordenar productos"
      >
        {OPCIONES.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.etiqueta}
          </option>
        ))}
      </select>
    </label>
  );
}
