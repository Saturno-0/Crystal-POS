# Despliegue en la laptop de la tienda (Windows)

Esta guía es para instalar Crystal POS en la laptop real de la tienda (Windows), de forma
que:
- El personal pueda entrar desde su celular (mismo wifi) o desde la propia laptop.
- Los tickets se impriman desde la impresora térmica conectada por USB a esa laptop.
- El sistema siga funcionando y los datos sigan visibles la mayor parte del tiempo, incluso
  después de que la laptop se apague/reinicie o si el proceso llegara a truncarse.

No cubre copias de seguridad fuera de la laptop (USB externo / nube) — eso queda para una
fase posterior; ver nota en `CLAUDE.md` § Respaldos.

## 1. Un solo servidor para todo

Desde la versión actual, `apps/api` sirve **tanto la API como el build del frontend** en el
mismo puerto (`:3001` por defecto). Esto significa que un celular en la misma red solo
necesita una URL: `http://<ip-de-la-laptop>:3001`. No hace falta exponer dos puertos ni
configurar CORS.

## 2. Instalar y compilar (una sola vez, o cada vez que haya una actualización de código)

En la laptop de la tienda, con [Node.js 20+](https://nodejs.org) y
[pnpm](https://pnpm.io/installation) instalados:

```powershell
git clone <este repositorio> C:\CrystalPOS
cd C:\CrystalPOS
pnpm install
pnpm build
```

Esto genera `apps/web/dist` (el frontend ya compilado) y `apps/api/dist` (la API compilada).
El build no depende de internet para funcionar en producción — las fuentes van
auto-hospedadas dentro del build.

## 3. Probar manualmente antes de instalarlo como servicio

```powershell
cd C:\CrystalPOS\apps\api
node dist/index.js
```

Debe imprimir `Crystal API escuchando en http://localhost:3001`. Abre
`http://localhost:3001` en el navegador de la laptop: debe cargar la pantalla de login. Si
funciona, cierra esta ventana (Ctrl+C) y continúa al paso 4.

## 4. Encontrar la IP local de la laptop y fijarla

```powershell
ipconfig
```

Busca la "Dirección IPv4" del adaptador de red (wifi o Ethernet) que usa la tienda. La IP
real fijada en la laptop de la tienda es **`192.168.1.200`**.

Idealmente esa IP se fija por **reserva DHCP en el router** (por dirección MAC), pero el
router de la tienda (ZTE F679L, firmware de Megacable) no expone esa opción en su panel
web — solo estadísticas de LAN, sin configuración de DHCP/reserva. Por eso la IP se fijó
**manualmente en el adaptador de red de Windows** (IP estática `192.168.1.200`, máscara
`255.255.255.0`, gateway `192.168.1.1`, DNS `192.168.1.1` y `8.8.8.8` como alterno; sin DNS
sobre HTTPS, porque el router no lo soporta). Se eligió un rango alto (`.200`) porque los
dispositivos que reparte el DHCP del router usan números bajos (`.5`–`.20` aprox.), para
minimizar el riesgo de que el DHCP asigne esa misma IP a otro dispositivo.

Si esto llegara a cambiar (reinstalación de Windows, cambio de router, etc.), repite esa
configuración manual — no hay reserva automática de por medio.

El personal entra desde su celular abriendo `http://192.168.1.200:3001` en el navegador
(agregarlo como marcador/acceso directo en el celular ahorra tener que escribirlo cada
vez).

## 5. Instalar como Servicio de Windows (para que siga disponible solo)

Si solo corres `node dist/index.js` en una ventana de terminal, el sistema se cae en cuanto
alguien cierre esa ventana, se reinicie la laptop, o la sesión de Windows se cierre. Para
que los datos sigan **disponibles la mayor parte del tiempo** sin depender de que alguien
se acuerde de "prender el programa", instálalo como **Servicio de Windows** con
[NSSM](https://nssm.cc/) (gratis, sin instalación, un solo .exe):

1. Descarga NSSM y descomprime `nssm.exe` (usa la versión de 64 bits) en, por ejemplo,
   `C:\CrystalPOS\nssm.exe`.
2. Abre PowerShell **como administrador** y corre:
   ```powershell
   C:\CrystalPOS\nssm.exe install CrystalPOS
   ```
3. En la ventana que se abre:
   - **Path**: la ruta a `node.exe` (si no sabes dónde está, en PowerShell corre `(Get-Command node).Path`).
   - **Startup directory**: `C:\CrystalPOS\apps\api`.
   - **Arguments**: `dist/index.js`.
   - En la pestaña **Details**, puedes poner "Crystal POS" como nombre visible.
   - En la pestaña **Exit actions**, deja "Restart application" (ya viene así por defecto) —
     esto es lo que hace que, si el proceso llegara a truncarse por cualquier razón, Windows
     lo vuelva a levantar solo, sin que nadie tenga que intervenir.
   - Dale clic a **Install service**.
4. Inícialo:
   ```powershell
   nssm start CrystalPOS
   ```
5. Verifica desde la laptop: `http://localhost:3001`. Y desde un celular en la misma red:
   `http://192.168.1.200:3001`.

A partir de aquí, el servicio:
- **Arranca solo cuando prende la laptop** (antes incluso de iniciar sesión en Windows), así
  que no depende de que alguien abra una ventana cada mañana.
- **Se reinicia solo si llegara a truncarse**, sin intervención manual.
- **No muestra ninguna ventana** — corre en segundo plano. Para revisar que esté bien, usa
  el Administrador de tareas o `nssm status CrystalPOS` en PowerShell.

### Comandos útiles de NSSM

```powershell
nssm status CrystalPOS      # ver si está corriendo
nssm restart CrystalPOS     # reiniciar manualmente (p.ej. tras actualizar el código)
nssm stop CrystalPOS        # detener
nssm remove CrystalPOS confirm   # desinstalar el servicio (no borra los datos)
```

## 6. Actualizar el sistema más adelante

Manual, desde PowerShell:

```powershell
cd C:\CrystalPOS
git pull
pnpm install
pnpm build
nssm restart CrystalPOS
```

O con el botón "Buscar actualizaciones" de Reportes (solo Admin), que corre exactamente
esos pasos — el dueño del negocio nunca necesita abrir PowerShell para esto.
`apps/api/src/services/actualizacion.service.ts` dispara el `nssm restart` final en un
proceso Windows separado (detached, grupo de procesos propio) en vez de esperarlo desde
el propio proceso de la API: el `nssm stop` de ese restart mata al proceso que lo pidió,
así que si se esperara desde ahí mismo, el `start` podía no llegar a ocurrir y el
servicio quedaba detenido hasta un `nssm start` manual.

## 7. Dónde viven los datos

Todo vive en `C:\CrystalPOS\apps\api\data\`:
- `hilo.sqlite` — la base de datos real de la tienda. **No se debe editar ni mover a mano.**
- `backups\` — respaldos automáticos (cada 6h y al iniciar el servicio), se podan solos
  dejando los últimos 30. Ver `CLAUDE.md` § Respaldos para los detalles.

Para la impresora térmica (modelo confirmado: genérica POS-58, 58 mm, USB): instálala en
Windows con su driver normal (aparece como una impresora más del sistema). La app ya
manda a imprimir sola al confirmar una venta o un apartado — no necesita más
configuración que esa. Si el navegador pide elegir impresora en vez de imprimir directo,
puedes fijar la POS-58 como impresora predeterminada de Windows para saltarte ese paso.
