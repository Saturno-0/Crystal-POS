import { calcularLinea, type Producto, type ResultadoLinea, type TipoDescuento } from '@crystal/shared';
import { useCallback, useMemo, useState } from 'react';

export interface LineaCarrito {
  producto: Producto;
  cantidad: number;
  probado: boolean;
  /** Descuento manual capturado en la línea (regla 5: sobrescribe al automático del producto). */
  descuentoTipo: TipoDescuento;
  descuentoValor: number; // 0 = sin descuento manual capturado
}

export interface LineaCarritoCalculada {
  linea: LineaCarrito;
  resultado: ResultadoLinea;
}

function calcularResultado(l: LineaCarrito): ResultadoLinea {
  return calcularLinea({
    precio: l.producto.precio,
    cantidad: l.cantidad,
    auto: l.producto.descuentoTipo
      ? { tipo: l.producto.descuentoTipo, valor: l.producto.descuentoValor ?? 0 }
      : null,
    manual: l.descuentoValor > 0 ? { tipo: l.descuentoTipo, valor: l.descuentoValor } : null,
  });
}

export function useCarrito() {
  const [lineas, setLineas] = useState<LineaCarrito[]>([]);

  const agregar = useCallback((producto: Producto) => {
    setLineas((actual) => {
      const existente = actual.find((l) => l.producto.id === producto.id);
      if (existente) {
        if (existente.cantidad >= producto.stock) return actual;
        return actual.map((l) =>
          l.producto.id === producto.id ? { ...l, cantidad: l.cantidad + 1 } : l,
        );
      }
      return [...actual, { producto, cantidad: 1, probado: false, descuentoTipo: 'pct', descuentoValor: 0 }];
    });
  }, []);

  const cambiarCantidad = useCallback((productoId: number, delta: number) => {
    setLineas((actual) =>
      actual.map((l) =>
        l.producto.id === productoId
          ? { ...l, cantidad: Math.min(l.producto.stock, Math.max(1, l.cantidad + delta)) }
          : l,
      ),
    );
  }, []);

  const quitar = useCallback((productoId: number) => {
    setLineas((actual) => actual.filter((l) => l.producto.id !== productoId));
  }, []);

  const alternarProbado = useCallback((productoId: number) => {
    setLineas((actual) =>
      actual.map((l) => (l.producto.id === productoId ? { ...l, probado: !l.probado } : l)),
    );
  }, []);

  const setDescuento = useCallback((productoId: number, tipo: TipoDescuento, valor: number) => {
    setLineas((actual) =>
      actual.map((l) =>
        l.producto.id === productoId ? { ...l, descuentoTipo: tipo, descuentoValor: valor } : l,
      ),
    );
  }, []);

  const vaciar = useCallback(() => setLineas([]), []);

  const calculadas = useMemo<LineaCarritoCalculada[]>(
    () => lineas.map((linea) => ({ linea, resultado: calcularResultado(linea) })),
    [lineas],
  );

  const piezas = useMemo(() => lineas.reduce((acc, l) => acc + l.cantidad, 0), [lineas]);

  return {
    lineas,
    calculadas,
    piezas,
    agregar,
    cambiarCantidad,
    quitar,
    alternarProbado,
    setDescuento,
    vaciar,
  };
}

export type UseCarrito = ReturnType<typeof useCarrito>;
