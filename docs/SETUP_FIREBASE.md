# Configuración de Firebase para OmniNexus-Pro

## 1. Crear proyecto en Firebase

1. Entrá a [Firebase Console](https://console.firebase.google.com/)
2. **Crear proyecto** o elegí uno existente
3. Si creás uno nuevo, anotá el ID del proyecto (ej: `mi-proyecto-123`)

## 2. Obtener credenciales

1. En Firebase Console → tu proyecto
2. **Configuración del proyecto** (ícono engranaje) → **General**
3. Bajo "Tus aplicaciones" → **Agregar app** → **Web** (ícono `</>`)
4. Nombre de la app (ej: "OmniNexus") → Registrar
5. Copiá el objeto `firebaseConfig` que muestra

## 3. Configurar .env.local

En `apps/web/.env.local` completá con los valores de tu proyecto:

```
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=tu-proyecto-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=tu-proyecto.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123...
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

## 4. Vincular Firebase CLI (opcional, para deploy)

```bash
firebase use tu-proyecto-id
```

O editá `.firebaserc` y cambiá `"default"` por tu project ID.

## 5. Habilitar Authentication

1. Firebase Console → **Authentication** → **Get started**
2. Pestaña **Sign-in method** → **Correo electrónico/contraseña** → **Activar**
3. Creá un usuario en **Users** → **Add user** para poder iniciar sesión

## 6. Reiniciar el servidor

```bash
npm run dev
```
