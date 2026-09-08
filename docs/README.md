# Handoff: Hilo POS & Inventario (tienda de ropa, intranet local)

## Overview
Sistema web de Punto de Venta e Inventario para una tienda de ropa que opera en red local (intranet). Cubre venta directa, apartados (layaway) a 15 días, alta de inventario por pieza única o por lote, gestión de personal con roles y NIP, y reportes de ventas y comisiones para el superusuario.

El prototipo aprobado por el cliente está en `Sistema POS v3.dc.html` (incluido en este paquete). Es un prototipo **funcional**: el stock, los tickets, las comisiones y los apartados se recalculan en vivo a partir de las acciones del usuario, con datos en memoria.

## About the Design Files
Los archivos de este paquete son **referencias de diseño construidas en HTML** — prototipos que muestran la apariencia y el comportamiento deseados, **no código de producción para copiar tal cual**.

La tarea es **recrear estos diseños en el entorno de la aplicación real** (React, Vue, Laravel/Blade, Django, etc.) usando los patrones y librerías establecidos de ese código. Si aún no existe un código base, elige el stack más apropiado (ver "Stack sugerido") e implementa ahí los diseños.

El prototipo usa un runtime propio de prototipado (`support.js`, etiquetas `<sc-for>`, `<sc-if>`, `renderVals()`). **Nada de eso debe migrarse.** Lo que se migra es: layout, jerarquía visual, tokens, copy, reglas de negocio y flujos.

## Fidelity
**Alta fidelidad (hifi).** Colores, tipografía, espaciados, estados y copy son finales y están en español (México). La UI debe recrearse con fidelidad usando las librerías del código base destino. La única libertad esperada es sustituir primitivos (botón, input, modal, tabla) por los equivalentes del design system del proyecto.

---

## Roles y permisos

| Capacidad | Admin (superusuario) | Vendedor |
|---|---|---|
| Punto de venta (Venta) | ✅ | ✅ |
| Alta de inventario | ✅ | ✅ |
| Apartados (registrar 2º pago / penalizar) | ✅ | ✅ |
| Reportes y comisiones | ✅ | ❌ |
| Personal y accesos (alta, cambio de rol, baja) | ✅ | ❌ |
| Cambio de usuario | ✅ (avatar del rail) | ✅ (pestaña "Usuario") |

La navegación se construye dinámicamente según el rol: `['Venta','Alta','Apartados']` + (`['Reportes','Personal']` si es admin, o `['Usuario']` si es vendedor).

---

## Screens / Views

### 0. Inicio de sesión (login con NIP)
- **Propósito**: autenticar al personal antes de operar la caja.
- **Layout**: tarjeta centrada de 400 px (PC) o ancho completo (móvil), sobre `--surface2`, radio 14, padding 24 (PC) / 18 (móvil), gap 16, `box-shadow: 0 12px 32px -18px rgba(0,0,0,.35)`.
- **Componentes**:
  - Header: cuadro de marca 40×40, radio 11, fondo `--primary`, letra "H" 16px/700, color `--pfg`. Título "Iniciar sesión" 18px/700. Subtítulo `hilo.local · sucursal Centro` en JetBrains Mono 11.5px, color `--muted`.
  - Lista de usuarios (máx. 4): botón fila con avatar circular 32px (`--chip`, iniciales 11px/600), nombre 13px/600, `usuario · rol` en Mono 10.5px `--faint`, marca "● activo" a la derecha en `--ptext`. Seleccionado: fondo `--psoft`, borde `1.5px solid var(--primary)`.
  - NIP: 4 casillas flex, alto 46, radio 9. Casilla activa: borde `--primary`; el resto `--border2`. Muestra "•" por dígito capturado.
  - Teclado numérico: grid 3 columnas, teclas `1..9, C, 0, ⌫`, alto 44, radio 9, borde `--border2`, Mono 16px/600.
  - Error: caja `--badsoft` con borde `--bad`, texto `--badtext` 11.5px/500.
  - Botón "Entrar": alto 48, radio 9. Habilitado sólo con 4 dígitos (deshabilitado: fondo `--chip`, texto `--faint`, `cursor:not-allowed`).
  - Enlace "Registrar nuevo personal": entra como Admin y navega a Personal, con aviso "Solo el Admin registra personal".
- **Reglas**: NIP demo `1234` para todos los usuarios semilla. NIP incorrecto → mensaje "NIP incorrecto para {nombre}".

