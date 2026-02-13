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
import { createMovimientoFondo } from './flujoFondosService';
import { getCuentaFondo } from './flujoFondosService';
import type { CajaChica, MovimientoCaja, Rendicion, FilaMatrizControl, CierreCaja } from '@/types/cajaChica';

const COL_CAJAS = 'cajas_chica';
const COL_MOV = 'movimientos_caja';
const COL_RENDICIONES = 'rendiciones_caja';
const COL_CIERRES = 'cierres_caja';

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

export async function listMovimientosCaja(
  cajaId: string,
  filtros?: { desde?: string; hasta?: string }
): Promise<MovimientoCaja[]> {
  const q = query(
    collection(getDb(), COL_MOV),
    where('cajaId', '==', cajaId)
  );
  const snap = await getDocs(q);
  let items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as MovimientoCaja));
  if (filtros?.desde) items = items.filter((m) => m.fecha >= filtros.desde!);
  if (filtros?.hasta) items = items.filter((m) => m.fecha <= filtros.hasta!);
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
    const movs = await listMovimientosCaja(c.id, { desde, hasta });
    all.push(...movs);
  }
  return all.sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? ''));
}

export async function createMovimientoCaja(
  data: Omit<MovimientoCaja, 'id' | 'rendido'>,
  userId?: string
): Promise<string> {
  const caja = await getCajaChica(data.cajaId);

  // Integración Flujo Fondos: ingreso en Caja Central con cuenta asociada
  if (
    caja &&
    (caja.nivel ?? 'sub_caja') === 'central' &&
    data.tipo === 'ingreso' &&
    caja.cuentaFondoId
  ) {
    const cuenta = await getCuentaFondo(caja.cuentaFondoId);
    if (!cuenta) throw new Error('Cuenta de fondo no encontrada');
    if ((cuenta.saldoActual ?? 0) < data.monto) {
      throw new Error(`Saldo insuficiente en la cuenta ${cuenta.nombre}. Disponible: ${(cuenta.saldoActual ?? 0).toLocaleString('es-AR')}`);
    }
  }

  let movimientoFondoId: string | undefined;
  if (
    caja &&
    (caja.nivel ?? 'sub_caja') === 'central' &&
    data.tipo === 'ingreso' &&
    caja.cuentaFondoId
  ) {
    movimientoFondoId = await createMovimientoFondo(
      {
        cuentaOrigenId: caja.cuentaFondoId,
        cuentaDestinoId: null,
        monto: data.monto,
        moneda: data.moneda ?? 'ARS',
        fecha: data.fecha ?? new Date().toISOString().slice(0, 10),
        categoria: 'Fondo a caja central',
        descripcion: data.descripcion || `Fondo a caja chica: ${caja.nombre}`,
        cajaId: data.cajaId,
      },
      userId
    );
  }

  const ref = collection(getDb(), COL_MOV);
  const now = new Date().toISOString();
  const payload = sanitize({
    ...data,
    rendido: false,
    movimientoFondoId: movimientoFondoId,
    createdAt: now,
    createdBy: userId ?? null,
  });
  const docRef = await addDoc(ref, payload);

  try {
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
  } catch (err) {
    if (movimientoFondoId && caja?.cuentaFondoId) {
      await createMovimientoFondo(
        {
          cuentaOrigenId: null,
          cuentaDestinoId: caja.cuentaFondoId,
          monto: data.monto,
          moneda: data.moneda ?? 'ARS',
          fecha: data.fecha ?? now.slice(0, 10),
          categoria: 'Devolución caja chica',
          descripcion: `Reversión por error en movimiento caja`,
        },
        userId
      ).catch(() => {});
    }
    await deleteDoc(docRef);
    throw err;
  }
}

