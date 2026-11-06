import { defineConfig, devices } from '@playwright/test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// BD descartable solo para estas pruebas: nunca toca apps/api/data/hilo.sqlite
// (los datos reales de la tienda). Se recrea desde cero y se siembra con los
// usuarios demo (NIP 1234) la primera vez que corre el servidor de prueba.
const DB_PRUEBA = join(__dirname, '../api/data/.playwright-test.sqlite');
const BACKUPS_PRUEBA = join(__dirname, '../api/data/.playwright-test-backups');

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: false, // los flujos escriben en la misma BD compartida
  workers: 1,
  reporter: 'line',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm --filter @crystal/api dev',
      cwd: join(__dirname, '../..'),
      url: 'http://localhost:3001/api/health',
      reuseExistingServer: false,
      timeout: 30_000,
      env: { HILO_DB_PATH: DB_PRUEBA, HILO_BACKUPS_DIR: BACKUPS_PRUEBA, PORT: '3001' },
    },
    {
      command: 'pnpm --filter @crystal/web dev',
      cwd: join(__dirname, '../..'),
      url: 'http://localhost:5173',
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
});
