import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";

initializeApp();

const db = getFirestore();

export const onComplaintCreated = onDocumentCreated("complaints/{complaintId}", async (event) => {
  const complaint = event.data?.data();
  if (!complaint) return;

  const batch = db.batch();

  // Create notification for resident
  const notifRef = db.collection("notifications").doc();
  batch.set(notifRef, {
    societyId: complaint.societyId,
    userId: complaint.createdByUserId || complaint.reportedBy,
    recipientUserId: complaint.createdByUserId || complaint.reportedBy,
    category: "complaint",
    type: "complaint",
    title: "Complaint submitted",
    body: `"${complaint.title}" has been registered. Triage team notified.`,
    message: `"${complaint.title}" has been registered. Triage team notified.`,
    relatedEntityId: event.params.complaintId,
    read: false,
    createdAt: FieldValue.serverTimestamp()
  });

  // Create audit log
  const auditRef = db.collection("audit_logs").doc();
  batch.set(auditRef, {
    actorUserId: complaint.createdByUserId || complaint.reportedBy || "system",
    actorRole: "resident",
    societyId: complaint.societyId,
    action: "complaint_created",
    entityType: "complaint",
    entityId: event.params.complaintId,
    metadata: {
      category: complaint.category,
      priority: complaint.priority,
      location: complaint.location || complaint.locationLabel
    },
    timestamp: FieldValue.serverTimestamp()
  });

  await batch.commit();
});

export const onComplaintUpdated = onDocumentUpdated("complaints/{complaintId}", async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after) return;

  const batch = db.batch();
  const complaintId = event.params.complaintId;
  const residentId = after.createdByUserId || after.reportedBy;

  // Status changed
  if (before.status !== after.status) {
    // Log in complaint_updates
    const updateRef = db.collection("complaint_updates").doc();
    batch.set(updateRef, {
      complaintId,
      actorUserId: after.updatedBy || "system",
      status: after.status,
      note: after.reopenReason
        ? `Reopened: ${after.reopenReason}`
        : `Status changed from ${before.status} to ${after.status}.`,
      attachments: after.attachments || [],
      createdAt: FieldValue.serverTimestamp()
    });

    // Create Audit Log
    const auditRef = db.collection("audit_logs").doc();
    batch.set(auditRef, {
      actorUserId: after.updatedBy || "system",
      actorRole: after.status === "resident_confirmation" ? "maintenance_staff" : "system",
      societyId: after.societyId,
      action: `complaint_${after.status}`,
      entityType: "complaint",
      entityId: complaintId,
      metadata: {
        previousStatus: before.status,
        newStatus: after.status,
        reopenReason: after.reopenReason || null
      },
      timestamp: FieldValue.serverTimestamp()
    });

    // Notify resident if ready for confirmation
    if (after.status === "resident_confirmation") {
      const notifRef = db.collection("notifications").doc();
      batch.set(notifRef, {
        societyId: after.societyId,
        userId: residentId,
        recipientUserId: residentId,
        category: "complaint",
        type: "complaint",
        title: "Work completed - Verification required",
        body: `Technician completed work on "${after.title}". Please inspect photo proof and confirm resolution.`,
        message: `Technician completed work on "${after.title}". Please inspect photo proof and confirm resolution.`,
        relatedEntityId: complaintId,
        read: false,
        createdAt: FieldValue.serverTimestamp()
      });
    } else {
      const notifRef = db.collection("notifications").doc();
      batch.set(notifRef, {
        societyId: after.societyId,
        userId: residentId,
        recipientUserId: residentId,
        category: "complaint",
        type: "complaint",
        title: "Complaint updated",
        body: `"${after.title}" status is now ${after.status.replace(/_/g, " ")}.`,
        message: `"${after.title}" status is now ${after.status.replace(/_/g, " ")}.`,
        relatedEntityId: complaintId,
        read: false,
        createdAt: FieldValue.serverTimestamp()
      });
    }
  }

  // Assigned to staff
  if (before.assignedStaffId !== after.assignedStaffId && after.assignedStaffId) {
    const staffNotifRef = db.collection("notifications").doc();
    batch.set(staffNotifRef, {
      societyId: after.societyId,
      userId: after.assignedStaffId,
      recipientUserId: after.assignedStaffId,
      category: "complaint",
      type: "complaint",
      title: "New work order assigned",
      body: `You have been assigned to: "${after.title}" at ${after.location || after.locationLabel}.`,
      message: `You have been assigned to: "${after.title}" at ${after.location || after.locationLabel}.`,
      relatedEntityId: complaintId,
      read: false,
      createdAt: FieldValue.serverTimestamp()
    });
  }

  await batch.commit();
});

