/** Iniciales para avatares: "Daniela Ochoa" -> "DO". */
export function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  const primera = partes[0]?.[0] ?? '';
  const segunda = partes[1]?.[0] ?? '';
  return (primera + segunda).toUpperCase();
}

/** Usuario de acceso sugerido: "Daniela Ochoa" -> "daniela.o". */
export function usuarioSugerido(nombre: string): string {
  const partes = nombre
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita acentos
    .split(/\s+/)
    .filter(Boolean);
  const primerNombre = partes[0] ?? '';
  const inicialApellido = partes[1]?.[0];
  return inicialApellido ? `${primerNombre}.${inicialApellido}` : primerNombre;
}
