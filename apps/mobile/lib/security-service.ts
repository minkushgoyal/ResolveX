import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where
} from "firebase/firestore";
import type { Delivery, ID, VisitorPass } from "@resolvex/types";
import { visitorPasses as fallbackVisitorPasses } from "@resolvex/utils";
import { db, isFirebaseConfigured } from "./firebase";

/**
 * Real-time subscription to society visitor passes.
 */
export function subscribeVisitorPasses(
  societyId: string,
  onUpdate: (passes: VisitorPass[]) => void
): () => void {
  if (!isFirebaseConfigured) {
    const local = fallbackVisitorPasses.filter(
      (p) => !p.societyId || p.societyId === societyId
    ) as unknown as VisitorPass[];
    onUpdate(local.length > 0 ? local : (fallbackVisitorPasses as unknown as VisitorPass[]));
    return () => {};
  }

  const q = query(
    collection(db, "visitor_passes"),
    where("societyId", "==", societyId)
  );

  return onSnapshot(
    q,
    (snap) => {
      const passes: VisitorPass[] = [];
      snap.forEach((d) => {
        passes.push({ id: d.id, ...d.data() } as VisitorPass);
      });
      // Sort newest first
      passes.sort((a, b) => {
        const timeA = a.gateEntryAt || a.visitDate || "";
        const timeB = b.gateEntryAt || b.visitDate || "";
        return timeB.localeCompare(timeA);
      });
      onUpdate(passes);
    },
    (err) => {
      console.warn("Security visitor passes snapshot error:", err);
      onUpdate(fallbackVisitorPasses as unknown as VisitorPass[]);
    }
  );
}

/**
 * Real-time subscription to society deliveries.
 */
export function subscribeDeliveries(
  societyId: string,
  onUpdate: (deliveries: Delivery[]) => void
): () => void {
  if (!isFirebaseConfigured) {
    onUpdate([]);
    return () => {};
  }

  const q = query(
    collection(db, "deliveries"),
    where("societyId", "==", societyId)
  );

  return onSnapshot(
    q,
    (snap) => {
      const items: Delivery[] = [];
      snap.forEach((d) => {
        items.push({ id: d.id, ...d.data() } as Delivery);
      });
      items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      onUpdate(items);
    },
    (err) => {
      console.warn("Security deliveries snapshot error:", err);
      onUpdate([]);
    }
  );
}

/**
 * Check-in visitor when they arrive at the security gate.
 */
export async function checkInVisitor(
  passId: string,
  guardId: string,
  passData?: Partial<VisitorPass>
): Promise<{ success: boolean; error?: string }> {
  const now = new Date().toISOString();

  if (!isFirebaseConfigured) {
    return { success: true };
  }

  try {
    const passRef = doc(db, "visitor_passes", passId);
    await updateDoc(passRef, {
      status: "entered",
      gateEntryAt: now,
      approvedAt: now,
      approvedBy: guardId
    });

    // Notify resident of visitor arrival
    if (passData?.societyId && (passData.flatId || passData.householdId)) {
      const notifId = `notif-visit-${Date.now()}`;
      await setDoc(doc(db, "notifications", notifId), {
        id: notifId,
        societyId: passData.societyId,
        householdId: passData.householdId,
        title: "Visitor Arrived at Gate",
        body: `${passData.visitorName || "A visitor"} has checked in at North Gate.`,
        type: "visitor_arrival",
        priority: "normal",
        read: false,
        createdAt: now
      });
    }

    return { success: true };
  } catch (err: any) {
    console.error("checkInVisitor error:", err);
    return { success: false, error: err?.message || "Failed to check-in visitor" };
  }
}

/**
 * Check-out visitor when they exit through the gate.
 */
export async function checkOutVisitor(
  passId: string
): Promise<{ success: boolean; error?: string }> {
  const now = new Date().toISOString();

  if (!isFirebaseConfigured) {
    return { success: true };
  }

  try {
    const passRef = doc(db, "visitor_passes", passId);
    await updateDoc(passRef, {
      status: "exited",
      gateExitAt: now
    });
    return { success: true };
  } catch (err: any) {
    console.error("checkOutVisitor error:", err);
    return { success: false, error: err?.message || "Failed to check-out visitor" };
  }
}

/**
 * Strict evaluator enforcing:
 * - society tenant-isolation
 * - rejection of expired passes
 * - rejection of already exited/checked-out passes
 * - rejection of duplicate check-in (already entered)
 * - rejection of cancelled/denied/revoked passes
 */
