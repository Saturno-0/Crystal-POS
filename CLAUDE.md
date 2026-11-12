# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Crystal POS & Inventario

Sistema de punto de venta e inventario para tienda de ropa (Crystal), operado en intranet local.

## Contexto de diseño
- Especificación completa: `docs/README.md`
- User stories y orden de sprints: `docs/USER_STORIES.md`
- Prototipo de referencia: `docs/Sistema POS v3.dc.html` (ábrelo en el navegador)
- El prototipo es SOLO referencia visual y de comportamiento. No copiar su runtime
  (`support.js`, `<sc-for>`, `<sc-if>`, `renderVals`). Se reimplementa en el stack real.
- Los documentos de `docs/` (README.md, USER_STORIES.md, el prototipo) son el handoff
  de diseño original y usan "Hilo" como nombre de ejemplo — el negocio real se llama
  **Crystal**. No son código; no hace falta editarlos, pero al leerlos mentalmente
  sustituye "Hilo" por "Crystal".

## Stack
- **Frontend**: React + TypeScript + Vite (`apps/web`).
- **Backend**: Node + Express + TypeScript sobre SQLite (`apps/api`), BD en archivo local en la laptop de la tienda.
- **Compartido**: paquete `packages/shared` con tipos y lógica de negocio pura (cálculo de línea/total), usado por web y api.
- **Gestor de paquetes**: pnpm (workspaces).
- **Tests**: Vitest.
- Modelo de datos y estructura de carpetas completos: `docs/MODELO_DATOS.md`.

## Comandos

Desde la raíz (workspace root), usando pnpm:

- `pnpm dev` — levanta web + api en paralelo.
- `pnpm dev:web` / `pnpm dev:api` — levanta solo uno (api en `:3001`, web via Vite).
- `pnpm build` — build de todos los paquetes (`pnpm -r build`).
- `pnpm test` — corre los tests de todos los paquetes (`pnpm -r test`, Vitest).
- `pnpm typecheck` — type-check de todos los paquetes (`pnpm -r typecheck`).
- `pnpm --filter @crystal/api test -- <patrón>` — corre un solo archivo/test en `apps/api`
  (equivalente en `@crystal/shared`). No hay `vitest.config.ts` por paquete: Vitest usa
  su configuración por defecto, apuntando a `src/**/*.test.ts`.
- `pnpm --filter @crystal/web lint` — oxlint (solo configurado en `apps/web`).
- `pnpm --filter @crystal/web test:e2e` — suite Playwright end-to-end (`apps/web/tests/e2e/`,
  ver `apps/web/playwright.config.ts`). Levanta API + web automáticamente contra una BD
  SQLite descartable (`apps/api/data/.playwright-test.sqlite`, nunca la BD real de la
  tienda) que se recrea desde cero en cada corrida. `workers: 1` porque los flujos
  escriben en esa misma BD compartida.

No hay lint configurado en `apps/api` ni `packages/shared`.

## Arquitectura

- **Monorepo pnpm** con tres paquetes: `@crystal/web`, `@crystal/api`, `@crystal/shared`.
  `@crystal/shared` exporta tipos (`types.ts`) y lógica de negocio pura (`calculo.ts`,
  `producto.ts`, `nombre.ts`) sin dependencias de runtime; tanto `apps/web` como `apps/api`
  la consumen vía `workspace:*` para no duplicar reglas de negocio (p. ej. cálculo de
  línea/descuento) entre frontend y backend.
- **API (`apps/api`)**: Express sobre SQLite (`better-sqlite3`, síncrono, un solo archivo
  en `apps/api/data/`). Patrón por dominio en `src/routes/*.routes.ts` →
  `src/services/*.service.ts` → `db` (instancia única de `src/db/client.ts`). Las rutas
  son delgadas: parsean `req`, llaman al service pasándole `db` explícitamente, y delegan
  errores a `handleError` (`src/lib/errors.ts`), que mapea `ValidationError`/`NotFoundError`
  a 400/404 y cualquier otra excepción a 500. Los services reciben `Database.Database`
  como primer parámetro (nunca importan el singleton directamente), lo que permite
  testearlos contra una DB en memoria (`src/test/testDb.ts` recrea el esquema de
  `db/schema.sql` con `:memory:`) sin tocar el archivo real.
- **Autenticación**: JWT con expiración corta por inactividad (`SESION_TTL_SEGUNDOS` = 20
  min, `src/lib/jwt.ts`). El middleware `authenticate` (`src/middleware/auth.ts`) verifica
  el token, puebla `req.sesion` (`{ sub, rol, nombre }`) y **reemite** un token nuevo con la
  ventana renovada en el header `X-Renewed-Token` en cada request autenticado — no hay
  endpoint de refresh separado. El cliente (`apps/web/src/lib/apiClient.ts`) lee ese header
  en cada `apiFetch` y notifica a un listener (`setTokenRenewedListener`) para persistir el
  token renovado. `requireRole(...roles)` protege rutas por rol (`admin` | `vendedor`).
- **Esquema de datos**: fuente de verdad en `apps/api/src/db/schema.sql`, documentado con
  comentarios de reglas de negocio en `docs/MODELO_DATOS.md` (snapshots de precio/tasa de
  comisión en el momento de la venta, estados de apartado, auditoría). Leer ese archivo
  antes de tocar servicios de ventas/apartados: varias reglas (congelado de precio en
  apartados, cómo se calcula `comision_monto`, qué estados cuentan para KPIs) solo están
  documentadas ahí, no son obvias del código.
- **Web (`apps/web`)**: React + Vite, sin router externo — la navegación entre `pages/`
  vive en `App.tsx`. Organización por `pages/` (una pantalla) y `features/<dominio>/` (API
  calls y hooks de ese dominio, p. ej. `features/ventas/api.ts` + `useCarrito.ts`).
  CSS Modules por página (`Pagina.module.css`) + tokens globales en `styles/tokens.css`
  (ver convenciones de diseño abajo).
