# Análisis: Plataforma de Inversores, Caja Chica y Flujo de Fondos

Documento de análisis para **OmniNexus Pro** sobre Firebase, orientada a **gestión de inversores**, **caja chica** y **flujo de fondos**.

---

## 1. Objetivos de la plataforma

| Área | Descripción |
|------|-------------|
| **Inversores** | Alta, perfiles, aportes, participación en fondos/proyectos, documentación y reportes por inversor. |
| **Caja chica** | Movimientos de efectivo menor (ingresos/egresos), rendiciones, responsables, límites y conciliación. |
| **Flujo de fondos** | Entradas/salidas de dinero por fuente/destino, categorías, proyecciones y trazabilidad. |

---

## 2. Stack técnico

- **Frontend:** Next.js, Tailwind, React Context/hooks
- **Backend:** Firebase Cloud Functions (Node 20)
- **Base de datos:** Firestore
- **Auth:** Firebase Authentication + Custom Claims (admin, inversor, tesorero, contador)
- **Proyecto Firebase:** Nuevo e independiente de Cronoapp

---

## 3. Modelo de datos (Firestore)

- `inversores`, `aportes`
- `cajas_chica`, `movimientos_caja`
- `cuentas_fondo`, `movimientos_fondo`
- `audit_log`, `system_users`

Ver reglas en `firestore.rules` e índices en `firestore.indexes.json`.

---

## 4. Prioridades de implementación

1. **Inversores** (alta, perfiles, aportes) — primero
2. **Caja chica** (cajas, movimientos, rendiciones) — segundo
3. **Flujo de fondos** (cuentas, movimientos) — tercero