export async function deleteMovimientoCaja(id: string, cajaId: string, userId?: string): Promise<void> {
  const movRef = doc(getDb(), COL_MOV, id);
  const movSnap = await getDoc(movRef);
  if (movSnap.exists()) {
    const data = movSnap.data() as MovimientoCaja;

    // Si es parte de compra USD, eliminar primero el movimiento par (sin recursion para evitar loop)
    if (data.operacionCambioId) {
      const par = await getMovimientoParOperacionCambio(id, data.operacionCambioId);
      if (par) {
        const movParRef = doc(getDb(), COL_MOV, par.id);
        const parSnap = await getDoc(movParRef);
        if (parSnap.exists()) {
          const parData = parSnap.data() as MovimientoCaja;
          const cajaPar = await getCajaChica(par.cajaId);
          const deltaPar = parData.tipo === 'ingreso' ? -parData.monto : parData.monto;
          if (cajaPar) await updateSaldoCaja(par.cajaId, (cajaPar.saldoActual ?? 0) + deltaPar, userId);
          await deleteDoc(movParRef);
          await logAudit({
            accion: 'ELIMINAR',
            modulo: 'caja_chica',
            detalle: `Eliminación movimiento par compra USD ${par.id}`,
            entidadId: par.id,
            entidadTipo: 'movimiento_caja',
            userId,
          }).catch(() => {});
        }
      }
    }

    const caja = await getCajaChica(cajaId);

    if (data.movimientoFondoId && caja?.cuentaFondoId) {
      await createMovimientoFondo(
          {
            cuentaOrigenId: null,
            cuentaDestinoId: caja.cuentaFondoId,
            monto: data.monto,
            moneda: data.moneda ?? 'ARS',
            fecha: data.fecha ?? new Date().toISOString().slice(0, 10),
            categoria: 'Devolución caja chica',
            descripcion: `Reversión movimiento caja ${id}`,
            referencia: id,
          },
          userId
        );
    }

    const delta = data.tipo === 'ingreso' ? -data.monto : data.monto;
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

  const monedaCentral = central.moneda ?? 'ARS';
  const monedaSub = sub.moneda ?? 'ARS';
  if (monedaCentral !== monedaSub) {
    throw new Error(`Monedas distintas: Central ${monedaCentral} vs Sub-caja ${monedaSub}`);
  }

  const topeSub = sub.montoMaximo ?? 0;
  const saldoActualSub = sub.saldoActual ?? 0;
  if (topeSub > 0 && saldoActualSub + monto > topeSub) {
    throw new Error(
      `La sub-caja superaría su tope. Saldo actual: ${saldoActualSub.toLocaleString('es-AR')}, tope: ${topeSub.toLocaleString('es-AR')}. Máximo a transferir: ${(topeSub - saldoActualSub).toLocaleString('es-AR')}`
    );
  }

  const moneda = monedaCentral;
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

// --- Compra USD entre cajas (egreso ARS + ingreso USD automáticos, con cotización) ---

export async function comprarUSDCajaChica(
  params: {
    cajaArsId: string;
    cajaUsdId: string;
    montoPesos: number;
    cotizacion: number;  // ARS por 1 USD
    fecha: string;
    descripcion?: string;
  },
  userId?: string
): Promise<{ idEgreso: string; idIngreso: string }> {
  if (params.montoPesos <= 0) throw new Error('El monto en pesos debe ser mayor a 0');
  if (params.cotizacion <= 0) throw new Error('La cotización debe ser mayor a 0');

  const cajaArs = await getCajaChica(params.cajaArsId);
  const cajaUsd = await getCajaChica(params.cajaUsdId);
  if (!cajaArs || !cajaUsd) throw new Error('Caja no encontrada');
  if ((cajaArs.moneda ?? 'ARS') !== 'ARS') throw new Error('La caja origen debe ser en pesos');
  if ((cajaUsd.moneda ?? '') !== 'USD') throw new Error('La caja destino debe ser en dólares');

  const saldoArs = cajaArs.saldoActual ?? 0;
  if (saldoArs < params.montoPesos) {
    throw new Error(
      `Saldo insuficiente en ${cajaArs.nombre}. Disponible: ${saldoArs.toLocaleString('es-AR')} ARS`
    );
  }

  const montoUsd = Math.round((params.montoPesos / params.cotizacion) * 100) / 100;
  if (montoUsd <= 0) throw new Error('El monto resultante en USD es demasiado pequeño');

  const operacionCambioId = `compra_usd_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const desc = params.descripcion || `Compra USD: ${params.montoPesos.toLocaleString('es-AR')} ARS → ${montoUsd.toLocaleString('es-AR')} USD (cot. ${params.cotizacion})`;

  let idEgreso: string;
  try {
    idEgreso = await createMovimientoCaja(
      {
        cajaId: params.cajaArsId,
        tipo: 'egreso',
        monto: params.montoPesos,
        moneda: 'ARS',
        fecha: params.fecha,
        categoria: 'Compra USD',
        descripcion: desc,
        operacionCambioId,
        cotizacionUsada: params.cotizacion,
      },
      userId
    );
  } catch (err) {
    throw err;
  }

  try {
    const idIngreso = await createMovimientoCaja(
      {
        cajaId: params.cajaUsdId,
        tipo: 'ingreso',
        tipoIngreso: 'otros',
        monto: montoUsd,
        moneda: 'USD',
        fecha: params.fecha,
        categoria: 'Ingreso por compra USD',
        descripcion: desc,
        operacionCambioId,
        cotizacionUsada: params.cotizacion,
      },
      userId
    );
    return { idEgreso, idIngreso };
  } catch (err) {
    await deleteMovimientoCaja(idEgreso, params.cajaArsId, userId);
    throw err;
  }
}

/** Busca el movimiento par (el otro de la operación compra USD) excluyendo el id dado */
export async function getMovimientoParOperacionCambio(excluirMovId: string, operacionCambioId: string): Promise<{ id: string; cajaId: string } | null> {
  const q = query(
    collection(getDb(), COL_MOV),
    where('operacionCambioId', '==', operacionCambioId)
  );
  const snap = await getDocs(q);
  for (const d of snap.docs) {
    if (d.id !== excluirMovId) return { id: d.id, cajaId: (d.data() as MovimientoCaja).cajaId };
  }
  return null;
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

// --- Cierres de caja ---

export async function createCierreCaja(
  data: Omit<CierreCaja, 'id' | 'createdAt'>,
  userId?: string
): Promise<string> {
  const ref = collection(getDb(), COL_CIERRES);
  const now = new Date().toISOString();
  const payload = sanitize({
    ...data,
    createdAt: now,
    createdBy: userId ?? null,
  });
  const docRef = await addDoc(ref, payload);
  await logAudit({
    accion: 'CREAR',
    modulo: 'caja_chica',
    detalle: `Cierre de caja: ${data.fecha} - Saldo ${(data.saldoRegistrado ?? 0).toLocaleString('es-AR')} (${data.tipo ?? 'diario'})`,
    entidadId: docRef.id,
    entidadTipo: 'cierre_caja',
    userId,
    metadata: { cajaId: data.cajaId, fecha: data.fecha, saldo: data.saldoRegistrado },
  }).catch(() => {});
  return docRef.id;
}

export async function listCierresCaja(cajaId: string): Promise<CierreCaja[]> {
  try {
    const q = query(
      collection(getDb(), COL_CIERRES),
      where('cajaId', '==', cajaId),
      orderBy('fecha', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as CierreCaja));
  } catch {
    const snap = await getDocs(collection(getDb(), COL_CIERRES));
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as CierreCaja))
      .filter((c) => c.cajaId === cajaId)
      .sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? ''));
  }
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
