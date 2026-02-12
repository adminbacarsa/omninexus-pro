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
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase';
import { createMovimientoFondo, getCuentaFondo, deleteMovimientoFondo } from './flujoFondosService';
import { logAudit } from './auditService';
import type {
  PlazoFijo,
  MovimientoPlazoFijo,
  FechaPagoPF,
  TipoInteres,
  FrecuenciaPago,
} from '@/types/plazoFijo';

const COL = 'plazos_fijo';
const SUB_MOV = 'movimientos';
const SUB_FECHAS = 'fechas_pago';

function sanitize<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Record<string, unknown>;
}

// --- Cálculos ---

export function calcularInteres(
  capital: number,
  tasaAnual: number,
  dias: number,
  tipo: TipoInteres
): number {
  if (capital <= 0 || dias <= 0) return 0;
  const tasa = tasaAnual / 100;
  if (tipo === 'simple') {
    return capital * tasa * (dias / 365);
  }
  // compuesto
  return capital * (Math.pow(1 + tasa, dias / 365) - 1);
}

export function agregarDias(fechaStr: string, dias: number): string {
  const d = new Date(fechaStr);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function diasEntre(fechaInicio: string, fechaFin: string): number {
  const a = new Date(fechaInicio);
  const b = new Date(fechaFin);
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export function generarFechasPago(
  fechaInicio: string,
  fechaVencimiento: string,
  frecuencia: FrecuenciaPago,
  capitalInicial: number,
  tasaAnual: number,
  tipoInteres: TipoInteres,
  capitalizar = false
): { fechaProgramada: string; interesEstimado: number }[] {
  const fechas: { fechaProgramada: string; interesEstimado: number }[] = [];
  if (frecuencia === 'vencimiento') {
    const dias = diasEntre(fechaInicio, fechaVencimiento);
    const interes = calcularInteres(capitalInicial, tasaAnual, dias, tipoInteres);
    fechas.push({ fechaProgramada: fechaVencimiento, interesEstimado: Math.round(interes * 100) / 100 });
    return fechas;
  }

  const mesesPorFrecuencia: Record<FrecuenciaPago, number> = {
    vencimiento: 0,
    mensual: 1,
    trimestral: 3,
    semestral: 6,
  };
  const intervaloMeses = mesesPorFrecuencia[frecuencia];
  let fechaActual = fechaInicio;
  let capitalAcum = capitalInicial;

  while (fechaActual < fechaVencimiento) {
    let siguiente = new Date(fechaActual);
    siguiente.setMonth(siguiente.getMonth() + intervaloMeses);
    let siguienteStr = siguiente.toISOString().slice(0, 10);
    if (siguienteStr > fechaVencimiento) siguienteStr = fechaVencimiento;
    const dias = diasEntre(fechaActual, siguienteStr);
    const interes = calcularInteres(capitalAcum, tasaAnual, dias, tipoInteres);
    const interesRedondeado = Math.round(interes * 100) / 100;
    fechas.push({
      fechaProgramada: siguienteStr,
      interesEstimado: interesRedondeado,
    });
    if (siguienteStr >= fechaVencimiento) break;
    fechaActual = siguienteStr;
    if (capitalizar) capitalAcum += interesRedondeado;
  }
  return fechas;
}

// --- CRUD Plazos Fijo ---

export async function listPlazosFijo(filtros?: { inversorId?: string; estado?: string }): Promise<PlazoFijo[]> {
  if (!db) return [];
  try {
    let q = query(collection(db, COL), orderBy('fechaInicio', 'desc'));
    if (filtros?.inversorId) {
      q = query(
        collection(db, COL),
        where('inversorId', '==', filtros.inversorId),
        orderBy('fechaInicio', 'desc')
      );
    }
    const snap = await getDocs(q);
    let items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as PlazoFijo));
    if (filtros?.estado) {
      items = items.filter((p) => p.estado === filtros.estado);
    }
    return items;
  } catch {
    const snap = await getDocs(collection(db, COL));
    let items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as PlazoFijo));
    if (filtros?.inversorId) items = items.filter((p) => p.inversorId === filtros.inversorId);
    if (filtros?.estado) items = items.filter((p) => p.estado === filtros.estado);
    return items.sort((a, b) => (b.fechaInicio || '').localeCompare(a.fechaInicio || ''));
  }
}

