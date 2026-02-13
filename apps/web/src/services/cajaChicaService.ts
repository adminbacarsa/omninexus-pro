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
import { logAudit } from './auditService';
import type { CajaChica, MovimientoCaja, Rendicion, FilaMatrizControl } from '@/types/cajaChica';

const COL_CAJAS = 'cajas_chica';
const COL_MOV = 'movimientos_caja';
const COL_RENDICIONES = 'rendiciones_caja';

function sanitize<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Record<string, unknown>;
}

// --- Cajas ---

export async function listCajasChica(): Promise<CajaChica[]> {
  const q = query(collection(getDb(), COL_CAJAS), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as CajaChica));
}

export async function getCajaChica(id: string): Promise<CajaChica | null> {
  const ref = doc(getDb(), COL_CAJAS, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as CajaChica;
}

export async function createCajaChica(data: Omit<CajaChica, 'id' | 'saldoActual'>, userId?: string): Promise<string> {
  const ref = collection(getDb(), COL_CAJAS);
  const now = new Date().toISOString();
  const nivel = data.nivel ?? 'sub_caja';
  const saldoIni = data.saldoInicial ?? 0;
  const payload = sanitize({
    ...data,
    nivel,
    saldoInicial: nivel === 'central' ? saldoIni : 0,
    saldoActual: nivel === 'central' ? saldoIni : 0,
    createdAt: now,
    updatedAt: now,
  });
  const docRef = await addDoc(ref, payload);
  const id = docRef.id;
  await logAudit({
    accion: 'CREAR',
    modulo: 'caja_chica',
    detalle: `Alta de caja chica: ${data.nombre}`,
    entidadId: id,
    entidadTipo: 'caja_chica',
    userId,
  }).catch(() => {});
  return id;
}

export async function updateCajaChica(id: string, data: Partial<CajaChica>, userId?: string): Promise<void> {
  const ref = doc(getDb(), COL_CAJAS, id);
  await updateDoc(ref, sanitize({ ...data, updatedAt: new Date().toISOString() }));
  await logAudit({
    accion: 'ACTUALIZAR',
    modulo: 'caja_chica',
    detalle: `Actualización de caja chica ${id}`,
    entidadId: id,
    entidadTipo: 'caja_chica',
    userId,
    metadata: { campos: Object.keys(data) },
  }).catch(() => {});
}

export async function updateSaldoCaja(id: string, nuevoSaldo: number, userId?: string): Promise<void> {
  await updateCajaChica(id, { saldoActual: nuevoSaldo }, userId);
}

export async function deleteCajaChica(id: string, userId?: string): Promise<void> {
  const ref = doc(getDb(), COL_CAJAS, id);
  const snap = await getDoc(ref);
  const nombre = snap.exists() ? (snap.data() as CajaChica).nombre : 'N/A';
  await deleteDoc(ref);
  await logAudit({
    accion: 'ELIMINAR',
    modulo: 'caja_chica',
    detalle: `Eliminación de caja chica: ${nombre} (ID: ${id})`,
    entidadId: id,
    entidadTipo: 'caja_chica',
    userId,
  }).catch(() => {});
}

// --- Movimientos ---

export async function listMovimientosCaja(cajaId: string): Promise<MovimientoCaja[]> {
  const q = query(
    collection(getDb(), COL_MOV),
    where('cajaId', '==', cajaId)
  );
  const snap = await getDocs(q);
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as MovimientoCaja));
  return items.sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? ''));
}

/** Movimientos de caja en un período (para integrar en flujo de fondos) */
export async function listMovimientosCajaPorPeriodo(
  cajas: CajaChica[],
  desde: string,
  hasta: string
): Promise<MovimientoCaja[]> {
  const all: MovimientoCaja[] = [];
  for (const c of cajas) {
    if (!c.id) continue;
    const movs = await listMovimientosCaja(c.id);
    for (const m of movs) {
      if (m.fecha >= desde && m.fecha <= hasta) all.push(m);
    }
  }
  return all.sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? ''));
}

