/** Módulos del sistema */
export type Modulo =
  | 'dashboard'
  | 'inversores'
  | 'cuentas'
  | 'plazo_fijo'
  | 'caja_chica'
  | 'flujo_fondos'
  | 'auditoria'
  | 'usuarios';

/** Acciones por módulo */
export type Accion = 'ver' | 'crear' | 'editar' | 'eliminar' | 'pagar_interes' | 'capitalizar' | 'transferir' | 'rendicion';

/** Mapa de acciones por módulo */
export const ACCIONES_POR_MODULO: Record<Modulo, Accion[]> = {
  dashboard: ['ver'],
  inversores: ['ver', 'crear', 'editar', 'eliminar'],
  cuentas: ['ver', 'crear', 'editar', 'eliminar'],
  plazo_fijo: ['ver', 'crear', 'editar', 'eliminar', 'pagar_interes', 'capitalizar'],
  caja_chica: ['ver', 'crear', 'editar', 'eliminar', 'transferir', 'rendicion'],
  flujo_fondos: ['ver', 'crear', 'editar', 'eliminar'],
  auditoria: ['ver'],
  usuarios: ['ver', 'crear', 'editar', 'eliminar'],
};

/** Labels para mostrar en UI */
export const MODULO_LABELS: Record<Modulo, string> = {
  dashboard: 'Dashboard',
  inversores: 'Inversores',
  cuentas: 'Cuentas',
  plazo_fijo: 'Plazos fijo',
  caja_chica: 'Caja chica',
  flujo_fondos: 'Flujo de fondos',
  auditoria: 'Auditoría',
  usuarios: 'Usuarios del sistema',
};

export const ACCION_LABELS: Record<Accion, string> = {
  ver: 'Ver',
  crear: 'Crear',
  editar: 'Editar',
  eliminar: 'Eliminar',
  pagar_interes: 'Pagar interés',
  capitalizar: 'Capitalizar',
  transferir: 'Transferir / Asignar',
  rendicion: 'Rendiciones',
};

/** Roles predefinidos. super_admin = acceso total a todo el sistema. */
export type Rol = 'super_admin' | 'administrador' | 'administrativo' | 'custom';

export const ROL_LABELS: Record<Rol, string> = {
  super_admin: 'Super Admin',
  administrador: 'Administrador',
  administrativo: 'Administrativo',
  custom: 'Personalizado',
};

export const ROLES: Rol[] = ['super_admin', 'administrador', 'administrativo', 'custom'];

/** Permisos: módulo -> acción -> permitido. Para caja_chica puede incluir cajasIds (cajas específicas que puede ver) */
export type PermisosMap = Partial<
  Record<Modulo, Partial<Record<Accion, boolean>> & { cajasIds?: string[] }>
>;

/** Usuario del sistema con rol y permisos */
export interface SystemUser {
  id?: string;
  uid: string;
  email: string;
  displayName?: string;
  rol: Rol;
  permisos?: PermisosMap; // Para custom o override
  activo?: boolean; // false = pendiente de activación por Super Admin
  createdAt?: string;
  updatedAt?: string;
}

/** Permisos predefinidos por rol. super_admin y administrador = todo. */
export const PERMISOS_POR_ROL: Record<Rol, PermisosMap> = {
  super_admin: {}, // Vacío = todo permitido
  administrador: {}, // Vacío = todo permitido
  administrativo: {
    dashboard: { ver: true },
    inversores: { ver: true },
    cuentas: { ver: true },
    caja_chica: { ver: true },
  },
  custom: {},
};
