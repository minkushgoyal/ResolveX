import {
  collection,
  doc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where
} from "firebase/firestore";
import type {
  Complaint,
  ComplaintUpdate,
  AppNotification,
  StaffAvailability
} from "@resolvex/types";
import {
  complaintUpdates as initialUpdates,
  complaints as initialComplaints,
  notifications as initialNotifications,
  validateComplaintTransition
} from "@resolvex/utils";
import { db, isFirebaseConfigured } from "./firebase";
import { cleanFirestorePayload } from "./firestore-clean";

// In-memory store for local demo updates
let localComplaints: Complaint[] = [...initialComplaints];
let localUpdates: ComplaintUpdate[] = [...initialUpdates];
let localNotifications: AppNotification[] = [...(initialNotifications as unknown as AppNotification[])];

export interface StaffWorkQueueParams {
  societyId: string;
  staffId: string;
}

/**
 * Subscribes to the technician's assigned work orders in real-time.
 * In Firebase mode: queries only complaints where societyId == societyId and assignedStaffId == staffId.
 * NEVER subscribes a technician to the entire society complaints collection.
 */
export function subscribeStaffWorkQueue(
  params: StaffWorkQueueParams,
  callback: (complaints: Complaint[]) => void
): () => void {
  if (isFirebaseConfigured) {
    try {
      const q = query(
        collection(db, "complaints"),
        where("societyId", "==", params.societyId),
        where("assignedStaffId", "==", params.staffId)
      );

      return onSnapshot(
        q,
        (snap) => {
          const list: Complaint[] = [];
          snap.forEach((d) => {
            list.push({ id: d.id, ...d.data() } as Complaint);
          });
          console.log(`[STAFF TASK QUERY] uid=${params.staffId} resultCount=${list.length}`);
          callback(list);
        },
        (err) => {
          console.warn("Firestore staff work queue snapshot error:", err);
        }
      );
    } catch (e) {
      console.warn("Could not attach staff work queue listener:", e);
    }
  }

  // Local fallback: filter for assigned staff
  const filterLocal = () => {
    const assigned = localComplaints.filter(
      (c) => c.societyId === params.societyId && c.assignedStaffId === params.staffId
    );
    callback(assigned);
  };

  filterLocal();
  const timer = setInterval(filterLocal, 2000);
  return () => clearInterval(timer);
}

/**
 * Subscribes to updates/history for a specific complaint
 */
