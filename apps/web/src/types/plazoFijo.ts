export type FrecuenciaPago = 'vencimiento' | 'mensual' | 'trimestral' | 'semestral';
export type AplicacionIntereses = 'pagar' | 'capitalizar';
export type TipoInteres = 'simple' | 'compuesto';
export type EstadoPlazoFijo = 'activo' | 'vencido' | 'cerrado' | 'renovado' | 'cancelado';
export type TipoMovimientoPF = 'aporte' | 'retiro_capital' | 'pago_interes' | 'capitalizacion_interes';
export type EstadoFechaPago = 'pendiente' | 'pagado' | 'capitalizado' | 'vencido' | 'omitido';

export interface PlazoFijo {
  id?: string;
  inversorId: string;
  capitalInicial: number;
  capitalActual: number;
  moneda: 'ARS' | 'USD';
  tasaAnual: number;
  tipoInteres: TipoInteres;
  plazoDias: number;
  fechaInicio: string;
  fechaVencimiento: string;
  frecuenciaPago: FrecuenciaPago;
  aplicacionIntereses: AplicacionIntereses;
  renovacionAutomatica: boolean;
  estado: EstadoPlazoFijo;
  observacion?: string;
  cuentaFondoId?: string;
  plazoFijoOrigenId?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
}

export interface MovimientoPlazoFijo {
  id?: string;
  tipo: TipoMovimientoPF;
  fecha: string;
  monto: number;
  moneda: string;
  capitalAnterior: number;
  capitalResultante: number;
  observacion?: string;
  referencia?: string;
  fechaPagoProgramada?: string;
  cuentaFondoId?: string;
  movimientoFondoId?: string;
  createdAt?: string;
  createdBy?: string;
}

export interface FechaPagoPF {
  id?: string;
  fechaProgramada: string;
  interesEstimado: number;
  interesEfectivo?: number;
  estado: EstadoFechaPago;
  fechaPagoEfectiva?: string;
  movimientoId?: string;
  cuentaFondoId?: string;
  observacion?: string;
  createdAt?: string;
  updatedAt?: string;
}
