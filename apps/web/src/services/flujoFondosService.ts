import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logAudit } from './auditService';
import type { CuentaFondo, MovimientoFondo } from '@/types/flujoFondos';
import { CATEGORIAS_INGRESO } from '@/types/flujoFondos';
import type { MovimientoCaja } from '@/types/cajaChica';

const COL_CUENTAS = 'cuentas_fondo';
const COL_MOV = 'movimientos_fondo';

function sanitize<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Record<string, unknown>;
}

// --- Cuentas ---

export async function listCuentasFondo(): Promise<CuentaFondo[]> {
  if (!db) return [];
  try {
    const q = query(collection(db, COL_CUENTAS), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as CuentaFondo));
  } catch {
    // Fallback: docs sin createdAt o índice faltante
    const snap = await getDocs(collection(db, COL_CUENTAS));
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as CuentaFondo))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }
}

export async function listCuentasActivas(): Promise<CuentaFondo[]> {
  const all = await listCuentasFondo();
  return all.filter((c) => c.activa !== false);
}

export async function listCuentasPorInversor(inversorId: string): Promise<CuentaFondo[]> {
  const all = await listCuentasFondo();
  return all.filter((c) => c.inversorId === inversorId);
}

export async function getCuentaFondo(id: string): Promise<CuentaFondo | null> {
  const ref = doc(db, COL_CUENTAS, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as CuentaFondo;
}

export async function createCuentaFondo(data: Omit<CuentaFondo, 'id'>, userId?: string): Promise<string> {
  const ref = collection(db, COL_CUENTAS);
  const now = new Date().toISOString();
  const saldo = data.saldoActual ?? data.saldoInicial ?? 0;
  const payload = sanitize({
    ...data,
    saldoActual: saldo,
    activa: data.activa !== false,
    createdAt: now,
    updatedAt: now,
  });
  const docRef = await addDoc(ref, payload);
  const id = docRef.id;
  await logAudit({
    accion: 'CREAR',
    modulo: 'flujo_fondos',
    detalle: `Alta de cuenta de fondo: ${data.nombre} (${data.moneda} ${saldo.toLocaleString('es-AR')})`,
    entidadId: id,
    entidadTipo: 'cuenta_fondo',
    userId,
    metadata: { nombre: data.nombre, moneda: data.moneda, tipo: data.tipo },
  }).catch(() => {});
  return id;
}

export async function updateCuentaFondo(id: string, data: Partial<CuentaFondo>, userId?: string): Promise<void> {
  const ref = doc(db, COL_CUENTAS, id);
  await updateDoc(ref, sanitize({ ...data, updatedAt: new Date().toISOString() }));
  await logAudit({
    accion: 'ACTUALIZAR',
    modulo: 'flujo_fondos',
    detalle: `Actualización de cuenta de fondo ${id}`,
    entidadId: id,
    entidadTipo: 'cuenta_fondo',
    userId,
    metadata: { campos: Object.keys(data) },
  }).catch(() => {});
}

export async function updateSaldoCuenta(id: string, nuevoSaldo: number, userId?: string): Promise<void> {
  await updateCuentaFondo(id, { saldoActual: nuevoSaldo }, userId);
}

export async function deleteCuentaFondo(id: string, userId?: string): Promise<void> {
  const ref = doc(db, COL_CUENTAS, id);
  const snap = await getDoc(ref);
  const nombre = snap.exists() ? (snap.data() as CuentaFondo).nombre : 'N/A';
  await deleteDoc(ref);
  await logAudit({
    accion: 'ELIMINAR',
    modulo: 'flujo_fondos',
    detalle: `Eliminación de cuenta de fondo: ${nombre} (ID: ${id})`,
    entidadId: id,
    entidadTipo: 'cuenta_fondo',
    userId,
  }).catch(() => {});
}

// --- Movimientos ---

export async function listMovimientosFondo(filtros?: {
  cuentaOrigenId?: string;
  cuentaDestinoId?: string;
  inversorId?: string;
  desde?: string;
  hasta?: string;
}): Promise<MovimientoFondo[]> {
  if (!db) return [];
  let q;
  try {
    q = query(collection(db, COL_MOV), orderBy('fecha', 'desc'));

  if (filtros?.cuentaOrigenId) {
    q = query(
      collection(db, COL_MOV),
      where('cuentaOrigenId', '==', filtros.cuentaOrigenId),
      orderBy('fecha', 'desc')
    );
  } else if (filtros?.cuentaDestinoId) {
    q = query(
      collection(db, COL_MOV),
      where('cuentaDestinoId', '==', filtros.cuentaDestinoId),
      orderBy('fecha', 'desc')
    );
  } else if (filtros?.inversorId) {
    q = query(
      collection(db, COL_MOV),
      where('inversorId', '==', filtros.inversorId),
      orderBy('fecha', 'desc')
    );
  }
    const snap = await getDocs(q);
    let items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as MovimientoFondo));
    if (filtros?.desde) items = items.filter((m) => m.fecha >= filtros.desde!);
    if (filtros?.hasta) items = items.filter((m) => m.fecha <= filtros.hasta!);
    return items;
  } catch {
    // Fallback sin orderBy
    const snap = await getDocs(collection(db, COL_MOV));
    let items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as MovimientoFondo));
    items = items.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
    if (filtros?.desde) items = items.filter((m) => m.fecha >= filtros.desde!);
    if (filtros?.hasta) items = items.filter((m) => m.fecha <= filtros.hasta!);
    return items;
  }
}

