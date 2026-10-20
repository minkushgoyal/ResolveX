import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where
} from "firebase/firestore";
import type { AmenityBooking, Facility, FacilityServiceLog } from "@resolvex/types";
import { auth, db, isFirebaseConfigured } from "../firebase";
import { cleanFirestorePayload } from "../utils/firestore-clean";
import { recordAuditEvent } from "./audit-service";
import { reactiveStore } from "./data-store";

export function subscribeFacilities(
  societyId: string,
  callback: (facilities: Facility[]) => void
): () => void {
  if (!isFirebaseConfigured) {
    return reactiveStore.subscribe<Facility[]>("facilities", (all) => {
      callback(all.filter((f) => f.societyId === societyId));
    });
  }

  let isUnsubscribed = false;
  let firestoreUnsub: (() => void) | null = null;

  const attachListener = () => {
    if (isUnsubscribed || firestoreUnsub) return;
    try {
      const q = query(collection(db, "facilities"), where("societyId", "==", societyId));
      firestoreUnsub = onSnapshot(
        q,
        (snapshot) => {
          if (isUnsubscribed) return;
          const list: Facility[] = [];
          snapshot.forEach((snap) => {
            list.push({ id: snap.id, ...snap.data() } as Facility);
          });
          callback(list);
        },
        (err) => {
          console.warn("Firestore facilities subscription error:", err);
        }
      );
    } catch (e) {
      console.warn("Could not attach facilities listener:", e);
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

export async function logMaintenanceService(
  facilityId: string,
  params: {
    type: FacilityServiceLog["type"];
    notes: string;
    cost?: number;
    staffId: string;
    actorUserId: string;
    societyIdOverride?: string;
  }
): Promise<FacilityServiceLog> {
  const now = new Date().toISOString();
  const todayStr = now.split("T")[0];
  const id = `log-${Date.now()}`;

  const serviceLog: FacilityServiceLog = {
    id,
    facilityId,
    staffId: params.staffId,
    servicedAt: now,
    date: todayStr,
    type: params.type,
    notes: params.notes,
    description: params.notes,
    cost: params.cost || 0,
    createdAt: now
  };

  const facility = reactiveStore.getDoc<Facility>("facilities", facilityId);
  const societyId = params.societyIdOverride || facility?.societyId || "soc-ajanta-genx";

  const facilityUpdates: Partial<Facility> = {
    lastMaintenanceDate: todayStr,
    status: "operational",
    serviceHistoryCount: (facility?.serviceHistoryCount || 0) + 1,
    openIssueCount: Math.max(0, (facility?.openIssueCount || 1) - 1),
    updatedAt: now
  };

  if (isFirebaseConfigured) {
    try {
      await setDoc(doc(db, "facility_service_logs", id), cleanFirestorePayload(serviceLog));
      await updateDoc(doc(db, "facilities", facilityId), cleanFirestorePayload(facilityUpdates));
    } catch (err: any) {
      console.error("Firestore logMaintenanceService error:", err);
      throw new Error(`Failed to log service record: ${err.message}`);
    }
  }

  reactiveStore.setDoc("facility_service_logs", serviceLog);
  reactiveStore.updateDoc("facilities", facilityId, facilityUpdates);

  await recordAuditEvent({
    actorUserId: params.actorUserId,
    actorRole: "maintenance_staff",
    societyId,
    action: "facility_service_logged",
    entityType: "facility",
    entityId: facilityId,
    metadata: {
      type: params.type,
      notes: params.notes,
      cost: params.cost
    }
  });

  return serviceLog;
}

export function subscribeFacilityServiceLogs(
  facilityId: string,
  callback: (logs: FacilityServiceLog[]) => void
): () => void {
  return reactiveStore.subscribe<FacilityServiceLog[]>("facility_service_logs", (all) => {
    callback(all.filter((l) => l.facilityId === facilityId));
  });
}

/**
 * Creates an amenity booking with conflict validation against existing bookings
 */
export async function createAmenityBooking(params: {
  societyId: string;
  amenityId: string;
  userId: string;
  userName: string;
  householdId?: string;
  slot: string;
  date: string;
  guestCount: number;
}): Promise<AmenityBooking> {
  const slotLockId = `lock_${params.amenityId}_${params.date}_${params.slot.replace(/[^a-zA-Z0-9]/g, "_")}`;
  const now = new Date().toISOString();
  const id = `amn-${Date.now()}`;
  const qrPassToken = `QR-AMN-${Math.floor(100000 + Math.random() * 900000)}`;

  const booking: AmenityBooking = {
    id,
    amenityId: params.amenityId,
    societyId: params.societyId,
    householdId: params.householdId || "",
    userId: params.userId,
    userName: params.userName,
    slot: params.slot,
    date: params.date,
    startTime: params.slot.split("-")[0]?.trim() || "09:00",
    endTime: params.slot.split("-")[1]?.trim() || "10:00",
    guestCount: params.guestCount,
    qrPassToken,
    status: "confirmed",
    createdAt: now
  };

  const parsedGuestCount = Number(params.guestCount);
  if (isNaN(parsedGuestCount) || !Number.isInteger(parsedGuestCount) || parsedGuestCount < 0) {
    throw new Error("Invalid guest count. Please enter a valid number of guests (0 or more).");
  }

  // 1. Conflict validation and capacity check against Firestore data using atomic transaction
  if (isFirebaseConfigured) {
    try {
      await runTransaction(db, async (transaction) => {
        // Authoritative capacity check from Firestore amenity document
        const amenityRef = doc(db, "amenities", params.amenityId);
        const amenitySnap = await transaction.get(amenityRef);
        if (amenitySnap.exists() && typeof amenitySnap.data()?.capacity === "number") {
          const maxCapacity = amenitySnap.data()?.capacity;
          if (parsedGuestCount > maxCapacity) {
            throw new Error(`Booking exceeds facility capacity. Maximum allowed capacity is ${maxCapacity}.`);
          }
        }

        const lockRef = doc(db, "amenity_slot_locks", slotLockId);
        const lockSnap = await transaction.get(lockRef);
        if (lockSnap.exists() && lockSnap.data()?.status !== "cancelled") {
          throw new Error(`Slot "${params.slot}" is already booked on ${params.date}. Please select an alternate slot.`);
        }
        transaction.set(lockRef, cleanFirestorePayload({
          amenityId: params.amenityId,
          societyId: params.societyId,
          householdId: params.householdId || "",
          date: params.date,
          slot: params.slot,
          userId: params.userId,
          status: "confirmed",
          bookingId: id,
          createdAt: now
        }));
        transaction.set(doc(db, "amenity_bookings", id), cleanFirestorePayload({
          ...booking,
          guestCount: parsedGuestCount
        }));
      });
    } catch (err: any) {
      if (err.message?.includes("already booked") || err.message?.includes("exceeds facility capacity")) {
        throw err;
      }
      console.error("Firestore createAmenityBooking error:", err);
      throw new Error(`Booking conflict or Firestore error: ${err.message}`);
    }
  }

  // Local store conflict check (dev fallback)
  const localExisting = reactiveStore.getCollection<AmenityBooking>("amenity_bookings");
  const localConflict = localExisting.some(
    (b) =>
      b.amenityId === params.amenityId &&
      b.date === params.date &&
      b.slot === params.slot &&
      b.status !== "cancelled"
  );
  if (localConflict) {
    throw new Error(`Slot "${params.slot}" is already booked on ${params.date}. Please select an alternate slot.`);
  }

  reactiveStore.setDoc("amenity_bookings", booking);

  await recordAuditEvent({
    actorUserId: params.userId,
    actorRole: "resident",
    societyId: params.societyId,
    action: "amenity_booked",
    entityType: "amenity",
    entityId: params.amenityId,
    metadata: {
      bookingId: id,
      slot: params.slot,
      date: params.date,
      guestCount: params.guestCount
    }
  });

  return booking;
}

export async function cancelAmenityBooking(
  bookingId: string,
  userId: string,
  societyId: string
): Promise<void> {
  const now = new Date().toISOString();
  let existing = reactiveStore.getDoc<AmenityBooking>("amenity_bookings", bookingId);
  const updates = { status: "cancelled" as const, updatedAt: now };

  if (isFirebaseConfigured) {
    try {
      if (!existing) {
        const snap = await getDoc(doc(db, "amenity_bookings", bookingId));
        if (snap.exists()) {
          existing = { id: snap.id, ...snap.data() } as AmenityBooking;
        }
      }

      await updateDoc(doc(db, "amenity_bookings", bookingId), cleanFirestorePayload(updates));
      if (existing && existing.slot) {
        const slotLockId = `lock_${existing.amenityId}_${existing.date}_${existing.slot.replace(/[^a-zA-Z0-9]/g, "_")}`;
        await updateDoc(doc(db, "amenity_slot_locks", slotLockId), cleanFirestorePayload({
          status: "cancelled",
          cancelledAt: now,
          updatedAt: now
        })).catch((err) => {
          console.warn("[FacilitiesService] Slot lock release warning:", err);
        });
      }
    } catch (err: any) {
      console.error("Firestore cancelAmenityBooking error:", err);
      throw new Error(`Failed to cancel booking in Firestore: ${err.message}`);
    }
  }

  reactiveStore.updateDoc("amenity_bookings", bookingId, updates);

  await recordAuditEvent({
    actorUserId: userId,
    actorRole: "resident",
    societyId,
    action: "booking_cancelled",
    entityType: "amenity",
    entityId: existing?.amenityId || bookingId,
    metadata: { bookingId }
  });
}

export function subscribeAmenityBookings(
  societyId: string,
  userId?: string,
  callback?: (bookings: AmenityBooking[]) => void
): () => void {
  if (!callback) return () => {};

  if (!isFirebaseConfigured) {
    return reactiveStore.subscribe<AmenityBooking[]>("amenity_bookings", (all) => {
      let filtered = all.filter((b) => b.societyId === societyId);
      if (userId) {
        filtered = filtered.filter((b) => b.userId === userId);
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
      if (userId) {
        constraints.push(where("userId", "==", userId));
      }

      console.log("[WEB BOOKING DEBUG] Attaching listener:", {
        adminUID: auth.currentUser?.uid,
        adminSocietyId: societyId,
        queryConstraints: { societyId, userId }
      });

      const q = query(collection(db, "amenity_bookings"), ...constraints);
      firestoreUnsub = onSnapshot(
        q,
        (snap) => {
          if (isUnsubscribed) return;
          const list: AmenityBooking[] = [];
          snap.forEach((d) => list.push({ id: d.id, ...d.data() } as AmenityBooking));
          list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

          console.log("[WEB BOOKING DEBUG] Snapshot received:", {
            adminUID: auth.currentUser?.uid,
            adminSocietyId: societyId,
            snapshotSize: snap.size,
            bookings: list.map((b) => ({
              id: b.id,
              societyId: b.societyId,
              amenityId: b.amenityId,
              date: b.date,
              slot: b.slot,
              userName: b.userName,
              status: b.status
            }))
          });

          callback(list);
        },
        (err) => {
          console.error("[WEB BOOKING DEBUG] Firestore amenity bookings listener error:", err);
        }
      );
    } catch (e) {
      console.error("[WEB BOOKING DEBUG] Could not attach amenity bookings listener:", e);
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

export function subscribeServiceBookings(
  societyId: string,
  callback: (bookings: any[]) => void
): () => void {
  if (!isFirebaseConfigured) {
    return reactiveStore.subscribe<any[]>("service_bookings" as any, (all) => {
      callback(all.filter((b) => b.societyId === societyId));
    });
  }

  let isUnsubscribed = false;
  let firestoreUnsub: (() => void) | null = null;

  const attachListener = () => {
    if (isUnsubscribed || firestoreUnsub) return;
    try {
      const q = query(collection(db, "service_bookings"), where("societyId", "==", societyId));
      firestoreUnsub = onSnapshot(
        q,
        (snap) => {
          if (isUnsubscribed) return;
          const list: any[] = [];
          snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
          list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
          callback(list);
        },
        (err) => {
          console.warn("Firestore service bookings listener error:", err);
        }
      );
    } catch (e) {
      console.warn("Could not attach service bookings listener:", e);
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

export async function updateServiceBookingStatus(
  bookingId: string,
  status: "requested" | "confirmed" | "in_progress" | "completed" | "cancelled",
  actorUserId: string,
  societyIdOverride?: string
): Promise<void> {
  const now = new Date().toISOString();
  if (isFirebaseConfigured) {
    try {
      await updateDoc(doc(db, "service_bookings", bookingId), cleanFirestorePayload({
        status,
        updatedAt: now
      }));
    } catch (err: any) {
      console.error("Firestore updateServiceBookingStatus error:", err);
      throw new Error(`Failed to update service booking status in Firestore: ${err.message}`);
    }
  }

  reactiveStore.updateDoc("service_bookings" as any, bookingId, { status, updatedAt: now });

  await recordAuditEvent({
    actorUserId,
    actorRole: "society_admin",
    societyId: societyIdOverride || "soc-ajanta-genx",
    action: "service_booking_status_updated",
    entityType: "facility",
    entityId: bookingId,
    metadata: { status }
  });
}

export async function createServiceBooking(input: {
  societyId: string;
  householdId: string;
  userId: string;
  userName: string;
  serviceProviderId: string;
  serviceName: string;
  category: string;
  scheduledAt: string;
  notes?: string;
}): Promise<any> {
  const id = `srv-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const now = new Date().toISOString();
  const payload = {
    id,
    serviceProviderId: input.serviceProviderId,
    serviceName: input.serviceName,
    category: input.category,
    societyId: input.societyId,
    householdId: input.householdId || "",
    userId: input.userId,
    userName: input.userName || "Resident",
    scheduledAt: input.scheduledAt,
    notes: input.notes?.trim() || "",
    status: "requested" as const,
    createdAt: now,
    updatedAt: now
  };

  if (isFirebaseConfigured) {
    try {
      await setDoc(doc(db, "service_bookings", id), cleanFirestorePayload(payload));
    } catch (err: any) {
      console.error("Firestore createServiceBooking error:", err);
      throw new Error(`Failed to create service booking in Firestore: ${err.message}`);
    }
  }

  reactiveStore.setDoc("service_bookings" as any, payload);
  return payload;
}
