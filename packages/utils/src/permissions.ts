import type {
  Complaint,
  ComplaintCategory,
  Facility,
  FacilityStatus,
  HouseholdRole,
  PlatformRole,
  ResidentUser,
  StaffDepartment,
  StaffProfile,
  UserProfile,
  VisitorPass
} from "@resolvex/types";

export const roleLabels: Record<PlatformRole, string> = {
  resident: "Resident",
  flat_owner: "Flat Owner",
  tenant: "Tenant",
  society_admin: "Society Admin",
  society_manager: "Society Manager",
  security_guard: "Security Guard",
  maintenance_staff: "Maintenance Staff",
  service_provider: "Service Provider",
  super_admin: "Super Admin"
};

export const householdRoleLabels: Record<HouseholdRole, string> = {
  owner: "Owner",
  co_owner: "Co-owner",
  family_member: "Family Member",
  tenant: "Tenant",
  relative: "Relative",
  other_resident: "Other Resident"
};

export const departmentLabels: Record<StaffDepartment, string> = {
  plumbing: "Plumbing",
  electrical: "Electrical",
  carpentry: "Carpentry",
  housekeeping: "Housekeeping",
  general_maintenance: "General Maintenance",
  other: "Other",
  security: "Security",
  lift: "Lift & Escalator Care",
  gardening: "Horticulture & Landscape",
  water_management: "Water Supply & Pumping"
};

export const MAINTENANCE_DEPARTMENTS: { value: StaffDepartment; label: string }[] = [
  { value: "plumbing", label: "Plumbing" },
  { value: "electrical", label: "Electrical" },
  { value: "carpentry", label: "Carpentry" },
  { value: "housekeeping", label: "Housekeeping" },
  { value: "general_maintenance", label: "General Maintenance" },
  { value: "other", label: "Other" }
];

export const SECURITY_DEPARTMENTS: { value: StaffDepartment; label: string }[] = [
  { value: "security", label: "Security" }
];

export const facilityStatusLabels: Record<FacilityStatus, string> = {
  operational: "Operational",
  under_maintenance: "Under Maintenance",
  degraded: "Degraded Performance",
  out_of_service: "Out of Service"
};

export type UserLike =
  | UserProfile
  | ResidentUser
  | {
      id?: string;
      uid?: string;
      role?: PlatformRole;
      platformRoles?: PlatformRole[];
      householdRole?: HouseholdRole;
      householdId?: string;
      societyId?: string;
    }
  | null
  | undefined;

export function getUserId(user: UserLike): string | undefined {
  if (!user) return undefined;
  if ("uid" in user && user.uid) return user.uid;
  if ("id" in user && user.id) return user.id;
  return undefined;
}

/**
 * Check if a user possesses a specific platform role
 */
export function hasRole(user: UserLike, role: PlatformRole): boolean {
  if (!user) return false;
  if ("role" in user && user.role === role) return true;
  if ("platformRoles" in user && Array.isArray(user.platformRoles)) {
    return user.platformRoles.includes(role);
  }
  return false;
}

/**
 * Check if a user has society-level management authorization
 */
export function canManageSociety(user: UserLike): boolean {
  return hasRole(user, "society_admin") || hasRole(user, "society_manager") || hasRole(user, "super_admin");
}

/**
 * Check if user can manage a household (invite/verify/remove members)
 */
export function canManageHousehold(user: UserLike): boolean {
  if (!user) return false;
  if (canManageSociety(user)) return true;
  return user.householdRole === "owner" || user.householdRole === "co_owner";
}

/**
 * Check if user can view a specific complaint based on role and household scoping
 */
export function canViewComplaint(user: UserLike, complaint: Partial<Complaint>): boolean {
  if (!user) return false;
  if (hasRole(user, "super_admin")) return true;

  // Management sees all society complaints
  if (canManageSociety(user)) return true;

  const userId = getUserId(user);

  // Maintenance staff sees work orders assigned to them
  if (hasRole(user, "maintenance_staff")) {
    return complaint.assignedStaffId === userId || !complaint.assignedStaffId;
  }

  // Residents, flat owners, tenants see complaints for their household
  if (user.householdId && complaint.householdId) {
    return user.householdId === complaint.householdId;
  }

  // Reported by user directly
  if (userId && (complaint.createdByUserId === userId || complaint.reportedBy === userId)) {
    return true;
  }

  return false;
}

/**
 * Check if user can update a complaint (work progress, assignment, confirmation, reopening)
 */
export function canUpdateComplaint(user: UserLike, complaint: Partial<Complaint>): boolean {
  if (!user) return false;
  if (canManageSociety(user)) return true;

  const userId = getUserId(user);

  // Assigned technician can update progress
  if (hasRole(user, "maintenance_staff") && complaint.assignedStaffId === userId) {
    return true;
  }

  // Resident of the household can confirm resolution or reopen
  if (user.householdId && complaint.householdId && user.householdId === complaint.householdId) {
    return true;
  }

  return false;
}

/**
 * Check if user can assign complaints to staff
 */
export function canAssignComplaint(user: UserLike): boolean {
  return canManageSociety(user);
}

