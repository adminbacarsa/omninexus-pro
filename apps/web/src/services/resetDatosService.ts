import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';
import { getDb } from '@/lib/firebase';
import { logAudit } from './auditService';
import { listCuentasFondo, updateSaldoCuenta } from './flujoFondosService';
import { listCajasChica, updateSaldoCaja } from './cajaChicaService';

const COL_CUENTAS = 'cuentas_fondo';
const COL_CAJAS = 'cajas_chica';
const COL_MOV_FONDO = 'movimientos_fondo';
const COL_MOV_CAJA = 'movimientos_caja';

const BATCH_SIZE = 450; // Firestore limit 500

/**
 * Reset datos: pone saldos en 0 y borra todos los movimientos.
 * Solo para Super Admin. Solo para pruebas.
 */
export async function resetDatos(userId?: string): Promise<void> {
  const db = getDb();

  // 1. Cuentas: saldoActual = 0
  const cuentas = await listCuentasFondo();
  for (const c of cuentas) {
    if (c.id) await updateSaldoCuenta(c.id, 0, userId);
  }

  // 2. Cajas: saldoActual = 0
  const cajas = await listCajasChica();
  for (const c of cajas) {
    if (c.id) await updateSaldoCaja(c.id, 0, userId);
  }

  // 3. Borrar movimientos_fondo (sin revertir saldos, ya están en 0)
  const movFondoSnap = await getDocs(collection(db, COL_MOV_FONDO));
  const idsFondo = movFondoSnap.docs.map((d) => d.id);
  for (let i = 0; i < idsFondo.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    const chunk = idsFondo.slice(i, i + BATCH_SIZE);
    for (const id of chunk) {
      batch.delete(doc(db, COL_MOV_FONDO, id));
    }
    await batch.commit();
  }

  // 4. Borrar movimientos_caja
  const movCajaSnap = await getDocs(collection(db, COL_MOV_CAJA));
  const idsCaja = movCajaSnap.docs.map((d) => d.id);
  for (let i = 0; i < idsCaja.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    const chunk = idsCaja.slice(i, i + BATCH_SIZE);
    for (const id of chunk) {
      batch.delete(doc(db, COL_MOV_CAJA, id));
    }
    await batch.commit();
  }

  await logAudit({
    accion: 'RESET_DATOS',
    modulo: 'usuarios',
    detalle: 'Reset datos: saldos a 0, movimientos borrados (solo pruebas)',
    entidadId: undefined,
    entidadTipo: 'sistema',
    userId,
    metadata: { cuentas: cuentas.length, cajas: cajas.length, movFondo: idsFondo.length, movCaja: idsCaja.length },
  }).catch(() => {});
}
