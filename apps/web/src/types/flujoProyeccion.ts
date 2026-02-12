/** Escenario de proyección de flujo de fondos */
export type EscenarioFlujo = 'BASE' | 'OPTIMISTA' | 'ESTRES';

/** Fila mensual en la tabla de flujo */
export interface FilaMensualFlujo {
  año: number;
  mes: number;
  mesLabel: string;
  saldoInicial: number;
  facturado: number;
  cobrado: number;
  egresosRRHH: number;
  egresosOperativo: number;
  egresosImpuestos: number;
  egresosFinanciero: number;
  egresosTotal: number;
  neto: number;
  saldoFinal: number;
  acumulado: number;
}

/** Filtros para la vista de flujo */
export interface FiltrosFlujoProyeccion {
  clienteId?: string;
  contratoId?: string;
  desde?: string;
  hasta?: string;
  escenario: EscenarioFlujo;
}

/** KPIs agregados del período */
export interface KPIsFlujoProyeccion {
  saldoInicial: number;
  facturado: number;
  cobrado: number;
  egresosRRHH: number;
  egresosOperativo: number;
  egresosImpuestos: number;
  egresosFinanciero: number;
  egresosTotal: number;
  neto: number;
  saldoFinal: number;
}

/** Alerta del módulo */
export interface AlertaFlujo {
  tipo: 'caja_negativa' | 'cobranza_vencida' | 'desvio_margen';
  mensaje: string;
  severidad: 'alta' | 'media' | 'baja';
  detalle?: string;
}

/** Contrato (opcional para filtro) */
export interface Contrato {
  id?: string;
  clienteId: string;
  nombre: string;
  fechaInicio: string;
  fechaFin?: string;
  montoMensual?: number;
  estado: 'activo' | 'finalizado' | 'pendiente';
  createdAt?: string;
  updatedAt?: string;
}
