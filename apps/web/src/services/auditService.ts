import {
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  getDocs,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

const COL = 'audit_log';

export interface AuditEntry {
  id?: string;
  accion: string;
  modulo: string;
  detalle?: string;
  entidadId?: string;
  entidadTipo?: string;
  userId?: string;
  userEmail?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

function sanitize<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as Record<string, unknown>;
}

export async function logAudit(entry: Omit<AuditEntry, 'id' | 'createdAt'>): Promise<string> {
  const ref = collection(db, COL);
  const payload = sanitize({
    ...entry,
    createdAt: new Date().toISOString(),
  });
  const docRef = await addDoc(ref, payload);
  return docRef.id;
}

export async function getRecentAudit(limitCount = 100): Promise<AuditEntry[]> {
  const q = query(
    collection(db, COL),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  } as AuditEntry));
}

export async function getAuditFiltrado(filtros: {
  modulo?: string;
  entidadId?: string;
  desde?: string;
  hasta?: string;
  limit?: number;
}): Promise<AuditEntry[]> {
  const q = query(
    collection(db, COL),
    orderBy('createdAt', 'desc'),
    limit(filtros.limit ?? 200)
  );
  const snap = await getDocs(q);
  let items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AuditEntry));
  if (filtros.modulo) {
    items = items.filter((a) => a.modulo === filtros.modulo);
  }
  if (filtros.entidadId) {
    items = items.filter((a) => a.entidadId === filtros.entidadId);
  }
  if (filtros.desde) {
    items = items.filter((a) => (a.createdAt ?? '') >= filtros.desde!);
  }
  if (filtros.hasta) {
    const hastaDate = filtros.hasta.slice(0, 10);
    items = items.filter((a) => (a.createdAt ?? '').slice(0, 10) <= hastaDate);
  }
  return items;
}
