# OmniNexus Pro

Plataforma para **gestión de inversores**, **caja chica** y **flujo de fondos**. Proyecto Firebase nuevo (independiente de Cronoapp).

## Stack

- **Frontend:** Next.js 14 (static export), Tailwind CSS, Firebase client
- **Backend:** Firebase Cloud Functions (Node 20)
- **Base de datos:** Firestore
- **Auth:** Firebase Authentication

## Estructura

```
OmniNexus-Pro/
├── apps/
│   ├── web/           # Next.js app (admin, inversores, caja chica, flujo fondos)
│   └── functions/     # Cloud Functions
├── firebase.json
├── firestore.rules
├── firestore.indexes.json
├── docs/
│   └── ANALISIS_PLATAFORMA.md
└── README.md
```

## Requisitos

- Node.js 20+
- Firebase CLI (`npm install -g firebase-tools`)

## Instalación

```bash
cd d:\APP\OmniNexus-Pro
npm install
```

## Configuración Firebase

1. Crear proyecto en [Firebase Console](https://console.firebase.google.com) (ej. `omninexus-pro`)
2. Actualizar `.firebaserc` con el ID del proyecto
3. Copiar `apps/web/.env.example` a `apps/web/.env.local` y completar las variables de Firebase

## Desarrollo

```bash
# Web (puerto 3003)
npm run dev

# Functions (emuladores)
npm run dev:functions
```

## Deploy

```bash
npm run build
firebase deploy
```

O por partes:
- `firebase deploy --only hosting`
- `firebase deploy --only functions`
- `firebase deploy --only firestore`

## Prioridades de implementación

1. **Inversores** (primero) — CRUD implementado
2. **Caja chica** (segundo)
3. **Flujo de fondos** (tercero)

Ver `docs/ANALISIS_PLATAFORMA.md` para el análisis completo.