### 1. Venta (POS) — optimizado para laptop/escritorio
- **Propósito**: cobrar ventas directas y registrar apartados.
- **Layout PC**: rail de navegación 80 px (fondo `--rail`) + catálogo flexible + panel de ticket fijo de 420 px con `border-left`.
- **Layout móvil**: sin rail lateral; barra inferior de navegación (alto 46 por botón, padding `8px 6px 14px`); el catálogo y el ticket se alternan con un segmented control ("Catálogo" / "Ticket · N").
- **Barra superior**: input de búsqueda (alto 40, radio 8, placeholder "Buscar nombre, marca o SKU…") + chip de usuario en PC (avatar 26px, nombre, badge de rol). Fila de categorías con scroll horizontal: `Todo · N`, Mezclilla, Blusas, Chamarras, Vestidos, Accesorios. Chip activo: fondo `--text`, texto `--surface`; inactivo: borde `--border2`, texto `--muted`, radio 999, padding `8px 13px`.
- **Grid de productos**: columnas según densidad (Compacta 4 / Estándar 3 / Amplia 2 en PC; 1 en móvil). Tarjeta: `--surface`, borde `--border`, radio 10, `min-height` 108/132/168, padding = gap de densidad, alineación izquierda, `cursor:pointer`.
  - Fila superior: SKU en Mono 10px `--faint` + badge de stock (`N u`). Badge: stock 0 → `--badsoft`/`--badtext`; ≤5 → `--warnsoft`/`--warntext`; resto → `--chip`/`--muted`.
  - Nombre 14px/600, `marca · tallas N` 11px/400 `--muted`.
  - Pie: precio Mono 16px/700 + "+ agregar" Mono 10px/600 `--ptext`.
  - Stock 0 → `opacity: .5` y clic muestra "Sin existencias de {producto}".
- **Panel de ticket**:
  - Encabezado: "Ticket #1042" + fecha; segmented "Venta directa" / "Apartado".
  - Vacío: caja punteada "Toca un producto para agregarlo al ticket."
  - **Línea de carrito** (columna, gap 8, padding 12, borde `--border`, radio 9):
    - Fila 1: nombre 12.5px/600 · `SKU · precio` Mono 10.5px `--muted` · stepper −/+ (26×26) · importe de línea (min-width 64, alineado derecha) · botón "×" para quitar.
    - Fila 2 (controles): **toggle "P · probado"** (alto 26, radio 6; activo: fondo `--bad`, texto blanco; inactivo: borde `--border2`, texto `--muted`) + grupo `%`/`$` (segmented de 2, activo fondo `--primary`) + input "Descuento" (ancho 88, alto 26).
    - Si `probado`: leyenda "Prenda probada · sin cambios ni devoluciones" en `--badtext`.
    - Si hay descuento: leyenda "Descuento de prenda aplicado: −$X" (automático) o "Descuento manual: −$X" en `--ptext`.
  - Aviso permanente (fondo `--psoft`, borde `--psoftb`): "Regla de stock: se descuenta **1 unidad** del modelo general, sin importar la variante de color."
  - **Bloque de apartado** (sólo modo Apartado): Nombre del cliente, Abono inicial (borde `1.5px --primary`), Teléfono, y caja `--warnsoft`/`--warn` con "VENCE EN 15 DÍAS" + fecha + nota "Si no se liquida, la prenda regresa al stock y el abono se penaliza."
  - **Pie**: `Subtotal · N pzas` (bruto), línea "Descuento en artículos −$X" (si aplica), separador, etiqueta de total ("Total a cobrar" / "Abono a cobrar") con cifra Mono 22px/700, línea "Resta al 3 sep" en apartado, botón principal (alto 46) y "Cancelar ticket".

### 1b. Modal de pasarela de pago
Se abre al presionar **"Cobrar e imprimir ticket"** (sólo venta directa; el apartado cobra directo).
- Overlay `rgba(10,10,12,.55)`, tarjeta 400 px (PC) / ancho completo (móvil), radio 14, padding 22, gap 13.
- Título "Pasarela de pago" 20px/700 + subtítulo "Elige cómo paga el cliente antes de imprimir el ticket."
- Tres botones de método (flex 1, alto 40, radio 8): **Efectivo · Transferencia · Tarjeta**. Activo: borde `1.5px --primary`, fondo `--psoft`, texto `--ptext`.
- Si Efectivo o Transferencia: línea "Descuento por método de pago: −$15.00".
- Si Efectivo: campos "Efectivo recibido" (input, borde `--primary`) y "Cambio" (read-only, texto `--oktext`), ambos alto 42.
- Línea "El vendedor recibe" con cifra Mono 22px/700 sobre borde punteado superior.
- Botones: "Confirmar e imprimir ticket" (alto 48, `--primary`) y "Cancelar" (texto plano).

