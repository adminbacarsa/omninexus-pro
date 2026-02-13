import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { createPlazoFijo } from './plazoFijoCallable';

if (!admin.apps.length) {
  admin.initializeApp();
}

export const helloOmniNexus = functions.https.onRequest((req, res) => {
  res.json({ message: 'OmniNexus Pro - Inversores · Caja chica · Flujo de fondos' });
});

export { createPlazoFijo };
