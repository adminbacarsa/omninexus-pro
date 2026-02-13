# Análisis del Módulo Caja Chica

Documento de análisis detallado del módulo de caja chica, sus funciones actuales y propuestas de mejora.

---

## 1. Modelo conceptual

El módulo implementa un **sistema de fondo fijo (imprest)**:

- **Caja Central (Nivel 1):** Banco interno que recibe fondos de una cuenta del flujo de fondos y distribuye a sub-cajas.
- **Sub-caja (Nivel 2):** Administrada por un responsable, con tope máximo. Recibe fondos de la central y rinde gastos contra comprobantes.

```
[Cuenta Flujo Fondos] → [Caja Central] → [Sub-cajas]
                           ↓                    ↓
                      Ingresos/Egresos    Rendición → Aprobar → Reponer
```

---

## 2. Funciones actuales

### 2.1 CRUD de cajas

| Función | Descripción |
|---------|-------------|
| `listCajasChica()` | Lista todas las cajas ordenadas por creación |
| `getCajaChica(id)` | Obtiene una caja por ID |
| `createCajaChica(data)` | Crea caja central o sub-caja. Central: saldo inicial, cuenta fondo. Sub: caja padre, responsable, usuario asignado |
| `updateCajaChica(id, data)` | Actualiza nombre, responsable, tope, estado, etc. |
| `deleteCajaChica(id)` | Elimina caja (los movimientos quedan huérfanos) |

**Campos principales:**
- `nombre`, `nivel` (central | sub_caja)
- `cajaPadreId` (sub-caja → caja central)
- `cuentaFondoId` (central → cuenta de flujo de fondos que la fondea)
- `responsableNombre`, `usuarioAsignadoId`
- `montoMaximo`, `moneda`, `saldoActual`, `estado`

### 2.2 Movimientos

| Función | Descripción |
|---------|-------------|
| `listMovimientosCaja(cajaId)` | Lista ingresos y egresos de una caja |
| `createMovimientoCaja(data)` | Crea ingreso o egreso y actualiza saldo automáticamente |
| `deleteMovimientoCaja(id, cajaId)` | Elimina movimiento y revierte el saldo |
| `listMovimientosCajaPorPeriodo(cajas, desde, hasta)` | Movimientos en rango de fechas (para reportes) |

**Tipos de movimiento:**
- **Ingreso:** fondo, reposición, transferencia, otros
- **Egreso:** categorías fijas (Viáticos, Insumos, Oficina, Combustible, Otros)

### 2.3 Transferencias

| Función | Descripción |
|---------|-------------|
| `transferirFondoACaja(centralId, subCajaId, monto, fecha)` | Transfiere de central a sub-caja. Genera egreso en central e ingreso en sub. |

### 2.4 Rendiciones

| Función | Descripción |
|---------|-------------|
| `createRendicion(data)` | Crea rendición pendiente con items (comprobantes: monto, categoría, descripción) |
| `listRendiciones(cajaId?)` | Lista rendiciones (filtrable por caja) |
| `aprobarRendicionYCrearReposicion(rendicionId)` | Registra los egresos rendidos, crea ingreso de reposición, marca rendición como aprobada |

**Flujo de rendición:**
1. Responsable crea rendición con items (comprobantes)
2. Admin aprueba → se crean egresos por cada item + 1 ingreso de reposición por el total

### 2.5 Matriz de control

| Función | Descripción |
|---------|-------------|
| `getMatrizControl(cajas)` | Genera resumen: ubicación, responsable, saldo inicial, entregas/reposiciones, gastos rendidos, saldo actual |
| `listCajasCentrales(cajas)` | Filtra cajas centrales |
| `listSubCajas(cajas, cajaPadreId)` | Filtra sub-cajas de una central |

---

## 3. Permisos

| Acción | Uso |
|--------|-----|
| `ver` | Ver cajas y movimientos |
| `crear` | Crear caja, ingresos/egresos |
| `editar` | Editar caja |
| `eliminar` | Eliminar caja o movimiento |
| `transferir` | Transferir de central a sub-caja |
| `rendicion` | Crear y aprobar rendiciones |

Permisos por caja: `cajasIds` en permisos permite restringir a un usuario a ver solo ciertas cajas.

---

## 4. Integración con otros módulos

| Módulo | Integración actual |
|--------|--------------------|
| **Flujo de fondos** | `cuentaFondoId` en caja central vincula a una cuenta. La UI muestra el selector, pero **no hay flujo automático** (ingresos/egresos de la caja central no se reflejan en la cuenta) |
| **Auditoría** | Todas las operaciones se registran en `audit_log` |
| **Usuarios** | `usuarioAsignadoId` y `addCajaToUserPermisos` para restringir acceso por caja |

---

## 5. Funciones agregadas (Mejoras implementadas)

