export type TipoMovimientoCaja = 'ingreso' | 'egreso';
export type EstadoCaja = 'activa' | 'cerrada';
export type NivelCaja = 'central' | 'sub_caja';
export type TipoIngresoCaja = 'fondo' | 'reposicion' | 'transferencia' | 'otros';

/** Caja Central (Nivel 1) = banco interno. Sub-Caja (Nivel 2) = administrada por responsable con techo */
export interface CajaChica {
  id?: string;
  nombre: string;
  nivel?: NivelCaja; // Default 'sub_caja' si no existe (retrocompat)
  cajaPadreId?: string; // Para sub-cajas: desde qué caja central recibe fondos
  /** Para Caja Central: cuenta (flujo de fondos) que la fondea */
  cuentaFondoId?: string;
  responsableId?: string;
  responsableNombre?: string;
  /** UID del usuario del sistema que puede ver y manejar esta caja (solo sub-cajas) */
  usuarioAsignadoId?: string;
  montoMaximo: number; // Tope / techo (sub-caja) o referencia (central)
  moneda: string;
  saldoInicial?: number;
  saldoActual: number;
  estado: EstadoCaja;
  createdAt?: string;
  updatedAt?: string;
}

export interface MovimientoCaja {
  id?: string;
  cajaId: string;
  tipo: TipoMovimientoCaja;
  tipoIngreso?: TipoIngresoCaja; // Solo para ingreso: fondo, reposicion, transferencia
  monto: number;
  moneda: string;
  fecha: string;
  categoria: string;
  descripcion?: string;
  comprobanteUrl?: string;
  rendido: boolean;
  rendicionId?: string;
  /** ID del movimiento en flujo de fondos (cuando ingreso en central proviene de cuenta) */
  movimientoFondoId?: string;
  /** Para compra USD: vincula egreso ARS e ingreso USD */
  operacionCambioId?: string;
  /** Cotización usada en compra/venta USD (ARS por 1 USD) */
  cotizacionUsada?: number;
  createdBy?: string;
  createdAt?: string;
}

/** Comprobante individual dentro de una rendición */
export interface ItemRendicion {
  monto: number;
  categoria: string;
  descripcion?: string;
  comprobanteUrl?: string;
}

/** Rendición: el responsable trae comprobantes, se aprueba y se repone */
export interface Rendicion {
  id?: string;
  cajaId: string;
  responsableNombre?: string;
  fecha: string;
  totalGastado: number;
  items: ItemRendicion[]; // Gastos con comprobantes
  estado: 'pendiente' | 'aprobada' | 'rechazada';
  montoReposicion: number; // Debe = totalGastado para restaurar fondo fijo
  aprobadaPor?: string;
  aprobadaAt?: string;
  createdAt?: string;
}

/** Fila para matriz de control de saldos */
export interface FilaMatrizControl {
  id: string;
  ubicacion: string;
  responsable: string;
  nivel: NivelCaja;
  saldoInicial: number;
  entregasReposiciones: number;
  gastosRendidos: number;
  saldoActual: number;
  moneda: string;
}

/** Cierre de caja: saldo registrado al final de un período (diario/mensual) */
export interface CierreCaja {
  id?: string;
  cajaId: string;
  fecha: string;        // Fecha del cierre (YYYY-MM-DD)
  tipo?: 'diario' | 'mensual';
  saldoRegistrado: number;
  observaciones?: string;
  createdBy?: string;
  createdAt?: string;
}

export const CATEGORIAS_EGRESO = [
  'Viáticos',
  'Insumos',
  'Oficina',
  'Combustible',
  'Otros',
];
