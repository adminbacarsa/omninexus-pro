export type TipoInversor = 'persona_fisica' | 'persona_juridica';
export type EstadoInversor = 'activo' | 'inactivo' | 'pendiente_documentacion';

export interface Inversor {
  id?: string;
  nombre: string;
  apellido?: string;
  razonSocial?: string;
  email: string;
  telefono?: string;
  documento?: string; // DNI o CUIT
  tipo: TipoInversor;
  estado: EstadoInversor;
  fechaAlta?: string; // ISO date
  fechaBaja?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
}
