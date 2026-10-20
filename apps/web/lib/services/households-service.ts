import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where
} from "firebase/firestore";
import type { Household, HouseholdRole, UserProfile } from "@resolvex/types";
import { auth, db, isFirebaseConfigured } from "../firebase";
import { cleanFirestorePayload } from "../utils/firestore-clean";
import { recordAuditEvent } from "./audit-service";
import { reactiveStore } from "./data-store";

export function subscribeHousehold(
  householdId: string,
  callback: (household: Household | null) => void
): () => void {
  if (!isFirebaseConfigured) {
    return reactiveStore.subscribe<Household[]>("households", (all) => {
      const found = all.find((h) => h.id === householdId) || null;
      callback(found);
    });
  }

  let isUnsubscribed = false;
  let firestoreUnsub: (() => void) | null = null;

  const attachListener = () => {
    if (isUnsubscribed || firestoreUnsub) return;
    try {
      const docRef = doc(db, "households", householdId);
      firestoreUnsub = onSnapshot(
        docRef,
        (snap) => {
          if (isUnsubscribed) return;
          if (snap.exists()) {
            callback({ id: snap.id, ...snap.data() } as Household);
          } else {
            callback(null);
          }
        },
        (err) => {
          console.warn("Firestore household listener note:", err);
          callback(null);
        }
      );
    } catch (e) {
      console.warn("Could not attach household listener:", e);
      callback(null);
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
      callback(null);
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
 * Subscribes to household members with security rule-compliant societyId filtering.
 */
export function subscribeHouseholdMembers(
  householdId: string,
  callback: (members: UserProfile[]) => void,
  societyIdOverride?: string
): () => void {
  if (!isFirebaseConfigured) {
    return reactiveStore.subscribe<UserProfile[]>("users", (all) => {
      const householdMembers = all.filter((u) => u.householdId === householdId);
      callback(householdMembers);
    });
  }

  let isUnsubscribed = false;
  let firestoreUnsub: (() => void) | null = null;

  const attachListener = () => {
    if (isUnsubscribed || firestoreUnsub) return;
    try {
      const socId = societyIdOverride || "soc-ajanta-genx";
      const q = query(
        collection(db, "users"),
        where("societyId", "==", socId),
        where("householdId", "==", householdId)
      );
      firestoreUnsub = onSnapshot(
        q,
        (snapshot) => {
          if (isUnsubscribed) return;
          const list: UserProfile[] = [];
          snapshot.forEach((snapDoc) => {
            list.push({ uid: snapDoc.id, ...snapDoc.data() } as UserProfile);
          });
          callback(list);
        },
        (err) => {
          console.warn("Firestore household members query error:", err);
          callback([]);
        }
      );
    } catch (err) {
      console.warn("Could not create Firestore household members query:", err);
      callback([]);
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

export function subscribeHouseholds(
  societyId: string,
  callback: (households: Household[]) => void
): () => void {
  if (!isFirebaseConfigured) {
    return reactiveStore.subscribe<Household[]>("households", (all) => {
      callback(all.filter((h) => h.societyId === societyId));
    });
  }

  let isUnsubscribed = false;
  let firestoreUnsub: (() => void) | null = null;

  const attachListener = () => {
    if (isUnsubscribed || firestoreUnsub) return;
    try {
      const q = query(collection(db, "households"), where("societyId", "==", societyId));
      firestoreUnsub = onSnapshot(
        q,
        (snap) => {
          if (isUnsubscribed) return;
          const list: Household[] = [];
          snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Household));
          callback(list);
        },
        (err) => {
          console.warn("Firestore households subscription error:", err);
        }
      );
    } catch (e) {
      console.warn("Could not attach households listener:", e);
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

export function subscribeFlats(
  societyId: string,
  callback: (flats: any[]) => void
): () => void {
  if (!isFirebaseConfigured) {
    return reactiveStore.subscribe<any[]>("flats", (all) => {
      callback(all.filter((f) => f.societyId === societyId));
    });
  }

  let isUnsubscribed = false;
  let firestoreUnsub: (() => void) | null = null;

  const attachListener = () => {
    if (isUnsubscribed || firestoreUnsub) return;
    try {
      const q = query(collection(db, "flats"), where("societyId", "==", societyId));
      firestoreUnsub = onSnapshot(
        q,
        (snap) => {
          if (isUnsubscribed) return;
          const list: any[] = [];
          snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
          callback(list);
        },
        (err) => {
          console.warn("Firestore flats subscription error:", err);
        }
      );
    } catch (e) {
      console.warn("Could not attach flats listener:", e);
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

export async function inviteMember(
  householdId: string,
  params: {
    name: string;
    email: string;
    phone: string;
    householdRole: HouseholdRole;
    actorUserId: string;
    societyIdOverride?: string;
  }
): Promise<UserProfile> {
  let household = reactiveStore.getDoc<Household>("households", householdId) || null;
  if (!household && isFirebaseConfigured) {
    try {
      const snap = await getDoc(doc(db, "households", householdId));
      if (snap.exists()) {
        household = { id: snap.id, ...snap.data() } as Household;
      }
    } catch (err) {
      console.warn("Could not fetch household doc for invite:", err);
    }
  }

  const societyId = params.societyIdOverride || household?.societyId || "soc-ajanta-genx";
  const towerId = household?.towerId || "tower-a";
  const flatId = household?.flatId || "flat-a-1204";

  const newUserId = `user-${Date.now().toString().slice(-4)}`;
  const newUser: UserProfile = {
    uid: newUserId,
    displayName: params.name,
    email: params.email,
    phone: params.phone,
    role: "resident",
    platformRoles: ["resident"],
    householdRole: params.householdRole,
    societyId,
    householdId,
    flatId,
    towerId,
    status: "pending",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const pending = household?.pendingRequestIds || [];

  if (isFirebaseConfigured) {
    try {
      await setDoc(doc(db, "users", newUserId), cleanFirestorePayload(newUser));
      await updateDoc(doc(db, "households", householdId), cleanFirestorePayload({
        pendingRequestIds: [...pending, newUserId],
        updatedAt: new Date().toISOString()
      }));
    } catch (err: any) {
      console.error("Firestore inviteMember error:", err);
      throw new Error(`Failed to record invitation in Firestore: ${err.message}`);
    }
  }

  reactiveStore.setDoc("users", newUser);
  reactiveStore.updateDoc("households", householdId, {
    pendingRequestIds: [...pending, newUserId]
  });

  await recordAuditEvent({
    actorUserId: params.actorUserId,
    actorRole: "flat_owner",
    societyId,
    action: "resident_invited",
    entityType: "household",
    entityId: householdId,
    metadata: {
      invitedName: params.name,
      email: params.email,
      role: params.householdRole
    }
  });

  return newUser;
}

export async function verifyMember(
  householdId: string,
  userId: string,
  approve: boolean,
  actorUserId: string
): Promise<void> {
  let household = reactiveStore.getDoc<Household>("households", householdId) || null;
  if (!household && isFirebaseConfigured) {
    try {
      const snap = await getDoc(doc(db, "households", householdId));
      if (snap.exists()) {
        household = { id: snap.id, ...snap.data() } as Household;
      }
    } catch (err) {}
  }
  const societyId = household?.societyId || "soc-ajanta-genx";

  const pending = (household?.pendingRequestIds || []).filter((id) => id !== userId);
  const members = [...(household?.memberIds || [])];

  if (approve) {
    if (!members.includes(userId)) members.push(userId);
  }

  if (isFirebaseConfigured) {
    try {
      await updateDoc(doc(db, "households", householdId), cleanFirestorePayload({
        pendingRequestIds: pending,
        memberIds: members,
        updatedAt: new Date().toISOString()
      }));

      try {
        await updateDoc(doc(db, "users", userId), cleanFirestorePayload({
          status: approve ? "verified" : "rejected",
          updatedAt: new Date().toISOString()
        }));
      } catch (userErr) {
        console.warn("Direct user status update skipped (household state updated):", userErr);
      }
    } catch (err: any) {
      console.error("Firestore verifyMember error:", err);
      throw new Error(`Failed to update resident verification in Firestore: ${err.message}`);
    }
  }

  if (approve) {
    reactiveStore.updateDoc("users", userId, { status: "verified" });
  } else {
    reactiveStore.updateDoc("users", userId, { status: "rejected" });
  }

  reactiveStore.updateDoc("households", householdId, {
    pendingRequestIds: pending,
    memberIds: members
  });

  await recordAuditEvent({
    actorUserId,
    actorRole: "flat_owner",
    societyId,
    action: approve ? "resident_verified" : "resident_rejected",
    entityType: "household",
    entityId: householdId,
    metadata: { targetUserId: userId, approved: approve }
  });
}

export async function removeMember(
  householdId: string,
  userId: string,
  actorUserId: string
): Promise<{ success: boolean; error?: string }> {
  let household = reactiveStore.getDoc<Household>("households", householdId) || null;
  let user = reactiveStore.getDoc<UserProfile>("users", userId) || null;

  if (isFirebaseConfigured) {
    if (!household) {
      try {
        const snap = await getDoc(doc(db, "households", householdId));
        if (snap.exists()) {
          household = { id: snap.id, ...snap.data() } as Household;
        }
      } catch (err) {
        console.warn("Could not fetch household doc for removal:", err);
      }
    }
    if (!user) {
      try {
        const snap = await getDoc(doc(db, "users", userId));
        if (snap.exists()) {
          user = { uid: snap.id, ...snap.data() } as UserProfile;
        }
      } catch (err) {
        console.warn("Could not fetch user doc for removal:", err);
      }
    }
  }

  // Safeguard: Primary owner cannot be removed without ownership transfer
  if (user?.householdRole === "owner") {
    return {
      success: false,
      error: "Primary Owner cannot be removed. You must transfer property ownership first."
    };
  }

  const updatedMembers = ((household?.memberIds) || []).filter((id) => id !== userId);

  if (isFirebaseConfigured) {
    try {
      await updateDoc(doc(db, "households", householdId), cleanFirestorePayload({
        memberIds: updatedMembers,
        updatedAt: new Date().toISOString()
      }));

      try {
        await updateDoc(doc(db, "users", userId), cleanFirestorePayload({
          householdId: "",
          status: "rejected",
          updatedAt: new Date().toISOString()
        }));
      } catch (userErr) {
        console.warn("Direct user doc update skipped/unauthorized (household memberIds updated):", userErr);
      }
    } catch (err: any) {
      console.error("Firestore removeMember error:", err);
      return { success: false, error: `Failed to remove member in Firestore: ${err.message}` };
    }
  }

  reactiveStore.updateDoc("households", householdId, {
    memberIds: updatedMembers
  });
  reactiveStore.updateDoc("users", userId, {
    householdId: undefined,
    status: "rejected"
  });

  await recordAuditEvent({
    actorUserId,
    actorRole: "flat_owner",
    societyId: household?.societyId || "soc-ajanta-genx",
    action: "resident_removed",
    entityType: "household",
    entityId: householdId,
    metadata: { removedUserId: userId }
  });

  return { success: true };
}

export async function transferOwnership(
  householdId: string,
  currentOwnerId: string,
  newOwnerId: string,
  actorUserId: string
): Promise<{ success: boolean; error?: string }> {
  let household = reactiveStore.getDoc<Household>("households", householdId) || null;
  let currentOwner = reactiveStore.getDoc<UserProfile>("users", currentOwnerId) || null;
  let newOwner = reactiveStore.getDoc<UserProfile>("users", newOwnerId) || null;

  if (isFirebaseConfigured) {
    if (!household) {
      try {
        const snap = await getDoc(doc(db, "households", householdId));
        if (snap.exists()) household = { id: snap.id, ...snap.data() } as Household;
      } catch {}
    }
    if (!currentOwner) {
      try {
        const snap = await getDoc(doc(db, "users", currentOwnerId));
        if (snap.exists()) currentOwner = { uid: snap.id, ...snap.data() } as UserProfile;
      } catch {}
    }
    if (!newOwner) {
      try {
        const snap = await getDoc(doc(db, "users", newOwnerId));
        if (snap.exists()) newOwner = { uid: snap.id, ...snap.data() } as UserProfile;
      } catch {}
    }
  }

  if (!currentOwner || !newOwner) {
    return { success: false, error: "Owner or candidate user not found." };
  }

  const societyId = household?.societyId || "soc-ajanta-genx";

  if (isFirebaseConfigured) {
    try {
      await updateDoc(doc(db, "users", currentOwnerId), cleanFirestorePayload({
        householdRole: "co_owner",
        updatedAt: new Date().toISOString()
      }));
      await updateDoc(doc(db, "users", newOwnerId), cleanFirestorePayload({
        householdRole: "owner",
        role: "flat_owner",
        platformRoles: ["resident", "flat_owner"],
        updatedAt: new Date().toISOString()
      }));
    } catch (err: any) {
      console.error("Firestore transferOwnership error:", err);
      return { success: false, error: `Failed to transfer ownership in Firestore: ${err.message}` };
    }
  }

  reactiveStore.updateDoc("users", currentOwnerId, { householdRole: "co_owner" });
  reactiveStore.updateDoc("users", newOwnerId, {
    householdRole: "owner",
    role: "flat_owner",
    platformRoles: ["resident", "flat_owner"]
  });

  await recordAuditEvent({
    actorUserId,
    actorRole: "society_admin",
    societyId,
    action: "ownership_transferred",
    entityType: "household",
    entityId: householdId,
    metadata: { previousOwnerId: currentOwnerId, newOwnerId }
  });

  return { success: true };
}
