# User stories — Hilo POS & Inventario

Roles: **Admin** (superusuario) · **Vendedor** · **Sistema** (procesos automáticos).
Prioridad: **P0** = MVP indispensable · **P1** = necesario para operar bien · **P2** = mejora posterior.

---

## Épica 1 — Autenticación y personal

### HU-1.1 · Iniciar sesión con NIP — P0
**Como** vendedor **quiero** entrar seleccionando mi usuario y escribiendo un NIP de 4 dígitos **para** empezar a vender sin teclado completo.
- El teclado numérico en pantalla permite `1..9, 0, C (limpiar), ⌫ (borrar)`.
- "Entrar" se habilita sólo con 4 dígitos capturados.
- NIP incorrecto muestra "NIP incorrecto para {nombre}" y no inicia sesión.
- Al entrar, aterrizo en la vista de Venta con un saludo "Bienvenida, {nombre}".
- El NIP se almacena hasheado; nunca en texto plano.

### HU-1.2 · Cerrar sesión — P0
**Como** vendedor **quiero** cerrar sesión **para** que nadie use la caja a mi nombre.
- Se limpia el carrito en curso y se regresa a la pantalla de inicio de sesión.

### HU-1.3 · Cambiar de usuario (cambio de turno) — P1
**Como** vendedor **quiero** cambiar rápido al usuario que entra al turno **para** que las ventas se acrediten a quien corresponde.
- Lista de todos los usuarios; el activo se marca "● sesión activa".
- Al cambiar, las ventas y comisiones posteriores se acreditan al nuevo usuario.

### HU-1.4 · Registrar personal — P0
**Como** admin **quiero** dar de alta personal con nombre, usuario, NIP, % de comisión y rol **para** controlar quién accede al sistema.
- El usuario se autogenera (`nombre.inicial`) si se deja vacío.
- El NIP debe ser exactamente 4 dígitos numéricos.
- No se permiten usuarios duplicados.

### HU-1.5 · Cambiar rol y dar de baja personal — P1
**Como** admin **quiero** cambiar el rol de un usuario o eliminarlo **para** ajustar permisos cuando alguien asciende o se va.
- No se puede eliminar la sesión activa ("No puedes eliminar la sesión activa").
- Cambiar rol actualiza inmediatamente la navegación visible de ese usuario.

### HU-1.6 · Permisos por rol — P0
**Como** admin **quiero** que Reportes y Personal sólo sean visibles para mí **para** proteger la información financiera.
- Un vendedor no ve las pestañas Reportes ni Personal, ni puede llegar a ellas por URL.

---

## Épica 2 — Catálogo e inventario

### HU-2.1 · Alta de pieza única — P0
**Como** vendedor **quiero** registrar una prenda única con nombre, marca, precio, talla y categoría **para** poder venderla de inmediato.
- Se genera un SKU automático `MAR-CA-1234`.
- Nombre y precio son obligatorios.

### HU-2.2 · Alta por lote — P0
**Como** vendedor **quiero** dar de alta N unidades del mismo modelo en un solo paso **para** no capturar 10 jeans uno por uno.
- Contador con `−`/`+` y presets `+5 / +10 / +20`.
- Las N unidades comparten un solo SKU de modelo; **las variantes de color no se registran**.
- El botón refleja la cantidad: "Dar de alta 10 unidades".

### HU-2.3 · Tallas según categoría — P0
**Como** vendedor **quiero** que el sistema me ofrezca las tallas correctas por tipo de prenda **para** no capturar tallas inválidas.
- Pantalones (Mezclilla): `1, 3, 5, 7, 9, 11, 13, 15`.
- Blusas, chamarras y accesorios: `XS, S, M, L, XL`.
- Vestidos: **sin talla**; se guarda como "Única" y se muestra el aviso correspondiente.
- Cambiar de categoría reajusta la talla seleccionada por defecto.

### HU-2.4 · Alta desde el celular — P0
**Como** vendedor **quiero** dar de alta inventario desde mi teléfono **para** capturar la mercancía al momento de recibirla.
- Formulario a una columna, controles de al menos 44 px de alto, scroll funcional.
- La app corre en la red local de la tienda.

### HU-2.5 · Editar y eliminar productos — P1
**Como** admin **quiero** editar o eliminar productos desde Reportes **para** corregir precios y depurar el catálogo.
- "Editar" precarga el formulario de alta en modo edición.
- "Eliminar" retira el modelo del catálogo con confirmación por aviso.

