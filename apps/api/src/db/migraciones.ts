import type Database from 'better-sqlite3';

// schema.sql solo usa CREATE TABLE IF NOT EXISTS: una BD que ya existe (la de
// la tienda) no recibe columnas nuevas al reiniciar. Cada columna agregada
// después del primer despliegue se añade aquí, de forma idempotente.
const COLUMNAS: { tabla: string; columna: string; definicion: string }[] = [
  { tabla: 'categorias', columna: 'por_color', definicion: 'INTEGER NOT NULL DEFAULT 0' },
  { tabla: 'productos', columna: 'color', definicion: 'TEXT' },
];

export function aplicarMigraciones(db: Database.Database) {
  for (const { tabla, columna, definicion } of COLUMNAS) {
    const existentes = db.prepare(`PRAGMA table_info(${tabla})`).all() as { name: string }[];
    if (!existentes.some((c) => c.name === columna)) {
      db.exec(`ALTER TABLE ${tabla} ADD COLUMN ${columna} ${definicion}`);
    }
  }
}