// ─── VISITOR PASS CREATION TRIGGER ──────────────────────────────────────────
export const onVisitorPassCreated = onDocumentCreated("visitor_passes/{passId}", async (event) => {
  const pass = event.data?.data();
  if (!pass) return;

  const batch = db.batch();
  const passId = event.params.passId;
  const hostUserId = pass.createdByUserId || pass.createdBy || pass.userId;

  // 1. Notify host household that visitor pass has been pre-cleared for the gate
  if (hostUserId) {
    const notifRef = db.collection("notifications").doc();
    batch.set(notifRef, {
      societyId: pass.societyId,
      userId: hostUserId,
      recipientUserId: hostUserId,
      category: "visitor",
      type: "visitor",
      title: "Visitor Pass Generated",
      body: `Digital pass created for ${pass.visitorName || "visitor"} (${pass.qrToken || passId}). Security gate will scan for access.`,
      message: `Digital pass created for ${pass.visitorName || "visitor"} (${pass.qrToken || passId}). Security gate will scan for access.`,
      relatedEntityId: passId,
      read: false,
      createdAt: FieldValue.serverTimestamp()
    });
  }

  // 2. Write immutable audit log
  const auditRef = db.collection("audit_logs").doc();
  batch.set(auditRef, {
    actorUserId: hostUserId || "system",
    actorRole: "resident",
    societyId: pass.societyId,
    action: "visitor_pass_created",
    entityType: "visitor",
    entityId: passId,
    metadata: {
      visitorName: pass.visitorName,
      type: pass.type,
      visitDate: pass.visitDate,
      qrToken: pass.qrToken
    },
    timestamp: FieldValue.serverTimestamp()
  });

  await batch.commit();
});

// ─── IDEMPOTENT HOURLY SLA ESCALATION CRON ──────────────────────────────────
export const checkSlaBreachesHourly = onSchedule("every 60 minutes", async () => {
  const now = Date.now();
  const snapshot = await db
    .collection("complaints")
    .where("status", "in", ["open", "under_review", "assigned", "in_progress"])
    .get();

  const batch = db.batch();
  let mutationCount = 0;

  snapshot.docs.forEach((doc) => {
    const complaint = doc.data();
    const createdAt = typeof complaint.createdAt === "string" ? Date.parse(complaint.createdAt) : complaint.createdAt?.toMillis?.();
    if (!createdAt) return;

    const ageHours = (now - createdAt) / 36e5;
    const currentStage = complaint.slaEscalatedStage || "none";
    const escalationRef = db.collection("complaint_escalations").doc();

    if (ageHours >= 72 && currentStage !== "72h") {
      batch.update(doc.ref, {
        slaEscalatedStage: "72h",
        priority: "emergency",
        updatedAt: FieldValue.serverTimestamp()
      });
      batch.set(escalationRef, {
        complaintId: doc.id,
        societyId: complaint.societyId,
        action: "notify_admin",
        stage: "72h",
        triggeredAt: FieldValue.serverTimestamp(),
        note: "Complaint crossed 72 hours. Escalated to emergency. Society administrator alerted."
      });
      mutationCount += 2;
    } else if (ageHours >= 48 && currentStage !== "48h" && currentStage !== "72h") {
      batch.update(doc.ref, {
        priority: "high",
        slaEscalatedStage: "48h",
        updatedAt: FieldValue.serverTimestamp()
      });
      batch.set(escalationRef, {
        complaintId: doc.id,
        societyId: complaint.societyId,
        action: "increase_priority",
        stage: "48h",
        triggeredAt: FieldValue.serverTimestamp(),
        note: "Complaint crossed 48 hours. Priority increased to High. Management team alerted."
      });
      mutationCount += 2;
    } else if (ageHours >= 24 && currentStage === "none") {
      batch.update(doc.ref, {
        slaEscalatedStage: "24h",
        updatedAt: FieldValue.serverTimestamp()
      });
      batch.set(escalationRef, {
        complaintId: doc.id,
        societyId: complaint.societyId,
        action: "notify_manager",
        stage: "24h",
        triggeredAt: FieldValue.serverTimestamp(),
        note: "Complaint crossed 24 hours without resolution. Operations manager alerted."
      });
      mutationCount += 2;
    }
  });

  if (mutationCount > 0) {
    await batch.commit();
  }
});

// Maintain alias for backward compatibility
export const escalateComplaints = checkSlaBreachesHourly;
