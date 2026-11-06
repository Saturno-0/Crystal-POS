import type Database from 'better-sqlite3';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { crearDbDePrueba } from '../test/testDb.js';
import * as respaldos from './respaldos.service.js';

let db: Database.Database;
let carpetaTmp: string;
let dbPathFalso: string;

beforeEach(() => {
  db = crearDbDePrueba();
  carpetaTmp = mkdtempSync(join(tmpdir(), 'crystal-respaldos-'));
  dbPathFalso = join(carpetaTmp, 'hilo.sqlite'); // solo se usa su dirname(); no necesita existir
  delete process.env.HILO_BACKUPS_DIR;
  delete process.env.HILO_MAX_RESPALDOS;
});

afterEach(() => {
  rmSync(carpetaTmp, { recursive: true, force: true });
});

describe('ejecutarRespaldo (HU-6.5)', () => {
  it('crea un archivo .sqlite no vacío en la carpeta de respaldos junto a la BD', async () => {
    const info = await respaldos.ejecutarRespaldo(db, dbPathFalso);
    expect(info.nombre).toMatch(/\.sqlite$/);
    expect(info.tamanoBytes).toBeGreaterThan(0);

    const carpeta = join(carpetaTmp, 'backups');
    expect(existsSync(join(carpeta, info.nombre))).toBe(true);
  });

  it('respeta HILO_BACKUPS_DIR si se define', async () => {
    const carpetaCustom = join(carpetaTmp, 'otro-destino');
    process.env.HILO_BACKUPS_DIR = carpetaCustom;
    const info = await respaldos.ejecutarRespaldo(db, dbPathFalso);
    expect(existsSync(join(carpetaCustom, info.nombre))).toBe(true);
  });

  it('poda los respaldos más viejos cuando se excede HILO_MAX_RESPALDOS', async () => {
    process.env.HILO_MAX_RESPALDOS = '2';
    await respaldos.ejecutarRespaldo(db, dbPathFalso);
    await respaldos.ejecutarRespaldo(db, dbPathFalso);
    await respaldos.ejecutarRespaldo(db, dbPathFalso);

    const carpeta = join(carpetaTmp, 'backups');
    expect(readdirSync(carpeta).filter((f) => f.endsWith('.sqlite'))).toHaveLength(2);
  });
});

describe('listarRespaldos', () => {
  it('lista del más nuevo al más viejo', async () => {
    const primero = await respaldos.ejecutarRespaldo(db, dbPathFalso);
    const segundo = await respaldos.ejecutarRespaldo(db, dbPathFalso);

    const lista = respaldos.listarRespaldos(dbPathFalso);
    expect(lista[0].nombre).toBe(segundo.nombre);
    expect(lista[1].nombre).toBe(primero.nombre);
  });

  it('retorna vacío si todavía no hay respaldos', () => {
    expect(respaldos.listarRespaldos(dbPathFalso)).toEqual([]);
  });
});
