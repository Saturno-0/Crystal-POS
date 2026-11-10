# Modelo de datos y estructura de carpetas — Crystal POS & Inventario

Estado: **cerrado con la dueña**. Las dos dudas que quedaban con el cliente final ya
se resolvieron (ver historial de decisiones más abajo).

## Decisiones de alcance que afectan este documento

- Plazo objetivo: listo en ~1 mes (2026-10-08).
- Producción: **una sola laptop**, SQLite en archivo local, hasta 3 dispositivos
  concurrentes (normalmente 1). Acceso por IP:puerto en la LAN, sin DNS local.
- Backups: copia a carpeta local en la misma laptop — **fase posterior**, no MVP.
- Impresora térmica: modelo aún sin definir. La impresión debe quedar desacoplada
  (plantilla HTML imprimible primero; ESC/POS cuando se defina el modelo).
- Exportar reportes a CSV/PDF **sí entra al alcance** (a diferencia del resto de
  historias P2, que quedan para una fase posterior).
- No hay recordatorios de vencimiento por WhatsApp/SMS ni ninguna mensajería externa.
- No hay import de catálogo: la captura inicial de inventario es manual desde cero.
- Los usuarios semilla del prototipo (NIP demo `1234`) se mantienen como punto de partida.
- **Sin devoluciones**: una venta ya cobrada no se puede reembolsar. Solo existe
  **cambio por otra prenda** — el flujo concreto (qué pasa con precios distintos,
  cómo se registra) se diseña junto con Ventas/Apartados (Épicas 3–4), todavía no
  implementado.
- **Comisión sobre ingreso neto**: se calcula después de descuentos de artículo y de
  método de pago — `ventas.comision_monto = total * (tasa_comision_aplicada / 100)`
  (la tasa se guarda como porcentaje entero, p.ej. 6 = 6 %).
- **El Admin también genera comisión**, igual que un Vendedor (ya soportado por el
  esquema: `usuarios.tasa_comision` no distingue rol).

## Esquema SQL (SQLite)

