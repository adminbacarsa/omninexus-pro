# Análisis: Módulo Plazo Fijo

Módulo para gestionar **depósitos a plazo fijo** por inversor, con cálculo de intereses, fechas de pago, aportes y retiros.

---

## 1. Objetivo

Permitir registrar inversiones tipo plazo fijo que incluyan:
- Saldo inicial con moneda (ARS/USD) y observación
- Cálculo de intereses (simple/compuesto)
- **Plazos largos** (ej. 12 meses) con pago de intereses mensuales
- Intereses **pagados** o **capitalizados** (sumados al capital)
- Fechas de pago programadas (los intereses pueden o no ser pagados en cada fecha)
- **Cuenta del cliente** donde se registran/guardan los intereses pagados
- **Renovación automática** con capitalización de intereses
- Pagos realizados que descuentan del capital
- Aportes adicionales que aumentan el capital
- Estado y trazabilidad completa

---

## 2. Funcionalidades requeridas

### 2.1 Alta / Apertura del plazo fijo

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| Inversor | ref | Sí | Vinculado a `inversores/{id}` |
| Capital inicial | number | Sí | Monto en la moneda definida |
| Moneda | enum | Sí | ARS \| USD |
| Tasa anual | number | Sí | Ej: 45 (% nominal anual) |
| Tipo de interés | enum | Sí | simple \| compuesto |
| Plazo (días) | number | Sí | 30, 60, 90, 180, 365, etc. |
| Fecha de inicio | date | Sí | Fecha de constitución |
| Fecha de vencimiento | date | Calculada | inicio + plazo días |
| Frecuencia de pago | enum | Sí | vencimiento \| mensual \| trimestral \| semestral |
| Aplicación intereses | enum | Sí | pagar \| capitalizar (ver 2.6) |
| Renovación automática | boolean | No | Si true, al vencimiento renueva con capital + intereses (default: false) |
| Observación | string | No | Nota libre (ej: "Renovación PF #123") |
| Cuenta del cliente | ref | Sí* | `cuentas_fondo/{id}` donde se acreditan intereses pagados y retiros. *Obligatorio si aplicación = pagar |

### 2.2 Cálculo de intereses

**Interés simple:**
```
Interés = Capital × (Tasa/100) × (Días/365)
```

**Interés compuesto:**
```
Interés = Capital × [(1 + Tasa/100)^(Días/365) - 1]
```

**Consideraciones:**
- Capital variable: al agregar aportes o pagos, el capital cambia → recalcular proyecciones
- Períodos parciales: si hay pago mensual, calcular por fracción de mes

### 2.3 Fechas de pago (plazos largos)

Soporta **plazos largos** (ej. 12 meses) con pago de intereses **mensuales**:

| Frecuencia | Ejemplo (12 meses) |
|------------|--------------------|
| Al vencimiento | Un solo pago al final (mes 12) |
| Mensual | 12 pagos, uno por mes (día aniversario o 1er día) |
| Trimestral | 4 pagos (meses 3, 6, 9, 12) |
| Semestral | 2 pagos (meses 6 y 12) |

Los intereses en cada fecha **pueden o no ser pagados**:
- Si se pagan → se acreditan en la **cuenta del cliente** (ver 2.3.1)
- Si no se pagan → pueden quedar como **pendientes** o **capitalizarse** según configuración

Cada fecha de pago tiene:
- Fecha programada
- Monto de interés estimado
- Estado: pendiente | pagado | capitalizado | vencido | omitido
- Fecha efectiva (si se pagó o capitalizó)
- Referencia (transferencia, cheque, etc.)
- Vinculación a cuenta del cliente (si aplica)

#### 2.3.1 Cuenta del cliente

Los intereses **pagados** se deben **guardar** en la cuenta del inversor:
- Cada PF puede tener asignada una `cuentaFondoId` (cuenta del cliente para ese inversor/moneda)
- Al registrar un pago de interés → crear movimiento en flujo fondos (entrada en esa cuenta)
- Alternativa: subcolección `cuenta_inversor` o campo en inversor con saldo acumulado de intereses

### 2.4 Movimientos que afectan el capital

**Aportes (aumentan el capital):**
- Fecha
- Monto
- Moneda (debe coincidir con el PF)
- Observación
- Capital resultante después del aporte

**Pagos / retiros (reducen el capital):**
- Fecha
- Monto
- Motivo: pago_interes | retiro_parcial | retiro_total | otro
- Observación
- Capital resultante después del pago

**Regla:** El capital actual = capital inicial + Σ aportes + Σ intereses capitalizados - Σ retiros de capital  
*(Los pagos de interés no reducen el capital; la capitalización lo aumenta)*

### 2.5 Aplicación de intereses: pagar vs capitalizar

| Modo | Comportamiento |
|------|----------------|
| **Pagar** | El interés se paga al inversor y se **acredita en su cuenta** (cuenta del cliente). No aumenta el capital del PF. Cada pago genera un movimiento en flujo fondos. |
| **Capitalizar** | El interés se **suma al capital** del PF. No hay salida de efectivo; el nuevo capital genera más intereses (efecto compuesto). |

