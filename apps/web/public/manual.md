# Manual de Usuario — OmniNexus Pro

Plataforma integral para gestión de inversores, plazos fijos, caja chica y flujo de fondos.

---

## Índice

1. [Introducción](#1-introducción)
2. [Acceso e inicio de sesión](#2-acceso-e-inicio-de-sesión)
3. [Dashboard](#3-dashboard)
4. [Inversores](#4-inversores)
5. [Plazos fijos](#5-plazos-fijos)
6. [Caja chica](#6-caja-chica)
7. [Flujo de fondos](#7-flujo-de-fondos)
8. [Auditoría](#8-auditoría)
9. [Usuarios y permisos](#9-usuarios-y-permisos)
10. [Apéndice: Cálculos y fórmulas](#10-apéndice-cálculos-y-fórmulas)

---

## 1. Introducción

OmniNexus Pro permite:

- **Inversores**: Gestionar personas físicas y jurídicas que invierten en la empresa.
- **Plazos fijos**: Constituir depósitos a plazo, calcular intereses (simple/compuesto), programar pagos y renovaciones.
- **Caja chica**: Administrar fondos fijos centrales y sub-cajas con rendiciones.
- **Flujo de fondos**: Cuentas bancarias, movimientos (entradas/salidas/transferencias), KPIs y proyecciones por moneda (ARS/USD).
- **Auditoría**: Registro de acciones relevantes en el sistema.
- **Usuarios**: Roles y permisos por módulo.

---

## 2. Acceso e inicio de sesión

1. Abrí la URL de la aplicación.
2. Ingresá tu **email** y **contraseña**.
3. Opcionalmente, podés iniciar sesión con **Google**.
4. Si las credenciales son correctas, serás redirigido al Dashboard.

Los permisos que tengas configurados determinan qué módulos ves en el menú lateral.

---

## 3. Dashboard

El Dashboard muestra un resumen general:

- Acceso rápido a Inversores, Plazos fijos, Caja chica y Flujo de fondos.
- Enlaces directos al **flujo de fondos** con la cuenta del inversor preseleccionada (cuando se navega desde el perfil del inversor).
- KPIs principales según el rol y permisos.

---

## 4. Inversores

### 4.1 Alta de inversor

1. Ir a **Inversores** → **Nuevo inversor**.
2. Completar:
   - **Tipo**: Persona física o Persona jurídica.
   - **Nombre**, **Apellido** (persona física) o **Razón social** (jurídica).
   - **Documento** (DNI/CUIT).
   - **Email**, **Teléfono**.
   - **Moneda preferida** (ARS o USD).
3. Guardar.

### 4.2 Dashboard del inversor

Desde la lista de inversores, al hacer clic en uno se abre su **dashboard**:

- Sus cuentas de fondo.
- Sus plazos fijos activos.
- Acceso directo al flujo de fondos de sus cuentas.

---

## 5. Plazos fijos

### 5.1 Crear un plazo fijo

1. Ir a **Plazos fijo** → **Nuevo plazo fijo**.
2. Completar:
   - **Inversor**: Seleccionar de la lista.
   - **Capital inicial**: Monto en la moneda elegida.
   - **Moneda**: ARS o USD.
   - **Tasa anual**: Por ejemplo 45 para 45% anual.
   - **Tipo de interés**: Simple o Compuesto (ver [Apéndice](#101-cálculo-de-intereses-plazo-fijo)).
   - **Plazo (días)**: 30, 60, 90, 180, 365, 730, etc.
   - **Fecha de inicio**: Día de constitución.
   - **Fecha de vencimiento**: Se calcula automáticamente o puede ingresarse manualmente.
   - **Frecuencia de pago**: Al vencimiento, Mensual, Trimestral o Semestral.
   - **Aplicación de intereses**: Pagar (acredita en cuenta del cliente) o Capitalizar (suma al capital).
   - **Cuenta del cliente**: Obligatoria si elegís "Pagar" — cuenta donde se acreditan los intereses.
   - **Cuenta de origen**: Cuenta desde la cual sale el capital (debe tener saldo suficiente).

### 5.2 Fechas de pago

El sistema genera **fechas de pago programadas** según la frecuencia:

| Frecuencia   | Ejemplo (12 meses)                        |
|--------------|-------------------------------------------|
| Al vencimiento | Un solo pago al final                     |
| Mensual      | 12 pagos, uno por mes                     |
| Trimestral   | 4 pagos (meses 3, 6, 9, 12)              |
| Semestral    | 2 pagos (meses 6 y 12)                    |

En cada fecha podés:
- **Pagar interés**: El monto se acredita en la cuenta del cliente y se registra en flujo de fondos.
- **Capitalizar**: El interés se suma al capital del PF (no hay salida de efectivo).

### 5.3 Aportes y retiros

- **Aporte**: Aumenta el capital del PF. Se registra con fecha, monto y observación.
- **Retiro de capital**: Reduce el capital. Puede ser parcial o total (cierra el PF).

### 5.4 Renovación automática

Si marcás **Renovación automática** al crear el PF:

1. Al vencimiento, los intereses se **capitalizan**.
2. Se crea un nuevo PF con capital = capital anterior + intereses.
3. El PF anterior pasa a estado "renovado".

### 5.5 Estados del plazo fijo

| Estado    | Descripción                                   |
|-----------|-----------------------------------------------|
| Activo    | Vigente, generando intereses                   |
| Vencido   | Pasó la fecha de vencimiento sin renovar      |
| Cerrado   | Retiro total o cierre explícito               |
| Renovado  | Cerrado por renovación automática             |
| Cancelado | Cancelación anticipada                        |

---

## 6. Caja chica

### 6.1 Estructura

- **Caja Central**: Fondo principal, se fondea desde una cuenta de flujo de fondos.
- **Sub-caja**: Tiene un techo (monto máximo) y un responsable. Recibe fondos desde la caja central.
- **Usuario asignado**: Para sub-cajas, solo el usuario asignado puede ver y operar esa caja (según permisos).

### 6.2 Movimientos

- **Ingreso**: Fondo, reposición, transferencia desde otra caja.
- **Egreso**: Gasto de la caja (categorías: Viáticos, Insumos, Oficina, Combustible, Otros).

### 6.3 Rendición

Cuando el responsable gasta de la sub-caja:

1. Registra los **egresos** con comprobantes.
2. El sistema agrupa en una **rendición**.
3. Si la rendición se aprueba, se repone el monto gastado a la sub-caja (desde la caja central).
4. Los gastos quedan marcados como **rendidos**.

---

## 7. Flujo de fondos

### 7.1 Cuentas

Las cuentas representan bancos, efectivo o fondos de inversión:

- **Nombre**, **Tipo** (banco, efectivo, fondo de inversión), **Moneda** (ARS/USD).
- **Saldo inicial**: Histórico (preexistente) o Nuevo (aporte actual al período).
- **Inversor** (opcional): Si se asigna, la cuenta aparece en el dashboard del inversor.
- **Caja Central** (opcional): Vincula la cuenta con una caja que se fondea desde ella.

### 7.2 Movimientos

- **Entrada (+)** : Cobranzas, aportes, intereses PF, etc. — acredita en la cuenta destino.
- **Salida (-)** : Proveedores, sueldos, impuestos, etc. — descuenta de la cuenta origen.
- **Transferencia** : Entre cuentas (origen → destino).

### 7.3 Operaciones de cambio (ARS ↔ USD)

- **Compra USD**: ARS sale de una cuenta, USD entra a otra.
- **Venta USD**: USD sale de una cuenta, ARS entra a otra.

### 7.4 Período y timeline

El selector de **período** afecta:

- KPIs (saldos, ingresos, egresos).
- Tabla de flujo del período.
- **Timeline horizontal** del flujo en el tiempo, con granularidad según período:

| Período   | Granularidad del timeline     |
|-----------|-------------------------------|
| Hoy       | Un solo punto (total del día) |
| Semana    | Por día (Lun, Mar, etc.)      |
| Mes       | Por día                       |
| Trimestre | Por semana                    |
| Semestre / Año | Por mes               |

### 7.5 Categorías de flujo

**Ingresos:**
- Cobranza clientes
- Aporte inversor
- Interés plazo fijo
- Ingreso por compra/venta divisas
- Otros ingresos

**Egresos operativos:**
- Proveedores / Mercadería
- Sueldos y alquiler
- Impuestos y servicios
- Otros operativos

**Sub-cajas:**
- Rendición sub-caja (Ventas, Logística, Otros)
- Fondo a sub-caja

**Financiero:**
- Interés pagado a inversores
- Retiro inversor
- Pago de capital a inversores
- Compra/Venta de divisas
- Transferencia entre cuentas
- Otros

---

## 8. Auditoría

El módulo de **Auditoría** registra:

- Acciones relevantes (crear, actualizar, eliminar).
- Módulo afectado.
- Usuario y fecha.
- Detalle y metadata.

Solo usuarios con permiso de ver auditoría pueden acceder a este registro.

---

## 9. Usuarios y permisos

### 9.1 Roles

| Rol           | Descripción                                      |
|---------------|--------------------------------------------------|
| Super Admin   | Acceso total al sistema                          |
| Administrador | Acceso total                                     |
| Administrativo| Dashboard, Inversores (ver), Caja chica (ver)    |
| Personalizado | Permisos definidos manualmente por módulo        |

### 9.2 Acciones por módulo

Cada módulo puede tener:

- **Ver**, **Crear**, **Editar**, **Eliminar**.
- **Plazo fijo**: Pagar interés, Capitalizar.
- **Caja chica**: Transferir, Rendiciones; además, para sub-cajas se puede restringir por **cajas específicas** que el usuario pueda ver.

### 9.3 Gestión de usuarios

En **Usuarios** (solo para super admin / administrador):

- Lista de usuarios del sistema.
- Asignar rol.
- Definir permisos personalizados para rol "Personalizado".
- Vincular con usuarios de Firebase Authentication.

---

## 10. Apéndice: Cálculos y fórmulas

### 10.1 Cálculo de intereses (Plazo fijo)

#### Interés simple

El interés se calcula linealmente sobre el capital:

```
Interés = Capital × (Tasa / 100) × (Días / 365)
```

**Ejemplo:** Capital = 1.000.000 ARS, Tasa = 45% anual, 90 días:

```
Interés = 1.000.000 × 0,45 × (90/365) = 110.958,90
```

#### Interés compuesto

El interés se capitaliza periódicamente:

```
Interés = Capital × [(1 + Tasa/100)^(Días/365) - 1]
```

**Ejemplo:** Capital = 1.000.000 ARS, Tasa = 45% anual, 90 días:

```
Interés = 1.000.000 × [(1 + 0,45)^(90/365) - 1] = 1.000.000 × 0,0954... ≈ 95.400
```

Para plazos con **pagos fraccionados** (mensual, trimestral, semestral):

- En cada período se calcula el interés sobre el capital vigente.
- Si **capitalizar** = true, el interés se suma al capital para el siguiente período.
- Si **capitalizar** = false, el capital se mantiene y los intereses se calculan siempre sobre el capital inicial (o el capital después de aportes/retiros).

### 10.2 Días entre fechas

Se usa convención de días naturales:

```
Días = (FechaFin - FechaInicio) en milisegundos / (24 × 60 × 60 × 1000)
```

Redondeado al entero más cercano.

### 10.3 Flujo neto

```
Flujo neto = Saldo inicial + Ingresos - Egresos operativos - Rendiciones sub-caja - Egresos financieros
```

Por moneda (ARS y USD se mantienen separados en reportes).

### 10.4 Fechas de pago programadas

Para frecuencias mensual, trimestral o semestral:

1. Desde la fecha de inicio, se avanza en intervalos (1, 3 o 6 meses).
2. En cada intervalo se calcula el interés con `diasEntre(fechaActual, siguienteFecha)`.
3. El capital para el siguiente período es:
   - El anterior + interés, si se capitaliza.
   - El anterior, si se paga (interés no capitaliza).

---

## Glosario

| Término       | Definición                                                                 |
|---------------|-----------------------------------------------------------------------------|
| Capitalizar   | Sumar el interés al capital del PF; no hay salida de efectivo              |
| Cuenta fondo  | Cuenta bancaria o similar en flujo de fondos                               |
| Fondo fijo    | Monto máximo asignado a una caja (techo)                                    |
| Rendición     | Presentación de comprobantes de gastos para reponer la sub-caja            |
| Sub-caja      | Caja con techo y responsable, fondeada desde la caja central               |
| Tasa anual    | Porcentaje nominal anual (ej. 45 = 45% anual)                              |

---

*Manual actualizado para OmniNexus Pro. Para soporte técnico, contactar al administrador del sistema.*
