// Datos fijos del negocio para encabezado/pie del ticket impreso (HU-3.6).
// Si cambian (dirección, redes), solo se edita aquí — TicketModal y
// ReciboApartado lo importan, no lo repiten.
export const DATOS_NEGOCIO = {
  nombre: 'Crystal Boutique',
  direccion: 'Calle Fray Juan de San Miguel #54, Col. Centro, Morelia, Mich.',
  instagram: '@crystal_boutique54',
  facebook: 'Crystal Boutique',
} as const;

export const LEYENDA_APARTADOS = 'Sistema de apartados a 15 días.';

export const LEYENDA_PROBADA = 'Las prendas marcadas con "P" ya fueron probadas: no tienen cambio.';