export function evaluatePassAccess(
  pass: VisitorPass,
  societyId: string
): { valid: boolean; pass?: VisitorPass; reason?: string } {
  if (pass.societyId && pass.societyId !== societyId) {
    return {
      valid: false,
      pass,
      reason: "Cross-Society Access Denied: This pass was issued for a different society."
    };
  }

  if (
    pass.status === "denied" ||
    pass.status === "cancelled" ||
    pass.status === "expired"
  ) {
    return {
      valid: false,
      pass,
      reason: `Pass is ${pass.status}. Access denied.`
    };
  }

  if (pass.status === "exited") {
    return {
      valid: false,
      pass,
      reason: "Pass has already been used and checked out. Access denied."
    };
  }

  if (pass.status === "entered") {
    return {
      valid: false,
      pass,
      reason: "Duplicate Check-In: Visitor is already checked in on premises."
    };
  }

  // Date and time expiration check
  const now = new Date();
  if (pass.validUntil) {
    if (new Date(pass.validUntil).getTime() < now.getTime()) {
      return {
        valid: false,
        pass,
        reason: "Pass has expired. Validity period has lapsed."
      };
    }
  } else if (pass.visitDate) {
    const endOfDay = new Date(pass.visitDate);
    endOfDay.setHours(23, 59, 59, 999);
    if (endOfDay.getTime() < now.getTime()) {
      return {
        valid: false,
        pass,
        reason: "Pass has expired. Scheduled visit date has passed."
      };
    }
  }

  return { valid: true, pass };
}

/**
 * Validate QR token or pass code.
 * Rejects forged or nonexistent tokens.
 */
export async function validateVisitorPass(
  societyId: string,
  tokenOrCode: string
): Promise<{ valid: boolean; pass?: VisitorPass; reason?: string }> {
  const clean = tokenOrCode.trim();
  if (!clean) {
    return { valid: false, reason: "Empty pass code or token provided." };
  }

  if (!isFirebaseConfigured) {
    // Check local fallback
    const match = fallbackVisitorPasses.find(
      (p) =>
        p.qrToken.toLowerCase() === clean.toLowerCase() ||
        p.id.toLowerCase() === clean.toLowerCase()
    );
    if (match) {
      return { valid: true, pass: match as unknown as VisitorPass };
    }
    return { valid: false, reason: "Pass token not recognized in system." };
  }

  try {
    // Query by qrToken
    const qToken = query(
      collection(db, "visitor_passes"),
      where("societyId", "==", societyId),
      where("qrToken", "==", clean)
    );
    const snap = await getDocs(qToken);

    if (!snap.empty) {
      const docData = snap.docs[0].data() as VisitorPass;
      const pass: VisitorPass = { ...docData, id: snap.docs[0].id };
      return evaluatePassAccess(pass, societyId);
    }

    // Query by pass ID fallback
    const qId = query(
      collection(db, "visitor_passes"),
      where("societyId", "==", societyId),
      where("id", "==", clean)
    );
    const snapId = await getDocs(qId);
    if (!snapId.empty) {
      const docData = snapId.docs[0].data() as VisitorPass;
      const pass: VisitorPass = { ...docData, id: snapId.docs[0].id };
      return evaluatePassAccess(pass, societyId);
    }

    return {
      valid: false,
      reason: "Unauthorized / Forged Token: No matching pass found for this society."
    };
  } catch (err: any) {
    console.error("validateVisitorPass error:", err);
    return { valid: false, reason: "Verification service error: " + (err?.message || "Unknown") };
  }
}

/**
 * Register a walk-in visitor directly from the security gate desk.
 */
