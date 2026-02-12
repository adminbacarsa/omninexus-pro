export type TipoCuenta = 'banco' | 'efectivo' | 'fondo_inversion';
export type SaldoInicialTipo = 'historico' | 'nuevo';

export interface CuentaFondo {
  id?: string;
  nombre: string;
  tipo: TipoCuenta;
  moneda: string;
  saldoInicial?: number;
  saldoActual: number;
  /** 'historico' = saldo preexistente (no ingreso del período); 'nuevo' = capital que entra ahora */
  saldoInicialTipo?: SaldoInicialTipo;
  activa: boolean;
  inversorId?: string;  // Cuenta del inversor; si está vacío es cuenta general
  /** Caja central asociada (la que se fondea con esta cuenta) */
  cajaCentralId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface MovimientoFondo {
  id?: string;
  cuentaOrigenId?: string | null;
  cuentaDestinoId?: string | null;
  monto: number;
  moneda: string;
  fecha: string;
  categoria: string;
  descripcion?: string;
  referencia?: string;
  /** Para operaciones de cambio: vincula egreso e ingreso (ej. compra USD) */
  operacionCambioId?: string;
  inversorId?: string;
  cajaId?: string;
  createdBy?: string;
  createdAt?: string;
}

/** Categorías agrupadas por tipo de flujo (para entrada intuitiva) */
export const CATEGORIAS_INGRESO = [
  'Cobranza clientes',
  'Aporte inversor',
  'Interés plazo fijo',
  'Ingreso por compra divisas',   // USD que entra al comprar
  'Ingreso por venta divisas',   // ARS que entra al vender USD
  'Otros ingresos',
];

export const CATEGORIAS_EGRESO_OPERATIVO = [
  'Proveedores / Mercadería',
  'Sueldos y alquiler',
  'Impuestos y servicios',
  'Otros operativos',
];

export const CATEGORIAS_EGRESO_SUBCAJA = [
  'Rendición sub-caja (Ventas)',
  'Rendición sub-caja (Logística)',
  'Rendición sub-caja (Otros)',
  'Fondo a sub-caja',
];

export const CATEGORIAS_EGRESO_FINANCIERO = [
  'Interés pagado a inversores',
  'Retiro inversor',
  'Pago de capital a inversores',
  'Colocación a unidades de negocio',
  'Inversión plazo fijo',         // retrocompat
  'Compra de divisas',             // ARS que sale al comprar USD
  'Venta de divisas',             // USD que sale al vender
  'Transferencia entre cuentas',
  'Otros',
];

/** Todas las categorías en una lista plana (para select) */
export const CATEGORIAS_MOVIMIENTO = [
  ...CATEGORIAS_INGRESO,
  ...CATEGORIAS_EGRESO_OPERATIVO,
  ...CATEGORIAS_EGRESO_SUBCAJA,
  ...CATEGORIAS_EGRESO_FINANCIERO,
];

/** Mapeo de categoría a tipo de egreso para proyección */
export const CATEGORIA_A_EGRESO: Record<string, 'RRHH' | 'Operativo' | 'Impuestos' | 'Financiero'> = {
  'Sueldos y alquiler': 'RRHH',
  'Proveedores / Mercadería': 'Operativo',
  'Impuestos y servicios': 'Impuestos',
  'Rendición sub-caja (Ventas)': 'Operativo',
  'Rendición sub-caja (Logística)': 'Operativo',
  'Rendición sub-caja (Otros)': 'Operativo',
  'Fondo a sub-caja': 'Operativo',
  'Interés pagado a inversores': 'Financiero',
  'Retiro inversor': 'Financiero',
  'Pago de capital a inversores': 'Financiero',
  'Colocación a unidades de negocio': 'Operativo',
  'Inversión plazo fijo': 'Financiero',
  'Compra de divisas': 'Financiero',
  'Venta de divisas': 'Financiero',
  'Transferencia entre cuentas': 'Financiero',
  Otros: 'Operativo',
  'Otros operativos': 'Operativo',
  'Otros ingresos': 'Operativo',
};