| Función | Descripción |
|---------|-------------|
| **Integración Flujo Fondos** | Al crear ingreso en Caja Central con `cuentaFondoId`, se debita la cuenta automáticamente (categoría "Fondo a caja central"). Al eliminar el movimiento, se revierte. |
| **Validación tope** | Al transferir de central a sub-caja: valida que no supere `montoMaximo`, misma moneda, saldo suficiente. |
| **Filtro por fecha** | `listMovimientosCaja(cajaId, { desde, hasta })` filtra movimientos por rango. |
| **Cierres de caja** | `createCierreCaja()`, `listCierresCaja()` para registrar saldo al cierre (diario/mensual). Colección `cierres_caja`. |

---

## 6. Gaps y limitaciones identificadas

### 6.1 Cuenta fondo (resuelto)
- ~~La caja central tiene `cuentaFondoId` pero **no hay movimientos bidireccionales**~~ **Implementado:** ingresos en central debitan la cuenta.
- Los ingresos manuales a la central no generan movimiento en la cuenta
- Los egresos de la central no debitan de la cuenta

### 6.2 Rendición sin rechazo
- No existe flujo para **rechazar** una rendición (solo aprobar)
- No hay comentarios de rechazo ni reenvío

### 6.3 Comprobantes sin archivo
- `comprobanteUrl` existe en el modelo pero **no hay subida de archivos** (Storage)
- No se pueden adjuntar tickets/facturas

### 6.4 Validaciones (parcialmente resuelto)
- ~~No se valida que el saldo de sub-caja no supere `montoMaximo` al transferir~~ **Implementado**
- Eliminar caja no valida si tiene movimientos o rendiciones pendientes
- No hay control de moneda al transferir (central ARS → sub USD)

### 6.5 UX/Reportes (parcialmente resuelto)
- ~~No hay filtros por fecha en movimientos~~ **Implementado**
- No hay exportación (Excel/PDF)
- Sin alertas cuando sub-caja está cerca del tope o sin fondos
- Sin historial de quién aprobó cada rendición (solo `aprobadaPor` guardado)

### 6.6 Tope máximo (resuelto)
- ~~`montoMaximo` en sub-caja es informativo~~ **Implementado:** bloquea transferencias que excedan el tope

---

## 7. Propuestas de mejora

### 7.1 Integración flujo de fondos ✅ Implementado

- Al crear **ingreso** en caja central con cuenta vinculada: se debita la cuenta (categoría "Fondo a caja central")
- Al **eliminar** ese ingreso: se revierte con "Devolución caja chica"

### 7.2 Rechazo de rendiciones

- Agregar estado `rechazada` con motivo
- Botón "Rechazar" con campo de comentario
- Notificación al responsable (si hay sistema de notificaciones)

### 7.3 Adjuntar comprobantes

- Usar Firebase Storage para subir imágenes/PDFs
- Mostrar thumbnails en items de rendición
- Campo `comprobanteUrl` ya existe, solo falta la UI y Storage

### 7.4 Validaciones de negocio ✅ Parcialmente implementado

- Al transferir: validar que sub-caja no supere `montoMaximo`
- Al eliminar caja: avisar si tiene movimientos o rendiciones pendientes; opción de "cerrar" en lugar de eliminar
- Validar misma moneda en transferencias central ↔ sub

### 7.5 Alertas y controles

- Alerta cuando sub-caja &lt; 20% del tope
- Alerta cuando hay rendiciones pendientes &gt; X días
- Bloqueo opcional de egresos si supera tope

### 7.6 Filtros y exportación ✅ Filtro implementado

- Filtro de movimientos por rango de fechas
- Exportar matriz de control a Excel
- Exportar movimientos de una caja a CSV/Excel

### 7.7 Categorías personalizables

- Permitir que el admin defina categorías de egreso (hoy están fijas en `CATEGORIAS_EGRESO`)
- Guardar en Firestore o config

### 7.8 Mejoras de trazabilidad

- Mostrar en UI quién aprobó cada rendición y cuándo
- Historial de cambios de saldo por caja
- Vincular movimientos con número de comprobante fiscal (si aplica)

---

## 8. Resumen de prioridades sugeridas

| Prioridad | Mejora | Esfuerzo |
|-----------|--------|----------|
| Alta | Integración caja central ↔ cuenta flujo fondos | Medio |
| Alta | Validar tope al transferir | Bajo |
| Media | Rechazo de rendiciones | Bajo |
| Media | Adjuntar comprobantes (Storage) | Medio |
| Media | Filtros por fecha en movimientos | Bajo |
| Baja | Categorías personalizables | Bajo |
| Baja | Exportación Excel/PDF | Medio |
| Baja | Alertas (tope, rendiciones vencidas) | Medio |

---

## 9. Estructura Firestore actual

```
cajas_chica/
  {id}: CajaChica

movimientos_caja/
  {id}: MovimientoCaja (cajaId, tipo, monto, fecha, categoria, descripcion, rendido, rendicionId)

rendiciones_caja/
  {id}: Rendicion (cajaId, fecha, totalGastado, items[], estado, montoReposicion)

cierres_caja/
  {id}: CierreCaja (cajaId, fecha, tipo, saldoRegistrado, observaciones)
```
