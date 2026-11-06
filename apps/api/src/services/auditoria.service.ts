import type Database from 'better-sqlite3';

export function registrar(
  db: Database.Database,
  params: {
    usuarioId: number | null;
    accion: string;
    entidad: string;
    entidadId?: number;
    detalle?: unknown;
  },
) {
  db.prepare(
    `INSERT INTO auditoria (usuario_id, accion, entidad, entidad_id, detalle)
     VALUES (@usuarioId, @accion, @entidad, @entidadId, @detalle)`,
  ).run({
    usuarioId: params.usuarioId,
    accion: params.accion,
    entidad: params.entidad,
    entidadId: params.entidadId ?? null,
    detalle: params.detalle ? JSON.stringify(params.detalle) : null,
  });
}