En un mismo PF se puede elegir:
- **Siempre pagar** → intereses mensuales van a la cuenta del cliente
- **Siempre capitalizar** → intereses se suman al capital (típico para renovación automática)
- **Híbrido** (futuro): en cada fecha de pago decidir si pagar o capitalizar

### 2.6 Renovación automática

Cuando `renovacionAutomatica = true` y el PF vence:
1. Calcular intereses generados hasta vencimiento
2. **Capitalizar** intereses (sumarlos al capital)
3. Crear nuevo PF con:
   - Capital = capital anterior + intereses capitalizados
   - Misma tasa, plazo y frecuencia (o configurables)
   - Fecha inicio = fecha de vencimiento del anterior
   - Referencia al PF anterior
4. Cerrar el PF anterior (estado = 'renovado')
5. Notificación/auditoría de la renovación

### 2.8 Estados del plazo fijo

| Estado | Descripción |
|--------|-------------|
| activo | Vigente, generando intereses |
| vencido | Pasó la fecha de vencimiento sin renovar/retirar |
| cerrado | Retiro total o cierre explícito |
| renovado | Cerrado por renovación automática; existe PF sucesor |
| cancelado | Cancelación anticipada (si se admite) |

---

## 3. Modelo de datos propuesto (Firestore)

### 3.1 Colección `plazos_fijo`

```typescript
interface PlazoFijo {
  id?: string;
  inversorId: string;
  capitalInicial: number;
  capitalActual: number;       // capitalInicial + aportes + intereses capitalizados - retiros
  moneda: 'ARS' | 'USD';
  tasaAnual: number;           // % nominal anual
  tipoInteres: 'simple' | 'compuesto';
  plazoDias: number;
  fechaInicio: string;         // ISO date
  fechaVencimiento: string;    // ISO date
  frecuenciaPago: 'vencimiento' | 'mensual' | 'trimestral' | 'semestral';
  aplicacionIntereses: 'pagar' | 'capitalizar';  // pagar → cuenta cliente; capitalizar → suma a capital
  renovacionAutomatica: boolean;  // al vencimiento, renueva con capital + intereses
  estado: 'activo' | 'vencido' | 'cerrado' | 'renovado' | 'cancelado';
  observacion?: string;
  cuentaFondoId?: string;      // cuenta del cliente; obligatoria si aplicacionIntereses = 'pagar'
  plazoFijoOrigenId?: string;  // si fue renovación automática
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
}
```

### 3.2 Subcolección `plazos_fijo/{id}/movimientos`

```typescript
type TipoMovimientoPF = 'aporte' | 'retiro_capital' | 'pago_interes' | 'capitalizacion_interes';

interface MovimientoPlazoFijo {
  id?: string;
  tipo: TipoMovimientoPF;
  fecha: string;
  monto: number;
  moneda: string;
  capitalAnterior: number;
  capitalResultante: number;
  observacion?: string;
  referencia?: string;          // Nº transferencia (pago_interes), etc.
  fechaPagoProgramada?: string; // para pago_interes y capitalizacion_interes
  cuentaFondoId?: string;       // cuenta donde se acreditó (solo pago_interes)
  movimientoFondoId?: string;   // ref a movimientos_fondo (si se acreditó en flujo fondos)
  createdAt?: string;
  createdBy?: string;
}
```

### 3.3 Subcolección `plazos_fijo/{id}/fechas_pago`

```typescript
interface FechaPagoPF {
  id?: string;
  fechaProgramada: string;
  interesEstimado: number;
  interesEfectivo?: number;     // puede diferir por redondeo
  estado: 'pendiente' | 'pagado' | 'capitalizado' | 'vencido' | 'omitido';
  fechaPagoEfectiva?: string;   // cuando se pagó o capitalizó
  movimientoId?: string;        // ref al movimiento (pago_interes o capitalizacion_interes)
  cuentaFondoId?: string;       // cuenta del cliente donde se acreditó (solo si pagado)
  observacion?: string;
  createdAt?: string;
  updatedAt?: string;
}
```

**Alternativa más simple:** Guardar fechas de pago como array en el mismo doc `plazos_fijo`, o calcularlas on-the-fly según frecuencia.

---

## 4. Flujos principales

### 4.1 Crear plazo fijo

1. Usuario selecciona inversor
2. Ingresa capital, tasa, plazo, frecuencia, observación
3. Sistema calcula fecha vencimiento y genera fechas de pago (si aplica)
4. Crea doc en `plazos_fijo` y subcolecciones

### 4.2 Registrar aporte

1. Usuario selecciona PF activo
2. Ingresa monto y observación
3. Sistema crea movimiento tipo `aporte`
4. Actualiza `capitalActual` del PF

### 4.3 Registrar pago de interés (intereses pagados)

