-- Esquema de Crystal POS & Inventario.
-- Fuente de verdad del diseño: docs/MODELO_DATOS.md — mantener ambos en sync.

CREATE TABLE IF NOT EXISTS categorias (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre      TEXT NOT NULL UNIQUE,
  tipo_talla  TEXT NOT NULL CHECK (tipo_talla IN ('numerica_pantalon','estandar_ropa','sin_talla')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS usuarios (
  id                        INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre                    TEXT NOT NULL,
  usuario                   TEXT NOT NULL UNIQUE,
  nip_hash                  TEXT NOT NULL,
  rol                       TEXT NOT NULL CHECK (rol IN ('admin','vendedor')),
  tasa_comision             REAL NOT NULL DEFAULT 0,
  pregunta_seguridad        TEXT,
  respuesta_seguridad_hash  TEXT,
  activo                    INTEGER NOT NULL DEFAULT 1,
  created_at                TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS productos (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  sku               TEXT NOT NULL UNIQUE,
  nombre            TEXT NOT NULL,
  marca             TEXT NOT NULL,
  categoria_id      INTEGER NOT NULL REFERENCES categorias(id) ON DELETE RESTRICT,
  talla             TEXT,
  precio            REAL NOT NULL CHECK (precio >= 0),
  stock             INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  vendidos          INTEGER NOT NULL DEFAULT 0,
  descuento_tipo    TEXT CHECK (descuento_tipo IN ('pct','monto')),
  descuento_valor   REAL,
  activo            INTEGER NOT NULL DEFAULT 1,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_productos_busqueda ON productos(nombre, marca, sku);

CREATE TABLE IF NOT EXISTS ventas (
  id                       INTEGER PRIMARY KEY AUTOINCREMENT,
  folio                    TEXT NOT NULL UNIQUE,
  tipo                     TEXT NOT NULL CHECK (tipo IN ('directa','apartado')),
  usuario_id               INTEGER NOT NULL REFERENCES usuarios(id),
  tasa_comision_aplicada   REAL NOT NULL,
  comision_monto           REAL,
  metodo_pago              TEXT CHECK (metodo_pago IN ('efectivo','transferencia','tarjeta')),
  subtotal_bruto           REAL NOT NULL,
  descuento_articulos      REAL NOT NULL DEFAULT 0,
  descuento_pago           REAL NOT NULL DEFAULT 0,
  total                    REAL NOT NULL,
  efectivo_recibido        REAL,
  cambio                   REAL,
  estado                   TEXT NOT NULL CHECK (estado IN (
                              'completada','apartado_activo','apartado_liquidado',
                              'apartado_penalizado','cancelada'
                            )),
  created_at               TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at               TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ventas_usuario_fecha ON ventas(usuario_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ventas_estado ON ventas(estado);

CREATE TABLE IF NOT EXISTS venta_lineas (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  venta_id            INTEGER NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  producto_id         INTEGER NOT NULL REFERENCES productos(id),
  cantidad            INTEGER NOT NULL CHECK (cantidad > 0),
  precio_unitario     REAL NOT NULL,
  probado             INTEGER NOT NULL DEFAULT 0,
  descuento_tipo      TEXT CHECK (descuento_tipo IN ('pct','monto')),
  descuento_valor     REAL,
  descuento_origen    TEXT NOT NULL CHECK (descuento_origen IN ('manual','automatico','ninguno')),
  descuento_aplicado  REAL NOT NULL DEFAULT 0,
  importe_linea       REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_lineas_venta ON venta_lineas(venta_id);

CREATE TABLE IF NOT EXISTS apartados (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  venta_id              INTEGER NOT NULL UNIQUE REFERENCES ventas(id),
  cliente_nombre        TEXT NOT NULL,
  cliente_telefono      TEXT,
  abono_inicial         REAL NOT NULL CHECK (abono_inicial > 0),
  pagado                REAL NOT NULL DEFAULT 0,
  vence_at              TEXT NOT NULL,
  estado                TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo','liquidado','penalizado')),
  liquidado_at          TEXT,
  penalizado_at         TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_apartados_estado_vence ON apartados(estado, vence_at);

CREATE TABLE IF NOT EXISTS apartado_extensiones (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  apartado_id     INTEGER NOT NULL REFERENCES apartados(id),
  usuario_id      INTEGER NOT NULL REFERENCES usuarios(id),
  vence_anterior  TEXT NOT NULL,
  vence_nuevo     TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Cambio por otra prenda (regla 10 de CLAUDE.md): solo por una prenda de
-- igual o mayor precio que lo efectivamente pagado por la línea original
-- (ya con descuentos); si es mayor, el cliente paga la diferencia. No hay
-- devolución de dinero si el nuevo producto fuera más barato: eso no está
-- permitido. UNIQUE en venta_linea_id: una línea solo se puede cambiar una vez.
CREATE TABLE IF NOT EXISTS cambios (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  venta_linea_id          INTEGER NOT NULL UNIQUE REFERENCES venta_lineas(id),
  producto_nuevo_id       INTEGER NOT NULL REFERENCES productos(id),
  usuario_id              INTEGER NOT NULL REFERENCES usuarios(id),
  precio_pagado_original  REAL NOT NULL,
  precio_nuevo            REAL NOT NULL,
  diferencia_cobrada      REAL NOT NULL DEFAULT 0,
  metodo_pago             TEXT CHECK (metodo_pago IN ('efectivo','transferencia','tarjeta')),
  tasa_comision_aplicada  REAL NOT NULL,
  comision_monto          REAL NOT NULL DEFAULT 0,
  created_at              TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS auditoria (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id   INTEGER REFERENCES usuarios(id),
  accion       TEXT NOT NULL,
  entidad      TEXT NOT NULL,
  entidad_id   INTEGER,
  detalle      TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_auditoria_entidad ON auditoria(entidad, entidad_id);