### 1c. Modal de ticket impreso
Aparece tras confirmar. Badge verde (`--oksoft`/`--oktext`) con folio, título ("Venta completada" / "Apartado registrado" / "Apartado liquidado"), detalle con método de pago y comisión acreditada, lista de líneas entre bordes punteados, total y botón "Listo".

### 2. Alta de inventario — optimizado para móvil
- **Propósito**: dar de alta piezas únicas o lotes desde el celular.
- **Layout**: formulario centrado, 520 px en PC / 100 % en móvil, gap 14; contenedor con scroll y `align-items:flex-start`; todos los bloques con `flex:none` para que no se compriman.
- **Componentes**:
  - Segmented "Pieza única" / "Por lote" (alto 40).
  - "Nombre del producto" (alto 46, borde `1.5px --primary`).
  - Fila: "Marca" (flex 1) + "Precio" (130 px, Mono).
  - **Talla — dependiente de categoría**:
    - Mezclilla (pantalones): `1, 3, 5, 7, 9, 11, 13, 15`
    - Blusas / Chamarras / Accesorios: `XS, S, M, L, XL`
    - Vestidos: **sin tallas**; se muestra "Los vestidos no manejan tallas: cada pieza es única." y se guarda `tallas: 'Única'`.
    - Chip de talla: min-width 48, alto 44, radio 8; activo fondo `--primary`, texto `--pfg`.
  - Categoría: chips (alto 38, radio 8); activo `--psoft`/`--ptext` con borde `--primary`. Cambiar categoría reajusta la talla por defecto (`1` para Mezclilla, vacío para Vestidos, `M` para el resto).
  - **Por lote**: caja `--psoft`/`--psoftb`, stepper grande (botones 52×52, display 52 de alto con cifra Mono 26px/700), presets `+5 / +10 / +20`, y nota "Las variantes de color no se registran: las N unidades comparten un solo SKU."
  - **Pieza única**: caja informativa con SKU automático de vista previa (`MAR-CA-0001`).
  - Botón de envío (min-height 52): "Dar de alta N unidades" / "Dar de alta 1 pieza" / "Guardar cambios" (modo edición). Debajo, "Limpiar formulario".
- **SKU generado**: `MARCA[0..2].toUpperCase() + '-' + CATEGORIA[0..1].toUpperCase() + '-' + random(1000..9999)`.

### 3. Apartados
- **Propósito**: dar seguimiento a reservas de 15 días.
- **Layout PC**: kanban de 3 columnas por estado, con scroll vertical. **Móvil**: una sola columna con todos los apartados ordenados rojo → amarillo → verde.
- **Encabezado**: "Apartados activos" + "N activos · $X por cobrar · N vencidos".
- **Estados** (calculados por días restantes):
  - `dias > 3` → **Verde / En tiempo** (`--ok`)
  - `0 ≤ dias ≤ 3` → **Amarillo / Por vencer** (`--warn`)
  - `dias < 0` → **Rojo / Vencidos · acción requerida** (`--bad`); la columna roja lleva fondo `--badsoft`.
- **Tarjeta**: borde izquierdo 3 px del color de estado, radio 9, padding 13, gap 9.
  - Cliente 13.5px/600 + badge de tiempo (`13d 4h` o `VENCIDO 2d`; en rojo el badge es fondo `--bad` con texto blanco).
  - Descripción del artículo 11.5px `--muted`.
  - Barra de progreso (alto 6, radio 3, fondo `--chip`) con `pagado/total` y leyenda "Abonado $X de $Y".
  - Nota contextual: "Vence 1 sep" / "Recordatorio enviado · vence 20 ago" / "Venció 17 ago · abono a penalizar".
  - Acciones: en PC fila (verde/amarillo) o columna (rojo); **en móvil siempre columna, ancho completo, alto mínimo 44 px, texto 13px** — "Registrar 2º pago" y "Penalizar" / "Penalizar y regresar a stock".

