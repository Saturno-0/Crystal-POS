import type Database from 'better-sqlite3';
import { iniciales } from '@crystal/shared';

export type Periodo = 'mes' | 'trimestre' | 'anio';

const PERIODOS: Periodo[] = ['mes', 'trimestre', 'anio'];
const DIAS_PERIODO: Record<Periodo, number> = { mes: 30, trimestre: 90, anio: 365 };
const PUNTOS_TENDENCIA: Record<Periodo, number> = { mes: 7, trimestre: 3, anio: 8 };

// Solo estas dos cuentan para KPIs/comisiones (ver docs/MODELO_DATOS.md):
// una venta 'cancelada' o 'apartado_penalizado' nunca suma a reportes.
const ESTADOS_CONTABLES = "('completada','apartado_liquidado')";

const LETRAS_DIA = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const FORMATO_MES = new Intl.DateTimeFormat('es-MX', { month: 'short' });

export function periodoValido(input: unknown): Periodo {
  return typeof input === 'string' && PERIODOS.includes(input as Periodo) ? (input as Periodo) : 'mes';
}

function formatoSqlite(fecha: Date): string {
  return fecha.toISOString().slice(0, 19).replace('T', ' ');
}

function rango(periodo: Periodo, ahora = new Date()): { inicio: string; fin: string } {
  const dias = DIAS_PERIODO[periodo];
  const inicio = new Date(ahora.getTime() - dias * 24 * 60 * 60 * 1000);
  return { inicio: formatoSqlite(inicio), fin: formatoSqlite(ahora) };
}

