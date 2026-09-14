import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

export function isFirebaseAdminConfigured() {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID?.trim()
    && process.env.FIREBASE_CLIENT_EMAIL?.trim()
    && process.env.FIREBASE_PRIVATE_KEY?.trim(),
  );
}

function firebaseAdminApp() {
  if (getApps().length) return getApp();
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) throw new Error("Firebase Admin belum dikonfigurasi.");
  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId });
}

export function firebaseAdminAuth() {
  return getAuth(firebaseAdminApp());
}

export function firebaseAdminDb() {
  return getFirestore(firebaseAdminApp());
}