export function subscribeComplaintUpdates(
  complaintId: string,
  callback: (updates: ComplaintUpdate[]) => void
): () => void {
  if (isFirebaseConfigured) {
    try {
      const q = query(
        collection(db, "complaint_updates"),
        where("complaintId", "==", complaintId)
      );
      return onSnapshot(
        q,
        (snap) => {
          const list: ComplaintUpdate[] = [];
          snap.forEach((d) => {
            list.push({ id: d.id, ...d.data() } as ComplaintUpdate);
          });
          list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          callback(list);
        },
        (err) => console.warn("Firestore complaint updates listener error:", err)
      );
    } catch (e) {
      console.warn("Error attaching complaint updates listener:", e);
    }
  }

  const list = localUpdates
    .filter((u) => u.complaintId === complaintId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  callback(list);
  return () => {};
}

/**
 * Technician starts work on an assigned complaint:
 * Moves assigned -> in_progress
 */
export async function startWorkOrder(params: {
  complaintId: string;
  technicianId: string;
  technicianName: string;
  societyId: string;
  currentStatus: string;
}): Promise<void> {
  const transition = validateComplaintTransition({
    currentStatus: params.currentStatus,
    targetStatus: "in_progress",
    actorRole: "maintenance_staff",
    actorUserId: params.technicianId,
    assignedStaffId: params.technicianId
  });

  if (!transition.valid) {
    throw new Error(transition.error || "Cannot start work on this complaint.");
  }

  const now = new Date().toISOString();
  const updatePayload = {
    status: "in_progress" as const,
    startedAt: now,
    updatedAt: now
  };

  const logPayload: ComplaintUpdate = {
    id: `cu-${Date.now()}`,
    complaintId: params.complaintId,
    actorUserId: params.technicianId,
    status: "in_progress",
    note: `Work commenced by ${params.technicianName}.`,
    attachments: [],
    createdAt: now
  };

  if (isFirebaseConfigured) {
    try {
      await updateDoc(doc(db, "complaints", params.complaintId), cleanFirestorePayload(updatePayload));
      await setDoc(doc(db, "complaint_updates", logPayload.id), cleanFirestorePayload(logPayload));
      console.log(`[STAFF TASK UPDATE] taskId=${params.complaintId} status=${updatePayload.status}`);
    } catch (err: any) {
      console.error("Firestore startWorkOrder error:", err);
      throw new Error(`Failed to start work in Firestore: ${err.message}`);
    }
  }

  // Update local store
  localComplaints = localComplaints.map((c) =>
    c.id === params.complaintId ? { ...c, ...updatePayload } : c
  );
  localUpdates.push(logPayload);
}

/**
 * Technician adds a work note
 */
export async function addTechnicianWorkNote(params: {
  complaintId: string;
  technicianId: string;
  technicianName: string;
  noteText: string;
}): Promise<void> {
  if (!params.noteText.trim()) {
    throw new Error("Work note text cannot be empty.");
  }

  const now = new Date().toISOString();
  const logPayload: ComplaintUpdate = {
    id: `cu-${Date.now()}`,
    complaintId: params.complaintId,
    actorUserId: params.technicianId,
    status: "in_progress",
    note: params.noteText.trim(),
    attachments: [],
    createdAt: now
  };

  if (isFirebaseConfigured) {
    try {
      await setDoc(doc(db, "complaint_updates", logPayload.id), cleanFirestorePayload(logPayload));
      await updateDoc(doc(db, "complaints", params.complaintId), cleanFirestorePayload({
        resolutionNote: params.noteText.trim(),
        updatedAt: now
      }));
      console.log(`[STAFF TASK UPDATE] taskId=${params.complaintId} status=in_progress`);
    } catch (err: any) {
      console.error("Firestore addTechnicianWorkNote error:", err);
      throw new Error(`Failed to save note: ${err.message}`);
    }
  }

  localUpdates.push(logPayload);
  localComplaints = localComplaints.map((c) =>
    c.id === params.complaintId
      ? { ...c, resolutionNote: params.noteText.trim(), updatedAt: now }
      : c
  );
}

/**
 * Technician completes work and requests resident confirmation:
 * in_progress -> resident_confirmation
 * (NEVER directly closes complaint)
 */
export async function completeWorkReadyForResident(params: {
  complaintId: string;
  technicianId: string;
  technicianName: string;
  notes: string;
  proofUrl?: string;
  societyId: string;
  currentStatus: string;
}): Promise<void> {
  const transition = validateComplaintTransition({
    currentStatus: params.currentStatus,
    targetStatus: "resident_confirmation",
    actorRole: "maintenance_staff",
    actorUserId: params.technicianId,
    assignedStaffId: params.technicianId,
    notes: params.notes,
    proofUrl: params.proofUrl
  });

  if (!transition.valid) {
    throw new Error(transition.error || "Cannot submit work for verification.");
  }

  const now = new Date().toISOString();
  const updatePayload: Partial<Complaint> = cleanFirestorePayload({
    status: "resident_confirmation",
    resolutionNote: params.notes || "Work completed by technician.",
    resolutionProofUrl: params.proofUrl || undefined,
    completedAt: now,
    updatedAt: now
  });

  const logPayload: ComplaintUpdate = cleanFirestorePayload({
    id: `cu-${Date.now()}`,
    complaintId: params.complaintId,
    actorUserId: params.technicianId,
    status: "resident_confirmation",
    note: params.notes || "Work completed by technician; ready for resident confirmation.",
    attachments: params.proofUrl
      ? [
          {
            id: `att-${Date.now()}`,
            type: "image",
            url: params.proofUrl,
            name: "resolution_proof.jpg"
          }
        ]
      : [],
    createdAt: now
  });

  if (isFirebaseConfigured) {
    try {
      await updateDoc(doc(db, "complaints", params.complaintId), updatePayload);
      await setDoc(doc(db, "complaint_updates", logPayload.id), logPayload);
      console.log(`[STAFF TASK UPDATE] taskId=${params.complaintId} status=${updatePayload.status}`);
    } catch (err: any) {
      console.error("Firestore completeWorkReadyForResident error:", err);
      throw new Error(`Failed to complete work in Firestore: ${err.message}`);
    }
  }

  localComplaints = localComplaints.map((c) =>
    c.id === params.complaintId ? { ...c, ...updatePayload } : c
  );
  localUpdates.push(logPayload);
}

/**
 * Subscribes to technician-specific notifications
 */
export function subscribeStaffNotifications(
  params: { societyId: string; staffId: string },
  callback: (notifications: AppNotification[]) => void
): () => void {
  if (isFirebaseConfigured) {
    try {
      const q = query(
        collection(db, "notifications"),
        where("userId", "==", params.staffId)
      );

      return onSnapshot(
        q,
        (snap) => {
          const list: AppNotification[] = [];
          snap.forEach((d) => {
            const data = d.data() as AppNotification;
            // Filter notifications addressed to staff or category complaint
            if (data.userId === params.staffId || data.category === "complaint") {
              list.push({ ...data, id: d.id });
            }
          });
          callback(list);
        },
        (err) => console.warn("Staff notifications snapshot error:", err)
      );
    } catch (e) {
      console.warn("Could not attach staff notifications listener:", e);
    }
  }

  // Fallback demo notifications for staff
  const staffNotifs: AppNotification[] = [
    {
      id: "notif-staff-1",
      societyId: params.societyId,
      userId: params.staffId,
      title: "New Work Order Assigned",
      body: "High priority ticket #CMP-1004 (Tower B Elevator Sensor) assigned to you.",
      category: "complaint",
      read: false,
      createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString()
    },
    {
      id: "notif-staff-2",
      societyId: params.societyId,
      userId: params.staffId,
      title: "SLA Warning: 45m Remaining",
      body: "Work order #CMP-1004 is approaching the 2-hour SLA response threshold.",
      category: "complaint",
      read: false,
      createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString()
    }
  ];

  callback(staffNotifs);
  return () => {};
}

/**
 * Updates technician duty availability status in canonical users collection
 */
export async function updateTechnicianDutyStatus(
  staffId: string,
  societyId: string,
  status: StaffAvailability,
  previousStatus?: StaffAvailability
): Promise<void> {
  const now = new Date().toISOString();

  console.log(`[STAFF DUTY AVAILABILITY SYNC] uid=${staffId} societyId=${societyId} prev=${previousStatus ?? "unknown"} new=${status}`);

  if (isFirebaseConfigured) {
    try {
      await updateDoc(doc(db, "users", staffId), {
        availabilityStatus: status,
        updatedAt: now
      });
      console.log(`[STAFF DUTY AVAILABILITY SYNC SUCCESS] uid=${staffId} status=${status} timestamp=${now}`);
    } catch (err: any) {
      console.error(`[STAFF DUTY AVAILABILITY SYNC ERROR] uid=${staffId} error=${err?.message || err}`);
      throw err;
    }
  }
}
