import { listPlazosFijo, listFechasPago, listMovimientosPlazoFijo } from './plazoFijoService';
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
  let movimientosTodos: Awaited<ReturnType<typeof listMovimientosFondo>> = [];

  try {
    [plazos, inversores, cuentas, movimientosMes, movimientosTodos] = await Promise.all([
      listPlazosFijo(),
      listInversores(),
      listCuentasFondo(),
      listMovimientosFondo({ desde: inicioMes, hasta: finMes }),
      listMovimientosFondo(), // Sin filtro de fecha: flujo completo para capital adeudado
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

  // Capital adeudado = Lo prestado + Intereses capitalizados - Devoluciones de capital (fórmula por flujo)
  let prestadoARS = 0;
  let prestadoUSD = 0;
  let interesesCapitalizadosARS = 0;
  let interesesCapitalizadosUSD = 0;
  let devolucionesARS = 0;
  let devolucionesUSD = 0;

  // 1. Lo prestado: Aporte inversor (movimientos_fondo) + capital directo a PFs (capitalInicial + aportes que no vinieron de cuenta)
  for (const m of movimientosTodos) {
    const monto = m.monto ?? 0;
    const moneda = m.moneda ?? 'ARS';
    const isUSD = moneda === 'USD';
    if (m.categoria === 'Aporte inversor' && m.cuentaDestinoId) {
      if (isUSD) prestadoUSD += monto;
      else prestadoARS += monto;
    } else if (m.categoria === 'Retiro inversor' || m.categoria === 'Pago de capital a inversores') {
      if (isUSD) devolucionesUSD += monto;
      else devolucionesARS += monto;
    }
  }

  // 2. Movimientos en plazos fijo: aporte (+), capitalizacion_interes (+), retiro_capital (-)
  let sumaCapitalInicialARS = 0;
  let sumaCapitalInicialUSD = 0;
  let sumaInversionPlazoFijoARS = 0;
  let sumaInversionPlazoFijoUSD = 0;
  for (const m of movimientosTodos) {
    const monto = m.monto ?? 0;
    const moneda = m.moneda ?? 'ARS';
    const isUSD = moneda === 'USD';
    if (m.categoria === 'Inversión plazo fijo' && m.cuentaOrigenId) {
      if (isUSD) sumaInversionPlazoFijoUSD += monto;
      else sumaInversionPlazoFijoARS += monto;
    }
  }
  for (const pf of plazos) {
    const moneda = pf.moneda ?? 'ARS';
    const isUSD = moneda === 'USD';
    const capInicial = pf.capitalInicial ?? 0;
    if (isUSD) sumaCapitalInicialUSD += capInicial;
    else sumaCapitalInicialARS += capInicial;

    try {
      const movs = await listMovimientosPlazoFijo(pf.id!);
      for (const mov of movs) {
        const mont = mov.monto ?? 0;
        if (mov.tipo === 'aporte') {
          aportePF += mont;
        } else if (mov.tipo === 'capitalizacion_interes') {
          capPF += mont;
          if (isUSD) interesesCapitalizadosUSD += mont;
          else interesesCapitalizadosARS += mont;
        } else if (mov.tipo === 'retiro_capital') {
          retiroPF += mont;
          if (isUSD) devolucionesUSD += mont;
          else devolucionesARS += mont;
        }
      }
    } catch {}
    prestadoARS += isUSD ? 0 : aportePF;
    prestadoUSD += isUSD ? aportePF : 0;
  }
  // Capital inicial de PFs que no vino de cuenta (manual)
  prestadoARS += Math.max(0, sumaCapitalInicialARS - sumaInversionPlazoFijoARS);
  prestadoUSD += Math.max(0, sumaCapitalInicialUSD - sumaInversionPlazoFijoUSD);

  let capitalTotalAdeudadoARS = prestadoARS + interesesCapitalizadosARS - devolucionesARS;
  let capitalTotalAdeudadoUSD = prestadoUSD + interesesCapitalizadosUSD - devolucionesUSD;

  let interesesAPagarHoyARS = 0;
  let interesesAPagarHoyUSD = 0;
  let interesesAPagarMes = 0;
  let interesesAPagarMesUSD = 0;
  let aportesMes = 0;
  let retirosMes = 0;
  let plazosCapitalizan = 0;
  let plazosPagan = 0;

  for (const pf of plazosActivos) {
    if (pf.aplicacionIntereses === 'capitalizar') {
      plazosCapitalizan += 1;
    } else {
      plazosPagan += 1;
    }

    try {
      const [fechas, movs] = await Promise.all([
        listFechasPago(pf.id!),
        listMovimientosPlazoFijo(pf.id!),
      ]);

      for (const f of fechas) {
        if (f.estado !== 'pendiente' && f.estado !== 'vencido') continue;
        const monto = f.interesEstimado ?? 0;
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

  const capitalTotal = capitalTotalAdeudadoARS;
  const pctCapitalizacion =
    plazosActivos.length > 0 ? (plazosCapitalizan / plazosActivos.length) * 100 : 0;
  const pctPagar = plazosActivos.length > 0 ? (plazosPagan / plazosActivos.length) * 100 : 0;
  const flujoNetoMes = aportesMes - retirosMes;
  const pctCrecimientoAportes =
    capitalTotal > 0 ? (aportesMes / capitalTotal) * 100 : 0;
  const pctBajaRetiros = capitalTotal > 0 ? (retirosMes / capitalTotal) * 100 : 0;

  return {
    capitalTotalAdeudadoARS,
    capitalTotalAdeudadoUSD,
    interesesAPagarHoyARS,
    interesesAPagarHoyUSD,
    interesesAPagarMes,
    interesesAPagarMesUSD,
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