function sumarVentas(db: Database.Database, inicio: string, fin: string) {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS tickets, COALESCE(SUM(total), 0) AS total
       FROM ventas
       WHERE estado IN ${ESTADOS_CONTABLES} AND created_at BETWEEN ? AND ?`,
    )
    .get(inicio, fin) as { tickets: number; total: number };
  return row;
}

/** HU-5.1/5.2: KPIs del periodo, con comparación contra el periodo anterior de igual duración. */
export function calcularKpis(db: Database.Database, periodo: Periodo, ahora = new Date()) {
  const actual = rango(periodo, ahora);
  const dias = DIAS_PERIODO[periodo];
  const anterior = rango(periodo, new Date(ahora.getTime() - dias * 24 * 60 * 60 * 1000));

  const ventasActual = sumarVentas(db, actual.inicio, actual.fin);
  const ventasAnterior = sumarVentas(db, anterior.inicio, anterior.fin);

  const ventasTotalesVsAnteriorPct =
    ventasAnterior.total > 0 ? ((ventasActual.total - ventasAnterior.total) / ventasAnterior.total) * 100 : null;

  const { comisiones } = db
    .prepare(
      `SELECT COALESCE(SUM(comision_monto), 0) AS comisiones
       FROM ventas
       WHERE estado IN ${ESTADOS_CONTABLES} AND created_at BETWEEN ? AND ?`,
    )
    .get(actual.inicio, actual.fin) as { comisiones: number };

  // Snapshot actual (no depende del periodo elegido): cuántos apartados están
  // vencidos ahora mismo, sin importar cuándo se crearon.
  const { vencidos } = db
    .prepare(`SELECT COUNT(*) AS vencidos FROM apartados WHERE estado = 'activo' AND vence_at < datetime('now')`)
    .get() as { vencidos: number };

  const { montoPenalizado } = db
    .prepare(
      `SELECT COALESCE(SUM(pagado), 0) AS montoPenalizado
       FROM apartados
       WHERE estado = 'penalizado' AND penalizado_at BETWEEN ? AND ?`,
    )
    .get(actual.inicio, actual.fin) as { montoPenalizado: number };

  return {
    rangoInicio: actual.inicio,
    rangoFin: actual.fin,
    ventasTotales: ventasActual.total,
    ventasTotalesVsAnteriorPct,
    tickets: ventasActual.tickets,
    ticketPromedio: ventasActual.tickets > 0 ? ventasActual.total / ventasActual.tickets : 0,
    comisionesPorPagar: comisiones,
    apartadosVencidos: vencidos,
    apartadosMontoPenalizado: montoPenalizado,
  };
}

/** HU-5.4: tendencia de ventas — barras diarias (Mes) o mensuales (Trimestre/Año). */
export function calcularTendencia(db: Database.Database, periodo: Periodo, ahora = new Date()) {
  if (periodo === 'mes') return tendenciaDiaria(db, PUNTOS_TENDENCIA.mes, ahora);
  return tendenciaMensual(db, PUNTOS_TENDENCIA[periodo], ahora);
}

function tendenciaDiaria(db: Database.Database, dias: number, ahora: Date) {
  const puntos: { etiqueta: string; monto: number }[] = [];
  for (let i = dias - 1; i >= 0; i--) {
    const dia = new Date(
      Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate() - i),
    );
    const inicio = formatoSqlite(dia);
    const fin = formatoSqlite(new Date(dia.getTime() + 24 * 60 * 60 * 1000 - 1000));
    const { total } = sumarVentas(db, inicio, fin);
    puntos.push({ etiqueta: LETRAS_DIA[dia.getUTCDay()], monto: total });
  }
  return puntos;
}

function tendenciaMensual(db: Database.Database, meses: number, ahora: Date) {
  const puntos: { etiqueta: string; monto: number }[] = [];
  for (let i = meses - 1; i >= 0; i--) {
    const inicioMes = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() - i, 1));
    const finMes = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() - i + 1, 1) - 1000);
    const { total } = sumarVentas(db, formatoSqlite(inicioMes), formatoSqlite(finMes));
    puntos.push({ etiqueta: FORMATO_MES.format(inicioMes), monto: total });
  }
  return puntos;
}

interface UsuarioRow {
  id: number;
  nombre: string;
  rol: 'admin' | 'vendedor';
  tasa_comision: number;
}

/** HU-5.3: ingreso y comisión por vendedor en el periodo (Admin incluido, regla 8). */
export function calcularPorVendedor(db: Database.Database, periodo: Periodo, ahora = new Date()) {
  const { inicio, fin } = rango(periodo, ahora);
  const usuarios = db
    .prepare('SELECT id, nombre, rol, tasa_comision FROM usuarios WHERE activo = 1 ORDER BY nombre')
    .all() as UsuarioRow[];

  const porUsuario = db.prepare(
    `SELECT COUNT(*) AS tickets, COALESCE(SUM(total), 0) AS ingreso, COALESCE(SUM(comision_monto), 0) AS comision
     FROM ventas
     WHERE usuario_id = ? AND estado IN ${ESTADOS_CONTABLES} AND created_at BETWEEN ? AND ?`,
  );

  return usuarios.map((u) => {
    const row = porUsuario.get(u.id, inicio, fin) as { tickets: number; ingreso: number; comision: number };
    return {
      id: u.id,
      nombre: u.nombre,
      ini: iniciales(u.nombre),
      rol: u.rol,
      tickets: row.tickets,
      ingreso: row.ingreso,
      tasaComision: u.tasa_comision,
      comisionMonto: row.comision,
    };
  });
}

export function generarReporte(db: Database.Database, periodoInput: unknown, ahora = new Date()) {
  const periodo = periodoValido(periodoInput);
  return {
    periodo,
    kpis: calcularKpis(db, periodo, ahora),
    tendencia: calcularTendencia(db, periodo, ahora),
    vendedores: calcularPorVendedor(db, periodo, ahora),
  };
}

function csvEscape(valor: string | number): string {
  const texto = String(valor);
  return /[",\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/** HU-5.5: exportación a CSV de ingresos/comisiones por vendedor del periodo. */
export function exportarVendedoresCsv(db: Database.Database, periodoInput: unknown, ahora = new Date()): string {
  const periodo = periodoValido(periodoInput);
  const vendedores = calcularPorVendedor(db, periodo, ahora);
  const encabezado = ['vendedor', 'rol', 'tickets', 'ingreso', 'tasa_comision', 'comision'];
  const filas = vendedores.map((v) =>
    [v.nombre, v.rol, v.tickets, v.ingreso.toFixed(2), v.tasaComision, v.comisionMonto.toFixed(2)]
      .map(csvEscape)
      .join(','),
  );
  return [encabezado.join(','), ...filas].join('\n');
}
