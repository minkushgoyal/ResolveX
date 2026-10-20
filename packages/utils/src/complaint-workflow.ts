import type { ComplaintStatus, PlatformRole } from "@resolvex/types";

export type CanonicalComplaintStatus =
  | "open"
  | "assigned"
  | "in_progress"
  | "resident_confirmation"
  | "closed"
  | "reopened";

export const CANONICAL_COMPLAINT_STATUSES: readonly CanonicalComplaintStatus[] = [
  "open",
  "assigned",
  "in_progress",
  "resident_confirmation",
  "closed",
  "reopened"
] as const;

/**
 * Normalizes legacy status aliases to their canonical equivalents
 */
export function normalizeComplaintStatus(status: ComplaintStatus | string): CanonicalComplaintStatus {
  switch (status) {
    case "work_completed":
      return "resident_confirmation";
    case "resolved":
      return "closed";
    case "under_review":
      return "open";
    case "open":
    case "assigned":
    case "in_progress":
    case "resident_confirmation":
    case "closed":
    case "reopened":
      return status;
    default:
      return "open";
  }
}

export interface TransitionValidationParams {
  currentStatus: ComplaintStatus | string;
  targetStatus: ComplaintStatus | string;
  actorRole: PlatformRole;
  actorUserId?: string;
  assignedStaffId?: string;
  reportedByUserId?: string;
  isHouseholdMember?: boolean;
  notes?: string;
  reopenReason?: string;
  proofUrl?: string;
}

export interface TransitionValidationResult {
  valid: boolean;
  error?: string;
  canonicalFrom: CanonicalComplaintStatus;
  canonicalTo: CanonicalComplaintStatus;
}

/**
 * Shared Complaint State Machine Validator
 * Enforces:
 * 1. Allowed state transitions
 * 2. Role-based transition authorization
 * 3. Mandatory reasons for reopening
 * 4. Technicians can NEVER directly force final closure
 */