```sql
-- ══════════════════ CATEGORÍAS ══════════════════
-- Dinámicas: el admin puede agregar o eliminar categorías (solo si no tienen
-- productos asociados — lo aplica el ON DELETE RESTRICT de productos.categoria_id).
-- tipo_talla le dice al sistema qué conjunto de tallas ofrecer, sin depender
-- de nombres de categoría hardcodeados en el código.
CREATE TABLE categorias (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre      TEXT NOT NULL UNIQUE,
  tipo_talla  TEXT NOT NULL CHECK (tipo_talla IN ('numerica_pantalon','estandar_ropa','sin_talla')),
  por_color   INTEGER NOT NULL DEFAULT 0,  -- 1 = alta por color × talla (sacos, pantalones de vestir); requiere tipo_talla con tallas
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ══════════════════ USUARIOS ══════════════════
-- Puede haber más de un admin. Un admin también vende y genera comisión,
-- igual que un vendedor; su tasa puede cambiar con el tiempo (por eso se
-- snapshotea en ventas.tasa_comision_aplicada).
CREATE TABLE usuarios (
  id                        INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre                    TEXT NOT NULL,
  usuario                   TEXT NOT NULL UNIQUE,       -- login, autogenerado si se deja vacío
  nip_hash                  TEXT NOT NULL,              -- bcrypt/argon2, nunca texto plano
  rol                       TEXT NOT NULL CHECK (rol IN ('admin','vendedor')),
  tasa_comision             REAL NOT NULL DEFAULT 0,    -- 0.05–0.08, editable en el tiempo
  pregunta_seguridad        TEXT,                       -- recuperación de NIP (solo admin la usa hoy)
  respuesta_seguridad_hash  TEXT,
  activo                    INTEGER NOT NULL DEFAULT 1, -- baja lógica: hay ventas ligadas
  created_at                TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                TEXT NOT NULL DEFAULT (datetime('now'))
);
-- Solo el admin puede cambiar el NIP de otro usuario (regla de aplicación, no de esquema).
-- Intentos de NIP ilimitados: no hay contador de intentos fallidos.
-- Sesión expira a los 20 min de inactividad (se maneja en la capa de auth/JWT, no en esta tabla).

-- ══════════════════ PRODUCTOS ══════════════════
-- Una fila = un SKU/modelo (talla incluida). El stock por lote vive aquí como
-- cantidad, no como filas individuales. Sin variantes de color, salvo en
-- categorías por_color: ahí cada color × talla es su propio producto/SKU.
CREATE TABLE productos (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  sku               TEXT NOT NULL UNIQUE,     -- MAR-CA-12345; generación reintenta en colisión
  nombre            TEXT NOT NULL,
  marca             TEXT NOT NULL,
  categoria_id      INTEGER NOT NULL REFERENCES categorias(id) ON DELETE RESTRICT,
  talla             TEXT,                     -- NULL/'Unica' en categorías tipo_talla='sin_talla'
  color             TEXT,                     -- obligatorio solo en categorías por_color; NULL en el resto
  precio            REAL NOT NULL CHECK (precio >= 0),
  stock             INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  vendidos          INTEGER NOT NULL DEFAULT 0,
  descuento_tipo    TEXT CHECK (descuento_tipo IN ('pct','monto')),  -- NULL = sin descuento automático
  descuento_valor   REAL,                     -- 10 (%) o 100/40 (monto), típico en vestidos
  activo            INTEGER NOT NULL DEFAULT 1, -- soft delete
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_productos_categoria ON productos(categoria_id);
CREATE INDEX idx_productos_busqueda ON productos(nombre, marca, sku);
-- Eliminar un producto: bloqueado si tiene apartados activos ligados.
-- Si solo tiene stock > 0 (sin apartados), sí se puede eliminar, y solo el admin puede hacerlo.
-- Editar precio: el total de apartados activos ya creados se mantiene congelado,
-- EXCEPTO si el precio nuevo es menor — en ese caso el apartado se beneficia del precio más bajo.

-- ══════════════════ VENTAS (tickets) ══════════════════
-- Cubre venta directa y apartado (el apartado nace y vive como una venta con
-- estado propio; su fila en `apartados` solo añade los datos de plazo/cliente).
CREATE TABLE ventas (
  id                       INTEGER PRIMARY KEY AUTOINCREMENT,
  folio                    TEXT NOT NULL UNIQUE,
  tipo                     TEXT NOT NULL CHECK (tipo IN ('directa','apartado')),
  usuario_id               INTEGER NOT NULL REFERENCES usuarios(id),
  tasa_comision_aplicada   REAL NOT NULL,     -- snapshot: la tasa del usuario pudo cambiar después
  comision_monto           REAL,              -- NULL hasta acreditarse (ver estado); = total * (tasa_comision_aplicada / 100)
  metodo_pago              TEXT CHECK (metodo_pago IN ('efectivo','transferencia','tarjeta')), -- NULL en apartado activo
  subtotal_bruto           REAL NOT NULL,
  descuento_articulos      REAL NOT NULL DEFAULT 0,
  descuento_pago           REAL NOT NULL DEFAULT 0,  -- -15 en efectivo/transferencia, solo venta directa
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
CREATE INDEX idx_ventas_usuario_fecha ON ventas(usuario_id, created_at);
CREATE INDEX idx_ventas_estado ON ventas(estado);
-- comision_monto se llena solo cuando estado pasa a 'completada' o 'apartado_liquidado'.
-- Ventas 'cancelada' o 'apartado_penalizado' nunca suman a KPIs ni comisiones.
-- Reimpresión de ticket: permitida solo si created_at tiene menos de 7 días (regla de aplicación).

-- ══════════════════ LÍNEAS DE TICKET ══════════════════
-- Un apartado puede incluir varias líneas/productos, igual que una venta directa.
CREATE TABLE venta_lineas (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  venta_id            INTEGER NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  producto_id         INTEGER NOT NULL REFERENCES productos(id),
  cantidad            INTEGER NOT NULL CHECK (cantidad > 0),
  precio_unitario     REAL NOT NULL,          -- snapshot del precio al momento de vender
  probado             INTEGER NOT NULL DEFAULT 0,
  descuento_tipo      TEXT CHECK (descuento_tipo IN ('pct','monto')),   -- manual capturado, si hubo
  descuento_valor     REAL,                   -- cualquier valor es válido; se capa contra la línea
  descuento_origen    TEXT NOT NULL CHECK (descuento_origen IN ('manual','automatico','ninguno')),
  descuento_aplicado  REAL NOT NULL DEFAULT 0, -- monto final tras min(manual>0?manual:auto, base)
  importe_linea       REAL NOT NULL
);
CREATE INDEX idx_lineas_venta ON venta_lineas(venta_id);

-- ══════════════════ APARTADOS ══════════════════
-- 1:1 con la venta que lo originó. El/los producto(s) se obtienen vía venta_lineas.
CREATE TABLE apartados (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  venta_id              INTEGER NOT NULL UNIQUE REFERENCES ventas(id),
  cliente_nombre        TEXT NOT NULL,
  cliente_telefono      TEXT,                      -- opcional
  abono_inicial         REAL NOT NULL CHECK (abono_inicial > 0),
  pagado                REAL NOT NULL DEFAULT 0,    -- = abono_inicial hasta liquidar (solo 2 pagos en total)
  vence_at              TEXT NOT NULL,              -- created_at + 15 días, 23:59:59 de ese día
  estado                TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo','liquidado','penalizado')),
  liquidado_at          TEXT,
  penalizado_at         TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_apartados_estado_vence ON apartados(estado, vence_at);
-- Un mismo cliente puede tener varios apartados activos a la vez (sin restricción de unicidad).
-- El job de cierre automático corre después de las 23:59:59 del día de vencimiento.
-- No hay recordatorios automáticos (sin WhatsApp/SMS/mensajería externa).
-- No existe flujo de devolución tras liquidar — PENDIENTE de confirmar con el cliente.

-- ══════════════════ PRÓRROGAS DE APARTADO ══════════════════
-- El plazo se puede extender; se audita quién y cuándo lo hizo.
CREATE TABLE apartado_extensiones (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  apartado_id     INTEGER NOT NULL REFERENCES apartados(id),
  usuario_id      INTEGER NOT NULL REFERENCES usuarios(id),
  vence_anterior  TEXT NOT NULL,
  vence_nuevo     TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ══════════════════ AUDITORÍA (trazabilidad, HU-6.4) ══════════════════
CREATE TABLE auditoria (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id   INTEGER REFERENCES usuarios(id),
  accion       TEXT NOT NULL,     -- 'venta.crear' | 'producto.editar' | 'apartado.penalizar' | ...
  entidad      TEXT NOT NULL,     -- 'producto' | 'venta' | 'apartado' | 'usuario' | 'categoria'
  entidad_id   INTEGER,
  detalle      TEXT,              -- JSON libre (antes/después, montos)
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_auditoria_entidad ON auditoria(entidad, entidad_id);
```