### 4. Reportes y comisiones (sólo Admin)
- **Encabezado**: título + badge "ADMIN" + rango de fechas del periodo; segmented **Mes / Trimestre / Año**.
- **KPIs** (grid 4 columnas en PC, 2 en móvil): Ventas totales (con "▲ 12.4% vs periodo anterior" en `--oktext`), Tickets (con promedio), Comisiones por pagar (cifra en `--ptext`), Apartados (vencidos y monto penalizado en `--badtext`). Tamaño de cifra según densidad (20/26/30 px en PC, 20 px en móvil).
- **Tendencia**: barras según periodo — Mes: 7 días (`M M J V S D L`), Trimestre: 3 meses, Año: 8 meses. La barra máxima usa `--primary`; el resto `--chip`.
- **Ventas por vendedor**: en PC tabla de 5 columnas (`1.6fr .7fr .9fr .6fr .9fr`): Vendedor (avatar + nombre + puesto), Tickets, Ingreso, Tasa, Comisión (en `--ptext`, 700). En móvil, tarjetas apiladas con las mismas cifras.
- **Inventario**: encabezado con conteo y botón "+ Nuevo producto"; filas con nombre, `marca · SKU · tallas`, precio, stock, vendidos y acciones **Editar** (precarga el formulario de alta) y **Eliminar** (borde `--bad`). En móvil, cada fila es tarjeta apilada.

### 5. Personal y accesos (sólo Admin)
- **Layout**: grid `1.4fr 1fr` en PC, una columna en móvil, con scroll y `min-width:0` en todos los contenedores.
- **Usuarios registrados**: fila con avatar, nombre, `usuario · comisión N%`, badge de rol (ADMIN: fondo `--text`, texto `--surface`; VENDEDOR: `--chip`/`--muted`), y acciones "Entrar como" / "Sesión activa" (deshabilitado), "Cambiar rol", "Eliminar". La fila de la sesión activa lleva fondo `--psoft`. No se puede eliminar la sesión activa.
- **Registrar nuevo personal**: Nombre completo, Usuario de acceso (autogenerado si se deja vacío: `nombre.inicial`), NIP (4 dígitos, sólo numérico), Comisión %, segmented Rol (Admin / Vendedor) con texto de ayuda contextual, y botón "Registrar usuario".
- **Validaciones**: nombre obligatorio; NIP exactamente 4 dígitos; usuario único.

### 6. Cambio de usuario
Lista de todos los usuarios como botones (mismo patrón que el login, sin NIP: es un cambio de turno dentro de la sesión) + botón "Cerrar sesión y volver al inicio". El usuario en sesión aparece marcado "● sesión activa".

---

## Interactions & Behavior

### Reglas de negocio (críticas)
1. **Descuento de stock**: cada venta descuenta **1 unidad del modelo general**, sin importar la variante de color. No se modelan variantes de color.
2. **Apartado (layaway)**: reserva de **15 días** con abono inicial. El abono debe ser `> 0` y `< total`. Al crearse, el artículo sale del stock disponible.
3. **Penalización**: al vencer los 15 días sin liquidar, el apartado se penaliza: el abono se acumula en el contador "penalizado", **la unidad regresa al stock** y **se retira cualquier descuento que tuviera el producto** (`descuento = null`), con aviso "…· descuento del producto retirado por vencimiento".
4. **Prenda probada**: toggle "P" por línea del ticket; deja constancia de que esa prenda no admite cambios ni devoluciones. Debe imprimirse/persistirse en el ticket.
5. **Descuentos por artículo**: porcentual o por monto, capturados en la línea del carrito. El descuento **manual sobrescribe** al automático del producto.
6. **Descuentos automáticos en vestidos**: cada vestido lleva su propio descuento — 10 % o monto fijo ($100 o $40) según el modelo. Se aplica solo si no hay descuento manual en esa línea.
7. **Descuento por método de pago**: **−$15** en Efectivo y en Transferencia; **$0** en Tarjeta. Sólo aplica a venta directa, nunca al abono de un apartado.
8. **Efectivo**: si el recibido es menor al total, se bloquea el cobro con el aviso "El efectivo recibido es menor al total a cobrar". El cambio es `recibido − total`.
9. **Comisiones**: se calculan sobre el ingreso generado por cada vendedor, con tasa individual (5 %–8 %). Cada venta/abono/liquidación acredita ingreso y ticket al **usuario en sesión**.