export function validateComplaintTransition(
  params: TransitionValidationParams
): TransitionValidationResult {
  const canonicalFrom = normalizeComplaintStatus(params.currentStatus);
  const canonicalTo = normalizeComplaintStatus(params.targetStatus);

  // Identity transition (no-op status update)
  if (canonicalFrom === canonicalTo) {
    return { valid: true, canonicalFrom, canonicalTo };
  }

  const isManagement = ["society_manager", "society_admin", "super_admin"].includes(params.actorRole);
  const isTechnician = params.actorRole === "maintenance_staff";
  const isResidentOrOwner = ["resident", "flat_owner", "tenant"].includes(params.actorRole);
  const isAssignedTech =
    isTechnician &&
    Boolean(params.actorUserId && params.assignedStaffId && params.actorUserId === params.assignedStaffId);
  const isAuthorizedResident =
    isResidentOrOwner &&
    (Boolean(params.actorUserId && params.reportedByUserId && params.actorUserId === params.reportedByUserId) ||
      Boolean(params.isHouseholdMember));

  // 1. OPEN -> ASSIGNED
  if (canonicalFrom === "open" && canonicalTo === "assigned") {
    if (!isManagement) {
      return {
        valid: false,
        error: "Only society managers or administrators can assign complaints to staff.",
        canonicalFrom,
        canonicalTo
      };
    }
    return { valid: true, canonicalFrom, canonicalTo };
  }

  // 2. ASSIGNED -> IN_PROGRESS
  if (canonicalFrom === "assigned" && canonicalTo === "in_progress") {
    if (!isTechnician && !isManagement) {
      return {
        valid: false,
        error: "Only the assigned maintenance technician or management can begin work.",
        canonicalFrom,
        canonicalTo
      };
    }
    if (isTechnician && params.assignedStaffId && params.actorUserId && params.assignedStaffId !== params.actorUserId) {
      return {
        valid: false,
        error: "Technicians can only start work orders assigned to them.",
        canonicalFrom,
        canonicalTo
      };
    }
    return { valid: true, canonicalFrom, canonicalTo };
  }

  // 3. IN_PROGRESS -> RESIDENT_CONFIRMATION (Work Completed)
  if (canonicalFrom === "in_progress" && canonicalTo === "resident_confirmation") {
    if (!isTechnician && !isManagement) {
      return {
        valid: false,
        error: "Only the maintenance technician or management can mark work completed for verification.",
        canonicalFrom,
        canonicalTo
      };
    }
    if (isTechnician && params.assignedStaffId && params.actorUserId && params.assignedStaffId !== params.actorUserId) {
      return {
        valid: false,
        error: "Technicians can only complete work orders assigned to them.",
        canonicalFrom,
        canonicalTo
      };
    }
    return { valid: true, canonicalFrom, canonicalTo };
  }

  // Direct start from OPEN -> IN_PROGRESS (allowed for emergency/urgent technician dispatch)
  if (canonicalFrom === "open" && canonicalTo === "in_progress") {
    if (!isManagement && !isTechnician) {
      return {
        valid: false,
        error: "Only management or assigned technician can move an open ticket to in_progress.",
        canonicalFrom,
        canonicalTo
      };
    }
    return { valid: true, canonicalFrom, canonicalTo };
  }

  // 4. RESIDENT_CONFIRMATION -> CLOSED (Resident Confirmation)
  if (canonicalFrom === "resident_confirmation" && canonicalTo === "closed") {
    // CRITICAL: Technicians must NEVER directly close resident confirmation
    if (isTechnician) {
      return {
        valid: false,
        error: "Technicians cannot confirm or close tickets. Resident verification is mandatory.",
        canonicalFrom,
        canonicalTo
      };
    }
    if (!isAuthorizedResident && !isManagement) {
      return {
        valid: false,
        error: "Only the resident reporter, household member, or society manager can confirm closure.",
        canonicalFrom,
        canonicalTo
      };
    }
    return { valid: true, canonicalFrom, canonicalTo };
  }

  // 5. RESIDENT_CONFIRMATION -> REOPENED
  if (canonicalFrom === "resident_confirmation" && canonicalTo === "reopened") {
    if (isTechnician) {
      return {
        valid: false,
        error: "Technicians cannot reopen a work order pending resident verification.",
        canonicalFrom,
        canonicalTo
      };
    }
    if (!isAuthorizedResident && !isManagement) {
      return {
        valid: false,
        error: "Only the resident reporter or household member can reopen this complaint.",
        canonicalFrom,
        canonicalTo
      };
    }
    if (!params.reopenReason || !params.reopenReason.trim()) {
      return {
        valid: false,
        error: "A non-empty reason is mandatory to reopen a complaint.",
        canonicalFrom,
        canonicalTo
      };
    }
    return { valid: true, canonicalFrom, canonicalTo };
  }

  // 6. REOPENED -> ASSIGNED / IN_PROGRESS
  if (canonicalFrom === "reopened" && (canonicalTo === "assigned" || canonicalTo === "in_progress")) {
    if (!isManagement && !isTechnician) {
      return {
        valid: false,
        error: "Only management or assigned technician can restart work on a reopened complaint.",
        canonicalFrom,
        canonicalTo
      };
    }
    return { valid: true, canonicalFrom, canonicalTo };
  }

  // 7. CLOSED -> REOPENED (Special escalation by resident within warranty period)
  if (canonicalFrom === "closed" && canonicalTo === "reopened") {
    if (!isAuthorizedResident && !isManagement) {
      return {
        valid: false,
        error: "Only the resident or management can reopen a closed ticket.",
        canonicalFrom,
        canonicalTo
      };
    }
    if (!params.reopenReason || !params.reopenReason.trim()) {
      return {
        valid: false,
        error: "A non-empty reason is mandatory to reopen a closed complaint.",
        canonicalFrom,
        canonicalTo
      };
    }
    return { valid: true, canonicalFrom, canonicalTo };
  }

  return {
    valid: false,
    error: `Illegal state transition from "${canonicalFrom}" to "${canonicalTo}".`,
    canonicalFrom,
    canonicalTo
  };
}
