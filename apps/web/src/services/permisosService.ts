import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  query,
  orderBy,
} from 'firebase/firestore';
import { getDb } from '@/lib/firebase';
import type { SystemUser, PermisosMap, Rol } from '@/types/permisos';
import { PERMISOS_POR_ROL } from '@/types/permisos';

const COL = 'system_users';

function sanitize<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as Record<string, unknown>;
}

export async function getSystemUser(uid: string): Promise<SystemUser | null> {
  const q = query(collection(getDb(), COL), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  const doc = snap.docs.find((d) => (d.data() as SystemUser).uid === uid);
  if (!doc) return null;
  return { id: doc.id, ...doc.data() } as SystemUser;
}

export async function getSystemUserByDocId(id: string): Promise<SystemUser | null> {
  const ref = doc(getDb(), COL, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as SystemUser;
}

/** Lista usuarios del sistema (por uid para evitar duplicados) */
export async function listSystemUsers(): Promise<SystemUser[]> {
  const q = query(collection(getDb(), COL), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  const seen = new Set<string>();
  const users: SystemUser[] = [];
  for (const d of snap.docs) {
    const u = { id: d.id, ...d.data() } as SystemUser;
    if (u.uid && !seen.has(u.uid)) {
      seen.add(u.uid);
      users.push(u);
    }
  }
  return users;
}

export async function createOrUpdateSystemUser(
  uid: string,
  data: { email: string; displayName?: string; rol: Rol; permisos?: PermisosMap; activo?: boolean },
  userId?: string
): Promise<string> {
  const existing = await getSystemUser(uid);
  const now = new Date().toISOString();

  if (existing?.id) {
    await updateDoc(doc(getDb(), COL, existing.id), sanitize({
      email: data.email,
      displayName: data.displayName,
      rol: data.rol,
      permisos: data.permisos,
      activo: data.activo,
      updatedAt: now,
      updatedBy: userId ?? null,
    }));
    return existing.id;
  }

  const users = await listSystemUsers();
  const isFirstUser = users.length === 0;
  const activo = isFirstUser ? true : (data.activo !== undefined ? data.activo : false);
  const rol = isFirstUser ? 'super_admin' : (data.rol ?? 'custom');

  const ref = collection(getDb(), COL);
  const docRef = await addDoc(ref, sanitize({
    uid,
    email: data.email,
    displayName: data.displayName,
    rol,
    permisos: data.permisos ?? {},
    activo,
    createdAt: now,
    updatedAt: now,
    createdBy: userId ?? null,
  }));
  return docRef.id;
}

export async function updateSystemUser(
  id: string,
  data: Partial<Pick<SystemUser, 'rol' | 'permisos' | 'email' | 'displayName' | 'activo'>>,
  userId?: string
): Promise<void> {
  const ref = doc(getDb(), COL, id);
  await updateDoc(ref, sanitize({
    ...data,
    updatedAt: new Date().toISOString(),
    updatedBy: userId ?? null,
  }));
}

/** Resuelve permisos efectivos: rol + override custom */
export function resolvePermisos(user: SystemUser | null): PermisosMap {
  if (!user) return {};

  const base = PERMISOS_POR_ROL[user.rol] ?? {};
  const override = user.permisos ?? {};

  if (user.rol === 'super_admin' || user.rol === 'administrador') {
    return {}; // Vacío = todo
  }

  const merged: PermisosMap = {};
  for (const mod of Object.keys(base) as (keyof PermisosMap)[]) {
    merged[mod] = { ...base[mod], ...override[mod] };
  }
  for (const mod of Object.keys(override) as (keyof PermisosMap)[]) {
    if (!merged[mod]) merged[mod] = override[mod];
  }
  return merged;
}

/** super_admin y administrador tienen acceso total a todo */
function tieneAccesoTotal(user: SystemUser | null): boolean {
  return !!user && (user.rol === 'super_admin' || user.rol === 'administrador');
}

/** Verifica si el usuario tiene permiso. super_admin y administrador = siempre true. Usuario inactivo = nunca. */
export function hasPermiso(
  user: SystemUser | null,
  modulo: keyof PermisosMap,
  accion: string
): boolean {
  if (!user || user.activo === false) return false;
  if (tieneAccesoTotal(user)) return true;

  const permisos = resolvePermisos(user);
  const modPermisos = permisos[modulo];
  if (!modPermisos) return false;
  return modPermisos[accion as keyof typeof modPermisos] === true;
}

/** Agrega una caja a los permisos de un usuario (para que pueda verla) */
export async function addCajaToUserPermisos(uid: string, cajaId: string, userId?: string): Promise<void> {
  const su = await getSystemUser(uid);
  if (!su?.id) return;
  const perm = (su.permisos ?? {}) as PermisosMap;
  const cc = (perm.caja_chica ?? {}) as Record<string, unknown>;
  const ids = (cc.cajasIds as string[] | undefined) ?? [];
  if (ids.includes(cajaId)) return;
  await updateSystemUser(su.id, {
    permisos: {
      ...perm,
      caja_chica: { ...cc, cajasIds: [...ids, cajaId], ver: true },
    },
  }, userId);
}

/** Cajas chica que el usuario puede ver. null = todas, [] = ninguna, string[] = solo esas.
 * super_admin y administrador siempre ven todas (null). Usuario inactivo = ninguna. */
export function getCajasChicaPermitidas(user: SystemUser | null): string[] | null {
  if (!user || user.activo === false) return [];
  if (tieneAccesoTotal(user)) return null;
  const permisos = resolvePermisos(user);
  const cc = permisos.caja_chica as { cajasIds?: string[] } | undefined;
  if (!cc?.cajasIds) return null; // Sin restricción = todas
  return cc.cajasIds;
}
