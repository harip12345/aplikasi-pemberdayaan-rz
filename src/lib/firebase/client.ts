import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, inMemoryPersistence, setPersistence } from "firebase/auth";

function firebaseConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
}

export function isFirebaseBrowserConfigured() {
  const config = firebaseConfig();
  return Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);
}

export async function createFirebaseBrowserAuth() {
  if (!isFirebaseBrowserConfigured()) throw new Error("Firebase belum dikonfigurasi pada aplikasi.");
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig());
  const auth = getAuth(app);
  await setPersistence(auth, inMemoryPersistence);
  return auth;
}
