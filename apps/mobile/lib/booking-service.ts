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
import type { Amenity, AmenityBooking, ServiceBooking, ServiceProvider, UserProfile } from "@resolvex/types";
import { auth, db, isFirebaseConfigured } from "./firebase";

/**
 * Strips undefined properties recursively so Firestore set/update never fails
 */
function cleanFirestorePayload<T extends Record<string, any>>(obj: T): T {
  if (obj === null || obj === undefined || typeof obj !== "object") {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) =>
        typeof item === "object" && item !== null && !(item instanceof Date)
          ? cleanFirestorePayload(item)
          : item
      ) as unknown as T;
  }
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    if (value !== null && typeof value === "object" && !(value instanceof Date)) {
      cleaned[key] = cleanFirestorePayload(value);
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned as T;
}

export interface CreateAmenityBookingParams {
  amenity: Amenity;
  slot: string;
  date: string;
  guestCount: number;
  userProfile: UserProfile;
}

/**
 * Creates an amenity reservation using an atomic Firestore transaction.
 * Checks and locks the deterministic slotLockId in amenity_slot_locks,
 * preventing double bookings across all mobile and web clients.
 */
export async function createAmenityBookingAsync(
  params: CreateAmenityBookingParams
): Promise<AmenityBooking> {
  const { amenity, slot, date, guestCount, userProfile } = params;

  if (!isFirebaseConfigured) {
    throw new Error("Firebase connection is not available.");
  }

  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.uid !== userProfile.uid) {
    throw new Error("You must be signed in with a verified resident account to reserve amenities.");
  }

  if (!userProfile.societyId) {
    throw new Error("Your profile does not have an assigned society. Booking cannot proceed.");
  }

  // 0. Validate date and time slot
  if (!date || !slot || !slot.includes(" - ")) {
    throw new Error("Invalid date or time slot selected.");
  }

  // 1. Strict guest count validation
  const parsedGuestCount = Number(guestCount);
  if (isNaN(parsedGuestCount) || !Number.isInteger(parsedGuestCount) || parsedGuestCount < 0) {
    throw new Error("Invalid guest count. Please enter a valid number of guests (0 or more).");
  }

  // 2. Canonical facility capacity validation from amenity model
  const facilityCapacity = typeof amenity.capacity === "number" ? amenity.capacity : 20;
  if (parsedGuestCount > facilityCapacity) {
    throw new Error(
      `Booking exceeds facility capacity. Maximum allowed capacity is ${facilityCapacity}.`
    );
  }

  const now = new Date().toISOString();
  const safeSlot = slot.replace(/[^a-zA-Z0-9]/g, "_");
  const slotLockId = `lock_${amenity.id}_${date}_${safeSlot}`;
  const bookingId = `bkg-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const passCode = `AJX-${amenity.name.slice(0, 3).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
  const [start, end] = slot.split(" - ");

  const bookingData: AmenityBooking = {
    id: bookingId,
    amenityId: amenity.id,
    societyId: userProfile.societyId,
    householdId: userProfile.householdId || "",
    userId: userProfile.uid,
    userName: userProfile.displayName || "Resident",
    date,
    startTime: (start || "07:00").trim(),
    endTime: (end || "08:00").trim(),
    slot,
    guestCount: parsedGuestCount,
    charge: amenity.charge || 0,
    qrPassToken: passCode,
    status: "confirmed",
    createdAt: now
  };

  const slotLockData = {
    amenityId: amenity.id,
    societyId: userProfile.societyId,
    householdId: userProfile.householdId || "",
    date,
    slot,
    userId: userProfile.uid,
    status: "confirmed",
    bookingId,
    createdAt: now
  };

  try {
    await runTransaction(db, async (txn) => {
      // 2 & 3 & 4. Load canonical amenity and verify society + active status
      const amenityRef = doc(db, "amenities", amenity.id);
      const amenitySnap = await txn.get(amenityRef);
      let authoritativeCapacity = facilityCapacity;

      if (amenitySnap.exists()) {
        const canonicalAmenity = amenitySnap.data();
        if (canonicalAmenity.societyId && canonicalAmenity.societyId !== userProfile.societyId) {
          throw new Error(`Amenity does not belong to your society (${userProfile.societyId}).`);
        }
        if (canonicalAmenity.status && canonicalAmenity.status !== "active") {
          throw new Error(`Amenity "${amenity.name}" is currently ${canonicalAmenity.status}.`);
        }
        if (typeof canonicalAmenity.capacity === "number") {
          authoritativeCapacity = canonicalAmenity.capacity;
        }
      }

      if (parsedGuestCount > authoritativeCapacity) {
        throw new Error(
          `Booking exceeds facility capacity. Maximum allowed capacity is ${authoritativeCapacity}.`
        );
      }

      // 8. Atomically check slot availability
      const lockRef = doc(db, "amenity_slot_locks", slotLockId);
      const lockSnap = await txn.get(lockRef);

      if (lockSnap.exists()) {
        const existing = lockSnap.data();
        if (existing?.status !== "cancelled") {
          throw new Error(
            `Slot "${slot}" on ${date} is already reserved by another resident. Please select another time slot.`
          );
        }
      }

      // 9 & 10. Write lock and booking
      txn.set(lockRef, cleanFirestorePayload(slotLockData));
      txn.set(doc(db, "amenity_bookings", bookingId), cleanFirestorePayload(bookingData));
    });

    // Immediate read-back check
    const readBooking = await getDoc(doc(db, "amenity_bookings", bookingId));
    const readLock = await getDoc(doc(db, "amenity_slot_locks", slotLockId));
    if (!readBooking.exists() || !readLock.exists()) {
      throw new Error("Firestore read-back failed: booking or slot lock not found after write.");
    }

    console.log("[BOOKING DEBUG] Amenity booking confirmed:", {
      userUID: currentUser.uid,
      societyId: userProfile.societyId,
      amenityId: amenity.id,
      date,
      startTime: bookingData.startTime,
      endTime: bookingData.endTime,
      guestCount: parsedGuestCount,
      bookingId,
      slotLockId,
      transactionResult: "SUCCESS",
      readBackBooking: readBooking.id,
      readBackLock: readLock.id
    });

    return bookingData;
  } catch (err: any) {
    console.error("[BOOKING DEBUG] Amenity reservation failed:", {
      userUID: currentUser.uid,
      societyId: userProfile.societyId,
      amenityId: amenity.id,
      date,
      startTime: bookingData.startTime,
      endTime: bookingData.endTime,
      guestCount: parsedGuestCount,
      bookingId,
      slotLockId,
      transactionResult: "FAILED",
      errorCode: err?.code,
      errorMessage: err?.message
    });
    throw err;
  }
}

