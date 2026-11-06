import { describe, expect, it } from 'vitest';
import { iniciales, usuarioSugerido } from './nombre.js';

describe('iniciales', () => {
  it('toma la primera letra del nombre y del apellido', () => {
    expect(iniciales('Daniela Ochoa')).toBe('DO');
  });

  it('funciona con un solo nombre', () => {
    expect(iniciales('Cher')).toBe('C');
  });
});

describe('usuarioSugerido', () => {
  it('genera nombre.inicial en minúsculas', () => {
    expect(usuarioSugerido('Daniela Ochoa')).toBe('daniela.o');
  });

  it('quita acentos', () => {
    expect(usuarioSugerido('José Ángel Pérez')).toBe('jose.a');
  });

  it('usa solo el nombre si no hay apellido', () => {
    expect(usuarioSugerido('Cher')).toBe('cher');
  });
});
