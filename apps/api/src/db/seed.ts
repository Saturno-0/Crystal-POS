import type Database from 'better-sqlite3';
import { hashSecreto } from '../lib/crypto.js';

// Datos semilla: mismos usuarios y categorías del prototipo aprobado
// (docs/Sistema POS v3.dc.html), decisión explícita de la dueña de seguir
// usándolos como punto de partida. NIP demo 1234 para todos.
const CATEGORIAS = [
  { nombre: 'Mezclilla', tipoTalla: 'numerica_pantalon' },
  { nombre: 'Blusas', tipoTalla: 'estandar_ropa' },
  { nombre: 'Chamarras', tipoTalla: 'estandar_ropa' },
  { nombre: 'Vestidos', tipoTalla: 'sin_talla' },
  { nombre: 'Accesorios', tipoTalla: 'estandar_ropa' },
] as const;

const USUARIOS = [
  { nombre: 'Crystal Domínguez', usuario: 'crystal.d', rol: 'admin', tasaComision: 0 },
  { nombre: 'Marisol Rivas', usuario: 'marisol.r', rol: 'vendedor', tasaComision: 6 },
  { nombre: 'Julio Tenorio', usuario: 'julio.t', rol: 'vendedor', tasaComision: 6 },
  { nombre: 'Nadia Cruz', usuario: 'nadia.c', rol: 'vendedor', tasaComision: 5 },
  { nombre: 'Alonso Vega', usuario: 'alonso.v', rol: 'vendedor', tasaComision: 8 },
] as const;

const NIP_DEMO = '1234';

export function seedInicial(db: Database.Database) {
  const yaHayUsuarios = (db.prepare('SELECT COUNT(*) AS n FROM usuarios').get() as { n: number }).n > 0;
  if (yaHayUsuarios) return;

  const insertCategoria = db.prepare(
    'INSERT INTO categorias (nombre, tipo_talla) VALUES (@nombre, @tipoTalla)',
  );
  const insertUsuario = db.prepare(
    `INSERT INTO usuarios (nombre, usuario, nip_hash, rol, tasa_comision)
     VALUES (@nombre, @usuario, @nipHash, @rol, @tasaComision)`,
  );

  const transaccion = db.transaction(() => {
    for (const categoria of CATEGORIAS) insertCategoria.run(categoria);
    for (const usuario of USUARIOS) {
      insertUsuario.run({ ...usuario, nipHash: hashSecreto(NIP_DEMO) });
    }
  });
  transaccion();
}