## Estructura de carpetas (pnpm workspace)

```
hilo-pos/
├── pnpm-workspace.yaml
├── package.json
├── CLAUDE.md
├── docs/
├── apps/
│   ├── web/                      # React + TS + Vite
│   │   ├── src/
│   │   │   ├── pages/            # Login, Venta, Alta, Apartados, Reportes, Personal, CambioUsuario
│   │   │   ├── features/         # lógica por dominio: venta, inventario, apartados, reportes, personal, auth
│   │   │   ├── components/ui/    # primitivos (botón, input, segmented, modal, tabla) — shadcn-like
│   │   │   ├── lib/               # api client, formato moneda/fecha, storage
│   │   │   ├── hooks/
│   │   │   ├── styles/tokens.css # variables CSS del README
│   │   │   ├── assets/fonts/     # Instrument Sans + JetBrains Mono auto-hospedadas
│   │   │   └── main.tsx
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   └── package.json
│   └── api/                      # Node + Express + TS
│       ├── src/
│       │   ├── routes/           # auth, productos, categorias, ventas, apartados, reportes, personal
│       │   ├── controllers/
│       │   ├── services/         # calculoLinea, comisiones, penalizacionApartados, exportReportes
│       │   ├── db/
│       │   │   ├── migrations/
│       │   │   ├── client.ts
│       │   │   └── schema.sql
│       │   ├── middleware/       # auth (sesión 20 min), requireRole
│       │   ├── jobs/             # cierre automático de apartados vencidos (23:59:59 del día 15)
│       │   └── index.ts
│       └── package.json
├── packages/
│   └── shared/                   # tipos TS + lógica de negocio pura, compartida web/api
│       ├── src/
│       │   ├── types.ts          # Usuario, Producto, Categoria, Venta, LineaCarrito, Apartado
│       │   └── calculo.ts        # cálculo de línea/total (pseudocódigo del README)
│       └── package.json
└── vitest.config.ts
```

## Dudas resueltas con el cliente

1. **Devoluciones** → No hay. Solo cambio por otra prenda. Pendiente diseñar el flujo
   exacto cuando lleguemos a Ventas/Apartados (Épicas 3–4).
2. **Base de comisión** → Neta (después de descuentos de artículo y de método de pago).
3. **¿El Admin genera comisión?** → Sí, igual que un Vendedor.

Sin dudas abiertas por ahora.
