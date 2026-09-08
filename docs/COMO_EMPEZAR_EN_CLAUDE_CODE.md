# Cómo continuar en Claude Code / VS Code

Guía breve para pasar del prototipo aprobado al desarrollo real.

## 1. Prepara el repositorio
```bash
mkdir hilo-pos && cd hilo-pos
git init
mkdir docs
# copia aquí el contenido de este paquete
cp -r <ruta>/design_handoff_pos_hilo/* docs/
git add . && git commit -m "docs: handoff de diseño y user stories"
```

## 2. Instala Claude Code
- CLI: `npm install -g @anthropic-ai/claude-code`, luego `claude` dentro del repo.
- VS Code: instala la extensión **Claude Code** desde el Marketplace y ábrela en la carpeta del repo.

En ambos casos Claude lee los archivos del proyecto, así que `docs/README.md` y `docs/USER_STORIES.md` quedan disponibles como contexto.

## 3. Crea el `CLAUDE.md` del repo
Archivo en la raíz que Claude Code lee en cada sesión:

```markdown
# Hilo POS & Inventario

Sistema de punto de venta e inventario para tienda de ropa, operado en intranet local.

## Contexto de diseño
- Especificación completa: `docs/README.md`
- User stories y orden de sprints: `docs/USER_STORIES.md`
- Prototipo de referencia: `docs/Sistema POS v3.dc.html` (ábrelo en el navegador)
- El prototipo es SOLO referencia visual y de comportamiento. No copiar su runtime
  (`support.js`, `<sc-for>`, `<sc-if>`, `renderVals`). Se reimplementa en el stack real.

## Stack
<completa cuando lo definas: framework, base de datos, gestor de paquetes, tests>

## Reglas de negocio no negociables
1. Cada venta descuenta 1 unidad del modelo general; no se modelan variantes de color.
2. Apartado = 15 días; abono > 0 y < total.
3. Al penalizar: abono perdido, unidad regresa a stock y se retira el descuento del producto.
4. Efectivo y Transferencia aplican −$15; Tarjeta no.
5. Descuento manual de línea sobrescribe el descuento automático de la prenda.
6. Vestidos: sin talla, con descuento propio (10 %, $100 o $40).
7. Pantalones usan tallas 1–15; el resto XS–XL.
8. Comisión por vendedor con tasa individual, acreditada al usuario en sesión.
9. Sin fotos de producto.

## Convenciones
- UI e interfaz de usuario en español (México).
- Tokens de color y tipografía exactamente como en `docs/README.md`.
- Fuentes auto-hospedadas: el sistema debe funcionar sin internet.
- Controles táctiles ≥ 44 px; breakpoint móvil < 768 px.
```

## 4. Primeros prompts sugeridos
Uno por sesión, en este orden:

1. `Lee docs/README.md y docs/USER_STORIES.md. Propón el modelo de datos (esquema SQL) y la estructura de carpetas para el stack que definimos en CLAUDE.md. No escribas código todavía.`
2. `Inicializa el proyecto: dependencias, configuración, tokens de diseño como variables CSS y el layout base (rail de escritorio + barra inferior móvil) según docs/README.md.`
3. `Implementa la Épica 1 (autenticación con NIP, roles y CRUD de personal) siguiendo HU-1.1 a HU-1.6. Incluye tests de las validaciones.`
4. `Implementa la Épica 2 (catálogo, alta única y por lote, tallas por categoría). Respeta las reglas 6, 7 y 9 de CLAUDE.md.`
5. `Implementa la Épica 3 (carrito, probado, descuentos, pasarela de pago). Escribe primero tests para el cálculo de línea y totales de docs/README.md.`

Después continúa con Épicas 4, 5 y 6 en el mismo formato.

## 5. Consejos
- Una épica por rama y por PR; pide a Claude que corra los tests antes de cerrar.
- Cuando la UI no coincida, señálale el archivo y la sección: *"compara con la sección 'Panel de ticket' de docs/README.md"*.
- El pseudocódigo de cálculo de línea y totales del README sirve tal cual como base de tests unitarios.
- Si cambian las reglas de negocio, actualiza `CLAUDE.md` — es la fuente de verdad de las sesiones.
