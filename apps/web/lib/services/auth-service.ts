import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User
} from "firebase/auth";
import {
  arrayRemove,
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
import type { Household, HouseholdRole, PlatformRole, UserProfile } from "@resolvex/types";
import {
  mapFirebaseErrorToMessage,
  validateSocietyTowerFlat
} from "@resolvex/utils";
import { auth, db, isFirebaseConfigured } from "../firebase";
import { cleanFirestorePayload } from "../utils/firestore-clean";
import { reactiveStore } from "./data-store";

export type AuthCallback = (user: User | null, profile: UserProfile | null) => void;

/**
 * Listens to Firebase authentication state changes and loads Firestore user profile.
 * Firebase Auth and Firestore users/{uid} is the single source of truth.
 */
export function subscribeToAuth(callback: AuthCallback): () => void {
  if (isFirebaseConfigured) {
    let profileUnsub: (() => void) | null = null;

    const authUnsub = onAuthStateChanged(auth, (firebaseUser) => {
      if (profileUnsub) {
        try { profileUnsub(); } catch {}
        profileUnsub = null;
      }

      if (!firebaseUser) {
        callback(null, null);
        return;
      }

      const userDocRef = doc(db, "users", firebaseUser.uid);
      profileUnsub = onSnapshot(
        userDocRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const profile = snapshot.data() as UserProfile;
            const mergedProfile: UserProfile = {
              ...profile,
              emailVerified: firebaseUser.emailVerified
            };
            callback(firebaseUser, mergedProfile);
          } else {
            callback(firebaseUser, null);
          }
        },
        (err) => {
          console.warn("Error subscribing to user profile doc:", err);
          callback(firebaseUser, null);
        }
      );
    });

    return () => {
      if (profileUnsub) {
        try { profileUnsub(); } catch {}
        profileUnsub = null;
      }
      authUnsub();
    };
  }

  callback(null, null);
  return () => {};
}

/**
 * Sign in with Email & Password
 */
export async function signInWithEmail(email: string, pass: string): Promise<UserProfile> {
  if (isFirebaseConfigured) {
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
      const userDocRef = doc(db, "users", cred.user.uid);
      const snapshot = await getDoc(userDocRef);

      if (snapshot.exists()) {
        const profile = snapshot.data() as UserProfile;
        return { ...profile, emailVerified: cred.user.emailVerified };
      }

      // If document missing, create fallback
      const fallbackProfile: UserProfile = {
        uid: cred.user.uid,
        displayName: cred.user.displayName || email.split("@")[0],
        email: cred.user.email || email,
        phone: "+91 98000 00000",
        role: "resident",
        platformRoles: ["resident"],
        societyId: "soc-ajanta-genx",
        householdId: "hh-a-1204",
        flatId: "flat-a-1204",
        towerId: "tower-a",
        status: "verified",
        emailVerified: cred.user.emailVerified,
        onboardingCompleted: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await setDoc(userDocRef, cleanFirestorePayload(fallbackProfile));
      return fallbackProfile;
    } catch (err: any) {
      throw new Error(mapFirebaseErrorToMessage(err));
    }
  }

  throw new Error("Firebase Authentication is not configured.");
}

export interface RegisterParams {
  fullName: string;
  email: string;
  password: string;
  phone: string;
  societyId: string;
  towerId: string;
  flatNumber: string;
  role?: PlatformRole;
  photoURL?: string;
}

/**
 * Real registration with society hierarchy validation and duplicate-proof household linking
 */
