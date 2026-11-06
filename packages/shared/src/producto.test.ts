import { describe, expect, it } from 'vitest';
import { descuentoVestidoValido, tallaValida } from './producto.js';

describe('tallaValida', () => {
  it('acepta tallas numéricas válidas de pantalón', () => {
    expect(tallaValida('numerica_pantalon', '7')).toBe(true);
  });

  it('rechaza una talla numérica fuera de la lista', () => {
    expect(tallaValida('numerica_pantalon', '2')).toBe(false);
  });

  it('acepta XS–XL para ropa estándar', () => {
    expect(tallaValida('estandar_ropa', 'M')).toBe(true);
    expect(tallaValida('estandar_ropa', 'XXL')).toBe(false);
  });

  it('vestidos (sin_talla) no requieren talla o aceptan "Única"', () => {
    expect(tallaValida('sin_talla', null)).toBe(true);
    expect(tallaValida('sin_talla', 'Única')).toBe(true);
    expect(tallaValida('sin_talla', 'M')).toBe(false);
  });
});

describe('descuentoVestidoValido', () => {
  it('permite no tener descuento', () => {
    expect(descuentoVestidoValido(null, null)).toBe(true);
  });

  it('acepta las 3 combinaciones permitidas', () => {
    expect(descuentoVestidoValido('pct', 10)).toBe(true);
    expect(descuentoVestidoValido('monto', 100)).toBe(true);
    expect(descuentoVestidoValido('monto', 40)).toBe(true);
  });

  it('rechaza cualquier otra combinación', () => {
    expect(descuentoVestidoValido('pct', 20)).toBe(false);
    expect(descuentoVestidoValido('monto', 50)).toBe(false);
  });
});