1. Usuario marca una fecha de pago como **pagada**
2. Ingresa monto efectivo (puede diferir por redondeo), referencia
3. Sistema crea movimiento tipo `pago_interes`
4. **Acredita en cuenta del cliente** → crea entrada en `movimientos_fondo` (cuenta destino del inversor)
5. Actualiza estado de la fecha de pago a 'pagado'
6. Los intereses **quedan guardados** en la cuenta del cliente (rastreables)

### 4.4 Capitalizar interés (intereses no pagados)

1. Usuario marca una fecha de pago como **capitalizada**
2. Sistema calcula interés correspondiente al período
3. Crea movimiento tipo `capitalizacion_interes`
4. Actualiza `capitalActual` del PF (capital += interés)
5. Actualiza estado de la fecha de pago a 'capitalizado'
6. Los próximos intereses se calculan sobre el nuevo capital (efecto compuesto)

**Nota:** Los intereses pueden **o no** ser pagados en cada fecha: pendientes hasta que se paguen o capitalicen.

### 4.5 Renovación automática (al vencimiento)

1. Job/cron o proceso manual detecta PF con `renovacionAutomatica=true` y `fechaVencimiento` alcanzada
2. Calcular intereses del último período (o total si frecuencia = vencimiento)
3. Capitalizar intereses → nuevo capital = capitalActual + intereses
4. Crear nuevo PF:
   - `capitalInicial` = `capitalActual` del anterior + intereses
   - `plazoFijoOrigenId` = id del PF anterior
   - Misma tasa, plazo, frecuencia, aplicación intereses
5. Cerrar PF anterior con estado = 'renovado'

### 4.6 Registrar retiro parcial/total

1. Usuario selecciona PF e indica retiro
2. Sistema valida que monto ≤ capitalActual
3. Crea movimiento tipo `retiro_capital`
4. Actualiza capitalActual
5. Si retiro total → estado = 'cerrado'

### 4.7 Proyección de intereses

Función que calcula intereses a generar entre dos fechas:

```typescript
function calcularInteres(
  capital: number,
  tasaAnual: number,
  dias: number,
  tipo: 'simple' | 'compuesto'
): number
```

---

## 5. Índices Firestore necesarios

```json
{
  "collectionGroup": "plazos_fijo",
  "fields": [
    { "fieldPath": "inversorId", "order": "ASCENDING" },
    { "fieldPath": "fechaInicio", "order": "DESCENDING" }
  ]
},
{
  "collectionGroup": "plazos_fijo",
  "fields": [
    { "fieldPath": "estado", "order": "ASCENDING" },
    { "fieldPath": "fechaVencimiento", "order": "ASCENDING" }
  ]
}
```

---

## 6. Integración con módulos existentes

- **Inversores:** Cada PF pertenece a un inversor.
- **Flujo de fondos / Cuenta del cliente:** Los intereses **pagados** se acreditan en `cuentas_fondo` (cuenta del cliente). Cada pago genera un `movimiento_fondo` de entrada con categoría "Interés plazo fijo". Los aportes/retiros pueden reflejar movimientos entre cuenta e inversor.
- **Auditoría:** Registrar en `audit_log` las operaciones relevantes.

---

## 7. Prioridades de implementación

1. **Fase 1 – Core**
   - Tipos e interfaces
   - CRUD plazo fijo (alta, listado por inversor)
   - Cálculo de intereses (simple/compuesto)
   - Fecha de vencimiento automática

2. **Fase 2 – Movimientos**
   - Aportes adicionales
   - Retiros (parcial/total)
   - Actualización de capital actual

3. **Fase 3 – Fechas de pago y aplicación de intereses**
   - Generación automática según frecuencia (mensual, trimestral, etc.)
   - Pagar intereses → acreditar en cuenta del cliente
   - Capitalizar intereses → sumar al capital
   - Estados pendiente/pagado/capitalizado/vencido
   - Guardar intereses en cuenta del cliente (flujo fondos)

4. **Fase 4 – Renovación automática**
   - Proceso/job que detecta PF vencidos con renovación automática
   - Capitalización de intereses pendientes
   - Creación del nuevo PF con capital + intereses
   - Cierre del PF anterior (estado renovado)

5. **Fase 5 – Integración y reportes**
   - Vinculación con cuentas de flujo de fondos
   - Reportes por inversor
   - Exportación / resumen

---

## 8. Consideraciones adicionales

- **Pluralidad de monedas:** Validar que aportes/retiros usen la misma moneda del PF.
- **Fechas de pago en días hábiles:** Opcional; versión inicial puede usar fechas calendario.
- **Cancelación anticipada:** Definir si se permite y cómo afecta los intereses (ej. tasa penalizada).
- **Renovación automática:** Implementada; al vencimiento crea nuevo PF con capital + intereses.
- **Cuenta del cliente:** Cada inversor puede tener una o más cuentas; los PF con `pagar` deben tener `cuentaFondoId` para acreditar intereses.
- **Impuestos / retenciones:** Campo de observación o futuro módulo contable.
