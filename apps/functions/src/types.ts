// Tipos compartidos para las Cloud Functions (alineados con el frontend)

export type FrecuenciaPago = 'vencimiento' | 'mensual' | 'trimestral' | 'semestral';
export type AplicacionIntereses = 'pagar' | 'capitalizar';
export type TipoInteres = 'simple' | 'compuesto';

export interface PlazoFijoInput {
  inversorId: string;
  capitalInicial: number;
  moneda: 'ARS' | 'USD';
  tasaAnual: number;
  tipoInteres: TipoInteres;
  plazoDias: number;
  fechaInicio: string;
  frecuenciaPago: FrecuenciaPago;
  aplicacionIntereses: AplicacionIntereses;
  renovacionAutomatica: boolean;
  cuentaFondoId?: string;
  observacion?: string;
  estado?: string;
}

export interface CreatePlazoFijoRequest {
  data: PlazoFijoInput;
  cuentaOrigenId?: string;
}
