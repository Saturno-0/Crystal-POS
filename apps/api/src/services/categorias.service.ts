import type Database from 'better-sqlite3';
import { claveTexto, type TipoTalla } from '@crystal/shared';
import { NotFoundError, ValidationError } from '../lib/errors.js';
import { registrar as registrarAuditoria } from './auditoria.service.js';

interface CategoriaRow {
  id: number;
  nombre: string;
  tipo_talla: TipoTalla;
  por_color: number;
}

const TIPOS_TALLA: TipoTalla[] = ['numerica_pantalon', 'estandar_ropa', 'sin_talla'];

function aPublico(row: CategoriaRow) {
  return { id: row.id, nombre: row.nombre, tipoTalla: row.tipo_talla, porColor: row.por_color === 1 };
}

export function listar(db: Database.Database) {
  const rows = db.prepare('SELECT * FROM categorias ORDER BY nombre').all() as CategoriaRow[];
  return rows.map(aPublico);
}

export function crear(
  db: Database.Database,
  input: { nombre: string; tipoTalla: TipoTalla; porColor?: boolean },
  actorId: number,
) {
  const nombre = input.nombre?.trim();
  if (!nombre) {
    throw new ValidationError('El nombre de la categoría es obligatorio');
  }
  if (!TIPOS_TALLA.includes(input.tipoTalla)) {
    throw new ValidationError('Tipo de talla inválido');
  }
  const porColor = input.porColor === true;
  // Color × talla: sin talla no hay cuadrícula que capturar.
  if (porColor && input.tipoTalla === 'sin_talla') {
    throw new ValidationError('Una categoría por color debe manejar tallas');
  }
  if (db.prepare('SELECT 1 FROM categorias WHERE nombre = ?').get(nombre)) {
    throw new ValidationError('Ya existe una categoría con ese nombre');
  }

  const result = db
    .prepare(
      'INSERT INTO categorias (nombre, tipo_talla, por_color) VALUES (@nombre, @tipoTalla, @porColor)',
    )
    .run({ nombre, tipoTalla: input.tipoTalla, porColor: porColor ? 1 : 0 });

  registrarAuditoria(db, {
    usuarioId: actorId,
    accion: 'categoria.crear',
    entidad: 'categoria',
    entidadId: Number(result.lastInsertRowid),
    detalle: { nombre, tipoTalla: input.tipoTalla, porColor },
  });

  return aPublico(
    db.prepare('SELECT * FROM categorias WHERE id = ?').get(result.lastInsertRowid) as CategoriaRow,
  );
}

// Solo cambia el nombre: los productos apuntan al id, y cambiar el tipo de talla
// o el color dejaría inválidos los que ya existen.
export function renombrar(db: Database.Database, id: number, nombreNuevo: unknown, actorId: number) {
  const categoria = db.prepare('SELECT * FROM categorias WHERE id = ?').get(id) as
    | CategoriaRow
    | undefined;
  if (!categoria) throw new NotFoundError('Categoría no encontrada');

  const nombre = typeof nombreNuevo === 'string' ? nombreNuevo.trim().replace(/\s+/g, ' ') : '';
  if (!nombre) throw new ValidationError('El nombre de la categoría es obligatorio');
  if (nombre === categoria.nombre) return aPublico(categoria);

  // El CSV reconoce categorías sin distinguir mayúsculas ni acentos: dos que
  // solo difieran en eso serían la misma para la importación.
  const repetida = (db.prepare('SELECT * FROM categorias WHERE id <> ?').all(id) as CategoriaRow[]).some(
    (c) => claveTexto(c.nombre) === claveTexto(nombre),
  );
  if (repetida) throw new ValidationError('Ya existe una categoría con ese nombre');

  db.prepare('UPDATE categorias SET nombre = ? WHERE id = ?').run(nombre, id);
  registrarAuditoria(db, {
    usuarioId: actorId,
    accion: 'categoria.renombrar',
    entidad: 'categoria',
    entidadId: id,
    detalle: { nombreAnterior: categoria.nombre, nombreNuevo: nombre },
  });
  return aPublico({ ...categoria, nombre });
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