export async function createMovimientoCaja(
  data: Omit<MovimientoCaja, 'id' | 'rendido'>,
  userId?: string
): Promise<string> {
  const ref = collection(getDb(), COL_MOV);
  const now = new Date().toISOString();
  const payload = sanitize({
    ...data,
    rendido: false,
    createdAt: now,
    createdBy: userId ?? null,
  });
  const docRef = await addDoc(ref, payload);

  // Actualizar saldo de la caja
  const caja = await getCajaChica(data.cajaId);
  if (caja) {
    const delta = data.tipo === 'ingreso' ? data.monto : -data.monto;
    await updateSaldoCaja(data.cajaId, (caja.saldoActual ?? 0) + delta, userId);
  }

  await logAudit({
    accion: data.tipo === 'ingreso' ? 'INGRESO' : 'EGRESO',
    modulo: 'caja_chica',
    detalle: `${data.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'} en caja ${data.cajaId}: ${(data.monto ?? 0).toLocaleString('es-AR')} - ${data.descripcion || data.categoria || 'Sin detalle'}`,
    entidadId: docRef.id,
    entidadTipo: 'movimiento_caja',
    userId,
    metadata: { cajaId: data.cajaId, monto: data.monto, tipo: data.tipo, categoria: data.categoria },
  }).catch(() => {});

  return docRef.id;
}

export async function deleteMovimientoCaja(id: string, cajaId: string, userId?: string): Promise<void> {
  const movRef = doc(getDb(), COL_MOV, id);
  const movSnap = await getDoc(movRef);
  if (movSnap.exists()) {
    const data = movSnap.data() as MovimientoCaja;
    const delta = data.tipo === 'ingreso' ? -data.monto : data.monto;
    const caja = await getCajaChica(cajaId);
    if (caja) {
      await updateSaldoCaja(cajaId, (caja.saldoActual ?? 0) + delta, userId);
    }
    await deleteDoc(movRef);
    await logAudit({
      accion: 'ELIMINAR',
      modulo: 'caja_chica',
      detalle: `Eliminación de movimiento de caja ${id}: ${data.tipo} ${(data.monto ?? 0).toLocaleString('es-AR')} - ${data.categoria ?? ''}`,
      entidadId: id,
      entidadTipo: 'movimiento_caja',
      userId,
      metadata: { cajaId, monto: data.monto, tipo: data.tipo },
    }).catch(() => {});
  }
}

// --- Helpers ---

export function listCajasCentrales(cajas: CajaChica[]): CajaChica[] {
  return cajas.filter((c) => (c.nivel ?? 'sub_caja') === 'central');
}

export function listSubCajas(cajas: CajaChica[], cajaPadreId: string): CajaChica[] {
  return cajas.filter((c) => c.cajaPadreId === cajaPadreId);
}

// --- Transferencia desde Central a Sub-caja ---

export async function transferirFondoACaja(
  cajaCentralId: string,
  subCajaId: string,
  monto: number,
  fecha: string,
  userId?: string
): Promise<void> {
  const central = await getCajaChica(cajaCentralId);
  const sub = await getCajaChica(subCajaId);
  if (!central || !sub) throw new Error('Caja no encontrada');
  if ((central.nivel ?? 'sub_caja') !== 'central') throw new Error('La origen debe ser Caja Central');
  if ((sub.nivel ?? 'sub_caja') !== 'sub_caja') throw new Error('El destino debe ser Sub-caja');
  if ((central.saldoActual ?? 0) < monto) throw new Error('Saldo insuficiente en Caja Central');

  const moneda = central.moneda ?? 'ARS';
  await createMovimientoCaja(
    {
      cajaId: cajaCentralId,
      tipo: 'egreso',
      monto,
      moneda,
      fecha,
      categoria: 'Transferencia a Sub-caja',
      descripcion: `Fondo a ${sub.nombre}`,
    },
    userId
  );
  await createMovimientoCaja(
    {
      cajaId: subCajaId,
      tipo: 'ingreso',
      tipoIngreso: 'fondo',
      monto,
      moneda,
      fecha,
      categoria: 'Fondo recibido',
      descripcion: `Desde ${central.nombre}`,
    },
    userId
  );
}

// --- Rendiciones ---

