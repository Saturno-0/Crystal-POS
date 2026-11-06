import { existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Borra la BD descartable de pruebas antes de levantar el servidor, para que
// cada corrida de la suite arranque desde el seed limpio (usuarios demo,
// catálogo vacío) y las aserciones no dependan de lo que dejó una corrida anterior.
export default function globalSetup() {
  const base = join(__dirname, '../../../api/data/.playwright-test.sqlite');
  for (const sufijo of ['', '-wal', '-shm']) {
    const ruta = base + sufijo;
    if (existsSync(ruta)) rmSync(ruta);
  }
  const backups = join(__dirname, '../../../api/data/.playwright-test-backups');
  if (existsSync(backups)) rmSync(backups, { recursive: true });
}