export async function createMovimientoFondo(
  data: Omit<MovimientoFondo, 'id'>,
  userId?: string
): Promise<string> {
  const ref = collection(db, COL_MOV);
  const now = new Date().toISOString();
  const payload = sanitize({
    ...data,
    createdAt: now,
    createdBy: userId ?? null,
  });
  const docRef = await addDoc(ref, payload);

  // Actualizar saldos: origen resta, destino suma
  const monto = data.monto;
  if (data.cuentaOrigenId) {
    const c = await getCuentaFondo(data.cuentaOrigenId);
    if (c) await updateSaldoCuenta(data.cuentaOrigenId, (c.saldoActual ?? 0) - monto, userId);
  }
  if (data.cuentaDestinoId) {
    const c = await getCuentaFondo(data.cuentaDestinoId);
    if (c) await updateSaldoCuenta(data.cuentaDestinoId, (c.saldoActual ?? 0) + monto, userId);
  }

  await logAudit({
    accion: 'CREAR_MOVIMIENTO',
    modulo: 'flujo_fondos',
    detalle: `Movimiento de fondo: ${data.categoria} - ${data.moneda} ${monto.toLocaleString('es-AR')} (${data.fecha})`,
    entidadId: docRef.id,
    entidadTipo: 'movimiento_fondo',
    userId,
    metadata: { monto, categoria: data.categoria, fecha: data.fecha, cuentaOrigenId: data.cuentaOrigenId, cuentaDestinoId: data.cuentaDestinoId },
  }).catch(() => {});

  return docRef.id;
}