- **Mismo origen siempre**: el frontend llama rutas relativas (`/api/...`, ver
  `lib/apiClient.ts`), nunca una URL absoluta. En dev, el proxy de Vite (`vite.config.ts`)
  reenvía `/api` a la API en `:3001`. En producción, `apps/api` sirve también el build de
  `apps/web/dist` como estáticos en ese mismo puerto (ver `index.ts`) — así un celular en
  la LAN solo necesita `http://<ip-de-la-laptop>:3001`, sin CORS ni una segunda URL que
  configurar. Ver `docs/DESPLIEGUE.md` para instalarlo en la laptop real de la tienda
  (Windows) como Servicio con auto-arranque y auto-reinicio.
- **`@crystal/shared` sí se compila**: a diferencia de antes, su `package.json` apunta a
  `dist/` (no a `src/*.ts`), porque `node dist/index.js` en producción no puede resolver
  TypeScript directamente. `pnpm dev` corre `tsc --watch` de `shared` en paralelo
  (recompila solo al guardar); si cambias algo ahí mientras hay sesiones de desarrollo
  activas y no se refleja, corre `pnpm --filter @crystal/shared build` a mano.

## Reglas de negocio no negociables
1. Cada venta descuenta 1 unidad del modelo general; no se modelan variantes de color,
   **excepto** en categorías marcadas "por color" (`categorias.por_color`, p. ej. sacos y
   pantalones de vestir): ahí cada color × talla es su propio producto/SKU con
   `productos.color` obligatorio, dado de alta desde el modal "Alta por color y talla".
   Columnas agregadas después del primer despliegue se añaden en `db/migraciones.ts`
   (schema.sql no altera una BD ya existente).
2. Apartado = 15 días; abono > 0 y < total.
3. Al penalizar: abono perdido, unidad regresa a stock y se retira el descuento del producto.
4. Efectivo y Transferencia aplican −$15; Tarjeta no.
5. Descuento manual de línea sobrescribe el descuento automático de la prenda.
6. Vestidos: sin talla, con descuento propio (10 %, $100 o $40).
7. Pantalones usan tallas 1–15; el resto XS–XL.
8. Comisión con tasa individual sobre el ingreso **neto** (después de descuentos de
   artículo y de método de pago), acreditada al usuario en sesión. El Admin también
   vende y genera comisión, igual que un Vendedor.
9. Sin fotos de producto.
10. No hay devoluciones de una venta ya cobrada. Solo se permite **cambio por otra
    prenda**, y solo por una de **igual o mayor precio** que lo efectivamente pagado
    por esa línea (con descuentos ya aplicados); si es mayor, el cliente paga la
    diferencia — nunca hay devolución de dinero. Una línea marcada "probada" no se
    puede cambiar, igual que no admite devolución. La diferencia no aplica el
    descuento de −$15 por método de pago (regla 4), pero sí genera comisión para el
    vendedor en turno sobre esa diferencia. Una línea solo se puede cambiar una vez,
    y solo si es de 1 unidad. Sin límite de tiempo por ahora. Implementado en
    `apps/api/src/services/cambios.service.ts`.

## Impresión de ticket (HU-3.6)

Impresora confirmada: térmica genérica **POS-58** (58 mm, USB, ESC/POS), vía el driver de
impresora normal del sistema operativo — nunca ESC/POS directo desde la app (decisión de
alcance en `docs/MODELO_DATOS.md`). `TicketModal.tsx` y `ReciboApartado.tsx` llaman
`window.print()` al montarse (más un botón "Imprimir de nuevo" como respaldo); `print.css`
fija el ancho imprimible a 48 mm con `@page { size: 58mm auto }`. En dev, `<StrictMode>`
duplica el efecto de montaje (comportamiento normal de React, no ocurre en el build de
producción) — por eso `tests/e2e/impresion.spec.ts` solo exige "al menos una" llamada, no
exactamente una.

## Respaldos (HU-6.5)

Al iniciar la API y cada `HILO_RESPALDO_INTERVALO_HORAS` (default 6h) mientras el proceso
corre, se respalda `apps/api/data/hilo.sqlite` a `apps/api/data/backups/` vía la API de
backup en caliente de `better-sqlite3` (segura con WAL activo). Se conservan los últimos
`HILO_MAX_RESPALDOS` (default 30), podando los más viejos. Ver
`apps/api/src/services/respaldos.service.ts` y `db/respaldoScheduler.ts`. Admin puede ver
la lista y forzar un respaldo manual desde Reportes (`GET`/`POST /api/respaldos`). No hay
restauración por UI — es una copia de archivo manual mientras el proceso está detenido.

## Credenciales de desarrollo (cambiar antes de operar en vivo)

- `JWT_SECRET` no configurado → cae en el literal `'dev-secret-cambiar-en-produccion'`
  (`src/lib/jwt.ts`). En producción se define como variable de entorno real (en el
  Servicio de Windows, vía `nssm set CrystalPOS AppEnvironmentExtra JWT_SECRET=...`).
- NIP demo `1234` para todos los usuarios semilla (`src/db/seed.ts`) — reemplazar por
  NIPs reales desde Personal (botón "Editar" → campo "Nuevo NIP") antes de que el
  personal real empiece a usar el sistema.

## Convenciones
- UI e interfaz de usuario en español (México).
- Tokens de color y tipografía exactamente como en `docs/README.md`.
- Fuentes auto-hospedadas: el sistema debe funcionar sin internet.
- Controles táctiles ≥ 44 px; breakpoint móvil < 768 px.