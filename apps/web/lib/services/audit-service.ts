import { addDoc, collection, limit, onSnapshot, query, serverTimestamp, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import type { AuditLog, PlatformRole } from "@resolvex/types";
import { auth, db, isFirebaseConfigured } from "../firebase";
import { cleanFirestorePayload } from "../utils/firestore-clean";

const inMemoryAuditLogs: AuditLog[] = [];

export async function recordAuditEvent(params: {
  actorUserId: string;
  actorRole: PlatformRole;
  societyId: string;
  action: string;
  entityType: AuditLog["entityType"];
  entityId: string;
  metadata?: Record<string, unknown>;
}): Promise<string> {
  const newLog: AuditLog = {
    id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    ...params,
    timestamp: new Date().toISOString()
  };

  inMemoryAuditLogs.unshift(newLog);

  if (isFirebaseConfigured) {
    try {
      const docRef = await addDoc(collection(db, "audit_logs"), cleanFirestorePayload({
        ...params,
        timestamp: serverTimestamp()
      }));
      return docRef.id;
    } catch (err: any) {
      // Browser ad/privacy blockers (e.g. uBlock, Brave Shields) intercept requests with 'audit' in path locally
      if (err?.message?.includes("BLOCKED_BY_CLIENT") || err?.message?.includes("blocked") || err?.code === "failed-precondition") {
        return newLog.id;
      }
      console.warn("Could not write to audit_logs collection:", err);
    }
  }

  return newLog.id;
}

export function getLocalAuditLogs(): AuditLog[] {
  return [...inMemoryAuditLogs];
}

export function subscribeAuditLogs(
  societyId: string,
  callback: (logs: any[]) => void
): () => void {
  if (!isFirebaseConfigured) {
    callback(inMemoryAuditLogs.filter((l) => l.societyId === societyId));
    return () => {};
  }

  let isUnsubscribed = false;
  let firestoreUnsub: (() => void) | null = null;

  const attachListener = () => {
    if (isUnsubscribed || firestoreUnsub) return;
    try {
      const q = query(
        collection(db, "audit_logs"),
        where("societyId", "==", societyId),
        limit(50)
      );

      firestoreUnsub = onSnapshot(
        q,
        (snap) => {
          if (isUnsubscribed) return;
          const logs: any[] = [];
          snap.forEach((d) => {
            const data = d.data();
            logs.push({
              id: d.id,
              ...data,
              timestamp: data.timestamp?.toDate ? data.timestamp.toDate().toISOString() : data.timestamp || new Date().toISOString()
            });
          });
          logs.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
          callback(logs);
        },
        (err) => {
          console.warn("Audit logs subscription warning:", err);
          callback(inMemoryAuditLogs.filter((l) => l.societyId === societyId));
        }
      );
    } catch (err) {
      console.warn("Could not attach audit logs listener:", err);
      callback(inMemoryAuditLogs.filter((l) => l.societyId === societyId));
    }
  };

  if (auth.currentUser) attachListener();

  const authUnsub = onAuthStateChanged(auth, (user) => {
    if (isUnsubscribed) return;
    if (user) {
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