/**
 * Check if user can approve or deny a visitor pass
 */
export function canApproveVisitor(user: UserLike, visitorPass: Partial<VisitorPass>): boolean {
  if (!user) return false;
  if (hasRole(user, "security_guard") || canManageSociety(user)) return true;
  if (user.householdId && visitorPass.householdId) {
    return user.householdId === visitorPass.householdId;
  }
  return false;
}

/**
 * Check if user can access or log service on a facility
 */
export function canAccessFacility(user: UserLike, facility?: Partial<Facility>): boolean {
  if (!user) return false;
  if (canManageSociety(user)) return true;
  if (hasRole(user, "maintenance_staff")) {
    if (!facility || !facility.responsibleStaffId) return true;
    const userId = getUserId(user);
    return facility.responsibleStaffId === userId;
  }
  if (hasRole(user, "security_guard")) {
    return facility?.category === "security" || facility?.category === "cctv";
  }
  return true; // Read-only for recreation/amenities
}

/**
 * Check if user can view household financial bills
 */
export function canViewHouseholdBills(user: UserLike, tenantsCanViewBills: boolean = false): boolean {
  if (!user) return false;
  if (canManageSociety(user)) return true;
  if (user.householdRole === "tenant") {
    return tenantsCanViewBills;
  }
  return ["owner", "co_owner", "family_member", "relative"].includes(user.householdRole || "");
}

export interface StaffRecommendationOptions {
  societyId?: string;
  facilityId?: string;
  priority?: "low" | "medium" | "high" | "critical" | "emergency" | string;
}

export interface StaffRecommendationResult {
  recommendedStaff?: StaffProfile;
  workloadWarning?: string;
  score: number;
  reason: string;
}

/**
 * Checks whether a staff member is eligible and specialized for a complaint category
 */
export function isStaffEligibleForCategory(
  staff: {
    role?: string;
    department?: string;
    skills?: string[];
    specialization?: string;
    status?: string;
    active?: boolean;
    availabilityStatus?: string;
    societyId?: string;
  },
  category: string,
  targetSocietyId?: string
): { eligible: boolean; reason: string } {
  // 1. Society tenant isolation check
  if (targetSocietyId && staff.societyId && staff.societyId !== targetSocietyId) {
    return { eligible: false, reason: `Staff belongs to society '${staff.societyId}', not '${targetSocietyId}'` };
  }

  // 2. Approval status
  if (staff.status && staff.status !== "verified") {
    return { eligible: false, reason: `Staff registration is not verified (status: ${staff.status})` };
  }

  // 3. Active status
  if (staff.active === false) {
    return { eligible: false, reason: "Staff profile is marked inactive" };
  }

  // 4. Trade and skill compatibility check
  const cat = (category || "").toLowerCase();
  const dept = (staff.department || "").toLowerCase();
  const spec = (staff.specialization || "").toLowerCase();
  const skills = (staff.skills || []).map((s) => String(s).toLowerCase());

  let matchesTrade = false;
  let matchDetail = "";

  if (cat === "carpentry") {
    matchesTrade = dept === "carpentry" || skills.includes("carpentry") || spec.includes("carpent");
    matchDetail = "Carpentry specialist";
  } else if (cat === "plumbing" || cat === "water_supply") {
    matchesTrade =
      dept === "plumbing" ||
      dept === "water_management" ||
      skills.includes("plumbing") ||
      skills.includes("water_supply") ||
      spec.includes("plumb");
    matchDetail = "Plumbing / Water supply specialist";
  } else if (cat === "electrical") {
    matchesTrade =
      dept === "electrical" ||
      skills.includes("electrical") ||
      skills.includes("high_voltage") ||
      spec.includes("electr") ||
      spec.includes("hvac") ||
      spec.includes("ac");
    matchDetail = "Electrical specialist";
  } else if (cat === "lift") {
    matchesTrade = dept === "lift" || skills.includes("lift") || spec.includes("lift") || spec.includes("elevator");
    matchDetail = "Elevator / Lift technician";
  } else if (cat === "security" || cat === "noise" || cat === "parking") {
    matchesTrade =
      staff.role === "security_guard" ||
      dept === "security" ||
      skills.includes("security") ||
      spec.includes("guard") ||
      spec.includes("security");
    matchDetail = "Security personnel";
  } else if (cat === "cleanliness" || cat === "pest_control") {
    matchesTrade =
      dept === "housekeeping" ||
      skills.includes("cleanliness") ||
      skills.includes("housekeeping") ||
      skills.includes("pest_control") ||
      spec.includes("clean") ||
      spec.includes("housekeep");
    matchDetail = "Housekeeping / Sanitation staff";
  } else if (cat === "gardening") {
    matchesTrade = dept === "gardening" || skills.includes("gardening") || spec.includes("garden");
    matchDetail = "Horticulture staff";
  } else if (cat === "common_area" || cat === "other") {
    matchesTrade =
      dept === "general_maintenance" ||
      dept === "other" ||
      skills.includes("common_area") ||
      skills.includes("other") ||
      skills.includes("general_maintenance");
    matchDetail = "General maintenance technician";
  } else {
    matchesTrade = skills.includes(cat) || dept === cat;
    matchDetail = `Direct match for ${category}`;
  }

  if (!matchesTrade) {
    return {
      eligible: false,
      reason: `Staff member's trade (${staff.department || "unspecified"}) is not compatible with ${category} issues`
    };
  }

  return { eligible: true, reason: matchDetail };
}