export async function registerWithHouseholdValidation(params: RegisterParams): Promise<UserProfile> {
  // 1. Validate society, tower, and flat
  const hierarchyCheck = validateSocietyTowerFlat(params.societyId, params.towerId, params.flatNumber);
  if (!hierarchyCheck.valid) {
    throw new Error(hierarchyCheck.error || "Invalid society, tower, or flat combination.");
  }

  // 2. Role security: Restrict public registration to resident roles only
  const requestedRole = params.role || "resident";
  const safeRole: PlatformRole = ["resident", "flat_owner", "tenant"].includes(requestedRole)
    ? requestedRole
    : "resident";

  const householdRole: HouseholdRole =
    safeRole === "flat_owner" ? "owner" : safeRole === "tenant" ? "tenant" : "family_member";

  const cleanFlat = params.flatNumber.trim().toUpperCase();
  const sanitizedFlatId = hierarchyCheck.sanitizedFlatId || `flat-${params.towerId}-${cleanFlat}`;
  const now = new Date().toISOString();

  if (isFirebaseConfigured) {
    // 3. Create Firebase Authentication account
    let cred;
    try {
      cred = await createUserWithEmailAndPassword(auth, params.email.trim(), params.password);
    } catch (err: any) {
      throw new Error(mapFirebaseErrorToMessage(err));
    }

    try {
      // 4. Create canonical UserProfile document in Firestore (strictly initial status = 'pending')
      const targetHouseholdId = `hh-${params.towerId.replace("tower-", "")}-${cleanFlat.replace(/[^A-Z0-9]/gi, "").toLowerCase()}`;

      const userProfile: UserProfile = {
        uid: cred.user.uid,
        displayName: params.fullName.trim(),
        email: params.email.trim(),
        phone: params.phone.trim(),
        ...(params.photoURL ? { photoURL: params.photoURL } : {}),
        role: safeRole,
        platformRoles: [safeRole],
        householdRole,
        societyId: params.societyId,
        towerId: params.towerId,
        flatId: sanitizedFlatId,
        householdId: targetHouseholdId,
        status: "pending", // NO AUTO-VERIFICATION: Every applicant requires management approval
        emailVerified: cred.user.emailVerified,
        onboardingCompleted: false,
        createdAt: now,
        updatedAt: now
      };

      await setDoc(doc(db, "users", cred.user.uid), cleanFirestorePayload(userProfile));

      // 5. Check whether household exists and append to pendingRequestIds
      const householdDocRef = doc(db, "households", targetHouseholdId);
      const householdSnap = await getDoc(householdDocRef);

      if (householdSnap.exists()) {
        await updateDoc(householdDocRef, {
          pendingRequestIds: arrayUnion(cred.user.uid),
          updatedAt: now
        });
      } else {
        // Query as fallback check
        const householdsRef = collection(db, "households");
        const householdQuery = query(
          householdsRef,
          where("societyId", "==", params.societyId),
          where("towerId", "==", params.towerId),
          where("flatId", "==", sanitizedFlatId)
        );
        const querySnap = await getDocs(householdQuery);

        if (!querySnap.empty) {
          const existingDoc = querySnap.docs[0];
          await updateDoc(doc(db, "households", existingDoc.id), {
            pendingRequestIds: arrayUnion(cred.user.uid),
            updatedAt: now
          });
        } else {
          // No household exists: Create the primary household record with applicant in pendingRequestIds (NOT memberIds!)
          const newHousehold: Household = {
            id: targetHouseholdId,
            societyId: params.societyId,
            towerId: params.towerId,
            flatId: sanitizedFlatId,
            displayName: `${cleanFlat} Household`,
            inviteCode: `${params.towerId.toUpperCase()}-${cleanFlat}`,
            memberIds: [], // NEVER add applicant as verified member automatically
            pendingRequestIds: [cred.user.uid],
            createdAt: now
          };

          await setDoc(householdDocRef, cleanFirestorePayload(newHousehold));
        }
      }

      // 6. Dispatch email verification
      try {
        await sendEmailVerification(cred.user);
      } catch (emailErr) {
        console.warn("Could not dispatch initial email verification:", emailErr);
      }

      return {
        ...userProfile,
        status: "pending"
      };
    } catch (firestoreErr: any) {
      // 7. Rollback handling: clean up orphan Auth account if Firestore setup fails
      console.error("Firestore registration failure, rolling back Auth account:", firestoreErr);
      try {
        await cred.user.delete();
      } catch (rollbackErr) {
        console.warn("Rollback delete failed:", rollbackErr);
      }
      throw new Error(
        `Registration could not be completed: ${firestoreErr.message || "Database write error"}. Please try again.`
      );
    }
  }

  // Demo / Local Store Fallback
  const allHouseholds = reactiveStore.getCollection<Household>("households");
  let existingHh = allHouseholds.find(
    (h) => h.societyId === params.societyId && h.towerId === params.towerId && h.flatId === sanitizedFlatId
  );

  const uid = `user-${Date.now()}`;
  let userStatus: UserProfile["status"] = "verified";
  let targetHouseholdId = "";

  if (existingHh) {
    targetHouseholdId = existingHh.id;
    userStatus = "pending_verification";
    existingHh.pendingRequestIds = [...(existingHh.pendingRequestIds || []), uid];
    reactiveStore.setDoc("households", existingHh);
  } else {
    targetHouseholdId = `hh-${params.towerId.replace("tower-", "")}-${cleanFlat.toLowerCase()}`;
    const newHh: Household = {
      id: targetHouseholdId,
      societyId: params.societyId,
      towerId: params.towerId,
      flatId: sanitizedFlatId,
      displayName: `${cleanFlat} Household`,
      inviteCode: `${params.towerId.toUpperCase()}-${cleanFlat}`,
      memberIds: [uid],
      pendingRequestIds: [],
      createdAt: now
    };
    reactiveStore.setDoc("households", newHh);
  }

  const profile: UserProfile = {
    uid,
    displayName: params.fullName.trim(),
    email: params.email.trim(),
    phone: params.phone.trim(),
    ...(params.photoURL ? { photoURL: params.photoURL } : {}),
    role: safeRole,
    platformRoles: [safeRole],
    householdRole,
    societyId: params.societyId,
    towerId: params.towerId,
    flatId: sanitizedFlatId,
    householdId: targetHouseholdId,
    status: userStatus,
    emailVerified: true,
    onboardingCompleted: true,
    createdAt: now,
    updatedAt: now
  };

  reactiveStore.setDoc("users", profile);
  return profile;
}