### HU-2.6 · Buscar y filtrar catálogo — P0
**Como** vendedor **quiero** buscar por nombre, marca o SKU y filtrar por categoría **para** encontrar la prenda en segundos durante el cobro.
- Búsqueda incremental; estado vacío "Sin resultados para esa búsqueda."

### HU-2.7 · Visibilidad del stock — P1
**Como** vendedor **quiero** ver el stock en cada tarjeta con color de alerta **para** saber qué está por agotarse.
- Stock ≤ 5 en ámbar, 0 en rojo con la tarjeta atenuada y clic bloqueado.

---

## Épica 3 — Punto de venta

### HU-3.1 · Armar ticket — P0
**Como** vendedor **quiero** agregar productos al ticket con un toque y ajustar cantidades **para** cobrar rápido.
- Cada alta en el ticket descuenta **1 unidad del modelo general**, sin importar la variante de color.
- Stepper `−`/`+` y botón para quitar la línea, todos devolviendo stock correctamente.

### HU-3.2 · Marcar prenda probada — P0
**Como** vendedor **quiero** marcar con "P" las prendas que el cliente se probó **para** dejar constancia de que no admiten devolución.
- El estado se imprime y se guarda en el ticket de venta.

### HU-3.3 · Descuento por artículo — P0
**Como** vendedor **quiero** aplicar un descuento porcentual o por monto a una línea **para** cerrar la venta cuando el cliente negocia.
- Selector `%` / `$` más campo de valor por línea.
- El descuento manual sobrescribe cualquier descuento automático de la prenda.
- El descuento nunca puede exceder el importe de la línea.

### HU-3.4 · Descuentos automáticos en vestidos — P1
**Como** dueña **quiero** que los vestidos apliquen su descuento configurado **para** respetar la promoción sin depender de la memoria del vendedor.
- Cada vestido tiene su propio descuento: 10 %, $100 o $40 según el modelo.
- Se muestra en la línea como "Descuento de prenda aplicado: −$X".

### HU-3.5 · Pasarela de pago — P0
**Como** vendedor **quiero** elegir el método de pago en un modal al cobrar **para** calcular el total correcto y el cambio.
- Métodos: Efectivo, Transferencia, Tarjeta.
- Efectivo y Transferencia aplican **−$15**; Tarjeta no aplica descuento.
- En Efectivo capturo lo recibido y el sistema calcula el cambio.
- Si el recibido es menor al total, el cobro se bloquea.
- Se muestra siempre "El vendedor recibe".

### HU-3.6 · Imprimir ticket — P0
**Como** vendedor **quiero** imprimir el ticket al cerrar la venta **para** entregárselo al cliente.
- El ticket incluye folio, líneas con descuentos, prendas probadas, método de pago, recibido y cambio.
- Impresión en térmica 58/80 mm.

### HU-3.7 · Cancelar ticket — P1
**Como** vendedor **quiero** cancelar el ticket en curso **para** liberar la mercancía si el cliente se arrepiente.
- Todas las unidades del carrito regresan al stock.

---

## Épica 4 — Apartados (layaway)

### HU-4.1 · Registrar apartado — P0
**Como** vendedor **quiero** apartar una prenda con un abono inicial y los datos del cliente **para** reservarla 15 días.
- Cliente y abono son obligatorios; el abono debe ser mayor a 0 y menor al total.
- Se muestra la fecha de vencimiento a 15 días y la nota de penalización.
- La unidad sale del stock disponible al crear el apartado.

### HU-4.2 · Ver apartados por estado — P0
**Como** vendedor **quiero** ver los apartados agrupados por salud **para** saber a quién llamar hoy.
- Verde (más de 3 días), Amarillo (3 días o menos), Rojo (vencido).
- Cada tarjeta muestra cliente, artículo, abonado/total, barra de progreso y cuenta regresiva.
- Kanban en escritorio; lista única ordenada por urgencia en móvil.

### HU-4.3 · Registrar segundo pago — P0
**Como** vendedor **quiero** liquidar un apartado **para** entregar la prenda al cliente.
- Se cobra el remanente, se acredita al vendedor en sesión y se emite el ticket "Apartado liquidado".
- El apartado desaparece de la lista y la venta cuenta como realizada.

