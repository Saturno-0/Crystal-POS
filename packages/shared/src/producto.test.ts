import { describe, expect, it } from 'vitest';
import {
  COLORES_COMUNES,
  descuentoVestidoValido,
  nombreConColor,
  normalizarColor,
  tallaValida,
} from './producto.js';

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

describe('normalizarColor', () => {
  it('recorta espacios y deja solo la primera letra en mayúscula', () => {
    expect(normalizarColor('  azul   MARINO ')).toBe('Azul marino');
  });
  it('devuelve null si está vacío', () => {
    expect(normalizarColor('   ')).toBeNull();
    expect(normalizarColor(undefined)).toBeNull();
  });
  it('los colores comunes ya vienen normalizados', () => {
    for (const c of COLORES_COMUNES) expect(normalizarColor(c)).toBe(c);
  });
});

describe('nombreConColor', () => {
  it('agrega el color solo si existe', () => {
    expect(nombreConColor('Saco slim', 'Negro')).toBe('Saco slim — Negro');
    expect(nombreConColor('Blusa', null)).toBe('Blusa');
  });
});
