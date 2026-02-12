import { listPlazosFijo, listFechasPago } from './plazoFijoService';
import { listInversores } from './inversorService';
import { listCuentasFondo, listMovimientosFondo } from './flujoFondosService';
import { db } from '@/lib/firebase';

export interface DashboardKPIs {
  capitalTotalAdeudadoARS: number;
  capitalTotalAdeudadoUSD: number;
  interesesAPagarHoyARS: number;
  interesesAPagarHoyUSD: number;
  interesesAPagarMes: number;
  interesesAPagarMesUSD: number;
  interesesPendientesTotalARS: number;
  interesesPendientesTotalUSD: number;
  aportesMes: number;
  retirosMes: number;
  flujoNetoMes: number;
  pctCapitalizacion: number;
  pctPagar: number;
  plazosActivos: number;
  inversores: number;
  cuentasActivas: number;
  pctCrecimientoAportes: number; // aportes / capital
  pctBajaRetiros: number; // retiros / capital
}

const HOY = new Date().toISOString().slice(0, 10);

function inicioMesActual(): string {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

function finMesActual(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  return d.toISOString().slice(0, 10);
}

export async function getDashboardKPIs(): Promise<DashboardKPIs> {
  if (!db) {
    throw new Error(
      'Firebase no configurado. Revisá .env.local (NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_PROJECT_ID).'
    );
  }
  const inicioMes = inicioMesActual();
  const finMes = finMesActual();

  let plazos: Awaited<ReturnType<typeof listPlazosFijo>> = [];
  let inversores: Awaited<ReturnType<typeof listInversores>> = [];
  let cuentas: Awaited<ReturnType<typeof listCuentasFondo>> = [];
  let movimientosMes: Awaited<ReturnType<typeof listMovimientosFondo>> = [];

  try {
    [plazos, inversores, cuentas, movimientosMes] = await Promise.all([
      listPlazosFijo(),
      listInversores(),
      listCuentasFondo(),
      listMovimientosFondo({ desde: inicioMes, hasta: finMes }),
    ]);
  } catch (e) {
    console.error('[Dashboard] Error cargando datos:', e);
    throw e;
  }

  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.log('[Dashboard] Datos cargados:', {
      plazos: plazos.length,
      inversores: inversores.length,
      cuentas: cuentas.length,
      movimientosMes: movimientosMes.length,
    });
  }

  const plazosActivos = plazos.filter((p) => p.estado === 'activo');
  const plazosConCapital = plazos.filter(
    (p) => (p.estado === 'activo' || p.estado === 'vencido') && (p.capitalActual ?? p.capitalInicial ?? 0) > 0
  );

  // Capital adeudado = saldos actuales (balance): cuentas de inversores + capital en plazos
  // Evita doble conteo que ocurría con la fórmula por flujo
  let capitalTotalAdeudadoARS = 0;
  let capitalTotalAdeudadoUSD = 0;

  for (const c of cuentas) {
    if (c.activa === false || !c.inversorId) continue;
    const saldo = c.saldoActual ?? c.saldoInicial ?? 0;
    if (c.moneda === 'USD') capitalTotalAdeudadoUSD += saldo;
    else capitalTotalAdeudadoARS += saldo;
  }
  for (const pf of plazosConCapital) {
    const cap = pf.capitalActual ?? pf.capitalInicial ?? 0;
    if (pf.moneda === 'USD') capitalTotalAdeudadoUSD += cap;
    else capitalTotalAdeudadoARS += cap;
  }
  // Negativo: pasivo/deuda con inversores
  capitalTotalAdeudadoARS = -Math.abs(capitalTotalAdeudadoARS);
  capitalTotalAdeudadoUSD = -Math.abs(capitalTotalAdeudadoUSD);

  let interesesAPagarHoyARS = 0;
  let interesesAPagarHoyUSD = 0;
  let interesesAPagarMes = 0;
  let interesesAPagarMesUSD = 0;
  let interesesPendientesTotalARS = 0;
  let interesesPendientesTotalUSD = 0;
  let aportesMes = 0;
  let retirosMes = 0;
  let plazosCapitalizan = 0;
  let plazosPagan = 0;

  const plazosParaIntereses = plazos.filter(
    (p) => (p.estado === 'activo' || p.estado === 'vencido') && (p.capitalActual ?? p.capitalInicial ?? 0) > 0
  );

  for (const pf of plazosActivos) {
    if (pf.aplicacionIntereses === 'capitalizar') {
      plazosCapitalizan += 1;
    } else {
      plazosPagan += 1;
    }
  }

  for (const pf of plazosParaIntereses) {
    try {
      const fechas = await listFechasPago(pf.id!);

      for (const f of fechas) {
        const est = f.estado ?? 'pendiente';
        if (est !== 'pendiente' && est !== 'vencido') continue;
        const monto = f.interesEstimado ?? 0;
        if (pf.moneda === 'USD') interesesPendientesTotalUSD += monto;
        else interesesPendientesTotalARS += monto;
        if (f.fechaProgramada === HOY) {
          if (pf.moneda === 'USD') interesesAPagarHoyUSD += monto;
          else interesesAPagarHoyARS += monto;
        }
        if (f.fechaProgramada >= inicioMes && f.fechaProgramada <= finMes) {
          if (pf.moneda === 'USD') {
            interesesAPagarMesUSD += monto;
          } else {
            interesesAPagarMes += monto;
          }
        }
      }
    } catch {
      // Ignorar errores al cargar fechas/movimientos de un plazo
    }
  }

  // Aportes y retiros desde Flujo de fondos (movimientos reales del mes)
  for (const m of movimientosMes) {
    const monto = m.monto ?? 0;
    const moneda = m.moneda ?? 'ARS';
    if (moneda !== 'ARS') continue;
    if (m.categoria === 'Aporte inversor' && m.cuentaDestinoId) {
      aportesMes += monto;
    } else if ((m.categoria === 'Retiro inversor' || m.categoria === 'Pago de capital a inversores') && m.cuentaOrigenId) {
      retirosMes += monto;
    }
  }

  const capitalAbs = Math.abs(capitalTotalAdeudadoARS);
  const pctCapitalizacion =
    plazosActivos.length > 0 ? (plazosCapitalizan / plazosActivos.length) * 100 : 0;
  const pctPagar = plazosActivos.length > 0 ? (plazosPagan / plazosActivos.length) * 100 : 0;
  const flujoNetoMes = aportesMes - retirosMes;
  const pctCrecimientoAportes = capitalAbs > 0 ? (aportesMes / capitalAbs) * 100 : 0;
  const pctBajaRetiros = capitalAbs > 0 ? (retirosMes / capitalAbs) * 100 : 0;

  return {
    capitalTotalAdeudadoARS,
    capitalTotalAdeudadoUSD,
    interesesAPagarHoyARS,
    interesesAPagarHoyUSD,
    interesesAPagarMes,
    interesesAPagarMesUSD,
    interesesPendientesTotalARS,
    interesesPendientesTotalUSD,
    aportesMes,
    retirosMes,
    flujoNetoMes,
    pctCapitalizacion,
    pctPagar,
    plazosActivos: plazosActivos.length,
    inversores: inversores.length,
    cuentasActivas: cuentas.filter((c) => c.activa !== false).length,
    pctCrecimientoAportes,
    pctBajaRetiros,
  };
}
