/**
 * Parser de CSV mínimo (RFC 4180): comillas dobles, comillas escapadas (""),
 * saltos de línea dentro de comillas y BOM de Excel. Detecta si el separador
 * es coma o punto y coma según la primera línea (Excel en español exporta con `;`
 * según la configuración regional).
 */
export function parseCsv(texto: string): string[][] {
  const limpio = texto.replace(/^﻿/, '');
  const delimitador = detectarDelimitador(limpio);

  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = '';
  let entreComillas = false;

  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i];
    if (entreComillas) {
      if (c === '"') {
        if (limpio[i + 1] === '"') {
          campo += '"';
          i++;
        } else {
          entreComillas = false;
        }
      } else {
        campo += c;
      }
    } else if (c === '"') {
      entreComillas = true;
    } else if (c === delimitador) {
      fila.push(campo);
      campo = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && limpio[i + 1] === '\n') i++;
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = '';
    } else {
      campo += c;
    }
  }
  if (campo !== '' || fila.length > 0) {
    fila.push(campo);
    filas.push(fila);
  }
  return filas;
}

function detectarDelimitador(texto: string): ',' | ';' {
  const primeraLinea = texto.split(/\r?\n/, 1)[0] ?? '';
  let comas = 0;
  let puntoYComas = 0;
  let entreComillas = false;
  for (const c of primeraLinea) {
    if (c === '"') entreComillas = !entreComillas;
    else if (!entreComillas && c === ',') comas++;
    else if (!entreComillas && c === ';') puntoYComas++;
  }
  return puntoYComas > comas ? ';' : ',';
}
