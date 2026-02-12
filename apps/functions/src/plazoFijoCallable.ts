import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import type { PlazoFijoInput, TipoInteres, FrecuenciaPago } from './types';

function getDb() {
  return admin.firestore();
}
const COL_PF = 'plazos_fijo';
const COL_CUENTAS = 'cuentas_fondo';
const COL_MOV = 'movimientos_fondo';
const SUB_FECHAS = 'fechas_pago';

function calcularInteres(
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
  return capital * (Math.pow(1 + tasa, dias / 365) - 1);
}

function agregarDias(fechaStr: string, dias: number): string {
  const d = new Date(fechaStr);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

function diasEntre(fechaInicio: string, fechaFin: string): number {
  const a = new Date(fechaInicio);
  const b = new Date(fechaFin);
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function generarFechasPago(
  fechaInicio: string,
  fechaVencimiento: string,
  frecuencia: FrecuenciaPago,
  capitalInicial: number,
  tasaAnual: number,
  tipoInteres: TipoInteres,
  capitalizar: boolean
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
    const siguiente = new Date(fechaActual);
    siguiente.setMonth(siguiente.getMonth() + intervaloMeses);
    let siguienteStr = siguiente.toISOString().slice(0, 10);
    if (siguienteStr > fechaVencimiento) siguienteStr = fechaVencimiento;
    const dias = diasEntre(fechaActual, siguienteStr);
    const interes = calcularInteres(capitalAcum, tasaAnual, dias, tipoInteres);
    const interesRedondeado = Math.round(interes * 100) / 100;
    fechas.push({ fechaProgramada: siguienteStr, interesEstimado: interesRedondeado });
    if (siguienteStr >= fechaVencimiento) break;
    fechaActual = siguienteStr;
    if (capitalizar) capitalAcum += interesRedondeado;
  }
  return fechas;
}

/**
 * Callable Function: crea un plazo fijo.
 * Si se indica cuentaOrigenId, debita el capital de esa cuenta (operación atómica).
 */
export const createPlazoFijo = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Debés iniciar sesión');
  }

  const { data: payload, cuentaOrigenId } = data as {
    data: PlazoFijoInput;
    cuentaOrigenId?: string;
  };

  if (!payload || !payload.inversorId || payload.capitalInicial <= 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Datos inválidos');
  }

  const capital = payload.capitalInicial;
  const userId = context.auth.uid;

  let movRef: FirebaseFirestore.DocumentReference | null = null;

  if (cuentaOrigenId && capital > 0) {
    const cuentaSnap = await getDb().collection(COL_CUENTAS).doc(cuentaOrigenId).get();
    if (!cuentaSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Cuenta no encontrada');
    }
    const cuenta = cuentaSnap.data() as { saldoActual?: number; moneda?: string };
    const saldo = cuenta?.saldoActual ?? 0;
    if (saldo < capital) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        `Saldo insuficiente. Disponible: ${saldo} ${cuenta?.moneda ?? 'ARS'}`
      );
    }
    if (cuenta?.moneda !== payload.moneda) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        `La moneda de la cuenta no coincide con la del plazo fijo`
      );
    }
  }

  const fechaVenc = agregarDias(payload.fechaInicio, payload.plazoDias);
  const now = new Date().toISOString();

  const batch = getDb().batch();

  // 1. Si hay cuenta origen: crear movimiento de egreso
  if (cuentaOrigenId && capital > 0) {
    movRef = getDb().collection(COL_MOV).doc();
    batch.set(movRef, {
      cuentaOrigenId,
      cuentaDestinoId: null,
      monto: capital,
      moneda: payload.moneda,
      fecha: payload.fechaInicio,
      categoria: 'Inversión plazo fijo',
      descripcion: 'Constitución plazo fijo',
      inversorId: payload.inversorId,
      createdAt: now,
      createdBy: userId,
    });
    const cuentaRef = getDb().collection(COL_CUENTAS).doc(cuentaOrigenId);
    batch.update(cuentaRef, {
      saldoActual: admin.firestore.FieldValue.increment(-capital),
      updatedAt: now,
    });
  }

  // 2. Crear plazo fijo
  const pfRef = getDb().collection(COL_PF).doc();
  batch.set(pfRef, {
    ...payload,
    capitalActual: capital,
    fechaVencimiento: fechaVenc,
    estado: payload.estado ?? 'activo',
    renovacionAutomatica: payload.renovacionAutomatica ?? false,
    createdAt: now,
    updatedAt: now,
    createdBy: userId,
  });

  // 3. Crear fechas de pago
  const fechas = generarFechasPago(
    payload.fechaInicio,
    fechaVenc,
    payload.frecuenciaPago,
    payload.capitalInicial,
    payload.tasaAnual,
    payload.tipoInteres,
    payload.aplicacionIntereses === 'capitalizar'
  );
  const fechasRef = pfRef.collection(SUB_FECHAS);
  for (const f of fechas) {
    const fechaDoc = fechasRef.doc();
    batch.set(fechaDoc, {
      fechaProgramada: f.fechaProgramada,
      interesEstimado: f.interesEstimado,
      estado: 'pendiente',
      createdAt: now,
      updatedAt: now,
    });
  }

  try {
    await batch.commit();
    return { id: pfRef.id };
  } catch (e) {
    if (movRef && cuentaOrigenId && capital > 0) {
      try {
        const revertBatch = getDb().batch();
        revertBatch.delete(movRef);
        const cuentaRef = getDb().collection(COL_CUENTAS).doc(cuentaOrigenId);
        revertBatch.update(cuentaRef, {
          saldoActual: admin.firestore.FieldValue.increment(capital),
          updatedAt: new Date().toISOString(),
        });
        await revertBatch.commit();
      } catch {}
    }
    throw new functions.https.HttpsError('internal', (e as Error).message);
  }
});