### HU-4.4 · Penalizar y regresar a stock — P0
**Como** vendedor **quiero** penalizar un apartado vencido **para** recuperar la prenda y registrar el abono perdido.
- La unidad regresa al stock.
- El abono se acumula en el total penalizado del periodo.
- **Se retira cualquier descuento que tuviera el producto** y se avisa explícitamente.

### HU-4.5 · Alertas de vencimiento — P2
**Como** vendedor **quiero** recibir un recordatorio de los apartados por vencer **para** contactar al cliente a tiempo.
- Marca "Recordatorio enviado" en las tarjetas ámbar; ideal: aviso por WhatsApp/SMS.

### HU-4.6 · Cierre automático al día 15 — P1
**Como** sistema **quiero** marcar como vencidos los apartados que pasan de 15 días **para** que el vendedor vea la acción pendiente sin cálculos manuales.
- Proceso diario que recalcula estados y mueve las tarjetas a la columna roja.

---

## Épica 5 — Reportes y comisiones

### HU-5.1 · KPIs del negocio — P0
**Como** admin **quiero** ver ventas totales, tickets, comisiones por pagar y apartados **para** saber cómo va la tienda de un vistazo.

### HU-5.2 · Periodos mensual / trimestral / anual — P0
**Como** admin **quiero** cambiar el periodo del reporte **para** comparar desempeño en distintas ventanas de tiempo.
- El cambio de periodo actualiza KPIs, rango de fechas, gráfica de tendencia e ingresos/comisiones por vendedor.

### HU-5.3 · Comisiones por vendedor — P0
**Como** admin **quiero** ver el ingreso generado y la comisión calculada de cada vendedor **para** pagar la nómina variable.
- Tasa individual por vendedor (5 %–8 %), configurable en Personal.
- Cada venta, abono y liquidación acredita al usuario en sesión al momento de la operación.

### HU-5.4 · Tendencia de ventas — P1
**Como** admin **quiero** una gráfica de tendencia acorde al periodo **para** ver estacionalidad.
- Mes: 7 días · Trimestre: 3 meses · Año: 8+ meses.

### HU-5.5 · Exportar reportes — P2
**Como** admin **quiero** exportar el reporte del periodo a CSV/PDF **para** compartirlo con mi contador.

---

## Épica 6 — Plataforma y calidad

### HU-6.1 · Responsivo real — P0
**Como** usuaria **quiero** que el sistema se adapte a laptop y celular **para** cobrar en caja y capturar inventario en piso.
- Breakpoint sugerido: `< 768 px` = móvil (rail → barra inferior, tablas → tarjetas, 1 columna).
- Todos los contenedores con scroll deben funcionar; controles táctiles ≥ 44 px.

### HU-6.2 · Operación en intranet — P0
**Como** dueña **quiero** que el sistema funcione en la red local **para** no depender de internet.
- Fuentes e íconos auto-hospedados; sin CDNs externos en runtime.

### HU-6.3 · Sin gestión de fotos — P0
**Como** dueña **quiero** que el catálogo no requiera fotos **para** que el alta por lote sea rápida.
- Los productos se identifican por SKU, marca, categoría y talla.

### HU-6.4 · Trazabilidad de operaciones — P1
**Como** admin **quiero** que cada venta, apartado, penalización y cambio de inventario quede registrado con usuario y fecha **para** auditar diferencias de caja.

### HU-6.5 · Respaldos locales — P2
**Como** dueña **quiero** respaldos automáticos de la base de datos **para** no perder el histórico si falla el equipo.

---

## Orden de implementación sugerido
1. **Sprint 1 — Base**: modelo de datos, auth con NIP, roles, CRUD de personal (Épica 1).
2. **Sprint 2 — Catálogo**: alta única y por lote, tallas por categoría, búsqueda y filtros (Épica 2).
3. **Sprint 3 — Venta**: carrito, probado, descuentos, pasarela de pago, impresión de ticket (Épica 3).
4. **Sprint 4 — Apartados**: creación, estados, segundo pago, penalización y cierre automático (Épica 4).
5. **Sprint 5 — Reportes**: KPIs, periodos, comisiones, tendencia (Épica 5).
6. **Sprint 6 — Endurecimiento**: responsivo fino, trazabilidad, respaldos, exportaciones (Épica 6).