/**
 * Advanced recommendation algorithm considering:
 * 1. Strict category / specialization trade qualification (unqualified staff are NEVER recommended)
 * 2. Society tenant isolation (must belong to target society)
 * 3. Verification approval (unapproved staff excluded)
 * 4. Duty availability (off-duty staff are excluded from automatic dispatch)
 * 5. Workload balancing among qualified candidates (graduated penalty for active tickets)
 * 6. SLA urgency prioritization
 */
export function getTechnicianAssignmentRecommendation(
  category: ComplaintCategory,
  staffList: StaffProfile[],
  options?: StaffRecommendationOptions
): StaffRecommendationResult {
  if (!staffList || staffList.length === 0) {
    return {
      recommendedStaff: undefined,
      score: 0,
      reason: "No staff members provided."
    };
  }

  // 1. Filter to candidates matching society, active status, and not off-duty
  const candidatePool = staffList.filter((s) => {
    if (options?.societyId && s.societyId && s.societyId !== options.societyId) {
      return false;
    }
    if (s.active === false) {
      return false;
    }
    // Strict requirement: Exclude unapproved / pending staff
    if ((s as any).status && (s as any).status !== "verified") {
      return false;
    }
    // Strict requirement: Exclude off-duty staff from auto-assignment
    if (s.availabilityStatus === "off_duty") {
      return false;
    }
    return true;
  });

  if (!candidatePool.length) {
    return {
      recommendedStaff: undefined,
      score: 0,
      reason: `No approved, on-duty staff available in society '${options?.societyId || "current"}'.`
    };
  }

  // 2. Score ONLY candidates who are genuinely qualified for this trade
  const qualifiedScored: Array<{
    staff: StaffProfile;
    score: number;
    reason: string;
  }> = [];

  for (const staff of candidatePool) {
    const eligibility = isStaffEligibleForCategory(staff, category, options?.societyId);
    if (!eligibility.eligible) {
      // Disqualified! Do not recommend staff with the wrong trade
      continue;
    }

    let score = 100; // Base score for qualified specialist
    const reasons: string[] = [eligibility.reason];

    // Asset / Facility bonus
    const hasFacilityMatch = Boolean(
      options?.facilityId && staff.assignedFacilityIds?.includes(options.facilityId)
    );
    if (hasFacilityMatch) {
      score += 40;
      reasons.push("Assigned to asset/facility");
    }

    // Availability status scoring (all in candidate pool are not off_duty)
    switch (staff.availabilityStatus) {
      case "available":
        score += 30;
        reasons.push("Available for immediate dispatch");
        break;
      case "on_duty":
        score += 20;
        reasons.push("On active shift");
        break;
      case "busy":
        score += 5;
        reasons.push("Currently engaged with active orders");
        break;
    }

    // Workload balance penalty: graduated penalty based on current tickets
    const workload = staff.currentWorkload || 0;
    score -= Math.min(workload * 10, 50);

    // SLA urgency boost
    const isUrgent = options?.priority === "critical" || options?.priority === "emergency" || options?.priority === "high";
    if (isUrgent && (staff.availabilityStatus === "available" || staff.availabilityStatus === "on_duty")) {
      score += 25;
      reasons.push("Urgent SLA responder");
    }

    qualifiedScored.push({
      staff,
      score,
      reason: reasons.join(", ")
    });
  }

  if (qualifiedScored.length === 0) {
    return {
      recommendedStaff: undefined,
      score: 0,
      reason: `No approved, on-duty staff found with specialization in '${category}'. Awaiting management dispatch.`
    };
  }

  // 3. Sort deterministically: highest score first, then lowest workload, then by ID
  qualifiedScored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const aWorkload = a.staff.currentWorkload || 0;
    const bWorkload = b.staff.currentWorkload || 0;
    if (aWorkload !== bWorkload) return aWorkload - bWorkload;
    return a.staff.id.localeCompare(b.staff.id);
  });

  const best = qualifiedScored[0];
  let workloadWarning: string | undefined;
  if ((best.staff.currentWorkload || 0) >= 4 || best.staff.availabilityStatus === "busy") {
    workloadWarning = `High workload warning: ${best.staff.name} currently has ${best.staff.currentWorkload || 0} active assignments.`;
  }

  return {
    recommendedStaff: best.staff,
    workloadWarning,
    score: best.score,
    reason: best.reason
  };
}

/**
 * Recommendation algorithm: considers qualification, current workload, facility ownership, and duty status
 */
export function getRecommendedStaff(
  category: ComplaintCategory,
  staffList: StaffProfile[],
  options?: StaffRecommendationOptions
): StaffProfile | undefined {
  const result = getTechnicianAssignmentRecommendation(category, staffList, options);
  return result.recommendedStaff;
}
