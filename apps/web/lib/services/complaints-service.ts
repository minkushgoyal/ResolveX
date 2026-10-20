import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where
} from "firebase/firestore";
import type { Complaint, ComplaintCategory, ComplaintStatus, ComplaintUpdate, StaffDepartment, StaffProfile } from "@resolvex/types";
import { getTechnicianAssignmentRecommendation, isStaffEligibleForCategory, validateComplaintTransition } from "@resolvex/utils";
import { auth, db, isFirebaseConfigured } from "../firebase";
import { cleanFirestorePayload } from "../utils/firestore-clean";
import { recordAuditEvent } from "./audit-service";
import { reactiveStore } from "./data-store";

export interface ComplaintFilters {
  societyId?: string;
  householdId?: string;
  assignedStaffId?: string;
  status?: ComplaintStatus;
}

/**
 * Subscribes to real-time complaints with automatic Firestore / reactive store fallback
 */
export function subscribeComplaints(
  filters: ComplaintFilters,
  callback: (complaints: Complaint[]) => void
): () => void {
  if (!isFirebaseConfigured) {
    return reactiveStore.subscribe<Complaint[]>("complaints", (all) => {
      let filtered = all;
      if (filters.societyId) {
        filtered = filtered.filter((c) => c.societyId === filters.societyId);
      }
      if (filters.householdId) {
        filtered = filtered.filter((c) => c.householdId === filters.householdId);
      }
      if (filters.assignedStaffId) {
        filtered = filtered.filter((c) => c.assignedStaffId === filters.assignedStaffId);
      }
      if (filters.status) {
        filtered = filtered.filter((c) => c.status === filters.status);
      }
      callback(filtered);
    });
  }

  let isUnsubscribed = false;
  let firestoreUnsub: (() => void) | null = null;

  const attachListener = () => {
    if (isUnsubscribed || firestoreUnsub) return;
    try {
      const constraints: any[] = [];

      if (filters.societyId) {
        constraints.push(where("societyId", "==", filters.societyId));
      }
      if (filters.householdId) {
        constraints.push(where("householdId", "==", filters.householdId));
      }
      if (filters.assignedStaffId) {
        constraints.push(where("assignedStaffId", "==", filters.assignedStaffId));
      }
      if (filters.status) {
        constraints.push(where("status", "==", filters.status));
      }

      console.log("[WEB COMPLAINT DEBUG] Attaching listener:", {
        adminUID: auth.currentUser?.uid,
        adminSocietyId: filters.societyId,
        queryPath: "complaints",
        queryConstraints: {
          societyId: filters.societyId,
          householdId: filters.householdId,
          assignedStaffId: filters.assignedStaffId,
          status: filters.status
        }
      });

      const q = constraints.length > 0
        ? query(collection(db, "complaints"), ...constraints)
        : collection(db, "complaints");

      firestoreUnsub = onSnapshot(
        q,
        (snapshot: any) => {
          if (isUnsubscribed) return;
          const list: Complaint[] = [];
          snapshot.forEach((docSnap: any) => {
            list.push({ id: docSnap.id, ...docSnap.data() } as Complaint);
          });
          list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

          console.log("[WEB COMPLAINT DEBUG] Snapshot received:", {
            adminUID: auth.currentUser?.uid,
            adminSocietyId: filters.societyId,
            queryPath: "complaints",
            queryConstraints: filters,
            snapshotSize: snapshot.size,
            eachComplaintSocietyId: list.map((c) => ({ id: c.id, societyId: c.societyId, title: c.title, status: c.status }))
          });

          callback(list);
        },
        (err) => {
          console.error("[WEB COMPLAINT DEBUG] Firestore complaints onSnapshot error:", err);
        }
      );
    } catch (e) {
      console.error("[WEB COMPLAINT DEBUG] Could not attach Firestore complaints listener:", e);
    }
  };

  if (auth.currentUser) {
    attachListener();
  }

  const authUnsub = onAuthStateChanged(auth, (user) => {
    if (isUnsubscribed) return;
    if (user) {
      if (!firestoreUnsub) {
        attachListener();
      }
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

/**
 * Creates a new complaint
 */
export async function createComplaint(
  data: Omit<Complaint, "id" | "createdAt" | "updatedAt">
): Promise<Complaint> {
  const now = new Date().toISOString();
  const id = `cmp-${Date.now().toString().slice(-4)}`;

  let autoAssignedStaffId = data.assignedStaffId;
  let autoAssignedStaffName = data.assignedStaffName;
  let autoAssignedDept = data.assignedDepartment || data.department;
  let complaintStatus: ComplaintStatus = data.status || (autoAssignedStaffId ? "assigned" : "open");
  let note = "Complaint submitted by resident.";

  // If no assigned staff was specified, look up eligible on-duty specialists in the society
  if (!autoAssignedStaffId && isFirebaseConfigured && data.societyId) {
    try {
      const staffSnap = await getDocs(
        query(collection(db, "users"), where("societyId", "==", data.societyId))
      );
      const societyStaffProfiles: StaffProfile[] = [];
      staffSnap.forEach((d) => {
        const u = d.data() as any;
        if (["maintenance_staff", "security_guard"].includes(u.role) && u.status === "verified") {
          societyStaffProfiles.push({
            id: d.id,
            societyId: u.societyId || data.societyId,
            name: u.displayName || u.name || "Technician",
            phone: u.phone || "+91 00000 00000",
            role: u.role,
            department: u.department || (u.role === "security_guard" ? "security" : "general_maintenance"),
            skills: u.skills || [],
            specialization: u.specialization,
            assignedFacilityIds: u.assignedFacilityIds || [],
            currentWorkload: u.currentWorkload || 0,
            availabilityStatus: u.availabilityStatus || "on_duty",
            active: u.active !== false
          } as StaffProfile);
        }
      });

      const rec = getTechnicianAssignmentRecommendation(data.category as ComplaintCategory, societyStaffProfiles, {
        societyId: data.societyId,
        priority: data.priority
      });

      if (rec.recommendedStaff) {
        autoAssignedStaffId = rec.recommendedStaff.id;
        autoAssignedStaffName = rec.recommendedStaff.name;
        autoAssignedDept = rec.recommendedStaff.department;
        complaintStatus = "assigned";
        note = `Complaint auto-assigned to ${autoAssignedStaffName} (${autoAssignedDept}). ${rec.reason}`;
        console.log(`[WEB COMPLAINT AUTO-ASSIGN MATCH] id=${id} category=${data.category} staff=${autoAssignedStaffId} dept=${autoAssignedDept}`);
      } else {
        note = `Complaint submitted. Unassigned: ${rec.reason}`;
        console.log(`[WEB COMPLAINT UNASSIGNED] id=${id} category=${data.category} reason=${rec.reason}`);
      }
    } catch (e: any) {
      console.warn("Could not query society staff for auto-assignment on web:", e?.message || e);
    }
  }

  const complaint: Complaint = cleanFirestorePayload({
    ...data,
    id,
    status: complaintStatus,
    assignedStaffId: autoAssignedStaffId,
    assignedStaffName: autoAssignedStaffName,
    assignedDepartment: autoAssignedDept,
    locationSource: data.locationSource || "manual",
    createdAt: now,
    updatedAt: now
  });

  const initialUpdate: ComplaintUpdate = cleanFirestorePayload({
    id: `cu-${Date.now()}`,
    complaintId: id,
    actorUserId: data.createdByUserId || data.reportedBy || "resident",
    status: complaint.status,
    note,
    attachments: data.attachments || [],
    createdAt: now
  });

  if (isFirebaseConfigured) {
    try {
      await setDoc(doc(db, "complaints", id), complaint);
      await setDoc(doc(db, "complaint_updates", initialUpdate.id), initialUpdate);
    } catch (err: any) {
      console.error("Firestore createComplaint error:", err);
      throw new Error(`Failed to save complaint in Firestore: ${err.message}`);
    }
  }

  reactiveStore.setDoc("complaints", complaint);
  reactiveStore.setDoc("complaint_updates", initialUpdate);

  // Record audit log
  await recordAuditEvent({
    actorUserId: data.createdByUserId || data.reportedBy || "resident",
    actorRole: "resident",
    societyId: data.societyId,
    action: "complaint_created",
    entityType: "complaint",
    entityId: id,
    metadata: {
      category: data.category,
      priority: data.priority,
      location: data.location,
      locationSource: complaint.locationSource
    }
  });

  return complaint;
}

/**
 * Retrieves a complaint by ID from reactiveStore or Firestore directly.
 */
async function getComplaintDoc(complaintId: string): Promise<Complaint | null> {
  const storeComplaint = reactiveStore.getDoc<Complaint>("complaints", complaintId);
  if (storeComplaint) return storeComplaint;
  if (isFirebaseConfigured) {
    try {
      const snap = await getDoc(doc(db, "complaints", complaintId));
      if (snap.exists()) {
        const complaint = { id: snap.id, ...snap.data() } as Complaint;
        reactiveStore.setDoc("complaints", complaint);
        return complaint;
      }
    } catch (err) {
      console.warn("Could not fetch complaint from Firestore:", err);
    }
  }
  return null;
}

/**
 * Assigns a complaint to a technician
 */
export async function assignStaff(
  complaintId: string,
  staffId: string,
  staffName: string,
  department: any,
  actorUserId: string,
  societyIdOverride?: string
): Promise<void> {
  const now = new Date().toISOString();
  const existingComplaint = await getComplaintDoc(complaintId);
  if (!existingComplaint) {
    throw new Error(`Complaint #${complaintId} was not found.`);
  }
  const societyId = societyIdOverride || existingComplaint?.societyId || "soc-ajanta-genx";

  // Validate status transition
  const transition = validateComplaintTransition({
    currentStatus: existingComplaint?.status || "open",
    targetStatus: "assigned",
    actorRole: "society_manager"
  });
  if (!transition.valid) {
    throw new Error(transition.error);
  }

  // Validate tenant isolation, approval status, and trade compatibility
  if (isFirebaseConfigured) {
    const staffDocSnap = await getDoc(doc(db, "users", staffId));
    if (staffDocSnap.exists()) {
      const staffData = staffDocSnap.data() as any;
      if (staffData.societyId && staffData.societyId !== societyId) {
        throw new Error(
          `Tenant isolation violation: Staff member belongs to '${staffData.societyId}', but complaint belongs to '${societyId}'.`
        );
      }
      if (staffData.status && staffData.status !== "verified") {
        throw new Error(
          `Staff member '${staffName}' has not been approved by society management (status: ${staffData.status}).`
        );
      }
      const eligibility = isStaffEligibleForCategory(staffData, existingComplaint.category, societyId);
      if (!eligibility.eligible) {
        throw new Error(`Trade incompatibility: ${eligibility.reason}`);
      }
    }
  }

  const updates: Partial<Complaint> = cleanFirestorePayload({
    assignedStaffId: staffId,
    assignedStaffName: staffName,
    assignedDepartment: department,
    department: department,
    status: "assigned",
    updatedAt: now
  });

  const updateEntry: ComplaintUpdate = cleanFirestorePayload({
    id: `cu-${Date.now()}`,
    complaintId,
    actorUserId,
    status: "assigned",
    note: `Assigned to ${staffName} (${department}).`,
    attachments: [],
    createdAt: now
  });

  if (isFirebaseConfigured) {
    try {
      await updateDoc(doc(db, "complaints", complaintId), updates);
      await setDoc(doc(db, "complaint_updates", updateEntry.id), updateEntry);
    } catch (err: any) {
      console.error("Firestore assignStaff error:", err);
      throw new Error(`Failed to update assignment in Firestore: ${err.message}`);
    }
  }

  reactiveStore.updateDoc("complaints", complaintId, updates);
  reactiveStore.setDoc("complaint_updates", updateEntry);

  await recordAuditEvent({
    actorUserId,
    actorRole: "society_manager",
    societyId,
    action: "complaint_assigned",
    entityType: "complaint",
    entityId: complaintId,
    metadata: { staffId, staffName, department }
  });
}

/**
 * Updates work order progress by technician (e.g. In Progress, Work Completed)
 * Note: Technician completion moves to `resident_confirmation`, never directly to closed.
 */
export async function updateWorkProgress(
  complaintId: string,
  params: {
    status: "in_progress" | "resident_confirmation" | "work_completed";
    notes?: string;
    proofUrl?: string;
    actorUserId: string;
    societyIdOverride?: string;
  }
): Promise<void> {
  const now = new Date().toISOString();
  const existingComplaint = await getComplaintDoc(complaintId);
  const societyId = params.societyIdOverride || existingComplaint?.societyId || "soc-ajanta-genx";

  const targetStatus: ComplaintStatus =
    params.status === "work_completed" ? "resident_confirmation" : params.status;

  const transition = validateComplaintTransition({
    currentStatus: existingComplaint?.status || "assigned",
    targetStatus,
    actorRole: "maintenance_staff",
    actorUserId: params.actorUserId,
    assignedStaffId: existingComplaint?.assignedStaffId,
    notes: params.notes,
    proofUrl: params.proofUrl
  });
  if (!transition.valid) {
    throw new Error(transition.error);
  }

  const updates: Partial<Complaint> = cleanFirestorePayload({
    status: targetStatus,
    updatedAt: now,
    ...(params.notes ? { resolutionNote: params.notes } : {}),
    ...(params.proofUrl ? { resolutionProofUrl: params.proofUrl } : {}),
    ...(targetStatus === "resident_confirmation" ? { completedAt: now } : {})
  });

  const updateEntry: ComplaintUpdate = cleanFirestorePayload({
    id: `cu-${Date.now()}`,
    complaintId,
    actorUserId: params.actorUserId,
    status: targetStatus,
    note: params.notes || `Work status updated to ${targetStatus}.`,
    attachments: params.proofUrl
      ? [{ id: `att-${Date.now()}`, type: "image", url: params.proofUrl, name: "proof.jpg" }]
      : [],
    createdAt: now
  });

  if (isFirebaseConfigured) {
    try {
      await updateDoc(doc(db, "complaints", complaintId), updates);
      await setDoc(doc(db, "complaint_updates", updateEntry.id), updateEntry);
    } catch (err: any) {
      console.error("Firestore updateWorkProgress error:", err);
      throw new Error(`Failed to update job status in Firestore: ${err.message}`);
    }
  }

  reactiveStore.updateDoc("complaints", complaintId, updates);
  reactiveStore.setDoc("complaint_updates", updateEntry);

  await recordAuditEvent({
    actorUserId: params.actorUserId,
    actorRole: "maintenance_staff",
    societyId,
    action: `work_${targetStatus}`,
    entityType: "complaint",
    entityId: complaintId,
    metadata: { notes: params.notes, hasProof: Boolean(params.proofUrl) }
  });
}

/**
 * Resident confirms resolution
 */
export async function confirmResolution(
  complaintId: string,
  actorUserId: string,
  societyIdOverride?: string
): Promise<void> {
  const now = new Date().toISOString();
  const existingComplaint = await getComplaintDoc(complaintId);
  const societyId = societyIdOverride || existingComplaint?.societyId || "soc-ajanta-genx";

  const transition = validateComplaintTransition({
    currentStatus: existingComplaint?.status || "resident_confirmation",
    targetStatus: "closed",
    actorRole: "resident",
    actorUserId,
    reportedByUserId: existingComplaint?.createdByUserId || existingComplaint?.reportedBy
  });
  if (!transition.valid) {
    throw new Error(transition.error);
  }

  const updates: Partial<Complaint> = cleanFirestorePayload({
    status: "closed",
    confirmedByResident: true,
    resolvedAt: now,
    residentConfirmedAt: now,
    updatedAt: now
  });

  const updateEntry: ComplaintUpdate = cleanFirestorePayload({
    id: `cu-${Date.now()}`,
    complaintId,
    actorUserId,
    status: "closed",
    note: "Resident verified technician proof and confirmed successful resolution.",
    attachments: [],
    createdAt: now
  });

  if (isFirebaseConfigured) {
    try {
      await updateDoc(doc(db, "complaints", complaintId), updates);
      await setDoc(doc(db, "complaint_updates", updateEntry.id), updateEntry);
    } catch (err: any) {
      console.error("Firestore confirmResolution error:", err);
      throw new Error(`Failed to confirm resolution in Firestore: ${err.message}`);
    }
  }

  reactiveStore.updateDoc("complaints", complaintId, updates);
  reactiveStore.setDoc("complaint_updates", updateEntry);

  await recordAuditEvent({
    actorUserId,
    actorRole: "resident",
    societyId,
    action: "complaint_confirmed_closed",
    entityType: "complaint",
    entityId: complaintId
  });
}

/**
 * Resident reopens complaint with mandatory reason
 */
export async function reopenComplaint(
  complaintId: string,
  reason: string,
  actorUserId: string,
  societyIdOverride?: string
): Promise<void> {
  if (!reason.trim()) {
    throw new Error("A specific reason is required to reopen an issue.");
  }

  const now = new Date().toISOString();
  const existingComplaint = await getComplaintDoc(complaintId);
  const societyId = societyIdOverride || existingComplaint?.societyId || "soc-ajanta-genx";

  const transition = validateComplaintTransition({
    currentStatus: existingComplaint?.status || "resident_confirmation",
    targetStatus: "reopened",
    actorRole: "resident",
    actorUserId,
    reportedByUserId: existingComplaint?.createdByUserId || existingComplaint?.reportedBy,
    reopenReason: reason
  });
  if (!transition.valid) {
    throw new Error(transition.error);
  }

  const updates: Partial<Complaint> = cleanFirestorePayload({
    status: "reopened",
    reopenReason: reason.trim(),
    reopenedAt: now,
    confirmedByResident: false,
    updatedAt: now
  });

  const updateEntry: ComplaintUpdate = cleanFirestorePayload({
    id: `cu-${Date.now()}`,
    complaintId,
    actorUserId,
    status: "reopened",
    note: `Complaint reopened by resident: "${reason.trim()}". Dispatched back for rework.`,
    attachments: [],
    createdAt: now
  });

  if (isFirebaseConfigured) {
    try {
      await updateDoc(doc(db, "complaints", complaintId), updates);
      await setDoc(doc(db, "complaint_updates", updateEntry.id), updateEntry);
    } catch (err: any) {
      console.error("Firestore reopenComplaint error:", err);
      throw new Error(`Failed to reopen complaint in Firestore: ${err.message}`);
    }
  }

  reactiveStore.updateDoc("complaints", complaintId, updates);
  reactiveStore.setDoc("complaint_updates", updateEntry);

  await recordAuditEvent({
    actorUserId,
    actorRole: "resident",
    societyId,
    action: "complaint_reopened",
    entityType: "complaint",
    entityId: complaintId,
    metadata: { reason }
  });
}

/**
 * Subscribes to complaint status history updates in real-time
 */
export function subscribeComplaintUpdates(
  complaintId: string,
  callback: (updates: ComplaintUpdate[]) => void
): () => void {
  if (!isFirebaseConfigured) {
    return reactiveStore.subscribe<ComplaintUpdate[]>("complaint_updates", (all) => {
      const filtered = all
        .filter((u) => u.complaintId === complaintId)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      callback(filtered);
    });
  }

  let isUnsubscribed = false;
  let firestoreUnsub: (() => void) | null = null;

  const attachListener = () => {
    if (isUnsubscribed || firestoreUnsub) return;
    try {
      const q = query(
        collection(db, "complaint_updates"),
        where("complaintId", "==", complaintId)
      );
      firestoreUnsub = onSnapshot(
        q,
        (snapshot) => {
          if (isUnsubscribed) return;
          const list: ComplaintUpdate[] = [];
          snapshot.forEach((snap) => {
            list.push({ id: snap.id, ...snap.data() } as ComplaintUpdate);
          });
          list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          callback(list);
        },
        (err) => {
          console.warn("Firestore complaint_updates listener error:", err);
        }
      );
    } catch (e) {
      console.warn("Could not attach complaint_updates listener:", e);
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
