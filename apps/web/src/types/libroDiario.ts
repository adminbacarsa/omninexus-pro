/** Cuenta bancaria del Libro Diario */
export interface Banco {
  id?: string;
  nombre: string;
  moneda: 'ARS' | 'USD';
  activa: boolean;
  orden: number;
  createdAt?: string;
  updatedAt?: string;
}

/** Saldo diario por banco y fecha (carga manual) */
export interface SaldoDiario {
  id?: string;
  bancoId: string;
  fecha: string; // YYYY-MM-DD
  saldo: number;
  createdAt?: string;
  updatedAt?: string;
}

/** Tipo de movimiento */
export type TipoMovimiento = 'deposito' | 'pago' | 'transferencia' | 'ajuste' | 'otro';

/** Movimiento del Libro Diario */
export interface Movimiento {
  id?: string;
  bancoId: string;
  fecha: string; // YYYY-MM-DD
  tipo: TipoMovimiento;
  monto: number; // positivo = ingreso, negativo = egreso
  moneda: 'ARS' | 'USD';
  descripcion: string;
  recurrente?: boolean;
  bancoDestinoId?: string; // para transferencias
  referencia?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string | null;
}

/** Plantilla para generar movimientos recurrentes */
export interface PlantillaMovimiento {
  id?: string;
  nombre: string;
  tipo: TipoMovimiento;
  monto: number;
  moneda: 'ARS' | 'USD';
  bancoId: string;
  bancoDestinoId?: string;
  descripcion: string;
  frecuencia?: 'diaria' | 'semanal' | 'mensual';
  activa?: boolean;
  orden?: number;
  createdAt?: string;
  updatedAt?: string;
}

/** Categorías de compromisos (planilla) */
export type CategoriaCompromiso =
  | 'inversores_usd'
  | 'inversores_ars'
  | 'prestamos_bancarios'
  | 'bancos'
  | 'inversiones_bursatiles'
  | 'impositivo'
  | 'gastos_personal'
  | 'otros_egresos'
  | 'com';

/** Compromiso (obligación futura en la planilla) */
export interface Compromiso {
  id?: string;
  concepto: string;
  deuda: number;
  importeAPagar: number;
  cuota: string; // "34 de 67" o "-"
  observacion: string;
  categoria: CategoriaCompromiso;
  moneda: 'ARS' | 'USD';
  mesAnio: string; // "2025-02"
  pagosPorFecha: Record<string, number>; // "2025-02-02" -> 5000
  acumulado?: number;
  diferencia?: number;
  orden?: number;
  activo?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export const CATEGORIAS_COMPROMISO: { value: CategoriaCompromiso; label: string }[] = [
  { value: 'inversores_usd', label: 'Inversores USD' },
  { value: 'inversores_ars', label: 'Inversores ARS' },
  { value: 'prestamos_bancarios', label: 'Préstamos bancarios' },
  { value: 'bancos', label: 'Bancos' },
  { value: 'inversiones_bursatiles', label: 'Inversiones bursátiles' },
  { value: 'impositivo', label: 'Impositivo' },
  { value: 'gastos_personal', label: 'Gastos de personal' },
  { value: 'otros_egresos', label: 'Otros egresos' },
  { value: 'com', label: 'COM' },
];

export const TIPOS_MOVIMIENTO: { value: TipoMovimiento; label: string }[] = [
  { value: 'deposito', label: 'Depósito' },
  { value: 'pago', label: 'Pago' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'ajuste', label: 'Ajuste' },
  { value: 'otro', label: 'Otro' },
];
