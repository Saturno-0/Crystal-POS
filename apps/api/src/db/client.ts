import Database from 'better-sqlite3';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { aplicarMigraciones } from './migraciones.js';
import { seedInicial } from './seed.js';

const here = dirname(fileURLToPath(import.meta.url));
export const dbPath = process.env.HILO_DB_PATH ?? join(here, '../../data/hilo.sqlite');

mkdirSync(dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schema = readFileSync(join(here, 'schema.sql'), 'utf-8');
db.exec(schema);
aplicarMigraciones(db);

seedInicial(db);
