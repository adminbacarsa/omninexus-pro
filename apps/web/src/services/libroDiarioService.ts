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
import { getDb } from '@/lib/firebase';
import type {
  Banco,
  SaldoDiario,
  Movimiento,
  PlantillaMovimiento,
  Compromiso,
} from '@/types/libroDiario';

const COL_BANCOS = 'libro_diario_bancos';
const COL_SALDOS = 'libro_diario_saldos';
const COL_MOVIMIENTOS = 'libro_diario_movimientos';
const COL_PLANTILLAS = 'libro_diario_plantillas';
const COL_COMPROMISOS = 'libro_diario_compromisos';

function sanitize<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as Record<string, unknown>;
}

// --- Bancos ---

export async function listBancos(): Promise<Banco[]> {
  try {
    const q = query(
      collection(getDb(), COL_BANCOS),
      orderBy('orden', 'asc'),
      orderBy('nombre', 'asc')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Banco));
  } catch {
    const snap = await getDocs(collection(getDb(), COL_BANCOS));
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Banco));
    return items.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || (a.nombre || '').localeCompare(b.nombre || ''));
  }
}

export async function getBanco(id: string): Promise<Banco | null> {
  const ref = doc(getDb(), COL_BANCOS, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Banco;
}

export async function createBanco(data: Omit<Banco, 'id'>, userId?: string): Promise<string> {
  const ref = collection(getDb(), COL_BANCOS);
  const now = new Date().toISOString();
  const payload = sanitize({
    ...data,
    orden: data.orden ?? 0,
    activa: data.activa ?? true,
    createdAt: now,
    updatedAt: now,
    createdBy: userId ?? null,
  });
  const docRef = await addDoc(ref, payload);
  return docRef.id;
}

export async function updateBanco(id: string, data: Partial<Banco>, userId?: string): Promise<void> {
  const ref = doc(getDb(), COL_BANCOS, id);
  await updateDoc(ref, sanitize({ ...data, updatedAt: new Date().toISOString() }));
}

export async function deleteBanco(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), COL_BANCOS, id));
}

// --- Saldos diarios ---

export async function listSaldos(filtros?: { bancoId?: string; fechaDesde?: string; fechaHasta?: string }): Promise<SaldoDiario[]> {
  let q = query(collection(getDb(), COL_SALDOS), orderBy('fecha', 'desc'));
  if (filtros?.bancoId) {
    q = query(
      collection(getDb(), COL_SALDOS),
      where('bancoId', '==', filtros.bancoId),
      orderBy('fecha', 'desc')
    );
  }
  const snap = await getDocs(q);
  let items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as SaldoDiario));
  if (filtros?.fechaDesde) items = items.filter((s) => s.fecha >= filtros!.fechaDesde!);
  if (filtros?.fechaHasta) items = items.filter((s) => s.fecha <= filtros!.fechaHasta!);
  return items;
}

export async function getSaldo(bancoId: string, fecha: string): Promise<SaldoDiario | null> {
  const q = query(
    collection(getDb(), COL_SALDOS),
    where('bancoId', '==', bancoId),
    where('fecha', '==', fecha)
  );
  const snap = await getDocs(q);
  const d = snap.docs[0];
  if (!d) return null;
  return { id: d.id, ...d.data() } as SaldoDiario;
}

export async function upsertSaldo(
  data: Omit<SaldoDiario, 'id'>,
  userId?: string
): Promise<string> {
  const existente = await getSaldo(data.bancoId, data.fecha);
  const now = new Date().toISOString();
  if (existente?.id) {
    await updateDoc(doc(getDb(), COL_SALDOS, existente.id), {
      saldo: data.saldo,
      updatedAt: now,
    });
    return existente.id;
  }
  const ref = collection(getDb(), COL_SALDOS);
  const payload = sanitize({
    ...data,
    createdAt: now,
    updatedAt: now,
    createdBy: userId ?? null,
  });
  const docRef = await addDoc(ref, payload);
  return docRef.id;
}

// --- Movimientos ---

export async function listMovimientos(filtros?: {
  bancoId?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  tipo?: string;
}): Promise<Movimiento[]> {
  let q = query(
    collection(getDb(), COL_MOVIMIENTOS),
    orderBy('fecha', 'desc'),
    orderBy('createdAt', 'desc')
  );
  if (filtros?.bancoId) {
    q = query(
      collection(getDb(), COL_MOVIMIENTOS),
      where('bancoId', '==', filtros.bancoId),
      orderBy('fecha', 'desc')
    );
  }
  const snap = await getDocs(q);
  let items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Movimiento));
  if (filtros?.fechaDesde) items = items.filter((m) => m.fecha >= filtros!.fechaDesde!);
  if (filtros?.fechaHasta) items = items.filter((m) => m.fecha <= filtros!.fechaHasta!);
  if (filtros?.tipo) items = items.filter((m) => m.tipo === filtros!.tipo);
  return items;
}