export async function createDirectVisitorEntry(
  societyId: string,
  guardId: string,
  details: {
    visitorName: string;
    visitorPhone: string;
    flatId: string;
    purpose: string;
    vehicleNumber?: string;
    householdId?: string;
  }
): Promise<{ success: boolean; passId: string; error?: string }> {
  const passId = `visit-${Date.now().toString().slice(-6)}`;
  const now = new Date().toISOString();
  const qrToken = `AJX-${Math.floor(1000 + Math.random() * 9000)}`;

  const newPass: VisitorPass = {
    id: passId,
    societyId,
    householdId: details.householdId || `hh-${details.flatId.toLowerCase()}`,
    flatId: details.flatId,
    createdByUserId: guardId,
    visitorName: details.visitorName.trim(),
    visitorPhone: details.visitorPhone.trim(),
    type: "guest",
    purpose: details.purpose.trim() || "Visitor",
    vehicleNumber: details.vehicleNumber?.trim() || undefined,
    visitDate: now.split("T")[0],
    status: "entered",
    qrToken,
    approvedAt: now,
    approvedBy: guardId,
    gateEntryAt: now
  };

  if (!isFirebaseConfigured) {
    return { success: true, passId };
  }

  try {
    await setDoc(doc(db, "visitor_passes", passId), newPass);

    // Notify resident
    const notifId = `notif-visit-${Date.now()}`;
    await setDoc(doc(db, "notifications", notifId), {
      id: notifId,
      societyId,
      flatId: details.flatId,
      householdId: details.householdId,
      title: "Visitor Checked In",
      body: `${details.visitorName} has entered through Gate 1 for flat ${details.flatId}.`,
      type: "visitor_arrival",
      priority: "normal",
      read: false,
      createdAt: now
    });

    return { success: true, passId };
  } catch (err: any) {
    console.error("createDirectVisitorEntry error:", err);
    return { success: false, passId: "", error: err?.message || "Failed to register visitor" };
  }
}

/**
 * Log parcel/delivery drop-off at security gate.
 */
export async function logDeliveryReceipt(
  societyId: string,
  guardId: string,
  details: {
    flatId: string;
    flatNumber?: string;
    courierName: string;
    trackingNumber?: string;
    recipientName?: string;
    householdId?: string;
  }
): Promise<{ success: boolean; deliveryId: string; error?: string }> {
  const deliveryId = `deliv-${Date.now().toString().slice(-6)}`;
  const now = new Date().toISOString();

  const newDelivery: Delivery = {
    id: deliveryId,
    societyId,
    householdId: details.householdId || `hh-${details.flatId.toLowerCase()}`,
    flatId: details.flatId,
    flatNumber: details.flatNumber || details.flatId,
    recipientName: details.recipientName || "Resident",
    courierName: details.courierName.trim(),
    trackingNumber: details.trackingNumber?.trim() || undefined,
    status: "received_at_gate",
    receivedAt: now,
    securityActorId: guardId,
    createdAt: now
  };

  if (!isFirebaseConfigured) {
    return { success: true, deliveryId };
  }

  try {
    await setDoc(doc(db, "deliveries", deliveryId), newDelivery);

    // Push notification to resident
    const notifId = `notif-deliv-${Date.now()}`;
    await setDoc(doc(db, "notifications", notifId), {
      id: notifId,
      societyId,
      flatId: details.flatId,
      householdId: details.householdId,
      title: "Package Dropped at Guard Post",
      body: `A parcel from ${details.courierName} has been received at the Gate Desk for ${details.flatNumber || details.flatId}.`,
      type: "delivery",
      priority: "normal",
      read: false,
      createdAt: now
    });

    return { success: true, deliveryId };
  } catch (err: any) {
    console.error("logDeliveryReceipt error:", err);
    return { success: false, deliveryId: "", error: err?.message || "Failed to log delivery" };
  }
}

/**
 * Mark a parcel collected by resident.
 */
export async function markDeliveryCollected(
  deliveryId: string
): Promise<{ success: boolean; error?: string }> {
  const now = new Date().toISOString();

  if (!isFirebaseConfigured) {
    return { success: true };
  }

  try {
    await updateDoc(doc(db, "deliveries", deliveryId), {
      status: "collected",
      collectedAt: now
    });
    return { success: true };
  } catch (err: any) {
    console.error("markDeliveryCollected error:", err);
    return { success: false, error: err?.message || "Failed to mark parcel collected" };
  }
}

/**
 * Emergency broadcast triggered by security guard.
 */
export async function broadcastSecurityEmergency(
  societyId: string,
  guardId: string,
  title: string,
  body: string
): Promise<{ success: boolean; error?: string }> {
  const now = new Date().toISOString();
  const notifId = `notif-emergency-${Date.now()}`;

  if (!isFirebaseConfigured) {
    return { success: true };
  }

  try {
    await setDoc(doc(db, "notifications", notifId), {
      id: notifId,
      societyId,
      title,
      body,
      type: "emergency",
      priority: "critical",
      read: false,
      createdAt: now
    });
    return { success: true };
  } catch (err: any) {
    console.error("broadcastSecurityEmergency error:", err);
    return { success: false, error: err?.message || "Failed to broadcast emergency" };
  }
}
