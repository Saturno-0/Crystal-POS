import type Database from 'better-sqlite3';
import type { TipoTalla } from '@crystal/shared';
import { NotFoundError, ValidationError } from '../lib/errors.js';
import { registrar as registrarAuditoria } from './auditoria.service.js';

interface CategoriaRow {
  id: number;
  nombre: string;
  tipo_talla: TipoTalla;
}

const TIPOS_TALLA: TipoTalla[] = ['numerica_pantalon', 'estandar_ropa', 'sin_talla'];

function aPublico(row: CategoriaRow) {
  return { id: row.id, nombre: row.nombre, tipoTalla: row.tipo_talla };
}

export function listar(db: Database.Database) {
  const rows = db.prepare('SELECT * FROM categorias ORDER BY nombre').all() as CategoriaRow[];
  return rows.map(aPublico);
}

export function crear(
  db: Database.Database,
  input: { nombre: string; tipoTalla: TipoTalla },
  actorId: number,
) {
  const nombre = input.nombre?.trim();
  if (!nombre) {
    throw new ValidationError('El nombre de la categoría es obligatorio');
  }
  if (!TIPOS_TALLA.includes(input.tipoTalla)) {
    throw new ValidationError('Tipo de talla inválido');
  }
  if (db.prepare('SELECT 1 FROM categorias WHERE nombre = ?').get(nombre)) {
    throw new ValidationError('Ya existe una categoría con ese nombre');
  }

  const result = db
    .prepare('INSERT INTO categorias (nombre, tipo_talla) VALUES (@nombre, @tipoTalla)')
    .run({ nombre, tipoTalla: input.tipoTalla });

  registrarAuditoria(db, {
    usuarioId: actorId,
    accion: 'categoria.crear',
    entidad: 'categoria',
    entidadId: Number(result.lastInsertRowid),
    detalle: { nombre, tipoTalla: input.tipoTalla },
  });

  return aPublico(
    db.prepare('SELECT * FROM categorias WHERE id = ?').get(result.lastInsertRowid) as CategoriaRow,
  );
}

export function eliminar(db: Database.Database, id: number, actorId: number) {
  const categoria = db.prepare('SELECT * FROM categorias WHERE id = ?').get(id) as
    | CategoriaRow
    | undefined;
  if (!categoria) throw new NotFoundError('Categoría no encontrada');

  const enUso = db.prepare('SELECT COUNT(*) AS n FROM productos WHERE categoria_id = ?').get(id) as {
    n: number;
  };
  if (enUso.n > 0) {
    throw new ValidationError('No puedes eliminar una categoría con productos asociados');
  }

  db.prepare('DELETE FROM categorias WHERE id = ?').run(id);
  registrarAuditoria(db, {
    usuarioId: actorId,
    accion: 'categoria.eliminar',
    entidad: 'categoria',
    entidadId: id,
  });
}