export async function getMovimiento(id: string): Promise<Movimiento | null> {
  const ref = doc(getDb(), COL_MOVIMIENTOS, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Movimiento;
}

export async function createMovimiento(
  data: Omit<Movimiento, 'id'>,
  userId?: string
): Promise<string> {
  const ref = collection(getDb(), COL_MOVIMIENTOS);
  const now = new Date().toISOString();
  const payload = sanitize({
    ...data,
    createdAt: now,
    updatedAt: now,
    createdBy: userId ?? null,
  });
  const docRef = await addDoc(ref, payload);
  return docRef.id;
}

/** Crea una transferencia: egreso en origen + ingreso en destino */
export async function createTransferencia(
  bancoOrigenId: string,
  bancoDestinoId: string,
  monto: number,
  moneda: 'ARS' | 'USD',
  fecha: string,
  descripcion: string,
  referencia?: string,
  userId?: string
): Promise<{ egresoId: string; ingresoId: string }> {
  const egresoId = await createMovimiento(
    {
      bancoId: bancoOrigenId,
      fecha,
      tipo: 'transferencia',
      monto: -Math.abs(monto),
      moneda,
      descripcion: descripcion || 'Transferencia',
      bancoDestinoId,
      referencia,
    },
    userId
  );
  const ingresoId = await createMovimiento(
    {
      bancoId: bancoDestinoId,
      fecha,
      tipo: 'transferencia',
      monto: Math.abs(monto),
      moneda,
      descripcion: descripcion || 'Transferencia',
      bancoDestinoId: bancoOrigenId,
      referencia,
    },
    userId
  );
  return { egresoId, ingresoId };
}

export async function updateMovimiento(id: string, data: Partial<Movimiento>, userId?: string): Promise<void> {
  const ref = doc(getDb(), COL_MOVIMIENTOS, id);
  await updateDoc(ref, sanitize({ ...data, updatedAt: new Date().toISOString() }));
}

export async function deleteMovimiento(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), COL_MOVIMIENTOS, id));
}

// --- Plantillas ---

export async function listPlantillas(): Promise<PlantillaMovimiento[]> {
  try {
    const q = query(
      collection(getDb(), COL_PLANTILLAS),
      orderBy('orden', 'asc'),
      orderBy('nombre', 'asc')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as PlantillaMovimiento));
  } catch {
    const snap = await getDocs(collection(getDb(), COL_PLANTILLAS));
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as PlantillaMovimiento));
    return items.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || (a.nombre || '').localeCompare(b.nombre || ''));
  }
}

export async function getPlantilla(id: string): Promise<PlantillaMovimiento | null> {
  const ref = doc(getDb(), COL_PLANTILLAS, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as PlantillaMovimiento;
}

export async function createPlantilla(data: Omit<PlantillaMovimiento, 'id'>, userId?: string): Promise<string> {
  const ref = collection(getDb(), COL_PLANTILLAS);
  const now = new Date().toISOString();
  const payload = sanitize({
    ...data,
    activa: data.activa ?? true,
    orden: data.orden ?? 0,
    createdAt: now,
    updatedAt: now,
    createdBy: userId ?? null,
  });
  const docRef = await addDoc(ref, payload);
  return docRef.id;
}

export async function updatePlantilla(id: string, data: Partial<PlantillaMovimiento>, userId?: string): Promise<void> {
  const ref = doc(getDb(), COL_PLANTILLAS, id);
  await updateDoc(ref, sanitize({ ...data, updatedAt: new Date().toISOString() }));
}

export async function deletePlantilla(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), COL_PLANTILLAS, id));
}

/** Genera un movimiento a partir de una plantilla en la fecha indicada */
export async function generarMovimientoDesdePlantilla(
  plantillaId: string,
  fecha: string,
  userId?: string
): Promise<string> {
  const plantilla = await getPlantilla(plantillaId);
  if (!plantilla) throw new Error('Plantilla no encontrada');
  return createMovimiento(
    {
      bancoId: plantilla.bancoId,
      fecha,
      tipo: plantilla.tipo,
      monto: plantilla.monto,
      moneda: plantilla.moneda,
      descripcion: plantilla.descripcion,
      recurrente: true,
      bancoDestinoId: plantilla.bancoDestinoId,
    },
    userId
  );
}

// --- Compromisos ---

export async function listCompromisos(mesAnio?: string): Promise<Compromiso[]> {
  let q = query(
    collection(getDb(), COL_COMPROMISOS),
    orderBy('mesAnio', 'desc'),
    orderBy('orden', 'asc'),
    orderBy('concepto', 'asc')
  );
  if (mesAnio) {
    q = query(
      collection(getDb(), COL_COMPROMISOS),
      where('mesAnio', '==', mesAnio),
      orderBy('orden', 'asc'),
      orderBy('concepto', 'asc')
    );
  }
  try {
    const snap = await getDocs(q);
    let items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Compromiso));
    if (mesAnio) items = items.filter((c) => c.mesAnio === mesAnio);
    return items;
  } catch {
    const snap = await getDocs(collection(getDb(), COL_COMPROMISOS));
    let items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Compromiso));
    if (mesAnio) items = items.filter((c) => c.mesAnio === mesAnio);
    return items.sort(
      (a, b) =>
        (b.mesAnio || '').localeCompare(a.mesAnio || '') ||
        (a.orden ?? 0) - (b.orden ?? 0) ||
        (a.concepto || '').localeCompare(b.concepto || '')
    );
  }
}

export async function getCompromiso(id: string): Promise<Compromiso | null> {
  const ref = doc(getDb(), COL_COMPROMISOS, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Compromiso;
}

export async function createCompromiso(data: Omit<Compromiso, 'id'>, userId?: string): Promise<string> {
  const ref = collection(getDb(), COL_COMPROMISOS);
  const now = new Date().toISOString();
  const payload = sanitize({
    ...data,
    activo: data.activo ?? true,
    orden: data.orden ?? 0,
    pagosPorFecha: data.pagosPorFecha ?? {},
    createdAt: now,
    updatedAt: now,
    createdBy: userId ?? null,
  });
  const docRef = await addDoc(ref, payload);
  return docRef.id;
}

export async function updateCompromiso(id: string, data: Partial<Compromiso>, userId?: string): Promise<void> {
  const ref = doc(getDb(), COL_COMPROMISOS, id);
  await updateDoc(ref, sanitize({ ...data, updatedAt: new Date().toISOString() }));
}

export async function deleteCompromiso(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), COL_COMPROMISOS, id));
}
