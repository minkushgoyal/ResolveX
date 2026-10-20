import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  initializeAuth,
  // @ts-ignore - getReactNativePersistence is exported by Firebase Auth for React Native at runtime
  getReactNativePersistence,
  type Auth
} from "firebase/auth";
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";
import { getFirestore, type Firestore } from "firebase/firestore";

const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
const authDomain = process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN;
const messagingSenderId = process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
const appId = process.env.EXPO_PUBLIC_FIREBASE_APP_ID;

export const isFirebaseConfigured = Boolean(
  apiKey &&
  apiKey.trim().length > 0 &&
  projectId &&
  projectId.trim().length > 0 &&
  apiKey !== "your-api-key" &&
  apiKey !== "demo-api-key" &&
  projectId !== "resolvex-demo"
);

export function getFirebaseConfigError(): string | null {
  if (isFirebaseConfigured) return null;
  const missing: string[] = [];
  if (!apiKey || apiKey === "your-api-key" || apiKey === "demo-api-key") missing.push("EXPO_PUBLIC_FIREBASE_API_KEY");
  if (!projectId || projectId === "resolvex-demo") missing.push("EXPO_PUBLIC_FIREBASE_PROJECT_ID");
  if (!appId) missing.push("EXPO_PUBLIC_FIREBASE_APP_ID");
  return `Firebase configuration is incomplete. Missing or invalid variables: ${missing.join(", ")}. Please configure apps/mobile/.env with live Firebase project credentials.`;
}

const firebaseConfig = {
  apiKey: apiKey || "unconfigured-api-key",
  authDomain: authDomain || `${projectId || "unconfigured"}.firebaseapp.com`,
  projectId: projectId || "unconfigured",
  messagingSenderId: messagingSenderId || "000000000000",
  appId: appId || "1:000000000000:mobile:unconfigured"
};

export const firebaseApp: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

let authInstance: Auth;
try {
  authInstance = initializeAuth(firebaseApp, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage)
  });
} catch {
  authInstance = getAuth(firebaseApp);
}

export const auth: Auth = authInstance;
export const db: Firestore = getFirestore(firebaseApp);
