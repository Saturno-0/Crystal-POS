import type Database from 'better-sqlite3';
import { ejecutarRespaldo } from '../services/respaldos.service.js';

// La laptop de la tienda solo está prendida en horario de negocio, así que un
// respaldo al iniciar + uno cada pocas horas mientras corre es lo que
// efectivamente produce al menos un respaldo por día de operación (un
// intervalo de 24h podría nunca dispararse si el proceso se reinicia cada
// mañana). HU-6.5: "respaldos automáticos", fase posterior del MVP.
const INTERVALO_HORAS = Number(process.env.HILO_RESPALDO_INTERVALO_HORAS ?? 6);

export function iniciarRespaldosAutomaticos(db: Database.Database, dbPath: string): void {
  function respaldar() {
    ejecutarRespaldo(db, dbPath).catch((err) => console.error('Respaldo automático falló:', err));
  }

  respaldar();
  setInterval(respaldar, INTERVALO_HORAS * 60 * 60 * 1000);
}
