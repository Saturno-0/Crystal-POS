import type Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import { parseCsv } from '../lib/csv.js';
import { crearDbDePrueba } from '../test/testDb.js';
import { importarCsv } from './importacion.service.js';

let db: Database.Database;
const ACTOR_ID = 1;

const totalProductos = () => (db.prepare('SELECT COUNT(*) n FROM productos').get() as { n: number }).n;

beforeEach(() => {
  db = crearDbDePrueba();
  db.prepare("INSERT INTO usuarios (id, nombre, usuario, nip_hash, rol) VALUES (1,'Test','test','x','admin')").run();
  db.prepare("INSERT INTO categorias (nombre, tipo_talla) VALUES ('Mezclilla','numerica_pantalon')").run();
  db.prepare("INSERT INTO categorias (nombre, tipo_talla) VALUES ('Blusas','estandar_ropa')").run();
  db.prepare("INSERT INTO categorias (nombre, tipo_talla) VALUES ('Vestidos','sin_talla')").run();
  db.prepare("INSERT INTO categorias (nombre, tipo_talla, por_color) VALUES ('Sacos','estandar_ropa',1)").run();
});

describe('parseCsv', () => {
  it('maneja comillas, comas dentro de campo y BOM', () => {
    expect(parseCsv('﻿a,b\n"x, y","di ""hola"""\n')).toEqual([
      ['a', 'b'],
      ['x, y', 'di "hola"'],
    ]);
  });

  it('detecta punto y coma como separador y saltos CRLF', () => {
    expect(parseCsv('a;b\r\n1,5;2\r\n')).toEqual([
      ['a', 'b'],
      ['1,5', '2'],
    ]);
  });
});

describe('importarCsv', () => {
  const ENCABEZADO = 'nombre,marca,categoria,talla,color,precio,cantidad,descuento_tipo,descuento_valor\n';

  it('vista previa no guarda nada', () => {
    const r = importarCsv(db, `${ENCABEZADO}Blusa lino,Zara,blusas,m,,420,2,,\n`, false, ACTOR_ID);
    expect(r.aplicado).toBe(false);
    expect(r.resumen).toEqual({ total: 1, nuevas: 1, sumas: 0, errores: 0 });
    expect(totalProductos()).toBe(0);
  });

  it('aplica filas válidas y respeta categoría sin importar mayúsculas/acentos', () => {
    const csv =
      ENCABEZADO +
      'Blusa lino,Zara,BLUSAS,M,,420,2,,\n' +
      'Jean recto,Levis,mezclilla,7,,"1,250.50",1,,\n' +
      'Vestido flor,Shein,Vestidos,,,500,1,pct,10\n' +
      'Saco azul,Zara,Sacos,L,Azul,900,1,,\n';
    const r = importarCsv(db, csv, true, ACTOR_ID);
    expect(r.aplicado).toBe(true);
    expect(r.resumen.nuevas).toBe(4);
    const jean = db.prepare("SELECT precio, stock FROM productos WHERE nombre = 'Jean recto'").get() as {
      precio: number;
      stock: number;
    };
    expect(jean).toEqual({ precio: 1250.5, stock: 1 });
  });

  it('una prenda repetida (en el archivo o ya existente) suma stock', () => {
    importarCsv(db, `${ENCABEZADO}Blusa lino,Zara,Blusas,M,,420,2,,\n`, true, ACTOR_ID);
    const r = importarCsv(
      db,
      `${ENCABEZADO}blusa  LINO,zara,Blusas,M,,420,1,,\nBlusa lino,Zara,Blusas,M,,420,3,,\n`,
      true,
      ACTOR_ID,
    );
    expect(r.resumen).toMatchObject({ nuevas: 0, sumas: 2, errores: 0 });
    expect(totalProductos()).toBe(1);
    expect((db.prepare('SELECT stock FROM productos').get() as { stock: number }).stock).toBe(6);
  });

  it('todo o nada: con una fila inválida no se guarda ninguna', () => {
    const csv =
      ENCABEZADO +
      'Blusa lino,Zara,Blusas,M,,420,2,,\n' +
      'Jean raro,Levis,Mezclilla,XL,,590,1,,\n' +
      'Capa,Zara,Abrigos,M,,300,1,,\n' +
      'Saco rojo,Zara,Sacos,M,,300,1,,\n';
    const r = importarCsv(db, csv, true, ACTOR_ID);
    expect(r.aplicado).toBe(false);
    expect(totalProductos()).toBe(0);
    expect(r.filas.map((f) => [f.fila, f.estado])).toEqual([
      [2, 'nueva'],
      [3, 'error'],
      [4, 'error'],
      [5, 'error'],
    ]);
    expect(r.filas[1].error).toMatch(/talla/i);
    expect(r.filas[2].error).toMatch(/categor/i);
    expect(r.filas[3].error).toMatch(/color/i);
  });

  it('descuento incompleto o inválido en vestidos marca error', () => {
    const r = importarCsv(
      db,
      `${ENCABEZADO}V1,Shein,Vestidos,,,500,1,pct,\nV2,Shein,Vestidos,,,500,1,pct,15\n`,
      true,
      ACTOR_ID,
    );
    expect(r.resumen.errores).toBe(2);
    expect(totalProductos()).toBe(0);
  });

  it('rechaza encabezados incompletos, archivos vacíos y demasiadas filas', () => {
    expect(() => importarCsv(db, 'nombre,marca\nA,B\n', false, ACTOR_ID)).toThrow(/categoria, precio/);
    expect(() => importarCsv(db, '', false, ACTOR_ID)).toThrow(/vacío/);
    expect(() => importarCsv(db, ENCABEZADO, false, ACTOR_ID)).toThrow(/sin filas|no tiene filas/);
    const muchas = ENCABEZADO + 'A,B,Blusas,M,,100,1,,\n'.repeat(1001);
    expect(() => importarCsv(db, muchas, false, ACTOR_ID)).toThrow(/Máximo/);
  });

  it('acepta encabezados con acentos, orden distinto y punto y coma', () => {
    const csv = 'Precio;Categoría;Marca;Nombre\n420;Blusas;Zara;Blusa lino\n';
    const r = importarCsv(db, csv, false, ACTOR_ID);
    expect(r.filas[0].error).toMatch(/talla/i); // blusas necesita talla; lo demás se leyó bien
  });
});