/**
 * Backward compatibility alias for existing calls
 */
export async function signUpWithEmail(
  email: string,
  pass: string,
  extra: Partial<UserProfile>
): Promise<UserProfile> {
  return registerWithHouseholdValidation({
    fullName: extra.displayName || email.split("@")[0],
    email,
    password: pass,
    phone: extra.phone || "+91 98000 00000",
    societyId: extra.societyId || "soc-ajanta-genx",
    towerId: extra.towerId || "tower-a",
    flatNumber: extra.flatId?.replace("flat-a-", "") || "1204",
    role: extra.role || "resident",
    ...(extra.photoURL ? { photoURL: extra.photoURL } : {})
  });
}

/**
 * Sign in with Google with onboarding check
 */
export async function signInWithGoogle(): Promise<{ profile: UserProfile; needsOnboarding: boolean }> {
  if (isFirebaseConfigured) {
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      const userDocRef = doc(db, "users", cred.user.uid);
      const snapshot = await getDoc(userDocRef);

      if (snapshot.exists()) {
        const profile = snapshot.data() as UserProfile;
        const needsOnboarding = !profile.societyId || !profile.flatId || !profile.onboardingCompleted;
        return {
          profile: { ...profile, emailVerified: cred.user.emailVerified },
          needsOnboarding
        };
      }

      // New Google User: Create initial profile requiring onboarding
      const newProfile: UserProfile = {
        uid: cred.user.uid,
        displayName: cred.user.displayName || "Google Resident",
        email: cred.user.email || "",
        phone: cred.user.phoneNumber || "",
        ...(cred.user.photoURL ? { photoURL: cred.user.photoURL } : {}),
        role: "resident",
        platformRoles: ["resident"],
        householdRole: "other_resident",
        societyId: "",
        householdId: "",
        flatId: "",
        towerId: "",
        status: "pending_verification",
        emailVerified: cred.user.emailVerified,
        onboardingCompleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await setDoc(userDocRef, cleanFirestorePayload(newProfile));
      return { profile: newProfile, needsOnboarding: true };
    } catch (err: any) {
      throw new Error(mapFirebaseErrorToMessage(err));
    }
  }

  // Demo fallback
  const demoProfile = await signInWithEmail("minkush@example.com", "password");
  return { profile: demoProfile, needsOnboarding: false };
}

/**
 * Send password reset email via Firebase Auth
 */
export async function sendPasswordReset(email: string): Promise<void> {
  const cleanEmail = email.trim();
  if (!cleanEmail) {
    throw new Error("Please enter your registered email address.");
  }

  if (isFirebaseConfigured) {
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
    } catch (err: any) {
      throw new Error(mapFirebaseErrorToMessage(err));
    }
    return;
  }

  // In demo mode, simulate success
  await new Promise((res) => setTimeout(res, 600));
}

/**
 * Resend verification email to current authenticated user
 */
export async function resendVerificationEmail(): Promise<void> {
  if (isFirebaseConfigured && auth.currentUser) {
    try {
      await sendEmailVerification(auth.currentUser);
    } catch (err: any) {
      throw new Error(mapFirebaseErrorToMessage(err));
    }
  }
}

/**
 * Reloads the current user profile & emailVerified status from Firebase
 */
export async function reloadCurrentUser(): Promise<boolean> {
  if (isFirebaseConfigured && auth.currentUser) {
    await auth.currentUser.reload();
    return auth.currentUser.emailVerified;
  }
  return true;
}