### Cálculo de línea (pseudocódigo)
```
base   = precio * cantidad
auto   = producto.descuento
           ? (tipo === 'pct' ? base * valor / 100 : valor)
           : 0
manual = valorCapturado > 0
           ? (tipoCapturado === 'pct' ? base * valorCapturado / 100 : valorCapturado)
           : 0
desc   = min(manual > 0 ? manual : auto, base)
totalLinea = base - desc
```
```
subtotalBruto      = Σ base
descuentoArticulos = Σ desc
subtotal           = subtotalBruto - descuentoArticulos
descPago           = (ventaDirecta && metodo ∈ {efectivo, transferencia}) ? 15 : 0
totalFinal         = max(0, subtotal - descPago)
cambio             = metodo === 'efectivo' ? max(0, recibido - totalFinal) : 0
```

### Flujos
- **Venta directa**: buscar/filtrar → tocar producto (descuenta stock, agrega línea) → ajustar cantidad, marcar probado, aplicar descuento → "Cobrar e imprimir ticket" → **modal de pasarela** → "Confirmar e imprimir ticket" → **modal de ticket** → "Listo".
- **Apartado**: cambiar a "Apartado" → capturar cliente, abono, teléfono → "Apartar e imprimir recibo" (sin pasarela) → recibo con abono y resta.
- **Liquidar apartado**: "Registrar 2º pago" → suma el remanente a ventas, incrementa `sold`, elimina el apartado y abre el ticket "Apartado liquidado".
- **Cancelar ticket**: vacía el carrito y **devuelve todas las unidades al stock**.
- **Editar producto**: desde Reportes → precarga el formulario de Alta en modo edición y navega a esa vista.

### Validaciones y avisos (toast)
Toast inferior, fondo `--text`, texto `--surface`, radio 10, autocierre a **2 800 ms**. Mensajes literales:
- "Agrega al menos un producto"
- "Captura el nombre del cliente" / "Captura el abono inicial" / "El abono debe ser menor al total"
- "El efectivo recibido es menor al total a cobrar"
- "Captura el nombre del producto" / "Captura un precio válido"
- "El NIP debe tener 4 dígitos" / "Ese usuario ya existe"
- "N unidades dadas de alta · SKU XXX" / "Pieza única dada de alta · SKU XXX"
- "Ticket cancelado · unidades devueltas al stock"
- "Abono de $X penalizado · 1 unidad regresó al stock"
- "No puedes eliminar la sesión activa"

### Responsive
Punto de corte conceptual: **PC ≈ 1440×900**, **Móvil ≈ 390×812**. En el prototipo se alterna con un toggle PC/Móvil; en producción debe ser por media queries / breakpoints reales (sugerido: `< 768px` = móvil).
Diferencias clave en móvil: rail lateral → barra inferior; catálogo 1 columna; ticket como pestaña; kanban → lista única; tablas → tarjetas apiladas; botones de acción a ancho completo y ≥ 44 px de alto.
Todo contenedor con scroll debe tener altura acotada (`position:absolute; inset:0` o `min-height:0`) y las tarjetas internas `flex:none`, para que el scroll funcione y nada se comprima.

---

## State Management

### Entidades
```ts
Usuario   { id, nombre, usuario, ini, rol: 'admin'|'vendedor', nip, tasa, tickets, ingreso }
Producto  { id, name, brand, cat, sku, precio, stock, sold, tallas,
            descuento?: { tipo: 'pct'|'monto', valor: number } | null }
LineaCarrito { id (productoId), qty, probado: boolean, descTipo: 'pct'|'monto', descValor: string }
Apartado  { id, cliente, pid (productoId), item, total, pagado, dias, horas, vence }
Pago      { metodo: 'efectivo'|'transferencia'|'tarjeta', recibido: string }
```

### Estado de UI
`disp` (pc|movil), `vista` (pos|inv|apa|ana|per|cambio), `panel` (catalogo|ticket), `periodo` (Mes|Trimestre|Año), `sesion` (userId|null), `loginSel`, `nip`, `loginErr`, `busqueda`, `cat`, `modo` (directa|apartado), `cliente`, `telefono`, `abono`, `carrito[]`, `folio`, `ticket`, `aviso`, `pago`, `pagoAbierto`, `form{}`, `reg{}`.

### Datos que deben venir del backend
Usuarios (con NIP hasheado), productos/inventario, apartados, ventas y tickets, tasas de comisión, agregados por periodo (mes/trimestre/año). En el prototipo el catálogo, los apartados y los históricos de venta están hardcodeados; ver `PERIODOS` para la forma de los agregados.

---

## Design Tokens

