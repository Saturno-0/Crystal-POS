import type Database from 'better-sqlite3';
import { claveTexto, type TipoDescuento } from '@crystal/shared';
import { parseCsv } from '../lib/csv.js';
import { ValidationError } from '../lib/errors.js';
import { crear } from './productos.service.js';

export const MAX_FILAS_IMPORTACION = 1000;

type Columna =
  | 'nombre'
  | 'marca'
  | 'categoria'
  | 'talla'
  | 'color'
  | 'precio'
  | 'cantidad'
  | 'descuento_tipo'
  | 'descuento_valor';

const OBLIGATORIAS: Columna[] = ['nombre', 'marca', 'categoria', 'precio'];

const ALIAS: Record<string, Columna> = {
  nombre: 'nombre',
  marca: 'marca',
  categoria: 'categoria',
  talla: 'talla',
  color: 'color',
  precio: 'precio',
  cantidad: 'cantidad',
  stock: 'cantidad',
  descuento_tipo: 'descuento_tipo',
  descuento_valor: 'descuento_valor',
};

export interface FilaImportada {
  /** Número de fila tal como se ve en la hoja de cálculo (la 1 es el encabezado). */
  fila: number;
  nombre: string;
  marca: string;
  categoria: string;
  talla: string;
  color: string;
  cantidad: number | null;
  estado: 'nueva' | 'suma' | 'error';
  error?: string;
}

export interface ResultadoImportacion {
  /** true solo si se pidió aplicar y no hubo ningún error: nada se guarda a medias. */
  aplicado: boolean;
  resumen: { total: number; nuevas: number; sumas: number; errores: number };
  filas: FilaImportada[];
}

class Revertir extends Error {}

function parsearNumero(texto: string): number {
  let limpio = texto.replace(/[$\s]/g, '');
  // "1,250.50" → miles con coma; "590,50" → decimal con coma.
  limpio = /^\d{1,3}(,\d{3})+(\.\d+)?$/.test(limpio) ? limpio.replace(/,/g, '') : limpio.replace(',', '.');
  return limpio === '' ? NaN : Number(limpio);
}

function parsearTipoDescuento(texto: string): TipoDescuento {
  const clave = claveTexto(texto);
  if (['pct', '%', 'porcentaje', 'porciento'].includes(clave)) return 'pct';
  if (['monto', '$', 'pesos'].includes(clave)) return 'monto';
  throw new ValidationError(`descuento_tipo "${texto}" no es válido (usa pct o monto)`);
}

/**
 * Importa productos desde el texto de un CSV reutilizando `crear` fila por fila
 * (mismas validaciones, mismo SKU, misma regla de "alta repetida suma stock").
 * Todo ocurre en una transacción: con `aplicar = false` (vista previa) o si
 * alguna fila tiene error, se revierte completa y no queda nada guardado.
 */
export function importarCsv(
  db: Database.Database,
  csv: string,
  aplicar: boolean,
  actorId: number,
): ResultadoImportacion {
  const tabla = parseCsv(csv ?? '');
  if (tabla.length === 0) throw new ValidationError('El archivo está vacío');

  const columnas = new Map<Columna, number>();
  tabla[0].forEach((encabezado, i) => {
    const columna = ALIAS[claveTexto(encabezado).replace(/ /g, '_')];
    if (columna && !columnas.has(columna)) columnas.set(columna, i);
  });
  const faltantes = OBLIGATORIAS.filter((c) => !columnas.has(c));
  if (faltantes.length > 0) {
    throw new ValidationError(`Faltan columnas en el encabezado: ${faltantes.join(', ')}`);
  }

  const datos = tabla
    .map((celdas, i) => ({ celdas, fila: i + 1 }))
    .slice(1)
    .filter(({ celdas }) => celdas.some((c) => c.trim() !== ''));
  if (datos.length === 0) throw new ValidationError('El archivo no tiene filas con datos');
  if (datos.length > MAX_FILAS_IMPORTACION) {
    throw new ValidationError(`Máximo ${MAX_FILAS_IMPORTACION} filas por archivo (trae ${datos.length})`);
  }

  const categorias = new Map(
    (
      db.prepare('SELECT id, nombre FROM categorias').all() as { id: number; nombre: string }[]
    ).map((c) => [claveTexto(c.nombre), c.id]),
  );

  const filas: FilaImportada[] = [];

  const procesar = db.transaction(() => {
    for (const { celdas, fila } of datos) {
      const valor = (c: Columna) => (columnas.has(c) ? (celdas[columnas.get(c)!] ?? '').trim() : '');
      const registro: FilaImportada = {
        fila,
        nombre: valor('nombre'),
        marca: valor('marca'),
        categoria: valor('categoria'),
        talla: valor('talla'),
        color: valor('color'),
        cantidad: null,
        estado: 'error',
      };
      try {
        const categoriaId = categorias.get(claveTexto(registro.categoria));
        if (categoriaId === undefined) {
          throw new ValidationError(`La categoría "${registro.categoria}" no existe`);
        }

        const precio = parsearNumero(valor('precio'));
        if (!Number.isFinite(precio)) throw new ValidationError(`Precio inválido: "${valor('precio')}"`);

        const textoCantidad = valor('cantidad');
        const cantidad = textoCantidad === '' ? 1 : parsearNumero(textoCantidad);
        if (!Number.isInteger(cantidad) || cantidad < 1) {
          throw new ValidationError(`Cantidad inválida: "${textoCantidad}"`);
        }
        registro.cantidad = cantidad;

        const textoTipo = valor('descuento_tipo');
        const textoValor = valor('descuento_valor');
        if ((textoTipo === '') !== (textoValor === '')) {
          throw new ValidationError('El descuento necesita descuento_tipo y descuento_valor');
        }
        const descuentoTipo = textoTipo === '' ? undefined : parsearTipoDescuento(textoTipo);
        const descuentoValor = textoValor === '' ? undefined : parsearNumero(textoValor);
        if (descuentoValor !== undefined && !Number.isFinite(descuentoValor)) {
          throw new ValidationError(`descuento_valor inválido: "${textoValor}"`);
        }

        const producto = crear(
          db,
          {
            nombre: registro.nombre,
            marca: registro.marca,
            categoriaId,
            talla: registro.talla ? registro.talla.toUpperCase() : undefined,
            color: registro.color || undefined,
            precio,
            cantidad,
            descuentoTipo,
            descuentoValor,
          },
          actorId,
        );
        registro.estado = producto.reabastecido ? 'suma' : 'nueva';
      } catch (err) {
        if (!(err instanceof ValidationError)) throw err;
        registro.error = err.message;
      }
      filas.push(registro);
    }

    if (!aplicar || filas.some((f) => f.estado === 'error')) throw new Revertir();
  });

  let aplicado = true;
  try {
    procesar();
  } catch (err) {
    if (!(err instanceof Revertir)) throw err;
    aplicado = false;
  }

  return {
    aplicado,
    resumen: {
      total: filas.length,
      nuevas: filas.filter((f) => f.estado === 'nueva').length,
      sumas: filas.filter((f) => f.estado === 'suma').length,
      errores: filas.filter((f) => f.estado === 'error').length,
    },
    filas,
  };
}