export async function signOutUser(): Promise<void> {
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem("resolvex_active_mock_user");
      localStorage.removeItem("resolvex_active_persona");
      localStorage.removeItem("resolvex_demo_persona");
      localStorage.removeItem("activePersona");
      localStorage.removeItem("demoPersona");
      sessionStorage.removeItem("resolvex_active_mock_user");
      sessionStorage.removeItem("resolvex_active_persona");
      sessionStorage.removeItem("resolvex_demo_persona");
      sessionStorage.removeItem("activePersona");
      sessionStorage.removeItem("demoPersona");
    } catch {
      // ignore
    }
  }
  if (isFirebaseConfigured) {
    await signOut(auth);
  }
}

export async function updateUserProfile(uid: string, updates: Partial<UserProfile>): Promise<void> {
  if (isFirebaseConfigured) {
    try {
      await updateDoc(doc(db, "users", uid), {
        ...updates,
        updatedAt: new Date().toISOString()
      });
    } catch (e) {
      console.warn("Could not update Firestore user doc:", e);
    }
  }

  reactiveStore.updateDoc("users", uid, updates);
}

/**
 * Subscribes to pending user registration requests for society management verification
 */
export function subscribePendingRegistrations(
  societyId: string,
  callback: (users: UserProfile[]) => void
): () => void {
  if (!isFirebaseConfigured) {
    callback([]);
    return () => {};
  }

  let isUnsubscribed = false;
  let firestoreUnsub: (() => void) | null = null;

  const attachListener = () => {
    if (isUnsubscribed || firestoreUnsub) return;
    try {
      console.log("[VERIFICATION WEB DEBUG] Subscribing to pending registrations:", {
        adminUID: auth.currentUser?.uid,
        adminSocietyId: societyId,
        queryConstraints: { societyId }
      });

      const q = query(
        collection(db, "users"),
        where("societyId", "==", societyId)
      );

      firestoreUnsub = onSnapshot(
        q,
        (snap) => {
          if (isUnsubscribed) return;
          const pending: UserProfile[] = [];
          snap.forEach((d) => {
            const u = d.data() as UserProfile;
            if (u.status === "pending" || u.status === "pending_verification") {
              pending.push({ ...u, uid: d.id });
            }
          });
          pending.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

          console.log("[VERIFICATION WEB DEBUG] Snapshot received:", {
            adminUID: auth.currentUser?.uid,
            adminSocietyId: societyId,
            queryConstraints: { societyId },
            snapshotSize: snap.size,
            returnedApplicants: pending.map((u) => ({
              uid: u.uid,
              name: u.displayName,
              email: u.email,
              role: u.role,
              societyId: u.societyId,
              flatId: u.flatId,
              householdId: u.householdId,
              status: u.status,
              phone: u.phone,
              createdAt: u.createdAt
            }))
          });

          callback(pending);
        },
        (err) => {
          console.error("[VERIFICATION WEB DEBUG] subscribePendingRegistrations listener error:", err);
        }
      );
    } catch (e) {
      console.error("[VERIFICATION WEB DEBUG] Could not attach subscribePendingRegistrations listener:", e);
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

/**
 * Subscribes to all active users belonging to a specific society in real-time
 */
export function subscribeSocietyUsers(
  societyId: string,
  callback: (users: UserProfile[]) => void
): () => void {
  if (!isFirebaseConfigured) {
    return reactiveStore.subscribe<UserProfile[]>("users", (all) => {
      callback(all.filter((u) => u.societyId === societyId));
    });
  }

  let isUnsubscribed = false;
  let firestoreUnsub: (() => void) | null = null;

  const attachListener = () => {
    if (isUnsubscribed || firestoreUnsub) return;
    try {
      const q = query(
        collection(db, "users"),
        where("societyId", "==", societyId)
      );

      firestoreUnsub = onSnapshot(
        q,
        (snap) => {
          if (isUnsubscribed) return;
          const list: UserProfile[] = [];
          snap.forEach((d) => {
            list.push({ uid: d.id, ...d.data() } as UserProfile);
          });
          callback(list);
        },
        (err) => {
          console.warn("subscribeSocietyUsers listener error:", err);
        }
      );
    } catch (e) {
      console.warn("Could not attach subscribeSocietyUsers listener:", e);
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

/**
 * Management approves a pending user registration.
 * Persists status = "verified", adds user to household memberIds, removes from pendingRequestIds,
 * logs immutable audit entry, and dispatches a notification.
 */
export async function approveUserRegistration(
  userId: string,
  societyId: string,
  managerId: string
): Promise<void> {
  if (!isFirebaseConfigured) {
    throw new Error("Firebase is not configured.");
  }

  const now = new Date().toISOString();
  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    throw new Error("User record not found.");
  }

  const user = userSnap.data() as UserProfile;
  const oldStatus = user.status;

  // 1. Update user document
  await updateDoc(userRef, {
    status: "verified",
    verifiedAt: now,
    verifiedBy: managerId,
    updatedAt: now
  });

  console.log(`[VERIFICATION APPROVED] uid=${userId} role=${user.role} societyId=${societyId}`);
  console.log("[VERIFICATION]", {
    uid: userId,
    oldStatus,
    newStatus: "verified",
    approvedBy: managerId,
    societyId
  });

  // 2. If user belongs to a household, add to memberIds and remove from pendingRequestIds
  if (user.householdId) {
    const hhRef = doc(db, "households", user.householdId);
    const hhSnap = await getDoc(hhRef);
    if (hhSnap.exists()) {
      await updateDoc(hhRef, {
        memberIds: arrayUnion(userId),
        pendingRequestIds: arrayRemove(userId),
        updatedAt: now
      });
    }
  }

  // 3. Write immutable audit log
  const auditRef = doc(collection(db, "audit_logs"));
  await setDoc(auditRef, {
    actorUserId: managerId,
    actorRole: "society_admin",
    societyId,
    action: "user_registration_approved",
    entityType: "user",
    entityId: userId,
    metadata: {
      applicantName: user.displayName,
      applicantEmail: user.email,
      approvedRole: user.role,
      flatId: user.flatId || null,
      householdId: user.householdId || null
    },
    timestamp: now
  });

  // 4. Send welcome notification to applicant
  const notifRef = doc(collection(db, "notifications"));
  await setDoc(notifRef, {
    id: notifRef.id,
    societyId,
    userId,
    recipientUserId: userId,
    category: "notice",
    type: "notice",
    title: "Account Approved & Verified",
    body: `Welcome to ${societyId}! Management has verified your registration. You now have full access to society services.`,
    read: false,
    createdAt: now
  });
}

/**
 * Management rejects a pending registration with a mandatory reason.
 */
export async function rejectUserRegistration(
  userId: string,
  societyId: string,
  managerId: string,
  rejectionReason: string
): Promise<void> {
  if (!isFirebaseConfigured) {
    throw new Error("Firebase is not configured.");
  }

  const cleanReason = rejectionReason.trim();
  if (!cleanReason) {
    throw new Error("A specific rejection reason is mandatory when declining an applicant.");
  }

  const now = new Date().toISOString();
  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    throw new Error("User record not found.");
  }

  const user = userSnap.data() as UserProfile;

  // 1. Update user document to rejected
  await updateDoc(userRef, {
    status: "rejected",
    rejectionReason: cleanReason,
    rejectedAt: now,
    rejectedBy: managerId,
    updatedAt: now
  });

  // 2. Remove applicant from household pendingRequestIds
  if (user.householdId) {
    const hhRef = doc(db, "households", user.householdId);
    const hhSnap = await getDoc(hhRef);
    if (hhSnap.exists()) {
      await updateDoc(hhRef, {
        pendingRequestIds: arrayRemove(userId),
        updatedAt: now
      });
    }
  }

  // 3. Write immutable audit log
  const auditRef = doc(collection(db, "audit_logs"));
  await setDoc(auditRef, {
    actorUserId: managerId,
    actorRole: "society_admin",
    societyId,
    action: "user_registration_rejected",
    entityType: "user",
    entityId: userId,
    metadata: {
      applicantName: user.displayName,
      applicantEmail: user.email,
      rejectionReason: cleanReason,
      flatId: user.flatId || null
    },
    timestamp: now
  });
}

/**
 * Management requests more documentation or information from applicant
 */
export async function requestMoreInfoRegistration(
  userId: string,
  notes: string
): Promise<void> {
  if (!isFirebaseConfigured) {
    throw new Error("Firebase is not configured.");
  }

  const cleanNotes = notes.trim();
  if (!cleanNotes) {
    throw new Error("Please specify what information or documentation is needed.");
  }

  const now = new Date().toISOString();
  await updateDoc(doc(db, "users", userId), {
    status: "pending_verification",
    verificationNotes: cleanNotes,
    updatedAt: now
  });
}
