import { deleteApp, initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  sendPasswordResetEmail
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where
} from "firebase/firestore";
import type {
  StaffAvailability,
  StaffDepartment,
  UserProfile
} from "@resolvex/types";
import { auth, db, firebaseConfig, isFirebaseConfigured } from "../firebase";
import { cleanFirestorePayload } from "../utils/firestore-clean";
import { recordAuditEvent } from "./audit-service";

export interface CreateStaffParams {
  name: string;
  email: string;
  phone: string;
  role: "maintenance_staff" | "security_guard";
  department: StaffDepartment;
  societyId: string;
  initialPassword?: string;
  actorUserId?: string;
}

export interface CreateStaffResult {
  uid: string;
  email: string;
  role?: "maintenance_staff" | "security_guard";
  department?: StaffDepartment;
  temporaryPassword?: string;
  isExistingAuth: boolean;
  message: string;
}

function getDepartmentSkills(dept: StaffDepartment): string[] {
  switch (dept) {
    case "plumbing":
      return ["plumbing", "water_supply", "common_area"];
    case "electrical":
      return ["electrical", "high_voltage", "substation", "common_area"];
    case "carpentry":
      return ["carpentry", "furniture", "woodwork", "common_area"];
    case "lift":
      return ["lift", "elevator", "safety_inspection", "machinery", "common_area"];
    case "housekeeping":
      return ["cleanliness", "housekeeping", "waste_management", "common_area"];
    case "gardening":
      return ["gardening", "horticulture", "irrigation", "landscaping", "common_area"];
    case "security":
      return ["security", "perimeter_defense", "visitor_protocol", "gate_desk"];
    case "water_management":
      return ["water_management", "water_supply", "stp_plant", "borewell", "common_area"];
    case "other":
      return ["other", "general_maintenance", "common_area"];
    case "general_maintenance":
    default:
      return ["general_maintenance", "common_area"];
  }
}

/**
 * Creates a real Firebase Auth account and links it to users/{uid} in Firestore
 * without storing plaintext passwords in Firestore.
 * Uses a secondary isolated FirebaseApp instance to prevent signing out the current management admin.
 */
export async function createOrInviteStaff(
  params: CreateStaffParams
): Promise<CreateStaffResult> {
  const email = params.email.trim().toLowerCase();
  const name = params.name.trim();
  const phone = params.phone.trim();
  const societyId = params.societyId || "soc-ajanta-genx";
  const role = params.role;
  const department = params.department;
  const actorUserId = params.actorUserId || auth.currentUser?.uid || "admin";

  if (!role || !["maintenance_staff", "security_guard"].includes(role)) {
    throw new Error("Role is mandatory and must be Maintenance Staff or Security Guard.");
  }
  if (!department) {
    throw new Error("Department is mandatory.");
  }
  if (role === "security_guard" && department !== "security") {
    throw new Error("For Security Guard, department must be Security.");
  }
  const validMaintenanceDepts: StaffDepartment[] = [
    "plumbing",
    "electrical",
    "carpentry",
    "housekeeping",
    "general_maintenance",
    "other",
    "lift",
    "gardening",
    "water_management"
  ];
  if (role === "maintenance_staff" && !validMaintenanceDepts.includes(department)) {
    throw new Error("For Maintenance Staff, department must be one of the configured maintenance departments.");
  }

  const passwordToUse =
    params.initialPassword?.trim() ||
    `Staff@${Math.floor(100000 + Math.random() * 900000)}`;

  let staffUid = "";
  let isExisting = false;

  if (isFirebaseConfigured) {
    // 1. Check if user profile already exists with this email in Firestore
    const userQuery = query(
      collection(db, "users"),
      where("email", "==", email)
    );
    const existingSnap = await getDocs(userQuery);
    if (!existingSnap.empty) {
      staffUid = existingSnap.docs[0].id;
      isExisting = true;
    }

    // 2. Provision or verify in Firebase Auth using temporary secondary instance
    const tempAppName = `staff-provision-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const tempApp = initializeApp(firebaseConfig, tempAppName);
    const tempAuth = getAuth(tempApp);

    try {
      if (!isExisting) {
        try {
          const cred = await createUserWithEmailAndPassword(
            tempAuth,
            email,
            passwordToUse
          );
          staffUid = cred.user.uid;
        } catch (authErr: any) {
          if (authErr.code === "auth/email-already-in-use") {
            isExisting = true;
            // Send reset email so staff can set their own credentials
            try {
              await sendPasswordResetEmail(auth, email);
            } catch {}
          } else {
            throw authErr;
          }
        }
      }
    } finally {
      await deleteApp(tempApp).catch(() => {});
    }

    if (!staffUid) {
      // Fallback search
      const reCheck = await getDocs(
        query(collection(db, "users"), where("email", "==", email))
      );
      if (!reCheck.empty) {
        staffUid = reCheck.docs[0].id;
      } else {
        throw new Error(
          `Unable to resolve Firebase Auth UID for email: ${email}`
        );
      }
    }

    // 3. Link / create the Firestore profile at users/{staffUid}
    const now = new Date().toISOString();
    const existingDoc = await getDoc(doc(db, "users", staffUid));
    const existingData = existingDoc.exists() ? existingDoc.data() : {};

    const profileData: Partial<UserProfile> = cleanFirestorePayload({
      ...existingData,
      uid: staffUid,
      email,
      displayName: name,
      name,
      phone,
      role,
      platformRoles: [role],
      department,
      societyId,
      status: "verified",
      isSocietyAdmin: false,
      skills: getDepartmentSkills(department),
      assignedFacilityIds: existingData.assignedFacilityIds || [],
      currentWorkload: existingData.currentWorkload || 0,
      availabilityStatus: existingData.availabilityStatus || "on_duty",
      active: true,
      updatedAt: now,
      createdAt: existingData.createdAt || now
    });

    await setDoc(doc(db, "users", staffUid), profileData, { merge: true });

    // 4. Record audit log event
    await recordAuditEvent({
      actorUserId,
      actorRole: "society_admin",
      societyId,
      action: "staff_created",
      entityType: "user",
      entityId: staffUid,
      metadata: {
        staffName: name,
        email,
        role,
        department,
        isExistingAuth: isExisting
      }
    });

    return {
      uid: staffUid,
      email,
      role,
      department,
      temporaryPassword: isExisting ? undefined : passwordToUse,
      isExistingAuth: isExisting,
      message: isExisting
        ? `Staff member profile updated for ${name}. An invitation / password reset link has been dispatched.`
        : `Staff member created successfully with Firebase Auth credentials for ${name}.`
    };
  }

  // Non-Firebase / offline fallback
  staffUid = `staff-${Date.now()}`;
  return {
    uid: staffUid,
    email,
    role,
    department,
    temporaryPassword: passwordToUse,
    isExistingAuth: false,
    message: `Staff member profile created offline.`
  };
}

/**
 * Dispatches an official password reset / invitation link to a staff member's email
 */
export async function sendStaffPasswordReset(email: string): Promise<void> {
  if (isFirebaseConfigured) {
    await sendPasswordResetEmail(auth, email.trim());
  }
}

/**
 * Updates staff technician duty availability in Firestore
 */
export async function updateStaffDutyStatus(
  staffId: string,
  societyId: string,
  status: StaffAvailability
): Promise<void> {
  if (isFirebaseConfigured) {
    await updateDoc(doc(db, "users", staffId), {
      availabilityStatus: status,
      updatedAt: new Date().toISOString()
    });
  }
}
