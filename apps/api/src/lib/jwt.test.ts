import { describe, expect, it } from 'vitest';
import { emitirToken, verificarToken } from './jwt.js';

describe('emitirToken / verificarToken', () => {
  it('un token emitido se puede verificar y sus datos coinciden', () => {
    const token = emitirToken({ sub: 1, rol: 'admin', nombre: 'Daniela Ochoa' });
    const sesion = verificarToken(token);
    expect(sesion).toEqual({ sub: 1, rol: 'admin', nombre: 'Daniela Ochoa' });
  });

  it('el payload verificado se puede reemitir sin error (sesión deslizante)', () => {
    // Regresión: jwt.sign lanza si el payload ya trae `exp`/`iat` y además
    // se pasa `expiresIn` — verificarToken debe devolver un payload limpio.
    const token = emitirToken({ sub: 2, rol: 'vendedor', nombre: 'Marisol Rivas' });
    const sesion = verificarToken(token);
    expect(() => emitirToken(sesion)).not.toThrow();
    const renovado = emitirToken(sesion);
    expect(verificarToken(renovado)).toEqual(sesion);
  });
});