export async function getPlazoFijo(id: string): Promise<PlazoFijo | null> {
  const ref = doc(db, COL, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as PlazoFijo;
}

export async function createPlazoFijo(
  data: Omit<PlazoFijo, 'id' | 'capitalActual'>,
  userId?: string,
  cuentaOrigenId?: string
): Promise<string> {
  // Usar Cloud Function cuando está disponible (operación atómica en el servidor)
  try {
    const createFn = httpsCallable<
      { data: Record<string, unknown>; cuentaOrigenId?: string },
      { id: string }
    >(functions, 'createPlazoFijo');
    const payload = sanitize({
      ...data,
      estado: data.estado ?? 'activo',
      renovacionAutomatica: data.renovacionAutomatica ?? false,
    }) as Record<string, unknown>;
    const res = await createFn({ data: payload, cuentaOrigenId });
    const id = (res.data as { id: string })?.id;
    if (id) return id;
  } catch (e) {
    const err = e as { code?: string; message?: string };
    if (err?.code !== 'functions/unavailable' && err?.code !== 'functions/not-found') {
      throw new Error(err?.message ?? (e as Error).message);
    }
    // Fallback: Function no desplegada, usar lógica cliente
  }

  // Fallback cliente (cuando Functions no está desplegado)
  const capital = data.capitalInicial;

  if (cuentaOrigenId && capital > 0) {
    const cuenta = await getCuentaFondo(cuentaOrigenId);
    if (!cuenta) throw new Error('Cuenta no encontrada');
    if ((cuenta.saldoActual ?? 0) < capital) {
      throw new Error(`Saldo insuficiente en la cuenta. Disponible: ${cuenta.saldoActual ?? 0} ${cuenta.moneda}`);
    }
    if (cuenta.moneda !== data.moneda) {
      throw new Error(`La moneda de la cuenta (${cuenta.moneda}) no coincide con la del plazo fijo (${data.moneda})`);
    }
  }

  let movId: string | null = null;
  if (cuentaOrigenId && capital > 0) {
    movId = await createMovimientoFondo(
      {
        cuentaOrigenId,
        cuentaDestinoId: null,
        monto: capital,
        moneda: data.moneda,
        fecha: data.fechaInicio,
        categoria: 'Inversión plazo fijo',
        descripcion: `Constitución plazo fijo`,
        inversorId: data.inversorId,
      },
      userId
    );
  }

  const ref = collection(db, COL);
  const now = new Date().toISOString();
  const fechaVenc = agregarDias(data.fechaInicio, data.plazoDias);

  const payload = sanitize({
    ...data,
    capitalActual: capital,
    fechaVencimiento: fechaVenc,
    estado: data.estado ?? 'activo',
    renovacionAutomatica: data.renovacionAutomatica ?? false,
    createdAt: now,
    updatedAt: now,
    createdBy: userId ?? null,
  });

  try {
    const docRef = await addDoc(ref, payload);
    const pfId = docRef.id;

    const fechas = generarFechasPago(
      data.fechaInicio,
      fechaVenc,
      data.frecuenciaPago,
      data.capitalInicial,
      data.tasaAnual,
      data.tipoInteres,
      data.aplicacionIntereses === 'capitalizar'
    );
    const fechasRef = collection(db, COL, pfId, SUB_FECHAS);
    for (const f of fechas) {
      await addDoc(fechasRef, {
        fechaProgramada: f.fechaProgramada,
        interesEstimado: f.interesEstimado,
        estado: 'pendiente',
        createdAt: now,
        updatedAt: now,
      });
    }

    await logAudit({
      accion: 'CREAR',
      modulo: 'plazo_fijo',
      detalle: `Constitución de plazo fijo: ${data.moneda} ${data.capitalInicial?.toLocaleString('es-AR')} - ${data.fechaInicio} a ${fechaVenc}`,
      entidadId: pfId,
      entidadTipo: 'plazo_fijo',
      userId,
      metadata: { capitalInicial: data.capitalInicial, inversorId: data.inversorId, moneda: data.moneda },
    }).catch(() => {});

    return pfId;
  } catch (e) {
    if (movId) {
      try {
        const movSnap = await getDoc(doc(db, 'movimientos_fondo', movId));
        if (movSnap.exists()) {
          await deleteMovimientoFondo(movId, { ...movSnap.data(), id: movId } as import('@/types/flujoFondos').MovimientoFondo, userId);
        }
      } catch {}
    }
    throw e;
  }
}

export async function updatePlazoFijo(id: string, data: Partial<PlazoFijo>, userId?: string): Promise<void> {
  const ref = doc(db, COL, id);
  await updateDoc(ref, sanitize({ ...data, updatedAt: new Date().toISOString() }));
  await logAudit({
    accion: 'ACTUALIZAR',
    modulo: 'plazo_fijo',
    detalle: `Actualización de plazo fijo ${id}`,
    entidadId: id,
    entidadTipo: 'plazo_fijo',
    userId,
    metadata: { campos: Object.keys(data) },
  }).catch(() => {});
}

export async function updateCapitalActual(id: string, nuevoCapital: number, userId?: string): Promise<void> {
  await updatePlazoFijo(id, { capitalActual: nuevoCapital }, userId);
}

// --- Movimientos ---

export async function listMovimientosPlazoFijo(pfId: string): Promise<MovimientoPlazoFijo[]> {
  const ref = collection(db, COL, pfId, SUB_MOV);
  const q = query(ref, orderBy('fecha', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as MovimientoPlazoFijo));
}

export async function listFechasPago(pfId: string): Promise<FechaPagoPF[]> {
  const ref = collection(db, COL, pfId, SUB_FECHAS);
  const q = query(ref, orderBy('fechaProgramada', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as FechaPagoPF));
}

async function crearMovimientoInterno(
  pfId: string,
  mov: Omit<MovimientoPlazoFijo, 'id'>,
  userId?: string
): Promise<string> {
  const ref = collection(db, COL, pfId, SUB_MOV);
  const now = new Date().toISOString();
  const payload = sanitize({
    ...mov,
    createdAt: now,
    createdBy: userId ?? null,
  });
  const docRef = await addDoc(ref, payload);
  return docRef.id;
}

export async function registrarAporte(
  pfId: string,
  monto: number,
  fecha: string,
  observacion?: string,
  userId?: string
): Promise<void> {
  const pf = await getPlazoFijo(pfId);
  if (!pf) throw new Error('Plazo fijo no encontrado');
  if (pf.estado !== 'activo') throw new Error('Solo se pueden agregar aportes a plazos fijos activos');

  const capitalAnterior = pf.capitalActual ?? pf.capitalInicial;
  const capitalResultante = capitalAnterior + monto;

  await crearMovimientoInterno(
    pfId,
    {
      tipo: 'aporte',
      fecha,
      monto,
      moneda: pf.moneda,
      capitalAnterior,
      capitalResultante,
      observacion,
    },
    userId
  );
  await updateCapitalActual(pfId, capitalResultante, userId);
  await logAudit({
    accion: 'APORTE',
    modulo: 'plazo_fijo',
    detalle: `Aporte a plazo fijo ${pfId}: ${pf.moneda} ${monto.toLocaleString('es-AR')}`,
    entidadId: pfId,
    entidadTipo: 'plazo_fijo',
    userId,
    metadata: { monto, capitalAnterior, capitalResultante },
  }).catch(() => {});
}

/** Indica si el plazo fijo ya venció (el capital puede retirarse) */
export function estaVencido(pf: { fechaVencimiento?: string; estado?: string }): boolean {
  if (!pf.fechaVencimiento) return false;
  const hoy = new Date().toISOString().slice(0, 10);
  return pf.fechaVencimiento <= hoy || pf.estado === 'vencido';
}

export async function registrarRetiro(
  pfId: string,
  monto: number,
  fecha: string,
  observacion?: string,
  userId?: string
): Promise<void> {
  const pf = await getPlazoFijo(pfId);
  if (!pf) throw new Error('Plazo fijo no encontrado');
  if (!estaVencido(pf)) {
    throw new Error('El plazo fijo no ha vencido. El capital solo puede retirarse a partir del ' + (pf.fechaVencimiento || 'vencimiento') + '.');
  }
  if (pf.estado === 'cerrado') throw new Error('El plazo fijo ya fue cerrado');

  const capitalAnterior = pf.capitalActual ?? pf.capitalInicial;
  if (monto > capitalAnterior) throw new Error('Monto mayor al capital disponible');
  const capitalResultante = capitalAnterior - monto;

  await crearMovimientoInterno(
    pfId,
    {
      tipo: 'retiro_capital',
      fecha,
      monto,
      moneda: pf.moneda,
      capitalAnterior,
      capitalResultante,
      observacion,
    },
    userId
  );
  await updateCapitalActual(pfId, capitalResultante, userId);
  if (capitalResultante <= 0) {
    await updatePlazoFijo(pfId, { estado: 'cerrado' }, userId);
  }
  await logAudit({
    accion: 'RETIRO_CAPITAL',
    modulo: 'plazo_fijo',
    detalle: `Retiro de capital de plazo fijo ${pfId}: ${pf.moneda} ${monto.toLocaleString('es-AR')}`,
    entidadId: pfId,
    entidadTipo: 'plazo_fijo',
    userId,
    metadata: { monto, capitalAnterior, capitalResultante },
  }).catch(() => {});
}

export async function pagarInteres(
  pfId: string,
  fechaPagoId: string,
  montoEfectivo: number,
  fechaPagoEfectiva: string,
  referencia?: string,
  userId?: string
): Promise<void> {
  const pf = await getPlazoFijo(pfId);
  if (!pf) throw new Error('Plazo fijo no encontrado');
  if (pf.aplicacionIntereses !== 'pagar') throw new Error('Este PF tiene capitalización; no se puede pagar interés');
  if (!pf.cuentaFondoId) throw new Error('Falta cuenta del cliente para acreditar intereses');

  const fechasRef = doc(db, COL, pfId, SUB_FECHAS, fechaPagoId);
  const snapFecha = await getDoc(fechasRef);
  if (!snapFecha.exists()) throw new Error('Fecha de pago no encontrada');
  const fechaPago = { id: snapFecha.id, ...snapFecha.data() } as FechaPagoPF;
  if (fechaPago.estado !== 'pendiente' && fechaPago.estado !== 'vencido')
    throw new Error('Esta fecha ya fue procesada');

  const capitalAnterior = pf.capitalActual ?? pf.capitalInicial;

  // Crear movimiento de pago de interés
  const movId = await crearMovimientoInterno(
    pfId,
    {
      tipo: 'pago_interes',
      fecha: fechaPagoEfectiva,
      monto: montoEfectivo,
      moneda: pf.moneda,
      capitalAnterior,
      capitalResultante: capitalAnterior,
      fechaPagoProgramada: fechaPago.fechaProgramada,
      referencia,
      cuentaFondoId: pf.cuentaFondoId,
    },
    userId
  );

  // Acreditar en cuenta del cliente
  const movFondoId = await createMovimientoFondo(
    {
      cuentaOrigenId: null,
      cuentaDestinoId: pf.cuentaFondoId,
      monto: montoEfectivo,
      moneda: pf.moneda,
      fecha: fechaPagoEfectiva,
      categoria: 'Interés plazo fijo',
      descripcion: `Interés PF ${pfId.slice(0, 8)} - ${fechaPago.fechaProgramada}`,
      referencia,
      inversorId: pf.inversorId,
    },
    userId
  );

  await updateDoc(fechasRef, {
    estado: 'pagado',
    interesEfectivo: montoEfectivo,
    fechaPagoEfectiva,
    movimientoId: movId,
    cuentaFondoId: pf.cuentaFondoId,
    updatedAt: new Date().toISOString(),
  });

  await updateDoc(doc(db, COL, pfId, SUB_MOV, movId), {
    movimientoFondoId: movFondoId,
  });

  await logAudit({
    accion: 'PAGAR_INTERES',
    modulo: 'plazo_fijo',
    detalle: `Pago de interés en plazo fijo ${pfId}: ${pf.moneda} ${montoEfectivo.toLocaleString('es-AR')} (fecha programada: ${fechaPago.fechaProgramada})`,
    entidadId: pfId,
    entidadTipo: 'plazo_fijo',
    userId,
    metadata: { montoEfectivo, fechaProgramada: fechaPago.fechaProgramada, cuentaFondoId: pf.cuentaFondoId },
  }).catch(() => {});
}

export async function capitalizarInteres(
  pfId: string,
  fechaPagoId: string,
  montoEfectivo: number,
  fechaCapitalizacion: string,
  userId?: string
): Promise<void> {
  const pf = await getPlazoFijo(pfId);
  if (!pf) throw new Error('Plazo fijo no encontrado');
  if (pf.estado !== 'activo') throw new Error('Plazo fijo no activo');

  const fechasRef = doc(db, COL, pfId, SUB_FECHAS, fechaPagoId);
  const snapFecha = await getDoc(fechasRef);
  if (!snapFecha.exists()) throw new Error('Fecha de pago no encontrada');
  const fechaPago = { id: snapFecha.id, ...snapFecha.data() } as FechaPagoPF;
  if (fechaPago.estado !== 'pendiente' && fechaPago.estado !== 'vencido')
    throw new Error('Esta fecha ya fue procesada');

  const capitalAnterior = pf.capitalActual ?? pf.capitalInicial;
  const capitalResultante = capitalAnterior + montoEfectivo;

  const movId = await crearMovimientoInterno(
    pfId,
    {
      tipo: 'capitalizacion_interes',
      fecha: fechaCapitalizacion,
      monto: montoEfectivo,
      moneda: pf.moneda,
      capitalAnterior,
      capitalResultante,
      fechaPagoProgramada: fechaPago.fechaProgramada,
    },
    userId
  );

  await updateDoc(fechasRef, {
    estado: 'capitalizado',
    interesEfectivo: montoEfectivo,
    fechaPagoEfectiva: fechaCapitalizacion,
    movimientoId: movId,
    updatedAt: new Date().toISOString(),
  });

  await updateCapitalActual(pfId, capitalResultante, userId);

  await logAudit({
    accion: 'CAPITALIZAR_INTERES',
    modulo: 'plazo_fijo',
    detalle: `Capitalización de interés en plazo fijo ${pfId}: ${pf.moneda} ${montoEfectivo.toLocaleString('es-AR')} (fecha: ${fechaPago.fechaProgramada})`,
    entidadId: pfId,
    entidadTipo: 'plazo_fijo',
    userId,
    metadata: { montoEfectivo, capitalAnterior, capitalResultante },
  }).catch(() => {});
}

/** Cancelar plazo fijo (anticipado o vencido). Devolución de capital a cuenta del inversor. Solo super admin / admin. */
export async function cancelarPlazoFijo(
  pfId: string,
  fecha: string,
  observacion?: string,
  userId?: string
): Promise<void> {
  const pf = await getPlazoFijo(pfId);
  if (!pf) throw new Error('Plazo fijo no encontrado');
  if (pf.estado === 'cerrado') throw new Error('El plazo fijo ya fue cerrado');
  if (pf.estado === 'cancelado') throw new Error('El plazo fijo ya fue cancelado');

  const capitalAnterior = pf.capitalActual ?? pf.capitalInicial ?? 0;
  if (capitalAnterior <= 0) {
    await updatePlazoFijo(pfId, { estado: 'cerrado' }, userId);
    return;
  }

  // Si tiene cuenta asignada, acreditar capital en la cuenta del inversor
  if (pf.cuentaFondoId) {
    await createMovimientoFondo(
      {
        cuentaOrigenId: null,
        cuentaDestinoId: pf.cuentaFondoId,
        monto: capitalAnterior,
        moneda: pf.moneda,
        fecha,
        categoria: 'Retiro inversor',
        descripcion: `Cancelación anticipada PF ${pfId.slice(0, 8)} — ${observacion || 'Cancelado por admin'}`,
        inversorId: pf.inversorId,
      },
      userId
    );
  }

  // Movimiento interno de retiro
  await crearMovimientoInterno(
    pfId,
    {
      tipo: 'retiro_capital',
      fecha,
      monto: capitalAnterior,
      moneda: pf.moneda,
      capitalAnterior,
      capitalResultante: 0,
      observacion: observacion || 'Cancelación anticipada',
    },
    userId
  );

  // Marcar fechas pendientes como omitidas
  const fechas = await listFechasPago(pfId);
  for (const f of fechas) {
    if ((f.estado === 'pendiente' || f.estado === 'vencido') && f.id) {
      const fechaRef = doc(db, COL, pfId, SUB_FECHAS, f.id);
      await updateDoc(fechaRef, {
        estado: 'omitido',
        updatedAt: new Date().toISOString(),
      });
    }
  }

  await updatePlazoFijo(pfId, { estado: 'cancelado', capitalActual: 0 }, userId);

  await logAudit({
    accion: 'CANCELAR',
    modulo: 'plazo_fijo',
    detalle: `Cancelación de plazo fijo ${pfId}: ${pf.moneda} ${capitalAnterior.toLocaleString('es-AR')} devuelto${pf.cuentaFondoId ? ' a cuenta del inversor' : ''}`,
    entidadId: pfId,
    entidadTipo: 'plazo_fijo',
    userId,
    metadata: { capitalAnterior, cuentaFondoId: pf.cuentaFondoId, fecha },
  }).catch(() => {});
}
