# Análisis: Módulo Libro Diario

Documento de análisis para agregar el módulo **Libro Diario** a OmniNexus Pro.

---

## 1. Características principales

- **Módulo independiente**: No se conecta con Inversores, Caja Chica ni Flujo de Fondos. Funciona por sí solo.
- **Planilla de compromisos**: Componente central del módulo.
- **Cuentas de banco**: El usuario define bancos donde carga saldos diarios.
- **Movimientos diarios**: Depósitos, pagos, transferencias entre cuentas, etc. Muchos son **fijos/recurrentes**.
- **Saldo por banco**: Resultado de los movimientos cargados.

---

## 2. Modelo de datos propuesto

### 2.1 Cuentas de banco (bancos del Libro Diario)
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | string | Auto |
| nombre | string | Ej: "Galicia", "Santander" |
| moneda | string | ARS, USD |
| activa | boolean | Si está en uso |
| orden | number | Para ordenar en la planilla |

### 2.2 Saldos diarios (por banco, por fecha)
| Campo | Tipo | Descripción |
|-------|------|-------------|
| bancoId | string | Referencia al banco |
| fecha | string | YYYY-MM-DD |
| saldo | number | Saldo del día |

**Decisión:** El usuario ingresa los saldos manualmente cada día.

### 2.3 Movimientos
| Campo | Tipo | Descripción |
|-------|------|-------------|
| bancoId | string | Banco afectado |
| fecha | string | YYYY-MM-DD |
| tipo | string | deposito \| pago \| transferencia \| etc. |
| monto | number | Positivo = ingreso, negativo = egreso |
| moneda | string | ARS, USD |
| descripcion | string | Concepto |
| recurrente | boolean | Si es movimiento fijo (se repite) |
| bancoDestinoId? | string | Para transferencias |
| referencia | string | Nº comprobante, etc. |

### 2.4 Planilla de compromisos (obligaciones futuras)

Estructura extraída de `COMPROMISOS 09 a 12-2025.xlsx`:

| Campo | Descripción | Ejemplo |
|-------|-------------|---------|
| **concepto** | Nombre del compromiso | "Aiasa Jose Antonio", "Leasing Ranger 29301" |
| **deuda** | Deuda total pendiente | 146771 (USD) |
| **importeAPagar** | Importe a pagar (cuota fija) | 5000 (USD) |
| **cuota** | Info cuota (ej: "34 de 67", "13/14 de 20") | "34 de 67" o "-" |
| **observacion** | Tipo y notas (Mutuo, Acuerdo, Pagare, Debito X, etc.) | "Mutuo - 0,75%", "Debito Julio" |
| **categoria** | Grupo del compromiso | Ver abajo |
| **moneda** | ARS o USD | "USD" |
| **pagosPorFecha** | Map fecha → monto (montos programados por día del mes) | { "2025-02-02": 5000 } |
| **acumulado** | Total acumulado del período | 311247 |
| **diferencia** | Diferencia (planificado vs real) | -256649 |

**Categorías detectadas:**
- INVERSORES DOLARES | INVERSORES PESOS
- PRESTAMOS BANCARIOS
- BANCOS (cheques, tarjetas, débitos automáticos)
- INVERSIONES BURSATILES
- IMPOSITIVO (DDJJ, IVA, planes AFIP)
- GASTOS DE PERSONAL (sueldos, obra social, embargos)
- OTROS EGRESOS
- COM (comisiones, fees)

### 2.5 Plantillas de movimientos (recurrentes)
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | string | Auto |
| nombre | string | Ej: "Sueldo empleado X" |
| tipo | string | deposito \| pago \| transferencia |
| monto | number | Monto fijo |
| moneda | string | ARS, USD |
| bancoId | string | Banco afectado |
| bancoDestinoId? | string | Para transferencias |
| descripcion | string | Concepto |
| frecuencia? | string | diaria \| semanal \| mensual (para generar automático) |

**Decisión:** El usuario puede crear plantillas y luego usarlas para generar movimientos rápidamente.

---

## 3. Decisiones tomadas

| Tema | Decisión |
|------|----------|
| **Saldos** | Carga manual diaria por banco |
| **Planilla de compromisos** | Obligaciones futuras. Estructura según planilla a proporcionar |
| **Movimientos recurrentes** | Crear plantillas que se pueden usar para generar movimientos |
| **Transferencias** | Dos movimientos separados: egreso en banco origen, ingreso en banco destino |

---

## 4. Propuesta de estructura de pantalla

1. **Listado de bancos** – ABM de cuentas bancarias.
2. **Carga de saldos** – Por fecha, por banco (o cálculo automático).
3. **Movimientos** – Tabla con filtros (fecha, banco, tipo). Alta/baja/edición.
4. **Planilla de compromisos** – Vista principal (definir estructura).
5. **Resumen** – Saldo por banco, totales.

---

## 5. Colecciones Firestore sugeridas

- `libro_diario_bancos` – Cuentas bancarias.
- `libro_diario_saldos` – Saldos por banco y fecha (carga manual diaria).
- `libro_diario_movimientos` – Movimientos diarios (depósitos, pagos, transferencias).
- `libro_diario_plantillas` – Plantillas de movimientos para generar rápidamente.
- `libro_diario_compromisos` – Planilla de obligaciones futuras.

---

## 6. Modelo Firestore para compromisos

```ts
interface Compromiso {
  id?: string;
  concepto: string;
  deuda: number;
  importeAPagar: number;
  cuota: string;           // "34 de 67" o "-"
  observacion: string;     // Tipo + forma de pago (Debito Julio, etc.)
  categoria: string;       // inversores_usd | prestamos | bancos | etc.
  moneda: 'ARS' | 'USD';
  mesAnio: string;         // "2025-02" para filtrar por período
  pagosPorFecha: Record<string, number>;  // "2025-02-02" -> 5000
  acumulado?: number;
  diferencia?: number;
  orden?: number;
  activo?: boolean;
  createdAt?: string;
  updatedAt?: string;
}
```

La vista principal replicará la planilla: filas = compromisos agrupados por categoría, columnas = fechas del mes + Acumulado + Diferencia.

---

## 7. Próximos pasos

1. Confirmar si este modelo refleja bien la planilla.
2. Implementar el módulo Libro Diario completo.
