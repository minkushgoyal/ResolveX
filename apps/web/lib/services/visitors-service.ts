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
import type { Delivery, VisitorPass } from "@resolvex/types";
import { auth, db, isFirebaseConfigured } from "../firebase";
import { cleanFirestorePayload } from "../utils/firestore-clean";
import { recordAuditEvent } from "./audit-service";
import { reactiveStore } from "./data-store";

// ─── VISITOR PASSES ─────────────────────────────────────────────────────────

export function subscribeVisitorPasses(
  societyId: string,
  filters: { householdId?: string; status?: VisitorPass["status"] } = {},
  callback: (passes: VisitorPass[]) => void
): () => void {
  if (!isFirebaseConfigured) {
    return reactiveStore.subscribe<VisitorPass[]>("visitor_passes", (all) => {
      let filtered = all.filter((v) => v.societyId === societyId);
      if (filters.householdId) {
        filtered = filtered.filter((v) => v.householdId === filters.householdId);
      }
      if (filters.status) {
        filtered = filtered.filter((v) => v.status === filters.status);
      }
      callback(filtered);
    });
  }

  let isUnsubscribed = false;
  let firestoreUnsub: (() => void) | null = null;

  const attachListener = () => {
    if (isUnsubscribed || firestoreUnsub) return;
    try {
      const constraints: any[] = [where("societyId", "==", societyId)];
      if (filters.householdId) {
        constraints.push(where("householdId", "==", filters.householdId));
      }
      if (filters.status) {
        constraints.push(where("status", "==", filters.status));
      }
      const q = query(collection(db, "visitor_passes"), ...constraints);
      firestoreUnsub = onSnapshot(
        q,
        (snapshot) => {
          if (isUnsubscribed) return;
          const list: VisitorPass[] = [];
          snapshot.forEach((snap) => {
            list.push({ id: snap.id, ...snap.data() } as VisitorPass);
          });
          list.sort((a, b) => new Date((b as any).createdAt || (b as any).visitDate || 0).getTime() - new Date((a as any).createdAt || (a as any).visitDate || 0).getTime());
          callback(list);
        },
        (err) => {
          console.warn("Firestore visitor passes subscription error:", err);
        }
      );
    } catch (e) {
      console.warn("Could not attach visitor passes listener:", e);
    }
  };

  if (auth.currentUser) {
    attachListener();
  }

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

export async function createVisitorPass(
  data: Omit<VisitorPass, "id">
): Promise<VisitorPass> {
  const id = `visit-${Date.now().toString().slice(-4)}`;
  const pass: VisitorPass = {
    ...data,
    id,
    qrToken: data.qrToken || `QR-AJX-PASS-${id.toUpperCase()}`,
    status: data.status || "expected"
  };

  if (isFirebaseConfigured) {
    try {
      await setDoc(doc(db, "visitor_passes", id), cleanFirestorePayload(pass));
    } catch (e: any) {
      console.error("Firestore createVisitorPass error:", e);
      throw new Error(`Failed to create visitor pass in Firestore: ${e.message}`);
    }
  }

  reactiveStore.setDoc("visitor_passes", pass);

  await recordAuditEvent({
    actorUserId: data.createdByUserId || data.createdBy || "resident",
    actorRole: "resident",
    societyId: data.societyId,
    action: "visitor_pass_created",
    entityType: "visitor",
    entityId: id,
    metadata: {
      visitorName: data.visitorName,
      type: data.type,
      visitDate: data.visitDate
    }
  });

  return pass;
}

export async function updateVisitorStatus(
  passId: string,
  status: VisitorPass["status"],
  actorUserId: string,
  societyIdOverride?: string
): Promise<void> {
  const now = new Date().toISOString();
  const currentPass = reactiveStore.getDoc<VisitorPass>("visitor_passes", passId);
  const societyId = societyIdOverride || currentPass?.societyId || "soc-ajanta-genx";

  // Expiration & Reuse Safeguards
  if (currentPass) {
    if (currentPass.status === "exited" && (status === "approved" || status === "entered")) {
      throw new Error("Invalid operation: Visitor pass has already been used and checked out.");
    }
    if (currentPass.validUntil && new Date(currentPass.validUntil).getTime() < Date.now()) {
      throw new Error("Expired pass: Visitor pass validity window has elapsed.");
    }
  }

  const updates: Partial<VisitorPass> = { status };

  if (status === "approved") {
    updates.approvedAt = now;
    updates.approvedBy = actorUserId;
  } else if (status === "entered" || status === "used") {
    updates.gateEntryAt = now;
  } else if (status === "exited") {
    updates.gateExitAt = now;
  }

  if (isFirebaseConfigured) {
    try {
      await updateDoc(doc(db, "visitor_passes", passId), cleanFirestorePayload(updates));
    } catch (e: any) {
      console.error("Could not update visitor pass in Firestore:", e);
      throw new Error(`Failed to update visitor clearance in Firestore: ${e.message}`);
    }
  }

  reactiveStore.updateDoc("visitor_passes", passId, updates);

  // Notify host household of entry clearance
  if (currentPass && (status === "approved" || status === "entered")) {
    const hostUserId = currentPass.createdByUserId || currentPass.createdBy;
    if (hostUserId) {
      const notif = {
        id: `notif-${Date.now()}`,
        societyId,
        userId: hostUserId,
        recipientUserId: hostUserId,
        category: "visitor" as const,
        type: "visitor" as const,
        title: status === "approved" ? "Visitor Entry Cleared" : "Visitor Entered Gate",
        body: `${currentPass.visitorName} has been ${status === "approved" ? "granted access" : "cleared at Main Gate 1"}.`,
        message: `${currentPass.visitorName} has been ${status === "approved" ? "granted access" : "cleared at Main Gate 1"}.`,
        relatedEntityId: passId,
        read: false,
        createdAt: now
      };
      if (isFirebaseConfigured) {
        try {
          await setDoc(doc(db, "notifications", notif.id), cleanFirestorePayload(notif));
        } catch (err) {
          console.warn("Could not save host visitor notification to Firestore:", err);
        }
      }
      reactiveStore.setDoc("notifications", notif);
    }
  }

  await recordAuditEvent({
    actorUserId,
    actorRole: "security_guard",
    societyId,
    action: `visitor_${status}`,
    entityType: "visitor",
    entityId: passId,
    metadata: { status, visitorName: currentPass?.visitorName }
  });
}

// ─── DELIVERIES ─────────────────────────────────────────────────────────────

export function subscribeDeliveries(
  societyId: string,
  householdId?: string,
  callback?: (deliveries: Delivery[]) => void
): () => void {
  if (!callback) return () => {};

  if (!isFirebaseConfigured) {
    return reactiveStore.subscribe<Delivery[]>("deliveries", (all) => {
      let filtered = all.filter((d) => d.societyId === societyId);
      if (householdId) {
        filtered = filtered.filter((d) => d.householdId === householdId);
      }
      callback(filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    });
  }

  let isUnsubscribed = false;
  let firestoreUnsub: (() => void) | null = null;

  const attachListener = () => {
    if (isUnsubscribed || firestoreUnsub) return;
    try {
      const constraints: any[] = [where("societyId", "==", societyId)];
      if (householdId) {
        constraints.push(where("householdId", "==", householdId));
      }
      const q = query(collection(db, "deliveries"), ...constraints);
      firestoreUnsub = onSnapshot(
        q,
        (snapshot) => {
          if (isUnsubscribed) return;
          const list: Delivery[] = [];
          snapshot.forEach((snap) => {
            list.push({ id: snap.id, ...snap.data() } as Delivery);
          });
          callback(list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        },
        (err) => {
          console.warn("Firestore deliveries subscription error:", err);
        }
      );
    } catch (e) {
      console.warn("Could not attach deliveries listener:", e);
    }
  };

  if (auth.currentUser) {
    attachListener();
  }

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

export async function createDelivery(
  data: Omit<Delivery, "id" | "createdAt">
): Promise<Delivery> {
  const id = `del-${Date.now().toString().slice(-4)}`;
  const now = new Date().toISOString();
  const delivery: Delivery = {
    ...data,
    id,
    status: data.status || "received_at_gate",
    receivedAt: data.receivedAt || now,
    createdAt: now
  };

  if (isFirebaseConfigured) {
    try {
      await setDoc(doc(db, "deliveries", id), cleanFirestorePayload(delivery));
    } catch (err: any) {
      console.error("Firestore createDelivery error:", err);
      throw new Error(`Failed to log delivery in Firestore: ${err.message}`);
    }
  }

  reactiveStore.setDoc("deliveries", delivery);

  await recordAuditEvent({
    actorUserId: data.securityActorId || "security-guard",
    actorRole: "security_guard",
    societyId: data.societyId,
    action: "delivery_logged",
    entityType: "visitor",
    entityId: id,
    metadata: {
      courierName: data.courierName,
      flatNumber: data.flatNumber,
      status: delivery.status
    }
  });

  return delivery;
}

export async function updateDeliveryStatus(
  deliveryId: string,
  status: Delivery["status"],
  actorUserId: string
): Promise<void> {
  const now = new Date().toISOString();
  const existing = reactiveStore.getDoc<Delivery>("deliveries", deliveryId);
  const updates: Partial<Delivery> = {
    status,
    ...(status === "collected" ? { collectedAt: now } : {})
  };

  if (isFirebaseConfigured) {
    try {
      await updateDoc(doc(db, "deliveries", deliveryId), cleanFirestorePayload(updates));
    } catch (err: any) {
      console.error("Firestore updateDeliveryStatus error:", err);
      throw new Error(`Failed to update delivery status: ${err.message}`);
    }
  }

  reactiveStore.updateDoc("deliveries", deliveryId, updates);

  await recordAuditEvent({
    actorUserId,
    actorRole: "security_guard",
    societyId: existing?.societyId || "soc-ajanta-genx",
    action: `delivery_${status}`,
    entityType: "visitor",
    entityId: deliveryId,
    metadata: { status }
  });
}
