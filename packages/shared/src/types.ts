// Tipos derivados de docs/MODELO_DATOS.md — mantener en sync con el esquema SQL.

export type Rol = 'admin' | 'vendedor';
export type TipoTalla = 'numerica_pantalon' | 'estandar_ropa' | 'sin_talla';
export type TipoDescuento = 'pct' | 'monto';
export type MetodoPago = 'efectivo' | 'transferencia' | 'tarjeta';
export type TipoVenta = 'directa' | 'apartado';
export type EstadoVenta =
  | 'completada'
  | 'apartado_activo'
  | 'apartado_liquidado'
  | 'apartado_penalizado'
  | 'cancelada';
export type EstadoApartado = 'activo' | 'liquidado' | 'penalizado';
export type DescuentoOrigen = 'manual' | 'automatico' | 'ninguno';

export interface Usuario {
  id: number;
  nombre: string;
  usuario: string;
  rol: Rol;
  tasaComision: number;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Categoria {
  id: number;
  nombre: string;
  tipoTalla: TipoTalla;
}

export interface Producto {
  id: number;
  sku: string;
  nombre: string;
  marca: string;
  categoriaId: number;
  talla: string | null;
  precio: number;
  stock: number;
  vendidos: number;
  descuentoTipo: TipoDescuento | null;
  descuentoValor: number | null;
  activo: boolean;
}

export interface LineaCarrito {
  productoId: number;
  cantidad: number;
  precioUnitario: number;
  probado: boolean;
  descuentoTipo: TipoDescuento | null;
  descuentoValor: number | null;
}

export interface Venta {
  id: number;
  folio: string;
  tipo: TipoVenta;
  usuarioId: number;
  tasaComisionAplicada: number;
  comisionMonto: number | null;
  metodoPago: MetodoPago | null;
  subtotalBruto: number;
  descuentoArticulos: number;
  descuentoPago: number;
  total: number;
  efectivoRecibido: number | null;
  cambio: number | null;
  estado: EstadoVenta;
  createdAt: string;
}

export interface Apartado {
  id: number;
  ventaId: number;
  clienteNombre: string;
  clienteTelefono: string | null;
  abonoInicial: number;
  pagado: number;
  venceAt: string;
  estado: EstadoApartado;
}