/**
 * Cancels an amenity reservation and releases the atomic slot lock.
 */
export async function cancelAmenityBookingAsync(
  bookingId: string,
  amenityId: string,
  date: string,
  slot: string
): Promise<void> {
  if (!isFirebaseConfigured) {
    throw new Error("Firebase connection is not available.");
  }

  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("You must be authenticated to cancel reservations.");
  }

  const now = new Date().toISOString();
  const safeSlot = (slot || "").replace(/[^a-zA-Z0-9]/g, "_");
  const slotLockId = `lock_${amenityId}_${date}_${safeSlot}`;

  await updateDoc(doc(db, "amenity_bookings", bookingId), cleanFirestorePayload({
    status: "cancelled",
    updatedAt: now
  }));

  try {
    await updateDoc(doc(db, "amenity_slot_locks", slotLockId), cleanFirestorePayload({
      status: "cancelled",
      cancelledAt: now,
      updatedAt: now
    }));
  } catch (err) {
    console.warn("[BookingService] Could not update slot lock status during cancellation:", err);
  }
}

/**
 * Real-time listener for the resident's amenity bookings in their society.
 */
export function subscribeMyAmenityBookings(
  societyId: string,
  userId: string,
  onUpdate: (bookings: AmenityBooking[]) => void,
  onError?: (err: Error) => void
): () => void {
  if (!isFirebaseConfigured || !societyId || !userId) {
    onUpdate([]);
    return () => {};
  }

  const q = query(
    collection(db, "amenity_bookings"),
    where("societyId", "==", societyId),
    where("userId", "==", userId)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const list: AmenityBooking[] = [];
      snapshot.forEach((snapDoc) => {
        list.push({ id: snapDoc.id, ...snapDoc.data() } as AmenityBooking);
      });
      // Sort newest first
      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      onUpdate(list);
    },
    (error) => {
      console.warn("[BookingService] Amenity bookings snapshot error:", error);
      if (onError) onError(error);
    }
  );
}

export interface CreateServiceBookingParams {
  provider: ServiceProvider;
  scheduledAt: string;
  notes?: string;
  userProfile: UserProfile;
}

export interface MobileServiceRequestItem {
  id: string;
  name: string;
  date: string;
  status: string;
  category?: string;
  notes?: string;
  createdAt?: string;
}

/**
 * Creates a private home service request in Firestore.
 */
export async function createServiceBookingAsync(
  params: CreateServiceBookingParams
): Promise<ServiceBooking> {
  const { provider, scheduledAt, notes, userProfile } = params;

  if (!isFirebaseConfigured) {
    throw new Error("Firebase connection is not available.");
  }

  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.uid !== userProfile.uid) {
    throw new Error("You must be authenticated to request home services.");
  }

  if (!userProfile.societyId) {
    throw new Error("Your profile does not have an active society.");
  }

  const now = new Date().toISOString();
  const id = `srv-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const bookingPayload = {
    id,
    serviceProviderId: provider.id,
    serviceName: provider.name,
    category: provider.category,
    societyId: userProfile.societyId,
    householdId: userProfile.householdId || "",
    userId: userProfile.uid,
    userName: userProfile.displayName || "Resident",
    scheduledAt,
    notes: notes?.trim() || "",
    status: "requested" as const,
    createdAt: now
  };

  await setDoc(doc(db, "service_bookings", id), cleanFirestorePayload(bookingPayload));
  return bookingPayload as unknown as ServiceBooking;
}

/**
 * Real-time listener for the resident's home service requests in their society.
 */
export function subscribeMyServiceBookings(
  societyId: string,
  userId: string,
  onUpdate: (requests: MobileServiceRequestItem[]) => void,
  onError?: (err: Error) => void
): () => void {
  if (!isFirebaseConfigured || !societyId || !userId) {
    onUpdate([]);
    return () => {};
  }

  const q = query(
    collection(db, "service_bookings"),
    where("societyId", "==", societyId),
    where("userId", "==", userId)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const list: MobileServiceRequestItem[] = [];
      snapshot.forEach((snapDoc) => {
        const data = snapDoc.data();
        const displayStatus =
          data.status === "requested"
            ? "Requested"
            : data.status === "confirmed"
            ? "Confirmed"
            : data.status === "completed"
            ? "Completed"
            : "Cancelled";

        list.push({
          id: snapDoc.id,
          name: `${data.serviceName || "Home Service"} (${data.category || "General"})`,
          date: data.scheduledAt || "Scheduled",
          status: displayStatus,
          category: data.category,
          notes: data.notes,
          createdAt: data.createdAt
        });
      });
      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      onUpdate(list);
    },
    (error) => {
      console.warn("[BookingService] Service bookings snapshot error:", error);
      if (onError) onError(error);
    }
  );
}
