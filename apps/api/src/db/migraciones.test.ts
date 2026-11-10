import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { aplicarMigraciones } from './migraciones.js';

describe('aplicarMigraciones', () => {
  it('agrega por_color y color a una BD creada antes de que existieran, sin perder datos', () => {
    const db = new Database(':memory:');
    db.exec(`
      CREATE TABLE categorias (id INTEGER PRIMARY KEY, nombre TEXT NOT NULL, tipo_talla TEXT NOT NULL);
      CREATE TABLE productos (id INTEGER PRIMARY KEY, nombre TEXT NOT NULL, talla TEXT);
      INSERT INTO categorias (nombre, tipo_talla) VALUES ('Blusas', 'estandar_ropa');
      INSERT INTO productos (nombre, talla) VALUES ('Blusa', 'M');
    `);

    aplicarMigraciones(db);
    aplicarMigraciones(db); // idempotente

    expect(db.prepare('SELECT por_color FROM categorias').get()).toEqual({ por_color: 0 });
    expect(db.prepare('SELECT nombre, color FROM productos').get()).toEqual({ nombre: 'Blusa', color: null });
  });
});
