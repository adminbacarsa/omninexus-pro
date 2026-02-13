import { listMovimientosFondo } from './flujoFondosService';
import { listCuentasFondo } from './flujoFondosService';
import type { MovimientoFondo } from '@/types/flujoFondos';
import {
  CATEGORIAS_INGRESO,
  CATEGORIA_A_EGRESO,
} from '@/types/flujoFondos';
import type {
  FiltrosFlujoProyeccion,
  FilaMensualFlujo,
  KPIsFlujoProyeccion,
  EscenarioFlujo,
  AlertaFlujo,
} from '@/types/flujoProyeccion';

const MESES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

const MULTIPLICADORES: Record<EscenarioFlujo, number> = {
  BASE: 1,
  OPTIMISTA: 1.1,
  ESTRES: 0.9,
};

function agregarPorMes(movs: MovimientoFondo[]) {
  const porMes: Record<string, {
    cobrado: number;
    facturado: number;
    egresosRRHH: number;
    egresosOperativo: number;
    egresosImpuestos: number;
    egresosFinanciero: number;
  }> = {};

  for (const m of movs) {
    const key = `${m.fecha.slice(0, 7)}`;
    if (!porMes[key]) {
      porMes[key] = {
        cobrado: 0,
        facturado: 0,
        egresosRRHH: 0,
        egresosOperativo: 0,
        egresosImpuestos: 0,
        egresosFinanciero: 0,
      };
    }

    const cat = m.categoria ?? '';
    const val = m.monto ?? 0;

    if (CATEGORIAS_INGRESO.includes(cat)) {
      porMes[key].cobrado += val;
      porMes[key].facturado += val; // MVP: facturado = cobrado
    } else {
      const tipo = CATEGORIA_A_EGRESO[cat];
      if (tipo === 'RRHH') porMes[key].egresosRRHH += val;
      else if (tipo === 'Operativo') porMes[key].egresosOperativo += val;
      else if (tipo === 'Impuestos') porMes[key].egresosImpuestos += val;
      else if (tipo === 'Financiero') porMes[key].egresosFinanciero += val;
      else porMes[key].egresosOperativo += val; // Otros sin mapeo
    }
  }

  return porMes;
}

export async function getFlujoProyeccion(
  filtros: FiltrosFlujoProyeccion
): Promise<{ filas: FilaMensualFlujo[]; kpis: KPIsFlujoProyeccion; alertas: AlertaFlujo[] }> {
  const movs = await listMovimientosFondo({
    inversorId: filtros.clienteId ?? undefined,
    desde: filtros.desde,
    hasta: filtros.hasta,
  });

  const cuentas = await listCuentasFondo();
  const saldoInicialGlobal =
    cuentas.reduce((s, c) => s + (c.saldoInicial ?? c.saldoActual ?? 0), 0) || 0;

  const porMes = agregarPorMes(movs);
  const keys = Object.keys(porMes).sort();

  if (keys.length === 0) {
    const hoy = new Date();
    const key = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
    keys.push(key);
    porMes[key] = {
      cobrado: 0,
      facturado: 0,
      egresosRRHH: 0,
      egresosOperativo: 0,
      egresosImpuestos: 0,
      egresosFinanciero: 0,
    };
  }

  const mult = MULTIPLICADORES[filtros.escenario];
  const filas: FilaMensualFlujo[] = [];
  let saldoAnterior = saldoInicialGlobal;
  let acumulado = saldoInicialGlobal;

  for (const key of keys) {
    const [añoStr, mesStr] = key.split('-');
    const año = Number(añoStr);
    const mes = Number(mesStr);
    const mesLabel = `${MESES[mes - 1]} ${año}`;
    const d = porMes[key];

    const cobrado = Math.round(d.cobrado * mult * 100) / 100;
    const facturado = Math.round(d.facturado * mult * 100) / 100;
    const egresosRRHH = Math.round(d.egresosRRHH * mult * 100) / 100;
    const egresosOperativo = Math.round(d.egresosOperativo * mult * 100) / 100;
    const egresosImpuestos = Math.round(d.egresosImpuestos * mult * 100) / 100;
    const egresosFinanciero = Math.round(d.egresosFinanciero * mult * 100) / 100;
    const egresosTotal = egresosRRHH + egresosOperativo + egresosImpuestos + egresosFinanciero;
    const neto = cobrado - egresosTotal;

    const saldoInicial = saldoAnterior;
    const saldoFinal = saldoInicial + neto;
    acumulado = saldoFinal;
    saldoAnterior = saldoFinal;

    filas.push({
      año,
      mes,
      mesLabel,
      saldoInicial,
      facturado,
      cobrado,
      egresosRRHH,
      egresosOperativo,
      egresosImpuestos,
      egresosFinanciero,
      egresosTotal,
      neto,
      saldoFinal,
      acumulado,
    });
  }

  const totales: KPIsFlujoProyeccion = {
    saldoInicial: filas[0]?.saldoInicial ?? 0,
    facturado: filas.reduce((s, f) => s + f.facturado, 0),
    cobrado: filas.reduce((s, f) => s + f.cobrado, 0),
    egresosRRHH: filas.reduce((s, f) => s + f.egresosRRHH, 0),
    egresosOperativo: filas.reduce((s, f) => s + f.egresosOperativo, 0),
    egresosImpuestos: filas.reduce((s, f) => s + f.egresosImpuestos, 0),
    egresosFinanciero: filas.reduce((s, f) => s + f.egresosFinanciero, 0),
    egresosTotal: filas.reduce((s, f) => s + f.egresosTotal, 0),
    neto: filas.reduce((s, f) => s + f.neto, 0),
    saldoFinal: filas[filas.length - 1]?.saldoFinal ?? 0,
  };

  const alertas = calcularAlertas(filas);

  return { filas, kpis: totales, alertas };
}

function calcularAlertas(filas: FilaMensualFlujo[]): AlertaFlujo[] {
  const alertas: AlertaFlujo[] = [];

  for (const f of filas) {
    if (f.saldoFinal < 0) {
      alertas.push({
        tipo: 'caja_negativa',
        mensaje: `Caja negativa en ${f.mesLabel}`,
        severidad: 'alta',
        detalle: `Saldo: ${f.saldoFinal.toLocaleString('es-AR')}`,
      });
    }
  }

  return alertas;
}