/** Crea operación de cambio: Compra USD (ARS sale, USD entra) o Venta USD (USD sale, ARS entra) */
export async function createOperacionCambioDivisas(
  params: {
    tipo: 'compra_usd' | 'venta_usd';
    cuentaOrigenId: string;    // ARS para compra, USD para venta
    cuentaDestinoId: string;  // USD para compra, ARS para venta
    montoOrigen: number;
    montoDestino: number;
    fecha: string;
    descripcion?: string;
    referencia?: string;
  },
  userId?: string
): Promise<{ idEgreso: string; idIngreso: string }> {
  const id = `cambio_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  let egreso: Omit<MovimientoFondo, 'id'>;
  let ingreso: Omit<MovimientoFondo, 'id'>;

  if (params.tipo === 'compra_usd') {
    egreso = {
      cuentaOrigenId: params.cuentaOrigenId,
      cuentaDestinoId: null,
      monto: params.montoOrigen,
      moneda: 'ARS',
      fecha: params.fecha,
      categoria: 'Compra de divisas',
      descripcion: params.descripcion || `Compra USD por ARS ${params.montoOrigen.toLocaleString('es-AR')}`,
      referencia: params.referencia,
      operacionCambioId: id,
    };
    ingreso = {
      cuentaOrigenId: null,
      cuentaDestinoId: params.cuentaDestinoId,
      monto: params.montoDestino,
      moneda: 'USD',
      fecha: params.fecha,
      categoria: 'Ingreso por compra divisas',
      descripcion: params.descripcion || `Compra USD: ${params.montoDestino.toLocaleString('es-AR')}`,
      referencia: params.referencia,
      operacionCambioId: id,
    };
  } else {
    egreso = {
      cuentaOrigenId: params.cuentaOrigenId,
      cuentaDestinoId: null,
      monto: params.montoOrigen,
      moneda: 'USD',
      fecha: params.fecha,
      categoria: 'Venta de divisas',
      descripcion: params.descripcion || `Venta USD por ARS ${params.montoDestino.toLocaleString('es-AR')}`,
      referencia: params.referencia,
      operacionCambioId: id,
    };
    ingreso = {
      cuentaOrigenId: null,
      cuentaDestinoId: params.cuentaDestinoId,
      monto: params.montoDestino,
      moneda: 'ARS',
      fecha: params.fecha,
      categoria: 'Ingreso por venta divisas',
      descripcion: params.descripcion || `Venta USD: ARS ${params.montoDestino.toLocaleString('es-AR')}`,
      referencia: params.referencia,
      operacionCambioId: id,
    };
  }

  const idEgreso = await createMovimientoFondo(egreso, userId);
  const idIngreso = await createMovimientoFondo(ingreso, userId);
  return { idEgreso, idIngreso };
}

export async function deleteMovimientoFondo(
  id: string,
  mov: MovimientoFondo,
  userId?: string
): Promise<void> {
  const movRef = doc(db, COL_MOV, id);
  const monto = mov.monto;

  // Revertir saldos
  if (mov.cuentaOrigenId) {
    const c = await getCuentaFondo(mov.cuentaOrigenId);
    if (c) await updateSaldoCuenta(mov.cuentaOrigenId, (c.saldoActual ?? 0) + monto, userId);
  }
  if (mov.cuentaDestinoId) {
    const c = await getCuentaFondo(mov.cuentaDestinoId);
    if (c) await updateSaldoCuenta(mov.cuentaDestinoId, (c.saldoActual ?? 0) - monto, userId);
  }

  await deleteDoc(movRef);
  await logAudit({
    accion: 'ELIMINAR_MOVIMIENTO',
    modulo: 'flujo_fondos',
    detalle: `Eliminación de movimiento de fondo ${id}: ${mov.categoria} - ${mov.moneda} ${monto.toLocaleString('es-AR')}`,
    entidadId: id,
    entidadTipo: 'movimiento_fondo',
    userId,
    metadata: { monto, categoria: mov.categoria, fecha: mov.fecha },
  }).catch(() => {});
}

// --- KPIs y datos para gráficos ---

export interface FlujoFondosKPIs {
  totalSaldos: number;
  totalSaldosUSD: number;
  cantCuentas: number;
  cantCuentasActivas: number;
  ingresosPeriodo: number;
  egresosPeriodo: number;
  netoPeriodo: number;
  ingresosPeriodoARS: number;
  ingresosPeriodoUSD: number;
  egresosPeriodoARS: number;
  egresosPeriodoUSD: number;
  netoPeriodoARS: number;
  netoPeriodoUSD: number;
  cantMovimientosPeriodo: number;
}

export interface FilaMensualChart {
  mes: string;
  mesCorto: string;
  ingresos: number;
  egresos: number;
  neto: number;
}

export interface FilaCategoriaChart {
  categoria: string;
  monto: number;
  montoARS: number;
  montoUSD: number;
  tipo: 'ingreso' | 'egreso';
}

export interface FilaCuentaChart {
  nombre: string;
  saldo: number;
  moneda: string;
}

export async function getFlujoFondosKPIs(
  cuentas: CuentaFondo[],
  movimientos: MovimientoFondo[],
  movimientosCaja?: MovimientoCaja[]
): Promise<FlujoFondosKPIs> {
  const totalSaldos = cuentas
    .filter((c) => (c.moneda ?? 'ARS') === 'ARS')
    .reduce((s, c) => s + (c.saldoActual ?? 0), 0);
  const totalSaldosUSD = cuentas
    .filter((c) => (c.moneda ?? '') === 'USD')
    .reduce((s, c) => s + (c.saldoActual ?? 0), 0);

  let ingresosARS = 0; let ingresosUSD = 0;
  let egresosARS = 0; let egresosUSD = 0;
  const esARS = (moneda: string) => (moneda ?? 'ARS') === 'ARS';

  for (const m of movimientos) {
    const mont = m.monto ?? 0;
    const ingreso = CATEGORIAS_INGRESO.includes(m.categoria ?? '');
    if (esARS(m.moneda ?? '')) {
      if (ingreso) ingresosARS += mont; else egresosARS += mont;
    } else {
      if (ingreso) ingresosUSD += mont; else egresosUSD += mont;
    }
  }
  for (const m of movimientosCaja ?? []) {
    const mont = m.monto ?? 0;
    const ingreso = m.tipo === 'ingreso';
    if (esARS(m.moneda ?? '')) {
      if (ingreso) ingresosARS += mont; else egresosARS += mont;
    } else {
      if (ingreso) ingresosUSD += mont; else egresosUSD += mont;
    }
  }

  const ingresosPeriodo = ingresosARS + ingresosUSD;
  const egresosPeriodo = egresosARS + egresosUSD;

  return {
    totalSaldos,
    totalSaldosUSD,
    cantCuentas: cuentas.length,
    cantCuentasActivas: cuentas.filter((c) => c.activa !== false).length,
    ingresosPeriodo,
    egresosPeriodo,
    netoPeriodo: ingresosPeriodo - egresosPeriodo,
    ingresosPeriodoARS: ingresosARS,
    ingresosPeriodoUSD: ingresosUSD,
    egresosPeriodoARS: egresosARS,
    egresosPeriodoUSD: egresosUSD,
    netoPeriodoARS: ingresosARS - egresosARS,
    netoPeriodoUSD: ingresosUSD - egresosUSD,
    cantMovimientosPeriodo: movimientos.length + (movimientosCaja?.length ?? 0),
  };
}

export function agregarMovimientosPorMes(
  movimientos: MovimientoFondo[],
  movimientosCaja?: MovimientoCaja[]
): FilaMensualChart[] {
  const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const porMes: Record<string, { ingresos: number; egresos: number }> = {};

  for (const m of movimientos) {
    const key = m.fecha?.slice(0, 7) ?? '';
    if (!key) continue;
    if (!porMes[key]) porMes[key] = { ingresos: 0, egresos: 0 };
    const mont = m.monto ?? 0;
    if (CATEGORIAS_INGRESO.includes(m.categoria ?? '')) {
      porMes[key].ingresos += mont;
    } else {
      porMes[key].egresos += mont;
    }
  }
  for (const m of movimientosCaja ?? []) {
    const key = m.fecha?.slice(0, 7) ?? '';
    if (!key) continue;
    if (!porMes[key]) porMes[key] = { ingresos: 0, egresos: 0 };
    const mont = m.monto ?? 0;
    if (m.tipo === 'ingreso') {
      porMes[key].ingresos += mont;
    } else {
      porMes[key].egresos += mont;
    }
  }

  return Object.entries(porMes)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => {
      const [año, mes] = key.split('-');
      const mesNum = parseInt(mes, 10);
      return {
        mes: `${MESES[mesNum - 1]} ${año}`,
        mesCorto: MESES[mesNum - 1],
        ingresos: Math.round(v.ingresos * 100) / 100,
        egresos: Math.round(v.egresos * 100) / 100,
        neto: Math.round((v.ingresos - v.egresos) * 100) / 100,
      };
    });
}

export type PeriodoFiltro = 'hoy' | 'semana' | 'mes' | 'trimestre' | 'semestre' | 'año';

/** Agrega movimientos según el período seleccionado para el timeline horizontal. */
export function agregarMovimientosParaTimeline(
  movimientos: MovimientoFondo[],
  movimientosCaja: MovimientoCaja[] | undefined,
  periodo: PeriodoFiltro,
  desde: string,
  hasta: string
): FilaMensualChart[] {
  const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  const addTo = (key: string, ing: number, egr: number, map: Record<string, { ingresos: number; egresos: number }>) => {
    if (!map[key]) map[key] = { ingresos: 0, egresos: 0 };
    map[key].ingresos += ing;
    map[key].egresos += egr;
  };

  const addMov = (fechaStr: string, monto: number, ingreso: boolean, map: Record<string, { ingresos: number; egresos: number }>) => {
    const mont = monto ?? 0;
    addTo(fechaStr, ingreso ? mont : 0, ingreso ? 0 : mont, map);
  };

  if (periodo === 'hoy') {
    const map: Record<string, { ingresos: number; egresos: number }> = {};
    for (const m of movimientos) {
      if (m.fecha === desde) addMov(desde, m.monto ?? 0, CATEGORIAS_INGRESO.includes(m.categoria ?? ''), map);
    }
    for (const m of movimientosCaja ?? []) {
      if (m.fecha === desde) addMov(desde, m.monto ?? 0, m.tipo === 'ingreso', map);
    }
    const v = map[desde] ?? { ingresos: 0, egresos: 0 };
    return [{
      mes: 'Hoy',
      mesCorto: 'Hoy',
      ingresos: Math.round(v.ingresos * 100) / 100,
      egresos: Math.round(v.egresos * 100) / 100,
      neto: Math.round((v.ingresos - v.egresos) * 100) / 100,
    }];
  }

  if (periodo === 'semana') {
    const map: Record<string, { ingresos: number; egresos: number }> = {};
    const slots: string[] = [];
    let d = new Date(desde + 'T12:00:00');
    const hastaD = new Date(hasta + 'T12:00:00');
    while (d <= hastaD) {
      const k = d.toISOString().slice(0, 10);
      slots.push(k);
      d.setDate(d.getDate() + 1);
    }
    for (const m of movimientos) {
      if (m.fecha && m.fecha >= desde && m.fecha <= hasta) addMov(m.fecha, m.monto ?? 0, CATEGORIAS_INGRESO.includes(m.categoria ?? ''), map);
    }
    for (const m of movimientosCaja ?? []) {
      if (m.fecha && m.fecha >= desde && m.fecha <= hasta) addMov(m.fecha, m.monto ?? 0, m.tipo === 'ingreso', map);
    }
    return slots.map((k) => {
      const v = map[k] ?? { ingresos: 0, egresos: 0 };
      const dd = new Date(k + 'T12:00:00');
      const dia = dd.getDate();
      const nom = DIAS[dd.getDay()];
      return {
        mes: `${nom} ${dia}`,
        mesCorto: `${nom} ${dia}`,
        ingresos: Math.round(v.ingresos * 100) / 100,
        egresos: Math.round(v.egresos * 100) / 100,
        neto: Math.round((v.ingresos - v.egresos) * 100) / 100,
      };
    });
  }

  if (periodo === 'mes') {
    const map: Record<string, { ingresos: number; egresos: number }> = {};
    const slots: string[] = [];
    let d = new Date(desde + 'T12:00:00');
    const hastaD = new Date(hasta + 'T12:00:00');
    while (d <= hastaD) {
      slots.push(d.toISOString().slice(0, 10));
      d.setDate(d.getDate() + 1);
    }
    for (const m of movimientos) {
      if (m.fecha && m.fecha >= desde && m.fecha <= hasta) addMov(m.fecha, m.monto ?? 0, CATEGORIAS_INGRESO.includes(m.categoria ?? ''), map);
    }
    for (const m of movimientosCaja ?? []) {
      if (m.fecha && m.fecha >= desde && m.fecha <= hasta) addMov(m.fecha, m.monto ?? 0, m.tipo === 'ingreso', map);
    }
    return slots.map((k) => {
      const v = map[k] ?? { ingresos: 0, egresos: 0 };
      const dd = new Date(k + 'T12:00:00');
      return {
        mes: k,
        mesCorto: String(dd.getDate()),
        ingresos: Math.round(v.ingresos * 100) / 100,
        egresos: Math.round(v.egresos * 100) / 100,
        neto: Math.round((v.ingresos - v.egresos) * 100) / 100,
      };
    });
  }

  if (periodo === 'trimestre') {
    const map: Record<string, { ingresos: number; egresos: number }> = {};
    const desdeTs = new Date(desde + 'T12:00:00').getTime();
    const getSemanaKey = (f: string) => {
      const fd = new Date(f + 'T12:00:00').getTime();
      const diff = Math.floor((fd - desdeTs) / (24 * 60 * 60 * 1000));
      const weekNum = Math.floor(diff / 7) + 1;
      return `W${weekNum}`;
    };
    for (const m of movimientos) {
      if (m.fecha && m.fecha >= desde && m.fecha <= hasta) addMov(getSemanaKey(m.fecha), m.monto ?? 0, CATEGORIAS_INGRESO.includes(m.categoria ?? ''), map);
    }
    for (const m of movimientosCaja ?? []) {
      if (m.fecha && m.fecha >= desde && m.fecha <= hasta) addMov(getSemanaKey(m.fecha), m.monto ?? 0, m.tipo === 'ingreso', map);
    }
    const hastaTs = new Date(hasta + 'T12:00:00').getTime();
    const totalDays = Math.ceil((hastaTs - desdeTs) / (24 * 60 * 60 * 1000)) + 1;
    const numSemanas = Math.ceil(totalDays / 7) || 1;
    return Array.from({ length: numSemanas }, (_, i) => {
      const k = `W${i + 1}`;
      const v = map[k] ?? { ingresos: 0, egresos: 0 };
      return {
        mes: `Semana ${i + 1}`,
        mesCorto: `S${i + 1}`,
        ingresos: Math.round(v.ingresos * 100) / 100,
        egresos: Math.round(v.egresos * 100) / 100,
        neto: Math.round((v.ingresos - v.egresos) * 100) / 100,
      };
    });
  }

  if (periodo === 'semestre' || periodo === 'año') {
    return agregarMovimientosPorMes(movimientos, movimientosCaja);
  }

  return [];
}

export function agregarMovimientosPorCategoria(
  movimientos: MovimientoFondo[],
  movimientosCaja?: MovimientoCaja[]
): FilaCategoriaChart[] {
  const porCat: Record<string, { montoARS: number; montoUSD: number; ingreso: boolean }> = {};
  const add = (cat: string, mont: number, ingreso: boolean, moneda: string) => {
    if (!porCat[cat]) porCat[cat] = { montoARS: 0, montoUSD: 0, ingreso };
    if ((moneda ?? 'ARS') === 'ARS') porCat[cat].montoARS += mont;
    else porCat[cat].montoUSD += mont;
  };
  for (const m of movimientos) {
    const cat = m.categoria || 'Otros';
    const mont = m.monto ?? 0;
    const ingreso = CATEGORIAS_INGRESO.includes(m.categoria ?? '');
    add(cat, mont, ingreso, m.moneda ?? 'ARS');
  }
  for (const m of movimientosCaja ?? []) {
    const cat = `Caja: ${m.categoria || 'Otros'}`;
    const mont = m.monto ?? 0;
    add(cat, mont, m.tipo === 'ingreso', m.moneda ?? 'ARS');
  }
  return Object.entries(porCat).map(([categoria, { montoARS, montoUSD, ingreso }]) => ({
    categoria,
    monto: Math.round((montoARS + montoUSD) * 100) / 100,
    montoARS: Math.round(montoARS * 100) / 100,
    montoUSD: Math.round(montoUSD * 100) / 100,
    tipo: ingreso ? 'ingreso' : 'egreso',
  }));
}

export function agregarSaldosPorCuenta(cuentas: CuentaFondo[]): FilaCuentaChart[] {
  return cuentas
    .filter((c) => (c.saldoActual ?? 0) !== 0)
    .map((c) => ({
      nombre: c.nombre ?? 'Sin nombre',
      saldo: c.saldoActual ?? 0,
      moneda: c.moneda ?? 'ARS',
    }))
    .sort((a, b) => Math.abs(b.saldo) - Math.abs(a.saldo));
}
