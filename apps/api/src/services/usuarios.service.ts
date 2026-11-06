import type Database from 'better-sqlite3';
import { iniciales, usuarioSugerido, type Rol, type Usuario } from '@crystal/shared';
import { hashSecreto, verificarSecreto } from '../lib/crypto.js';
import { NotFoundError, ValidationError } from '../lib/errors.js';
import { registrar as registrarAuditoria } from './auditoria.service.js';

interface UsuarioRow {
  id: number;
  nombre: string;
  usuario: string;
  nip_hash: string;
  rol: Rol;
  tasa_comision: number;
  pregunta_seguridad: string | null;
  respuesta_seguridad_hash: string | null;
  activo: number;
  created_at: string;
  updated_at: string;
}

const NIP_REGEX = /^\d{4}$/;

function aPublico(row: UsuarioRow): Usuario & { ini: string; preguntaSeguridad: string | null } {
  return {
    id: row.id,
    nombre: row.nombre,
    usuario: row.usuario,
    ini: iniciales(row.nombre),
    rol: row.rol,
    tasaComision: row.tasa_comision,
    activo: row.activo === 1,
    preguntaSeguridad: row.pregunta_seguridad,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizarRespuesta(respuesta: string): string {
  return respuesta.trim().toLowerCase();
}

function buscarPorId(db: Database.Database, id: number): UsuarioRow | undefined {
  return db.prepare('SELECT * FROM usuarios WHERE id = ?').get(id) as UsuarioRow | undefined;
}

function generarUsuarioUnico(db: Database.Database, nombre: string): string {
  const base = usuarioSugerido(nombre);
  let candidato = base;
  let sufijo = 2;
  while (db.prepare('SELECT 1 FROM usuarios WHERE usuario = ?').get(candidato)) {
    candidato = `${base}${sufijo}`;
    sufijo += 1;
  }
  return candidato;
}

function contarAdminsActivos(db: Database.Database, excluirId?: number): number {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS n FROM usuarios
       WHERE rol = 'admin' AND activo = 1 AND id != COALESCE(?, -1)`,
    )
    .get(excluirId ?? null) as { n: number };
  return row.n;
}

export function listar(db: Database.Database) {
  const rows = db
    .prepare('SELECT * FROM usuarios WHERE activo = 1 ORDER BY nombre')
    .all() as UsuarioRow[];
  return rows.map(aPublico);
}

export interface CrearUsuarioInput {
  nombre: string;
  usuario?: string;
  nip: string;
  tasaComision?: number;
  rol: Rol;
  preguntaSeguridad?: string;
  respuestaSeguridad?: string;
}

export function crear(db: Database.Database, input: CrearUsuarioInput) {
  const nombre = input.nombre.trim();
  if (!nombre) {
    throw new ValidationError('El nombre es obligatorio');
  }
  if (!NIP_REGEX.test(input.nip)) {
    throw new ValidationError('El NIP debe tener 4 dígitos');
  }
  if (input.rol !== 'admin' && input.rol !== 'vendedor') {
    throw new ValidationError('Rol inválido');
  }

  const usuarioDeseado = input.usuario?.trim();
  if (usuarioDeseado && db.prepare('SELECT 1 FROM usuarios WHERE usuario = ?').get(usuarioDeseado)) {
    throw new ValidationError('Ese usuario ya existe');
  }
  const usuario = usuarioDeseado || generarUsuarioUnico(db, nombre);

  const tasaComision = input.tasaComision ?? 0;
  if (!Number.isFinite(tasaComision) || tasaComision < 0) {
    throw new ValidationError('La comisión debe ser un número válido');
  }

  const nipHash = hashSecreto(input.nip);
  const respuestaHash = input.respuestaSeguridad
    ? hashSecreto(normalizarRespuesta(input.respuestaSeguridad))
    : null;

  const result = db
    .prepare(
      `INSERT INTO usuarios (nombre, usuario, nip_hash, rol, tasa_comision, pregunta_seguridad, respuesta_seguridad_hash)
       VALUES (@nombre, @usuario, @nipHash, @rol, @tasaComision, @preguntaSeguridad, @respuestaHash)`,
    )
    .run({
      nombre,
      usuario,
      nipHash,
      rol: input.rol,
      tasaComision,
      preguntaSeguridad: input.preguntaSeguridad?.trim() || null,
      respuestaHash,
    });

  registrarAuditoria(db, {
    usuarioId: null,
    accion: 'usuario.crear',
    entidad: 'usuario',
    entidadId: Number(result.lastInsertRowid),
    detalle: { nombre, usuario, rol: input.rol },
  });

  return aPublico(buscarPorId(db, Number(result.lastInsertRowid))!);
}

export function cambiarRol(db: Database.Database, id: number, nuevoRol: Rol, actorId: number) {
  const target = buscarPorId(db, id);
  if (!target || target.activo !== 1) throw new NotFoundError('Usuario no encontrado');
  if (nuevoRol !== 'admin' && nuevoRol !== 'vendedor') {
    throw new ValidationError('Rol inválido');
  }
  if (target.rol === 'admin' && nuevoRol !== 'admin' && contarAdminsActivos(db, target.id) === 0) {
    throw new ValidationError('Debe existir al menos un Admin activo');
  }

  db.prepare('UPDATE usuarios SET rol = ?, updated_at = datetime(\'now\') WHERE id = ?').run(
    nuevoRol,
    id,
  );
  registrarAuditoria(db, {
    usuarioId: actorId,
    accion: 'usuario.cambiar_rol',
    entidad: 'usuario',
    entidadId: id,
    detalle: { de: target.rol, a: nuevoRol },
  });
  return aPublico(buscarPorId(db, id)!);
}

export interface ActualizarPerfilInput {
  nombre?: string;
  usuario?: string;
}

export function actualizarPerfil(
  db: Database.Database,
  id: number,
  cambios: ActualizarPerfilInput,
  actorId: number,
) {
  const target = buscarPorId(db, id);
  if (!target || target.activo !== 1) throw new NotFoundError('Usuario no encontrado');

  const nombre = cambios.nombre !== undefined ? cambios.nombre.trim() : target.nombre;
  const usuario = cambios.usuario !== undefined ? cambios.usuario.trim() : target.usuario;
  if (!nombre) throw new ValidationError('El nombre es obligatorio');
  if (!usuario) throw new ValidationError('El usuario de acceso es obligatorio');
  if (
    usuario !== target.usuario &&
    db.prepare('SELECT 1 FROM usuarios WHERE usuario = ? AND id != ?').get(usuario, id)
  ) {
    throw new ValidationError('Ese usuario ya existe');
  }

  db.prepare(
    'UPDATE usuarios SET nombre = ?, usuario = ?, updated_at = datetime(\'now\') WHERE id = ?',
  ).run(nombre, usuario, id);
  registrarAuditoria(db, {
    usuarioId: actorId,
    accion: 'usuario.editar_perfil',
    entidad: 'usuario',
    entidadId: id,
    detalle: { de: { nombre: target.nombre, usuario: target.usuario }, a: { nombre, usuario } },
  });
  return aPublico(buscarPorId(db, id)!);
}

export function cambiarComision(db: Database.Database, id: number, tasaComision: number, actorId: number) {
  const target = buscarPorId(db, id);
  if (!target || target.activo !== 1) throw new NotFoundError('Usuario no encontrado');
  if (!Number.isFinite(tasaComision) || tasaComision < 0) {
    throw new ValidationError('La comisión debe ser un número válido');
  }

  db.prepare('UPDATE usuarios SET tasa_comision = ?, updated_at = datetime(\'now\') WHERE id = ?').run(
    tasaComision,
    id,
  );
  registrarAuditoria(db, {
    usuarioId: actorId,
    accion: 'usuario.cambiar_comision',
    entidad: 'usuario',
    entidadId: id,
    detalle: { de: target.tasa_comision, a: tasaComision },
  });
  return aPublico(buscarPorId(db, id)!);
}

export function cambiarNip(db: Database.Database, id: number, nuevoNip: string, actorId: number) {
  const target = buscarPorId(db, id);
  if (!target || target.activo !== 1) throw new NotFoundError('Usuario no encontrado');
  if (!NIP_REGEX.test(nuevoNip)) {
    throw new ValidationError('El NIP debe tener 4 dígitos');
  }

  db.prepare('UPDATE usuarios SET nip_hash = ?, updated_at = datetime(\'now\') WHERE id = ?').run(
    hashSecreto(nuevoNip),
    id,
  );
  registrarAuditoria(db, {
    usuarioId: actorId,
    accion: 'usuario.cambiar_nip',
    entidad: 'usuario',
    entidadId: id,
  });
}

export function darDeBaja(db: Database.Database, id: number, actorId: number) {
  if (id === actorId) {
    throw new ValidationError('No puedes eliminar la sesión activa');
  }
  const target = buscarPorId(db, id);
  if (!target || target.activo !== 1) throw new NotFoundError('Usuario no encontrado');
  if (target.rol === 'admin' && contarAdminsActivos(db, target.id) === 0) {
    throw new ValidationError('Debe existir al menos un Admin activo');
  }

  db.prepare('UPDATE usuarios SET activo = 0, updated_at = datetime(\'now\') WHERE id = ?').run(id);
  registrarAuditoria(db, {
    usuarioId: actorId,
    accion: 'usuario.baja',
    entidad: 'usuario',
    entidadId: id,
  });
}

export function login(db: Database.Database, usuarioId: number, nip: string) {
  const target = buscarPorId(db, usuarioId);
  if (!target || target.activo !== 1) {
    throw new ValidationError('Usuario no encontrado');
  }
  if (!verificarSecreto(nip, target.nip_hash)) {
    throw new ValidationError(`NIP incorrecto para ${target.nombre}`);
  }
  return aPublico(target);
}

/**
 * Cambio de usuario dentro de una sesión activa (HU-1.3): hacia un
 * Vendedor no pide NIP (cambio de turno rápido en terminal compartida),
 * pero hacia un Admin sí lo exige — si no, cualquier vendedor podría
 * "entrar como" Admin sin conocer su NIP.
 */
export function prepararCambioSesion(db: Database.Database, usuarioId: number, nip?: string) {
  const target = buscarPorId(db, usuarioId);
  if (!target || target.activo !== 1) {
    throw new NotFoundError('Usuario no encontrado');
  }
  if (target.rol === 'admin') {
    if (!nip || !NIP_REGEX.test(nip)) {
      throw new ValidationError(`Ingresa el NIP de ${target.nombre} para continuar`);
    }
    if (!verificarSecreto(nip, target.nip_hash)) {
      throw new ValidationError(`NIP incorrecto para ${target.nombre}`);
    }
  }
  return aPublico(target);
}

export function resetNipConPregunta(
  db: Database.Database,
  usuarioLogin: string,
  respuesta: string,
  nuevoNip: string,
) {
  const target = db
    .prepare('SELECT * FROM usuarios WHERE usuario = ? AND activo = 1')
    .get(usuarioLogin) as UsuarioRow | undefined;
  if (!target) throw new ValidationError('Usuario no encontrado');
  if (!target.respuesta_seguridad_hash) {
    throw new ValidationError('Este usuario no configuró una pregunta de seguridad');
  }
  if (!verificarSecreto(normalizarRespuesta(respuesta), target.respuesta_seguridad_hash)) {
    throw new ValidationError('Respuesta incorrecta');
  }
  if (!NIP_REGEX.test(nuevoNip)) {
    throw new ValidationError('El NIP debe tener 4 dígitos');
  }

  db.prepare('UPDATE usuarios SET nip_hash = ?, updated_at = datetime(\'now\') WHERE id = ?').run(
    hashSecreto(nuevoNip),
    target.id,
  );
  registrarAuditoria(db, {
    usuarioId: target.id,
    accion: 'usuario.reset_nip_autoservicio',
    entidad: 'usuario',
    entidadId: target.id,
  });
}
