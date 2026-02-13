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
} from 'firebase/firestore';
import { getDb } from '@/lib/firebase';
import { logAudit } from './auditService';
import type { Inversor } from '@/types/inversor';

const COL = 'inversores';

export async function listInversores(): Promise<Inversor[]> {
  try {
    const q = query(collection(getDb(), COL), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...d.data(), id: d.id } as Inversor));
  } catch {
    // Fallback: docs sin createdAt o índice faltante
    const snap = await getDocs(collection(getDb(), COL));
    return snap.docs
      .map((d) => ({ ...d.data(), id: d.id } as Inversor))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }
}

export async function getInversor(id: string): Promise<Inversor | null> {
  const ref = doc(getDb(), COL, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { ...snap.data(), id: snap.id } as Inversor;
}

// Firestore no acepta undefined; hay que remover esos campos
function sanitize<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as Record<string, unknown>;
}

const FIRESTORE_TIMEOUT_MS = 15000;

export async function createInversor(data: Omit<Inversor, 'id'>, userId?: string): Promise<string> {
  const ref = collection(getDb(), COL);
  const now = new Date().toISOString();
  const payload = sanitize({
    ...data,
    fechaAlta: data.fechaAlta ?? now.slice(0, 10),
    createdAt: now,
    updatedAt: now,
    createdBy: userId ?? null,
  });

  let timeoutId: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error('Tiempo de espera agotado. Verificá la conexión y que Firebase esté configurado correctamente.')),
      FIRESTORE_TIMEOUT_MS
    );
  });

  try {
    const docRef = await Promise.race([addDoc(ref, payload), timeoutPromise]);
    clearTimeout(timeoutId!);
    const id = docRef.id;
    await logAudit({
      accion: 'CREAR',
      modulo: 'inversores',
      detalle: `Alta de inversor: ${data.nombre || data.razonSocial || data.email}`,
      entidadId: id,
      entidadTipo: 'inversor',
      userId,
      metadata: { nombre: data.nombre, email: data.email, tipo: data.tipo },
    }).catch(() => {});
    return id;
  } catch (e) {
    clearTimeout(timeoutId!);
    throw e;
  }
}

export async function updateInversor(id: string, data: Partial<Inversor>, userId?: string): Promise<void> {
  const ref = doc(getDb(), COL, id);
  const payload = sanitize({
    ...data,
    updatedAt: new Date().toISOString(),
  });
  await updateDoc(ref, payload);
  await logAudit({
    accion: 'ACTUALIZAR',
    modulo: 'inversores',
    detalle: `Actualización de inversor ${id}`,
    entidadId: id,
    entidadTipo: 'inversor',
    userId,
    metadata: { campos: Object.keys(data) },
  }).catch(() => {});
}

export async function deleteInversor(id: string, userId?: string): Promise<void> {
  const ref = doc(getDb(), COL, id);
  const snap = await getDoc(ref);
  const nombre = snap.exists() ? (snap.data() as Inversor).nombre || (snap.data() as Inversor).razonSocial : 'N/A';
  await deleteDoc(ref);
  await logAudit({
    accion: 'ELIMINAR',
    modulo: 'inversores',
    detalle: `Eliminación de inversor: ${nombre} (ID: ${id})`,
    entidadId: id,
    entidadTipo: 'inversor',
    userId,
  }).catch(() => {});
}
