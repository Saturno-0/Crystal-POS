import type Database from 'better-sqlite3';
import { mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';

// HU-6.5: respaldos locales a una carpeta en la misma laptop (fase posterior
// del MVP, sin nube ni red). El máximo acota el espacio en disco de una
// laptop de tienda que puede no tener mucho libre; se lee en cada llamada
// (no al cargar el módulo) para poder configurarse/probarse en caliente.
function maxRespaldos(): number {
  return Number(process.env.HILO_MAX_RESPALDOS ?? 30);
}

function carpetaRespaldos(dbPath: string): string {
  return process.env.HILO_BACKUPS_DIR ?? join(dirname(dbPath), 'backups');
}

function nombreArchivo(ahora = new Date()): string {
  const iso = ahora.toISOString().replace(/[:.]/g, '-');
  const sufijo = Math.random().toString(16).slice(2, 6);
  return `crystal-${iso}-${sufijo}.sqlite`;
}

export interface RespaldoInfo {
  nombre: string;
  tamanoBytes: number;
  creadoEn: string;
}

export function listarRespaldos(dbPath: string): RespaldoInfo[] {
  const carpeta = carpetaRespaldos(dbPath);
  mkdirSync(carpeta, { recursive: true });
  return readdirSync(carpeta)
    .filter((nombre) => nombre.endsWith('.sqlite'))
    .map((nombre) => {
      const stat = statSync(join(carpeta, nombre));
      return { nombre, tamanoBytes: stat.size, creadoEn: stat.mtime.toISOString() };
    })
    .sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
}

function podarRespaldosViejos(dbPath: string): void {
  const carpeta = carpetaRespaldos(dbPath);
  const sobrantes = listarRespaldos(dbPath).slice(maxRespaldos());
  for (const r of sobrantes) unlinkSync(join(carpeta, r.nombre));
}

/**
 * Respaldo en caliente vía la API de backup de SQLite: a diferencia de copiar
 * el archivo .sqlite a mano, esto es seguro aunque la BD esté en modo WAL con
 * escrituras en curso (no corrompe ni pierde las últimas transacciones).
 */
export async function ejecutarRespaldo(db: Database.Database, dbPath: string): Promise<RespaldoInfo> {
  const carpeta = carpetaRespaldos(dbPath);
  mkdirSync(carpeta, { recursive: true });
  const nombre = nombreArchivo();
  const destino = join(carpeta, nombre);

  await db.backup(destino);
  podarRespaldosViejos(dbPath);

  const stat = statSync(destino);
  return { nombre, tamanoBytes: stat.size, creadoEn: stat.mtime.toISOString() };
}
