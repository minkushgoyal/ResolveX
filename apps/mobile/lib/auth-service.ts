import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User
} from "firebase/auth";
import {
  arrayUnion,
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
import type { Household, HouseholdRole, PlatformRole, StaffDepartment, UserProfile } from "@resolvex/types";
import { mapFirebaseErrorToMessage, validateSocietyTowerFlat } from "@resolvex/utils";
import { auth, db, isFirebaseConfigured } from "./firebase";
import { useMobileSessionStore, getCachedProfile, clearCachedProfile } from "./session-store";
import { registerForPushNotificationsAsync } from "./device-capabilities";
import { cleanFirestorePayload } from "./firestore-clean";

let activeProfileUnsub: (() => void) | null = null;

/**
 * Listens to Firebase Authentication state and live Firestore users/{uid} document.
 * Role and status come strictly from the authenticated Firestore profile.
 * Rapid startup: hydrates from local AsyncStorage cache first, then synchronizes with Firestore.
 * NO demo fallback, NO hardcoded users.
 */
export function subscribeMobileAuth(
  callback: (user: User | null, profile: UserProfile | null) => void
): () => void {
  if (!isFirebaseConfigured) {
    callback(null, null);
    useMobileSessionStore.getState().setSession(null, null);
    return () => {};
  }

  let profileUnsub: (() => void) | null = null;
  let isInitialCallbackDone = false;

  // 1. Immediately hydrate profile from local AsyncStorage cache if available (0ms latency startup)
  getCachedProfile()
    .then((cached) => {
      console.log("[STARTUP 5] Cached profile loaded | cached:", cached ? `${cached.displayName} (${cached.status})` : "none");
      if (cached && !isInitialCallbackDone) {
        const currentStore = useMobileSessionStore.getState();
        if (!currentStore.userProfile) {
          console.log("[Auth] Restoring profile from AsyncStorage cache for instant UI startup:", cached.uid);
          currentStore.setCachedProfile(cached);
          if (auth.currentUser && auth.currentUser.uid === cached.uid) {
            currentStore.setSession(auth.currentUser, cached);
            callback(auth.currentUser, cached);
          }
        }
      }
    })
    .catch(() => {});

  const authUnsub = onAuthStateChanged(auth, async (firebaseUser) => {
    console.log("[STARTUP 6] Auth state received | user:", firebaseUser ? firebaseUser.uid : "null (unauthenticated)");
    // Clean up any existing Firestore profile listener for this subscriber
    if (profileUnsub) {
      profileUnsub();
      profileUnsub = null;
      activeProfileUnsub = null;
    }

    if (!firebaseUser) {
      isInitialCallbackDone = true;
      await clearCachedProfile();
      callback(null, null);
      useMobileSessionStore.getState().setSession(null, null);
      return;
    }

    // Check if current cached profile matches authenticated user
    try {
      const cached = await getCachedProfile();
      if (cached && cached.uid === firebaseUser.uid) {
        isInitialCallbackDone = true;
        callback(firebaseUser, cached);
        useMobileSessionStore.getState().setSession(firebaseUser, cached);
      }
    } catch {}

    // Attach real-time snapshot listener to users/{uid} for live sync
    const userDocRef = doc(db, "users", firebaseUser.uid);
    profileUnsub = onSnapshot(
      userDocRef,
      (snapshot) => {
        isInitialCallbackDone = true;
        if (snapshot.exists()) {
          const profile = snapshot.data() as UserProfile;
          const merged: UserProfile = {
            ...profile,
            emailVerified: firebaseUser.emailVerified
          };
          if (profile.role === "maintenance_staff") {
            console.log(`[STAFF SESSION LOADED] uid=${profile.uid} role=${profile.role} status=${profile.status}`);
          } else if (profile.role === "security_guard") {
            console.log(`[SECURITY GUARD SESSION] uid=${profile.uid} status=${profile.status}`);
          }
          callback(firebaseUser, merged);
          useMobileSessionStore.getState().setSession(firebaseUser, merged);
          // Register device for push notifications in background
          registerForPushNotificationsAsync(firebaseUser.uid).catch(() => {});
        } else {
          // Document not yet written (e.g. mid-registration) or not found
          callback(firebaseUser, null);
          useMobileSessionStore.getState().setProfileNotFound(firebaseUser);
        }
      },
      (error) => {
        console.warn("Firestore profile snapshot error:", error);
        isInitialCallbackDone = true;
        const current = useMobileSessionStore.getState();
        if (!current.userProfile) {
          callback(firebaseUser, null);
          current.setProfileNotFound(firebaseUser);
        } else {
          current.setLoading(false);
        }
      }
    );
    activeProfileUnsub = profileUnsub;
  });

  return () => {
    authUnsub();
    if (profileUnsub) {
      profileUnsub();
      profileUnsub = null;
      activeProfileUnsub = null;
    }
  };
}

/**
 * Sign in with email and password against live Firebase
 */
export async function mobileSignIn(email: string, pass: string): Promise<UserProfile> {
  if (!isFirebaseConfigured) {
    throw new Error("Firebase Authentication is not configured. Please set environment variables in apps/mobile/.env.");
  }

  console.log("[AUTH LOGIN START]");
  try {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
    const user = cred.user;
    console.log(`[AUTH LOGIN SUCCESS] uid=${user.uid}`);

    // Reload auth user to refresh token and emailVerified state
    try {
      await user.reload();
    } catch (reloadErr) {
      console.warn("[AUTH LOGIN] User reload warning:", reloadErr);
    }

    console.log(`[AUTH PROFILE FETCH] uid=${user.uid}`);
    const snap = await getDoc(doc(db, "users", user.uid));
    if (!snap.exists()) {
      console.log("[AUTH LOGIN ERROR] code=profile-not-found");
      throw new Error("Your user profile was not found in the society database. Please register for an account.");
    }

    const profile = snap.data() as UserProfile;
    console.log(`[AUTH PROFILE STATUS] status=${profile.status}`);
    console.log(`[AUTH EMAIL VERIFIED] ${user.emailVerified}`);
    if (profile.role === "maintenance_staff") {
      console.log(`[STAFF SESSION LOADED] uid=${profile.uid} role=${profile.role} status=${profile.status}`);
    } else if (profile.role === "security_guard") {
      console.log(`[SECURITY GUARD SESSION] uid=${profile.uid} status=${profile.status}`);
    }

    useMobileSessionStore.getState().setSession(user, profile);
    console.log("[AUTH SESSION UPDATED]");

    return profile;
  } catch (err: any) {
    console.log(`[AUTH LOGIN ERROR] code=${err?.code || "unknown"} message=${err?.message}`);
    throw new Error(mapFirebaseErrorToMessage(err));
  }
}

export interface MobileRegisterParams {
  fullName: string;
  email: string;
  password: string;
  phone: string;
  societyId: string;
  role: "resident" | "flat_owner" | "tenant" | "maintenance_staff" | "security_guard";
  householdRole?: HouseholdRole;
  towerId?: string;
  flatNumber?: string;
  department?: StaffDepartment;
  specialization?: string;
  gate?: string;
  shift?: string;
}

function computeStaffSkills(specialization?: string, department?: StaffDepartment): import("@resolvex/types").ComplaintCategory[] {
  const skills = new Set<import("@resolvex/types").ComplaintCategory>();
  const specLower = (specialization || "").toLowerCase();

  if (specLower.includes("plumb") || department === "plumbing") {
    skills.add("plumbing");
    skills.add("water_supply");
  }
  if (specLower.includes("electr") || specLower.includes("hvac") || specLower.includes("ac") || department === "electrical") {
    skills.add("electrical");
  }
  if (specLower.includes("carpent") || department === "carpentry") {
    skills.add("carpentry");
    skills.add("common_area");
    skills.add("other");
  }
  if (specLower.includes("lift") || specLower.includes("elevator") || department === "lift") {
    skills.add("lift");
  }
  if (specLower.includes("clean") || specLower.includes("housekeeping") || department === "housekeeping") {
    skills.add("cleanliness");
    skills.add("common_area");
  }
  if (specLower.includes("garden") || department === "gardening") {
    skills.add("common_area");
  }
  if (specLower.includes("paint") || specLower.includes("general") || department === "general_maintenance") {
    skills.add("common_area");
    skills.add("other");
  }

  if (skills.size === 0) {
    skills.add("other");
  }

  return Array.from(skills);
}

/**
 * Real user registration.
 * CRITICAL SECURITY REQUIREMENT:
 * Every newly registered account MUST initially have status = "pending".
 * NO FIRST-REGISTRANT AUTO-VERIFICATION.
 * A user can NEVER claim an empty flat and become verified automatically.
 */
export async function mobileRegister(params: MobileRegisterParams): Promise<UserProfile> {
  if (!isFirebaseConfigured) {
    throw new Error("Firebase is not configured. Please verify apps/mobile/.env.");
  }

  const isStaffRole = params.role === "maintenance_staff";
  const isGuardRole = params.role === "security_guard";
  const isResidentRole = ["resident", "flat_owner", "tenant"].includes(params.role);

  if (isStaffRole) {
    console.log("[STAFF REGISTER START]");
  }

  // 1. Role verification: Allow residents, maintenance staff, and security guard
  const allowedRoles = ["resident", "flat_owner", "tenant", "maintenance_staff", "security_guard"];
  if (!allowedRoles.includes(params.role)) {
    throw new Error("Invalid registration role. Privileged and management roles cannot be registered through this portal.");
  }

  // 2. Validate hierarchy for resident accounts
  let sanitizedFlatId = "";
  let targetHouseholdId = "";
  let cleanFlat = "";

  if (isResidentRole) {
    if (!params.towerId || !params.flatNumber) {
      throw new Error("Tower and flat number are required for resident registration.");
    }
    const hierarchy = validateSocietyTowerFlat(params.societyId, params.towerId, params.flatNumber);
    if (!hierarchy.valid) {
      throw new Error(hierarchy.error || "Invalid society, tower, or flat combination.");
    }
    cleanFlat = params.flatNumber.trim().toUpperCase();
    sanitizedFlatId = hierarchy.sanitizedFlatId || `flat-${params.towerId}-${cleanFlat}`;
    targetHouseholdId = `hh-${params.towerId.replace("tower-", "")}-${cleanFlat.replace(/[^A-Z0-9]/gi, "").toLowerCase()}`;
  } else if (isStaffRole) {
    if (!params.specialization && !params.department) {
      throw new Error("Maintenance staff must select a specialization trade.");
    }
  }

  const now = new Date().toISOString();

  // 3. Create Firebase Authentication account
  let cred: any;
  try {
    cred = await createUserWithEmailAndPassword(auth, params.email.trim(), params.password);
    console.log(`[AUTH REGISTER SUCCESS] uid=${cred.user.uid}`);
    if (isStaffRole) {
      console.log(`[STAFF REGISTER AUTH SUCCESS] uid=${cred.user.uid}`);
    }
  } catch (err: any) {
    if (isStaffRole) {
      console.log(`[STAFF REGISTER ERROR] code=${err?.code || "auth-error"}`);
    }
    throw new Error(mapFirebaseErrorToMessage(err));
  }

  try {
    // 4. Create user profile with STRICT initial status = "pending"
    const userProfile: UserProfile = {
      uid: cred.user.uid,
      displayName: params.fullName.trim(),
      name: params.fullName.trim(),
      email: params.email.trim(),
      phone: params.phone.trim(),
      role: params.role as PlatformRole,
      platformRoles: [params.role as PlatformRole],
      societyId: params.societyId,
      status: "pending", // ALWAYS pending verification by management!
      emailVerified: cred.user.emailVerified,
      isSocietyAdmin: false,
      onboardingCompleted: false,
      createdAt: now,
      updatedAt: now,
      ...(isResidentRole
        ? {
            householdRole:
              params.householdRole ||
              (params.role === "flat_owner"
                ? "owner"
                : params.role === "tenant"
                ? "tenant"
                : "family_member"),
            towerId: params.towerId,
            flatId: sanitizedFlatId,
            householdId: targetHouseholdId
          }
        : {}),
      ...(isStaffRole
        ? {
            department: params.department || "general_maintenance",
            specialization: params.specialization || "General Maintenance",
            skills: computeStaffSkills(params.specialization, params.department),
            availabilityStatus: "available",
            active: true
          }
        : {}),
      ...(isGuardRole
        ? {
            department: "security",
            gate: params.gate || "Main Gate",
            shift: params.shift || "General Shift",
            skills: ["security"],
            availabilityStatus: "on_duty",
            active: true
          }
        : {})
    };

    const cleanUser = cleanFirestorePayload(userProfile);
    await setDoc(doc(db, "users", cred.user.uid), cleanUser);

    console.log("[AUTH REGISTER FIRESTORE SUCCESS]");
    console.log("[AUTH REGISTER STATUS] pending");
    if (isStaffRole) {
      console.log(`[STAFF REGISTER PROFILE SUCCESS] uid=${cred.user.uid} role=maintenance_staff status=pending`);
    }
    console.log("[AUTH REGISTER]", {
      uid: cred.user.uid,
      email: userProfile.email,
      firebaseAuthSuccess: true,
      firestoreUsersWriteSuccess: true,
      status: userProfile.status,
      societyId: userProfile.societyId,
      role: userProfile.role,
      emailVerified: cred.user.emailVerified
    });

    // 5. If resident/owner/tenant, link user's UID to household's pendingRequestIds
    if (isResidentRole && targetHouseholdId) {
      try {
        const householdRef = doc(db, "households", targetHouseholdId);
        const householdSnap = await getDoc(householdRef);

        if (householdSnap.exists()) {
          await updateDoc(householdRef, {
            pendingRequestIds: arrayUnion(cred.user.uid),
            updatedAt: now
          });
        } else {
          // Create household with applicant in pendingRequestIds (NOT memberIds!)
          const newHousehold: Household = {
            id: targetHouseholdId,
            societyId: params.societyId,
            towerId: params.towerId!,
            flatId: sanitizedFlatId,
            displayName: `${cleanFlat} Household`,
            inviteCode: `${params.towerId!.toUpperCase()}-${cleanFlat}`,
            memberIds: [], // NEVER add applicant directly as verified member
            pendingRequestIds: [cred.user.uid],
            createdAt: now
          };
          await setDoc(householdRef, cleanFirestorePayload(newHousehold));
        }
      } catch (householdErr) {
        console.warn("[AUTH REGISTER] Note: household link deferred or skipped:", householdErr);
      }
    }

    // 6. Send email verification
    try {
      await sendEmailVerification(cred.user);
    } catch (e) {
      console.warn("Could not send email verification:", e);
    }

    useMobileSessionStore.getState().setSession(cred.user, userProfile);
    return userProfile;
  } catch (err: any) {
    if (isStaffRole) {
      console.log(`[STAFF REGISTER ERROR] code=${err?.code || "firestore-write-error"}`);
    }
    console.error("[VERIFICATION DEBUG] Firestore user registration failed:", {
      code: err?.code,
      message: err?.message,
      error: err
    });
    try {
      await cred.user.delete();
    } catch {}
    throw new Error(err.message || "Failed to register user profile in society database.");
  }
}

/**
 * Send password reset email
 */
export async function mobileForgotPassword(email: string): Promise<void> {
  if (!isFirebaseConfigured) {
    throw new Error("Firebase Authentication is not configured.");
  }

  try {
    await sendPasswordResetEmail(auth, email.trim());
  } catch (err: any) {
    throw new Error(mapFirebaseErrorToMessage(err));
  }
}

/**
 * Completely sign out and reset mobile session
 */
export async function mobileSignOut(): Promise<void> {
  if (activeProfileUnsub) {
    activeProfileUnsub();
    activeProfileUnsub = null;
  }
  useMobileSessionStore.getState().clearSession();
  if (isFirebaseConfigured) {
    await firebaseSignOut(auth);
  }
}
