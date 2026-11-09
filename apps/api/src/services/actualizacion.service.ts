import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Actualización desde la UI: git pull + pnpm install + pnpm build, y si todo
// sale bien, reinicia el Servicio de Windows (nssm) para cargar el build
// nuevo. Si cualquier paso falla no se reinicia nada y queda corriendo la
// versión anterior — ver docs/DESPLIEGUE.md.
const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ_REPO = join(AQUI, '../../../..');
const NOMBRE_SERVICIO = process.env.HILO_SERVICIO_NOMBRE ?? 'CrystalPOS';

export type EstadoActualizacion = 'inactivo' | 'en_progreso' | 'completado' | 'error';

export interface InfoActualizacion {
  estado: EstadoActualizacion;
  pasoActual: string | null;
  log: string[];
  iniciadoEn: string | null;
  terminadoEn: string | null;
}

const ESTADO_INACTIVO: InfoActualizacion = {
  estado: 'inactivo',
  pasoActual: null,
  log: [],
  iniciadoEn: null,
  terminadoEn: null,
};

function archivoEstado(dbPath: string): string {
  return join(dirname(dbPath), 'actualizacion-estado.json');
}

export function obtenerEstado(dbPath: string): InfoActualizacion {
  const archivo = archivoEstado(dbPath);
  if (!existsSync(archivo)) return ESTADO_INACTIVO;
  try {
    return JSON.parse(readFileSync(archivo, 'utf-8')) as InfoActualizacion;
  } catch {
    return ESTADO_INACTIVO;
  }
}

function guardarEstado(dbPath: string, info: InfoActualizacion): void {
  const archivo = archivoEstado(dbPath);
  mkdirSync(dirname(archivo), { recursive: true });
  writeFileSync(archivo, JSON.stringify(info, null, 2));
}

/**
 * Se llama una vez al arrancar la API. Si el proceso murió a medio camino de
 * una actualización anterior (corte de luz, crash) antes de llegar a marcar
 * "completado", el estado quedaría atorado en "en_progreso" para siempre,
 * bloqueando cualquier reintento (la ruta POST rechaza mientras ese sea el
 * estado). Lo marca como error para que un Admin pueda volver a intentarlo.
 */
export function repararEstadoAlArrancar(dbPath: string): void {
  const info = obtenerEstado(dbPath);
  if (info.estado !== 'en_progreso') return;
  info.estado = 'error';
  info.pasoActual = null;
  info.terminadoEn = new Date().toISOString();
  info.log.push('La actualización se interrumpió inesperadamente (el proceso se reinició a medias). Reintenta.');
  guardarEstado(dbPath, info);
}

function ejecutarComando(comando: string, args: string[]): Promise<{ ok: boolean; salida: string }> {
  return new Promise((resolve) => {
    const proceso = spawn(comando, args, { cwd: RAIZ_REPO, shell: true });
    let salida = '';
    proceso.stdout.on('data', (d) => (salida += d.toString()));
    proceso.stderr.on('data', (d) => (salida += d.toString()));
    proceso.on('error', (err) => resolve({ ok: false, salida: String(err) }));
    proceso.on('close', (code) => resolve({ ok: code === 0, salida }));
  });
}

/**
 * Dispara el "nssm restart" en un proceso completamente aparte de este
 * (grupo de procesos nuevo, sin stdio heredado, sin esperar su salida).
 *
 * Si este propio proceso Node llamara a `nssm restart` directamente y
 * esperara su resultado, `nssm stop` (la primera mitad del restart) lo mata
 * a él mismo a mitad de esa misma llamada — Windows puede arrastrar en esa
 * muerte al proceso "nssm restart" que disparó, si quedó en el mismo grupo
 * de consola, dejando el "start" sin ocurrir nunca y el servicio detenido
 * hasta que alguien entre a PowerShell a mano. `detached: true` + `unref()`
 * evita eso: el "ping" de espera y el "nssm restart" corren en un proceso
 * independiente que sigue vivo aunque este proceso muera un instante
 * después. `ping` (no `timeout`) para la espera porque `timeout` falla sin
 * una consola real, que es justo lo que `stdio: 'ignore'` le quita aquí.
 */
function dispararReinicioServicio(): void {
  const comando = `ping -n 3 127.0.0.1 >nul & nssm restart ${NOMBRE_SERVICIO}`;
  const hijo = spawn('cmd.exe', ['/c', comando], {
    cwd: RAIZ_REPO,
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  hijo.unref();
}

/**
 * Corre en segundo plano (no se espera su promesa desde la ruta): marca
 * "en_progreso" de inmediato para que el frontend pueda sondear el estado.
 * Si el build sale bien, el reinicio del servicio mata este proceso — por
 * eso el último paso se escribe en el archivo de estado ANTES de reiniciar.
 */
export async function ejecutarActualizacion(dbPath: string): Promise<void> {
  const info: InfoActualizacion = {
    estado: 'en_progreso',
    pasoActual: 'Descargando última versión (git pull)…',
    log: [],
    iniciadoEn: new Date().toISOString(),
    terminadoEn: null,
  };
  guardarEstado(dbPath, info);

  const pasos: [string, string, string[]][] = [
    ['Descargando última versión (git pull)…', 'git', ['pull']],
    ['Instalando dependencias (pnpm install)…', 'pnpm', ['install']],
    ['Compilando (pnpm build)…', 'pnpm', ['build']],
  ];

  for (const [etiqueta, comando, args] of pasos) {
    info.pasoActual = etiqueta;
    info.log.push(etiqueta);
    guardarEstado(dbPath, info);

    const { ok, salida } = await ejecutarComando(comando, args);
    info.log.push(salida.trim());
    if (!ok) {
      info.estado = 'error';
      info.pasoActual = null;
      info.terminadoEn = new Date().toISOString();
      info.log.push(`Falló: ${etiqueta} — no se tocó el sistema en ejecución.`);
      guardarEstado(dbPath, info);
      return;
    }
  }

  info.pasoActual = 'Reiniciando servicio…';
  info.log.push('Build completo. Reiniciando el servicio para cargar la nueva versión…');
  // Se guarda como "completado" antes de reiniciar: si el reinicio del
  // servicio mata este proceso aquí mismo, al volver a arrancar la API ya
  // queda reflejado que la actualización terminó bien.
  info.estado = 'completado';
  info.pasoActual = null;
  info.terminadoEn = new Date().toISOString();
  guardarEstado(dbPath, info);

  // Chequeo rápido y seguro (no detiene nada): confirma que sí corre como
  // Servicio de Windows con nssm antes de disparar el reinicio real.
  const correComoServicio = await ejecutarComando('nssm', ['status', NOMBRE_SERVICIO]);
  if (!correComoServicio.ok) {
    info.log.push(
      'No se pudo reiniciar el servicio automáticamente (¿no corre como Servicio de Windows con nssm?). ' +
        'La nueva versión ya está compilada: reinicia el servicio manualmente.',
    );
    guardarEstado(dbPath, info);
    return;
  }

  dispararReinicioServicio();
}
