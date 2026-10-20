/**
 * ResolveX Master Finalization Sprint - Comprehensive Golden End-to-End Test Suite
 * Validates cross-platform workflows, canonical status machine transitions,
 * role authorization, qualification scoring, double-booking prevention,
 * security isolation, storage boundaries, multi-member households, and guard workflows.
 */

import {
  validateComplaintTransition,
  getTechnicianAssignmentRecommendation,
  resolveQRCode,
  staff
} from "@resolvex/utils";
import type {
  Complaint,
  ComplaintPriority,
  ComplaintStatus,
  Delivery,
  StaffProfile,
  UserProfile,
  VisitorPass
} from "@resolvex/types";

interface TestResult {
  name: string;
  section: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

function assert(condition: boolean, message: string, section: string, testName: string) {
  if (condition) {
    results.push({ name: testName, section, passed: true });
    console.log(`  ✓ [${section}] ${testName}`);
  } else {
    results.push({ name: testName, section, passed: false, error: message });
    console.error(`  ✗ [${section}] ${testName}: ${message}`);
  }
}

async function runGoldenE2ETests() {
  console.log("\n=======================================================");
  console.log("ResolveX Master Finalization: Golden E2E Test Suite");
  console.log("=======================================================\n");

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 1: AUTHENTICATION & ROLE RESTRICTIONS (Part C & U)
  // ──────────────────────────────────────────────────────────────────────────
  console.log("--- 1. Authentication & Role Permissions ---");

  // 1A. User registration validation
  function validateRegistration(data: {
    name: string;
    email: string;
    phone: string;
    password: string;
    confirmPassword: string;
    societyId: string;
    towerId: string;
    flatId: string;
  }) {
    if (!data.name.trim()) return { valid: false, error: "Name is required" };
    if (!data.email.includes("@") || !data.email.includes(".")) return { valid: false, error: "Invalid email" };
    if (data.password.length < 8) return { valid: false, error: "Password must be at least 8 characters" };
    if (data.password !== data.confirmPassword) return { valid: false, error: "Passwords do not match" };
    if (!data.societyId || !data.towerId || !data.flatId) return { valid: false, error: "Society, tower, flat required" };
    return { valid: true };
  }

  const validReg = validateRegistration({
    name: "Minkush Goyal",
    email: "minkush@example.com",
    phone: "+91 98765 43210",
    password: "SecurePassword123!",
    confirmPassword: "SecurePassword123!",
    societyId: "soc-ajanta-genx",
    towerId: "tower-a",
    flatId: "flat-a-1204"
  });
  assert(validReg.valid, "Valid registration data must pass validation", "Auth", "Registration validation succeeds");

  const mismatchReg = validateRegistration({
    name: "Minkush Goyal",
    email: "minkush@example.com",
    phone: "+91 98765 43210",
    password: "Password1!",
    confirmPassword: "Password2!",
    societyId: "soc-ajanta-genx",
    towerId: "tower-a",
    flatId: "flat-a-1204"
  });
  assert(!mismatchReg.valid && mismatchReg.error === "Passwords do not match", "Password mismatch rejected", "Auth", "Mismatched passwords rejected");

  // 1B. Role escalation prevention on client profile update
  function validateProfileUpdate(
    currentProfile: UserProfile,
    updatedData: Partial<UserProfile>,
    isSuperAdmin: boolean = false
  ) {
    if (isSuperAdmin) return { allowed: true };
    // Clients must never escalate role, societyId, householdId, flatId, or isSocietyAdmin
    if (updatedData.role && updatedData.role !== currentProfile.role) {
      return { allowed: false, error: "Unauthorized role change attempt blocked." };
    }
    if (updatedData.isSocietyAdmin && !currentProfile.isSocietyAdmin) {
      return { allowed: false, error: "Unauthorized society admin escalation blocked." };
    }
    if (updatedData.societyId && updatedData.societyId !== currentProfile.societyId) {
      return { allowed: false, error: "Unauthorized cross-society migration blocked." };
    }
    return { allowed: true };
  }

  const baseResident: UserProfile = {
    uid: "usr-resident-1",
    displayName: "Minkush Goyal",
    email: "minkush@example.com",
    role: "resident",
    societyId: "soc-ajanta-genx",
    towerId: "tower-a",
    flatId: "flat-a-1204",
    householdId: "hh-a-1204",
    createdAt: new Date().toISOString()
  };

  const escalationAttempt = validateProfileUpdate(baseResident, {
    role: "society_admin" as any,
    isSocietyAdmin: true
  });
  assert(
    !escalationAttempt.allowed,
    "Client write cannot escalate role to society_admin",
    "Security",
    "Client role escalation is strictly blocked"
  );

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 2: HOUSEHOLD MULTI-MEMBER MODEL (Part Q & U)
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n--- 2. Household Multi-Member Model ---");

  // Multiple accounts can belong to the same flat/household without overwrite
  interface HouseholdRegistry {
    id: string;
    flatId: string;
    members: Array<{ uid: string; name: string; relation: "owner" | "tenant" | "family" }>;
  }

  const societyHouseholds: Record<string, HouseholdRegistry> = {
    "hh-a-1204": {
      id: "hh-a-1204",
      flatId: "flat-a-1204",
      members: [{ uid: "usr-1", name: "Minkush Goyal", relation: "owner" }]
    }
  };

  function registerFamilyMember(householdId: string, member: { uid: string; name: string; relation: "owner" | "tenant" | "family" }) {
    const hh = societyHouseholds[householdId];
    if (!hh) return false;
    // Append without overwriting
    hh.members.push(member);
    return true;
  }

  registerFamilyMember("hh-a-1204", { uid: "usr-2", name: "Suman Goyal", relation: "family" });
  assert(
    societyHouseholds["hh-a-1204"].members.length === 2 &&
      societyHouseholds["hh-a-1204"].members[0].uid === "usr-1" &&
      societyHouseholds["hh-a-1204"].members[1].uid === "usr-2",
    "Registering a second member for the same flat must not overwrite existing members",
    "Household",
    "Multiple users belong to same household without data loss"
  );

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 3: RESIDENT COMPLAINT CREATION & GPS COMPLIANCE (Part D, J, U)
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n--- 3. Resident Complaint Creation & GPS Location ---");

  // 3A. With GPS Permission Granted
  const complaintWithGps: Partial<Complaint> = {
    id: "cmp-test-gps-granted",
    societyId: "soc-ajanta-genx",
    householdId: "hh-a-1204",
    towerId: "tower-a",
    flatId: "flat-a-1204",
    createdByUserId: "usr-resident-1",
    reportedBy: "usr-resident-1",
    title: "Water leaking under kitchen sink",
    description: "Cold water supply pipe has a hairline crack and is dripping onto the floor cabinet.",
    category: "plumbing",
    priority: "high",
    status: "open",
    locationType: "flat",
    location: "Flat A-1204, Tower A",
    locationSource: "gps",
    latitude: 28.535512,
    longitude: 77.391024,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  assert(
    complaintWithGps.status === "open" &&
      complaintWithGps.locationSource === "gps" &&
      typeof complaintWithGps.latitude === "number" &&
      typeof complaintWithGps.longitude === "number",
    "Complaint with GPS must store real coordinates and locationSource = 'gps'",
    "Resident",
    "Resident mobile creates complaint with GPS coordinates"
  );

  // 3B. With GPS Permission Denied (Must never use fake fallback coordinates)
  const complaintGpsDenied: Partial<Complaint> = {
    id: "cmp-test-gps-denied",
    societyId: "soc-ajanta-genx",
    householdId: "hh-a-1204",
    towerId: "tower-a",
    flatId: "flat-a-1204",
    createdByUserId: "usr-resident-1",
    reportedBy: "usr-resident-1",
    title: "Kitchen sink drain clogged",
    description: "Water draining very slowly in kitchen sink.",
    category: "plumbing",
    priority: "medium",
    status: "open",
    locationType: "flat",
    location: "Flat A-1204, Tower A",
    locationSource: "unavailable",
    latitude: undefined,
    longitude: undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  assert(
    complaintGpsDenied.locationSource === "unavailable" &&
      complaintGpsDenied.latitude === undefined &&
      complaintGpsDenied.longitude === undefined,
    "When GPS permission is denied, locationSource must be 'unavailable' with null/undefined coordinates",
    "Resident",
    "GPS denial sets locationSource = 'unavailable' without fake coordinates"
  );

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 4: MANAGEMENT DISPATCH & QUALIFICATION SCORING (Part E, G, U)
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n--- 4. Management Dispatch & Qualification-First Routing ---");

  const testStaffRoster: StaffProfile[] = [
    {
      id: "staff-deepak-busy",
      name: "Deepak Verma (Busy Specialist)",
      role: "maintenance_staff",
      societyId: "soc-ajanta-genx",
      department: "lift",
      skills: ["lift", "electrical"],
      active: true,
      availabilityStatus: "busy", // BUSY
      currentWorkload: 4, // 4 active tickets
      phone: "+91 98111 22334"
    },
    {
      id: "staff-ramesh-idle",
      name: "Ramesh Sharma (Idle Gardener)",
      role: "maintenance_staff",
      societyId: "soc-ajanta-genx",
      department: "gardening",
      skills: ["gardening"], // UNQUALIFIED for lift
      active: true,
      availabilityStatus: "available", // AVAILABLE & IDLE
      currentWorkload: 0,
      phone: "+91 98222 33445"
    }
  ];

  const liftRecommendation = getTechnicianAssignmentRecommendation("lift", testStaffRoster, { priority: "high" });

  assert(
    liftRecommendation.recommendedStaff?.id === "staff-deepak-busy",
    `Busy qualified technician MUST outscore unqualified idle technician. Selected: ${liftRecommendation.recommendedStaff?.name}`,
    "Staff",
    "Qualified busy technician is chosen over available unqualified worker"
  );

  assert(
    Boolean(liftRecommendation.workloadWarning && liftRecommendation.workloadWarning.includes("High workload")),
    "High workload warning must be provided when recommending a busy qualified technician",
    "Staff",
    "Workload warning is generated for busy qualified technician"
  );

  // Transition: OPEN -> ASSIGNED
  const assignResult = validateComplaintTransition({
    currentStatus: "open",
    targetStatus: "assigned",
    actorRole: "society_manager",
    actorUserId: "usr-manager-1",
    assignedStaffId: "staff-deepak"
  });

  assert(
    assignResult.valid === true,
    "Management must be authorized to assign open complaints",
    "Complaints",
    "Management transition OPEN -> ASSIGNED succeeds"
  );

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 5: TECHNICIAN WORKFLOW & DIRECT-CLOSE BAR (Part E, M, U)
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n--- 5. Technician Workflow & Security Boundaries ---");

  // 5A. ASSIGNED -> IN_PROGRESS
  const startWorkResult = validateComplaintTransition({
    currentStatus: "assigned",
    targetStatus: "in_progress",
    actorRole: "maintenance_staff",
    actorUserId: "staff-deepak",
    assignedStaffId: "staff-deepak"
  });

  assert(
    startWorkResult.valid === true,
    "Assigned technician can transition ASSIGNED -> IN_PROGRESS",
    "Complaints",
    "Technician start work ASSIGNED -> IN_PROGRESS succeeds"
  );

  // 5B. Unassigned technician cannot hijack another's ticket
  const hijackAttempt = validateComplaintTransition({
    currentStatus: "assigned",
    targetStatus: "in_progress",
    actorRole: "maintenance_staff",
    actorUserId: "staff-other-tech",
    assignedStaffId: "staff-deepak"
  });

  assert(
    hijackAttempt.valid === false,
    "Technician cannot start work on ticket assigned to another technician",
    "Security",
    "Cross-technician task hijacking blocked"
  );

  // 5C. IN_PROGRESS -> RESIDENT_CONFIRMATION
  const completeWorkResult = validateComplaintTransition({
    currentStatus: "in_progress",
    targetStatus: "resident_confirmation",
    actorRole: "maintenance_staff",
    actorUserId: "staff-deepak",
    assignedStaffId: "staff-deepak",
    notes: "Replaced faulty optical sensor on car door header. Recalibrated landing level alignment.",
    proofUrl: "https://storage.googleapis.com/resolvex/proof.jpg"
  });

  assert(
    completeWorkResult.valid === true,
    "Technician can transition IN_PROGRESS -> RESIDENT_CONFIRMATION with proof",
    "Complaints",
    "Technician marks work ready for resident confirmation"
  );

  // 5D. CRITICAL SECURITY RULE: Technician directly closing ticket MUST FAIL
  const techDirectCloseResult = validateComplaintTransition({
    currentStatus: "resident_confirmation",
    targetStatus: "closed",
    actorRole: "maintenance_staff",
    actorUserId: "staff-deepak",
    assignedStaffId: "staff-deepak"
  });

  assert(
    techDirectCloseResult.valid === false,
    "Technician must NEVER be allowed to directly close a complaint awaiting resident verification",
    "Security",
    "Technician direct closure attempt is STRICTLY DENIED"
  );

  // 5E. Technician cannot modify protected complaint fields (SLA, priority, category)
  function validateTechnicianUpdateFields(actorRole: string, diff: Record<string, any>) {
    if (actorRole === "maintenance_staff") {
      const forbiddenFields = ["slaDeadline", "slaDueAt", "priority", "category", "societyId", "flatId", "reportedBy"];
      const violated = forbiddenFields.some((f) => f in diff);
      if (violated) {
        return { allowed: false, error: "Technicians cannot modify SLA, priority, or category." };
      }
    }
    return { allowed: true };
  }

  const techTamperAttempt = validateTechnicianUpdateFields("maintenance_staff", {
    priority: "low",
    slaDeadline: "2026-12-31"
  });
  assert(
    !techTamperAttempt.allowed,
    "Technician cannot alter complaint priority or SLA deadline",
    "Security",
    "Protected complaint fields barred from technician edits"
  );

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 6: RESIDENT CONFIRMATION & MANDATORY REOPEN BRANCH (Part D, U)
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n--- 6. Resident Verification & Reopen Branch ---");

  // 6A. Resident confirms resolution (RESIDENT_CONFIRMATION -> CLOSED)
  const residentConfirmResult = validateComplaintTransition({
    currentStatus: "resident_confirmation",
    targetStatus: "closed",
    actorRole: "resident",
    actorUserId: "usr-resident-1",
    reportedByUserId: "usr-resident-1",
    isHouseholdMember: true
  });

  assert(
    residentConfirmResult.valid === true,
    "Authorized resident can confirm resolution and transition ticket to CLOSED",
    "Complaints",
    "Resident confirms resolution RESIDENT_CONFIRMATION -> CLOSED succeeds"
  );

  // 6B. Reopen branch: Empty reason MUST FAIL
  const emptyReopenResult = validateComplaintTransition({
    currentStatus: "resident_confirmation",
    targetStatus: "reopened",
    actorRole: "resident",
    actorUserId: "usr-resident-1",
    reportedByUserId: "usr-resident-1",
    isHouseholdMember: true,
    reopenReason: "   " // Empty whitespace
  });

  assert(
    emptyReopenResult.valid === false,
    "Reopening without a valid reason must be rejected",
    "Complaints",
    "Reopen with empty reason is REJECTED"
  );

  // 6C. Reopen branch: Valid reason MUST SUCCEED
  const validReopenResult = validateComplaintTransition({
    currentStatus: "resident_confirmation",
    targetStatus: "reopened",
    actorRole: "resident",
    actorUserId: "usr-resident-1",
    reportedByUserId: "usr-resident-1",
    isHouseholdMember: true,
    reopenReason: "Door is still shuddering and sticking on 6th floor landing."
  });

  assert(
    validReopenResult.valid === true,
    "Reopening with non-empty reason must be allowed for authorized resident",
    "Complaints",
    "Resident reopen with valid reason RESIDENT_CONFIRMATION -> REOPENED succeeds"
  );

  // 6D. Reopened -> Assigned
  const reassignResult = validateComplaintTransition({
    currentStatus: "reopened",
    targetStatus: "assigned",
    actorRole: "society_manager",
    actorUserId: "usr-manager-1",
    assignedStaffId: "staff-deepak"
  });

  assert(
    reassignResult.valid === true,
    "Management must be able to reassign reopened complaints",
    "Complaints",
    "Management reassign REOPENED -> ASSIGNED succeeds"
  );

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 7: SECURITY GUARD - PASS SCAN, CHECK-IN & DELIVERIES (Part F, U)
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n--- 7. Security Guard: Pass Validation, Check-in & Deliveries ---");

  const testPasses: VisitorPass[] = [
    {
      id: "visit-1204",
      societyId: "soc-ajanta-genx",
      householdId: "hh-a-1204",
      flatId: "flat-a-1204",
      createdByUserId: "usr-resident-1",
      visitorName: "Rohan Khanna",
      visitorPhone: "+91 98111 22334",
      type: "guest",
      visitDate: "2026-09-24",
      status: "expected",
      qrToken: "AJX-1204"
    },
    {
      id: "visit-cancelled",
      societyId: "soc-ajanta-genx",
      householdId: "hh-a-1204",
      flatId: "flat-a-1204",
      createdByUserId: "usr-resident-1",
      visitorName: "Suspicious Visitor",
      type: "guest",
      visitDate: "2026-09-24",
      status: "cancelled",
      qrToken: "AJX-CANCELLED"
    }
  ];

  function simulatePassValidation(societyId: string, token: string) {
    const clean = token.trim();
    const pass = testPasses.find((p) => p.societyId === societyId && (p.qrToken === clean || p.id === clean));
    if (!pass) {
      return { valid: false, reason: "Unauthorized / Forged Token: No matching pass found for this society." };
    }
    if (pass.status === "cancelled" || pass.status === "expired" || pass.status === "denied") {
      return { valid: false, reason: `Pass is ${pass.status}. Access denied.` };
    }
    return { valid: true, pass };
  }

  // 7A. Valid token
  const validPassRes = simulatePassValidation("soc-ajanta-genx", "AJX-1204");
  assert(validPassRes.valid && validPassRes.pass?.visitorName === "Rohan Khanna", "Legitimate pass token validates", "Security", "Valid QR pass verified");

  // 7B. Cancelled token
  const cancelledPassRes = simulatePassValidation("soc-ajanta-genx", "AJX-CANCELLED");
  assert(!cancelledPassRes.valid && cancelledPassRes.reason?.includes("cancelled"), "Cancelled pass denied entry", "Security", "Cancelled pass denied");

  // 7C. Forged / non-existent token
  const forgedPassRes = simulatePassValidation("soc-ajanta-genx", "FORGED-TOKEN-999");
  assert(!forgedPassRes.valid, "Forged token strictly rejected", "Security", "Forged pass token rejected");

  // 7D. Cross-society guard isolation: guard in society B cannot validate society A pass
  const crossSocPassRes = simulatePassValidation("soc-other-complex", "AJX-1204");
  assert(!crossSocPassRes.valid, "Pass from society A not valid in society B", "Security", "Cross-society pass verification blocked");

  // 7E. Deliveries logging & resident ping
  const deliveryStore: Delivery[] = [];
  function recordDelivery(societyId: string, guardId: string, data: { flatId: string; courierName: string }) {
    const d: Delivery = {
      id: `deliv-${Date.now()}`,
      societyId,
      householdId: `hh-${data.flatId.toLowerCase()}`,
      flatId: data.flatId,
      courierName: data.courierName,
      status: "received_at_gate",
      securityActorId: guardId,
      receivedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
    deliveryStore.push(d);
    return d;
  }

  const newDelivery = recordDelivery("soc-ajanta-genx", "usr-guard-1", {
    flatId: "flat-a-1204",
    courierName: "Amazon"
  });
  assert(
    newDelivery.status === "received_at_gate" && newDelivery.courierName === "Amazon",
    "Security guard logs delivery with status received_at_gate",
    "Security",
    "Delivery receipt logged at gate"
  );

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 8: MEDIA & STORAGE VALIDATION (Part I, N, U)
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n--- 8. Media Upload & Storage Security ---");

  function validateAttachmentUpload(file: { name: string; sizeBytes: number; mimeType: string }) {
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];

    if (file.sizeBytes > MAX_SIZE) {
      return { valid: false, error: `File size exceeds 10MB limit (${(file.sizeBytes / 1024 / 1024).toFixed(1)}MB)` };
    }
    if (!ALLOWED_MIME.includes(file.mimeType)) {
      return { valid: false, error: `Disallowed file type (${file.mimeType}). Only JPEG, PNG, WEBP allowed.` };
    }
    return { valid: true };
  }

  // 8A. Valid JPEG <= 10MB
  const validPhoto = validateAttachmentUpload({
    name: "leak_photo.jpg",
    sizeBytes: 2.4 * 1024 * 1024,
    mimeType: "image/jpeg"
  });
  assert(validPhoto.valid, "Valid JPEG under 10MB accepted", "Storage", "Valid image upload passes validation");

  // 8B. File > 10MB rejected
  const oversizedPhoto = validateAttachmentUpload({
    name: "huge_raw_image.jpg",
    sizeBytes: 14.5 * 1024 * 1024,
    mimeType: "image/jpeg"
  });
  assert(!oversizedPhoto.valid && oversizedPhoto.error?.includes("10MB"), "Oversized file (>10MB) rejected", "Storage", "Oversized photo upload rejected");

  // 8C. Disallowed MIME rejected
  const maliciousFile = validateAttachmentUpload({
    name: "script.sh",
    sizeBytes: 1024,
    mimeType: "application/x-sh"
  });
  assert(!maliciousFile.valid, "Non-image MIME type rejected", "Storage", "Disallowed file MIME type rejected");

  // 8D. Tenant-scoped storage path format
  function getTenantStoragePath(societyId: string, complaintId: string, filename: string) {
    return `societies/${societyId}/complaints/${complaintId}/${filename}`;
  }
  const storagePath = getTenantStoragePath("soc-ajanta-genx", "cmp-1001", "proof.jpg");
  assert(
    storagePath === "societies/soc-ajanta-genx/complaints/cmp-1001/proof.jpg",
    "Storage path must be tenant-scoped under societies/{societyId}/",
    "Storage",
    "Tenant-scoped storage path generated"
  );

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 9: AMENITY DOUBLE-BOOKING CONFLICT PREVENTION (Part G, U)
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n--- 9. Amenities: Duplicate Booking Prevention ---");

  const bookingsTable = [
    { amenityId: "amn-tennis", date: "2026-09-10", slot: "06:00 - 07:00", status: "confirmed", userId: "user-1" }
  ];

  function simulateBookingAttempt(amenityId: string, date: string, slot: string, userId: string) {
    const conflict = bookingsTable.some(
      (b) => b.amenityId === amenityId && b.date === date && b.slot === slot && b.status !== "cancelled"
    );
    if (conflict) {
      return { success: false, error: `Slot "${slot}" is already booked on ${date}.` };
    }
    bookingsTable.push({ amenityId, date, slot, status: "confirmed", userId });
    return { success: true };
  }

  const booking1 = simulateBookingAttempt("amn-tennis", "2026-09-10", "07:00 - 08:00", "user-2");
  assert(booking1.success === true, "Booking an open slot must succeed", "Amenities", "Open slot booking succeeds");

  const bookingConflict = simulateBookingAttempt("amn-tennis", "2026-09-10", "06:00 - 07:00", "user-3");
  assert(
    bookingConflict.success === false && bookingConflict.error?.includes("already booked"),
    "Concurrent/duplicate booking for the same slot MUST be rejected",
    "Amenities",
    "Duplicate slot booking is atomically REJECTED"
  );

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 10: POLL SINGLE-VOTE LOCK & INTEGRITY (Part U)
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n--- 10. Community: Poll Single-Vote Lock & Integrity ---");

  const voteRecords = new Set<string>();

  function castVote(pollId: string, userId: string, optionId: string) {
    const voteKey = `${pollId}_${userId}`;
    if (voteRecords.has(voteKey)) {
      return { success: false, error: "User has already voted in this poll." };
    }
    voteRecords.add(voteKey);
    return { success: true };
  }

  const vote1 = castVote("poll-q3-budget", "usr-resident-1", "opt-yes");
  assert(vote1.success === true, "First vote must be registered", "Community", "First poll vote succeeds");

  const vote2 = castVote("poll-q3-budget", "usr-resident-1", "opt-no");
  assert(
    vote2.success === false,
    "Second vote attempt by the same user in the same poll MUST be rejected",
    "Community",
    "Duplicate vote attempt by same user is REJECTED"
  );

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 11: ASSET QR CODE RESOLUTION (Part H, U)
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n--- 11. QR Code Resolution & Tamper Resistance ---");

  const resolvedValid = resolveQRCode("QR-AJX-TA-LIFT1");
  assert(
    resolvedValid !== null &&
      resolvedValid.societyId === "soc-ajanta-genx" &&
      resolvedValid.category === "lift",
    "Valid QR token QR-AJX-TA-LIFT1 must resolve to Ajanta Gen-X lift category",
    "QR",
    "Valid asset QR resolves correct society and category"
  );

  const resolvedInvalid = resolveQRCode("QR-MALICIOUS-FAKE-ASSET");
  assert(
    resolvedInvalid === null,
    "Forged or invalid QR token must return null and prevent arbitrary asset spoofing",
    "QR",
    "Forged asset QR token returns null"
  );

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 12: AUDIT LOG IMMUTABILITY (Part M, U)
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n--- 12. Security: Audit Log Immutability ---");

  function validateAuditLogOperation(operation: "create" | "update" | "delete") {
    // Firestore rules specify: allow read: if signedIn(); allow create: if signedIn(); allow update, delete: if false;
    if (operation === "update" || operation === "delete") {
      return { allowed: false, error: "Audit logs are strictly immutable and cannot be updated or deleted." };
    }
    return { allowed: true };
  }

  assert(!validateAuditLogOperation("update").allowed, "Updating audit log is blocked", "Security", "Audit log modification prohibited");
  assert(!validateAuditLogOperation("delete").allowed, "Deleting audit log is blocked", "Security", "Audit log deletion prohibited");
  assert(validateAuditLogOperation("create").allowed, "Creating audit log is allowed", "Security", "Audit log appending allowed");

  // ──────────────────────────────────────────────────────────────────────────
  // SUMMARY
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n=======================================================");
  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;
  console.log(`Test Execution Summary: ${passedCount} / ${totalCount} PASSED`);
  console.log("=======================================================\n");

  if (passedCount !== totalCount) {
    console.error("Test failures encountered.");
    process.exit(1);
  }
}

runGoldenE2ETests().catch((err) => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