export async function createRendicion(
  data: Omit<Rendicion, 'id' | 'estado' | 'aprobadaPor' | 'aprobadaAt'>,
  userId?: string
): Promise<string> {
  const ref = collection(getDb(), COL_RENDICIONES);
  const now = new Date().toISOString();
  const total = data.items.reduce((s, i) => s + i.monto, 0);
  const payload = sanitize({
    ...data,
    totalGastado: total,
    montoReposicion: total,
    estado: 'pendiente',
    createdAt: now,
    createdBy: userId ?? null,
  });
  const docRef = await addDoc(ref, payload);
  await logAudit({
    accion: 'CREAR_RENDICION',
    modulo: 'caja_chica',
    detalle: `Rendición pendiente para ${data.responsableNombre ?? 'N/A'}: ${total.toLocaleString('es-AR')}`,
    entidadId: docRef.id,
    entidadTipo: 'rendicion',
    userId,
    metadata: { cajaId: data.cajaId, totalGastado: total },
  }).catch(() => {});
  return docRef.id;
}

export async function listRendiciones(cajaId?: string): Promise<Rendicion[]> {
  let q = query(collection(getDb(), COL_RENDICIONES), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  let items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Rendicion));
  if (cajaId) items = items.filter((r) => r.cajaId === cajaId);
  return items;
}

export async function aprobarRendicionYCrearReposicion(
  rendicionId: string,
  userId?: string
): Promise<void> {
  const refRend = doc(getDb(), COL_RENDICIONES, rendicionId);
  const snap = await getDoc(refRend);
  if (!snap.exists()) throw new Error('Rendición no encontrada');
  const rend = { id: snap.id, ...snap.data() } as Rendicion;
  if (rend.estado !== 'pendiente') throw new Error('La rendición ya fue procesada');

  const caja = await getCajaChica(rend.cajaId);
  if (!caja) throw new Error('Caja no encontrada');

  const now = new Date().toISOString();
  const fecha = rend.fecha ?? now.slice(0, 10);

  for (const item of rend.items) {
    await createMovimientoCaja(
      {
        cajaId: rend.cajaId,
        tipo: 'egreso',
        monto: item.monto,
        moneda: caja.moneda ?? 'ARS',
        fecha,
        categoria: item.categoria,
        descripcion: item.descripcion,
        comprobanteUrl: item.comprobanteUrl,
        rendido: true,
        rendicionId: rendicionId,
      },
      userId
    );
  }

  await createMovimientoCaja(
    {
      cajaId: rend.cajaId,
      tipo: 'ingreso',
      tipoIngreso: 'reposicion',
      monto: rend.montoReposicion,
      moneda: caja.moneda ?? 'ARS',
      fecha,
      categoria: 'Reposición (rendición)',
      descripcion: `Reposición rendición ${rendicionId.slice(0, 8)}`,
      rendido: true,
      rendicionId: rendicionId,
    },
    userId
  );

  await updateDoc(refRend, {
    estado: 'aprobada',
    aprobadaPor: userId ?? null,
    aprobadaAt: now,
    updatedAt: now,
  });

  await logAudit({
    accion: 'APROBAR_RENDICION',
    modulo: 'caja_chica',
    detalle: `Rendición aprobada y repuesta: ${rend.montoReposicion.toLocaleString('es-AR')} en ${caja.nombre}`,
    entidadId: rendicionId,
    entidadTipo: 'rendicion',
    userId,
    metadata: { totalGastado: rend.totalGastado, items: rend.items.length },
  }).catch(() => {});
}

// --- Matriz de control ---

export async function getMatrizControl(cajas: CajaChica[]): Promise<FilaMatrizControl[]> {
  const filas: FilaMatrizControl[] = [];

  for (const c of cajas) {
    const movs = await listMovimientosCaja(c.id!);
    const entregasReposiciones = movs
      .filter((m) => m.tipo === 'ingreso' && (m.tipoIngreso === 'fondo' || m.tipoIngreso === 'reposicion'))
      .reduce((s, m) => s + m.monto, 0);
    const gastosRendidos = movs
      .filter((m) => m.tipo === 'egreso')
      .reduce((s, m) => s + m.monto, 0);

    filas.push({
      id: c.id!,
      ubicacion: c.nombre,
      responsable: c.responsableNombre ?? (c.nivel === 'central' ? 'Gerente' : '—'),
      nivel: c.nivel ?? 'sub_caja',
      saldoInicial: c.saldoInicial ?? 0,
      entregasReposiciones,
      gastosRendidos,
      saldoActual: c.saldoActual ?? 0,
      moneda: c.moneda ?? 'ARS',
    });
  }

  return filas;
}