```css
--canvas:  #eceae5    /* fondo de página */
--surface: #ffffff    /* tarjetas, paneles */
--surface2:#faf9f7    /* fondos secundarios, pies */
--border:  rgba(0,0,0,.09)
--border2: rgba(0,0,0,.14)
--text:    #1c1c1a
--muted:   #6b6b72
--faint:   #a1a1aa
--chip:    #f1f0ed
--rail:    #1c1c1a    /* rail de navegación */

--primary: oklch(0.5 0.15 155)   /* verde de marca (configurable) */
--pfg:     #fff
--psoft:   color-mix(in oklab, var(--primary) 14%, var(--surface))
--psoftb:  color-mix(in oklab, var(--primary) 36%, var(--surface))
--ptext:   color-mix(in oklab, var(--primary) 74%, var(--text))

--ok:      oklch(0.58 0.14 150)  --oksoft:  oklch(0.95 0.05 150)  --oktext:  oklch(0.43 0.13 150)
--warn:    oklch(0.75 0.15 82)   --warnsoft:oklch(0.96 0.05 85)   --warntext:oklch(0.45 0.1 70)
--bad:     oklch(0.56 0.19 25)   --badsoft: oklch(0.96 0.03 25)   --badtext: oklch(0.5 0.19 25)

--shadow:  0 12px 32px -18px rgba(0,0,0,.35)
```

**Alternativas de color de marca** validadas: `oklch(0.52 0.19 268)` (índigo), `oklch(0.55 0.14 200)` (azul), `oklch(0.5 0.15 155)` (verde, actual), `oklch(0.56 0.17 20)` (rojo).

**Tipografía**
- UI: **Instrument Sans** — 400 / 500 / 600 / 700.
- Cifras, SKU, tiempos, códigos: **JetBrains Mono** — 400 / 500 / 600 / 700.
- Escala usada: 10–11.5 px (metadatos), 12–14 px (cuerpo/labels), 14–16 px (títulos de tarjeta, botones), 18–22 px (títulos de sección y totales), 26–30 px (KPIs).
- Ambas de Google Fonts. **En intranet sin internet, deben auto-hospedarse.**

**Otros**
- Radios: 4 / 6 / 7 / 8 / 9 / 10 / 11 / 12 / 14 / 999 (píldoras) / 36–46 (marco de móvil).
- Espaciado: 3, 4, 6, 7, 8, 9, 10, 12, 13, 14, 16, 18, 22, 24.
- Alturas de control: 26 (mini), 30–34 (secundario), 38–42 (input), 44–46 (móvil / primario), 48–52 (CTA).
- Modo oscuro: **eliminado por decisión del cliente**. Sólo tema claro.

## Assets
Ninguno. **El sistema no maneja fotos de producto** (decisión del cliente: el alta por lote y las piezas únicas lo harían tedioso). Los productos se identifican por SKU, marca, categoría y talla. No hay iconos de librería: los indicadores son puntos de color, badges de texto y glifos tipográficos (`−`, `+`, `×`, `‹`, `⌫`).

---

## Stack sugerido (si no hay código base)
- **Frontend**: React + TypeScript + Vite; Tailwind o CSS Modules con los tokens de arriba como variables CSS. Los primitivos (botón, input, segmented, modal, tabla) pueden venir de shadcn/ui: el prototipo ya sigue esa estética.
- **Backend**: API REST (Node/Express o Laravel) sobre PostgreSQL o MySQL, servida en la LAN de la tienda.
- **Auth**: sesión por usuario + NIP hasheado (bcrypt/argon2); sesión corta con re-autenticación al cambiar de turno.
- **Impresión**: ticket a impresora térmica 58/80 mm (ESC/POS o plantilla HTML de impresión) — el diseño del modal de ticket es la referencia de contenido, no del formato físico.
- **Offline/LAN**: la app corre en red local; considerar PWA con caché para el alta de inventario desde celular.

## Épicas y user stories iniciales
Ver `USER_STORIES.md` en este mismo paquete.

## Files
- `Sistema POS v3.dc.html` — prototipo aprobado, todas las pantallas y reglas (**referencia principal**).
- `Sistema POS - Hilo (offline).html` — el mismo prototipo en un archivo único que abre sin internet; útil para mostrarlo al cliente o al equipo.
- `Sistema POS v2.dc.html` — versión previa (sin login ni personal); sólo referencia histórica.
- `Hilo POS.dc.html` — mockups estáticos originales de las 4 pantallas.
- `README.md` (este archivo) y `USER_STORIES.md`.
