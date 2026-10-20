import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where
} from "firebase/firestore";
import type { AppNotification } from "@resolvex/types";
import { auth, db, isFirebaseConfigured } from "../firebase";
import { cleanFirestorePayload } from "../utils/firestore-clean";
import { reactiveStore } from "./data-store";

export function subscribeNotifications(
  userId: string,
  callback: (notifications: AppNotification[]) => void
): () => void {
  // Guard against invalid/empty user IDs
  if (!userId || typeof userId !== "string" || !userId.trim()) {
    callback([]);
    return () => {};
  }

  const cleanUserId = userId.trim();

  if (!isFirebaseConfigured || typeof window === "undefined") {
    return reactiveStore.subscribe<AppNotification[]>("notifications", (all) => {
      const userNotifs = all
        .filter((n) => n.userId === cleanUserId || !n.userId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callback(userNotifs);
    });
  }

  let isUnsubscribed = false;
  let firestoreUnsub: (() => void) | null = null;

  const attachListener = () => {
    if (isUnsubscribed || firestoreUnsub) return;
    try {
      const notifsCol = collection(db, "notifications");
      const q = query(notifsCol, where("userId", "==", cleanUserId));
      firestoreUnsub = onSnapshot(
        q,
        (snapshot) => {
          if (isUnsubscribed) return;
          const list: AppNotification[] = [];
          snapshot.forEach((snap) => {
            list.push({ id: snap.id, ...snap.data() } as AppNotification);
          });
          list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          callback(list);
        },
        (err) => {
          console.warn("Firestore notifications listener error:", err);
        }
      );
    } catch (e) {
      console.warn("Could not attach Firestore notifications listener:", e);
    }
  };

  if (auth.currentUser && auth.currentUser.uid === cleanUserId) {
    attachListener();
  }

  const authUnsub = onAuthStateChanged(auth, (user) => {
    if (isUnsubscribed) return;
    if (user && user.uid === cleanUserId) {
      if (!firestoreUnsub) attachListener();
    } else {
      if (firestoreUnsub) {
        try { firestoreUnsub(); } catch {}
        firestoreUnsub = null;
      }
      callback([]);
    }
  });

  return () => {
    isUnsubscribed = true;
    try { authUnsub(); } catch {}
    if (firestoreUnsub) {
      try { firestoreUnsub(); } catch {}
      firestoreUnsub = null;
    }
  };
}

export async function markAsRead(notificationId: string): Promise<void> {
  if (isFirebaseConfigured && auth.currentUser) {
    try {
      await updateDoc(doc(db, "notifications", notificationId), { read: true });
    } catch (e) {
      console.warn("Firestore markAsRead error:", e);
    }
  }
  reactiveStore.updateDoc("notifications", notificationId, { read: true });
}

export async function markAllAsRead(userId: string): Promise<void> {
  const all = reactiveStore.getCollection<AppNotification>("notifications");
  for (const n of all) {
    if (n.userId === userId && !n.read) {
      if (isFirebaseConfigured && auth.currentUser && auth.currentUser.uid === userId) {
        try {
          await updateDoc(doc(db, "notifications", n.id), { read: true });
        } catch (e) {
          console.warn("Firestore markAllAsRead item error:", e);
        }
      }
      reactiveStore.updateDoc("notifications", n.id, { read: true });
    }
  }
}

export async function createNotification(
  data: Omit<AppNotification, "id" | "read" | "createdAt"> & {
    societyId?: string;
    recipientUserId?: string;
    message?: string;
    relatedEntityId?: string;
  }
): Promise<AppNotification> {
  const id = `notif-${Date.now()}`;
  const now = new Date().toISOString();
  const notif: AppNotification = {
    id,
    userId: data.userId || data.recipientUserId || "user",
    societyId: data.societyId || "soc-ajanta-genx",
    category: data.category,
    title: data.title,
    body: data.body || data.message || "",
    read: false,
    createdAt: now
  };

  if (isFirebaseConfigured && auth.currentUser) {
    try {
      await setDoc(doc(db, "notifications", id), cleanFirestorePayload({
        ...notif,
        recipientUserId: notif.userId,
        message: notif.body,
        relatedEntityId: data.relatedEntityId || null
      }));
    } catch (e) {
      console.warn("Firestore createNotification error:", e);
    }
  }

  reactiveStore.setDoc("notifications", notif);
  return notif;
}
