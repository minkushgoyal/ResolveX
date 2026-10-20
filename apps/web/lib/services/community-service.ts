import { onAuthStateChanged } from "firebase/auth";
import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where
} from "firebase/firestore";
import type {
  CommunityPoll,
  CommunityPost,
  MarketplaceItem,
  Notice,
  PollVote,
  SocietyEvent
} from "@resolvex/types";
import { auth, db, isFirebaseConfigured } from "../firebase";
import { cleanFirestorePayload } from "../utils/firestore-clean";
import { recordAuditEvent } from "./audit-service";
import { reactiveStore } from "./data-store";

// ─── COMMUNITY POSTS ────────────────────────────────────────────────────────

export function subscribePosts(
  societyId: string,
  callback: (posts: CommunityPost[]) => void
): () => void {
  if (!isFirebaseConfigured) {
    return reactiveStore.subscribe<CommunityPost[]>("community_posts", (all) => {
      callback(all.filter((p) => p.societyId === societyId));
    });
  }

  let isUnsubscribed = false;
  let firestoreUnsub: (() => void) | null = null;

  const attachListener = () => {
    if (isUnsubscribed || firestoreUnsub) return;
    try {
      const q = query(
        collection(db, "community_posts"),
        where("societyId", "==", societyId)
      );
      firestoreUnsub = onSnapshot(
        q,
        (snap) => {
          if (isUnsubscribed) return;
          const list: CommunityPost[] = [];
          snap.forEach((d) => list.push({ id: d.id, ...d.data() } as CommunityPost));
          list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          callback(list);
        },
        (err) => {
          console.warn("Firestore community_posts listener error:", err);
        }
      );
    } catch (e) {
      console.warn("Could not attach community_posts listener:", e);
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

export async function createPost(
  data: Omit<CommunityPost, "id" | "likes" | "comments" | "createdAt">
): Promise<CommunityPost> {
  const id = `post-${Date.now()}`;
  const newPost: CommunityPost = {
    ...data,
    id,
    likes: 0,
    comments: 0,
    createdAt: new Date().toISOString()
  };

  if (isFirebaseConfigured) {
    try {
      await setDoc(doc(db, "community_posts", id), cleanFirestorePayload(newPost));
    } catch (e: any) {
      console.error("Firestore createPost error:", e);
      throw new Error(`Failed to publish post to Firestore: ${e.message}`);
    }
  }

  reactiveStore.setDoc("community_posts", newPost);

  await recordAuditEvent({
    actorUserId: data.authorUserId,
    actorRole: "resident",
    societyId: data.societyId,
    action: "community_post_created",
    entityType: "community",
    entityId: newPost.id,
    metadata: { category: data.category }
  });

  return newPost;
}

// ─── COMMUNITY POLLS & VOTING ───────────────────────────────────────────────

export function subscribePolls(
  societyId: string,
  callback: (polls: CommunityPoll[]) => void
): () => void {
  if (!isFirebaseConfigured) {
    return reactiveStore.subscribe<CommunityPoll[]>("community_polls", (all) => {
      callback(all.filter((p) => p.societyId === societyId));
    });
  }

  let isUnsubscribed = false;
  let firestoreUnsub: (() => void) | null = null;

  const attachListener = () => {
    if (isUnsubscribed || firestoreUnsub) return;
    try {
      const q = query(
        collection(db, "community_polls"),
        where("societyId", "==", societyId)
      );
      firestoreUnsub = onSnapshot(
        q,
        (snap) => {
          if (isUnsubscribed) return;
          const list: CommunityPoll[] = [];
          snap.forEach((d) => list.push({ id: d.id, ...d.data() } as CommunityPoll));
          list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          callback(list);
        },
        (err) => {
          console.warn("Firestore community_polls listener error:", err);
        }
      );
    } catch (e) {
      console.warn("Could not attach community_polls listener:", e);
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

export async function votePoll(
  pollId: string,
  optionId: string,
  userId: string,
  societyIdOverride?: string
): Promise<void> {
  const poll = reactiveStore.getDoc<CommunityPoll>("community_polls", pollId);
  const societyId = societyIdOverride || poll?.societyId || "soc-green-valley";

  // Prevent duplicate votes: check if user already voted in any option locally
  if (poll) {
    const hasAlreadyVoted = poll.options.some((opt) => opt.votedUserIds.includes(userId));
    if (hasAlreadyVoted) {
      throw new Error("You have already recorded your vote in this community poll.");
    }
  }

  const voteDocId = `${pollId}_${userId}`;

  // Check if vote already exists in Firestore to prevent immutable update rule violation
  if (isFirebaseConfigured) {
    try {
      const existingVote = await getDoc(doc(db, "poll_votes", voteDocId));
      if (existingVote.exists()) {
        throw new Error("You have already recorded your vote in this community poll.");
      }
    } catch (err: any) {
      if (err.message?.includes("already recorded")) throw err;
    }
  }

  const pollVote: PollVote = {
    id: voteDocId,
    pollId,
    optionId,
    userId,
    societyId,
    votedAt: new Date().toISOString()
  };

  const updatedOptions = (poll?.options || []).map((opt) => {
    const withoutUser = opt.votedUserIds.filter((id) => id !== userId);
    if (opt.id === optionId) {
      return {
        ...opt,
        votes: withoutUser.length + 1,
        votedUserIds: [...withoutUser, userId]
      };
    }
    return {
      ...opt,
      votes: withoutUser.length,
      votedUserIds: withoutUser
    };
  });

  if (isFirebaseConfigured) {
    try {
      // 1. Record immutable individual vote
      await setDoc(doc(db, "poll_votes", voteDocId), cleanFirestorePayload(pollVote));
      // 2. Update aggregate options in poll document if it exists in Firestore
      const pollRef = doc(db, "community_polls", pollId);
      const pollSnap = await getDoc(pollRef);
      if (pollSnap.exists()) {
        await updateDoc(pollRef, cleanFirestorePayload({
          options: updatedOptions
        }));
      }
    } catch (e: any) {
      console.error("Firestore votePoll error:", e);
      throw new Error(`Failed to record vote in Firestore: ${e.message}`);
    }
  }

  reactiveStore.updateDoc("community_polls", pollId, {
    options: updatedOptions
  });

  await recordAuditEvent({
    actorUserId: userId,
    actorRole: "resident",
    societyId,
    action: "poll_voted",
    entityType: "community",
    entityId: pollId,
    metadata: { optionId }
  });
}

// ─── MARKETPLACE ITEMS ──────────────────────────────────────────────────────

export function subscribeMarketplace(
  societyId: string,
  callback: (items: MarketplaceItem[]) => void
): () => void {
  if (!isFirebaseConfigured) {
    return reactiveStore.subscribe<MarketplaceItem[]>("marketplace_items", (all) => {
      callback(all.filter((m) => m.societyId === societyId));
    });
  }

  let isUnsubscribed = false;
  let firestoreUnsub: (() => void) | null = null;

  const attachListener = () => {
    if (isUnsubscribed || firestoreUnsub) return;
    try {
      const q = query(
        collection(db, "marketplace_items"),
        where("societyId", "==", societyId)
      );
      firestoreUnsub = onSnapshot(
        q,
        (snap) => {
          if (isUnsubscribed) return;
          const list: MarketplaceItem[] = [];
          snap.forEach((d) => list.push({ id: d.id, ...d.data() } as MarketplaceItem));
          list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          callback(list);
        },
        (err) => {
          console.warn("Firestore marketplace_items listener error:", err);
        }
      );
    } catch (e) {
      console.warn("Could not attach marketplace listener:", e);
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

export async function createMarketplaceListing(
  data: Omit<MarketplaceItem, "id" | "status" | "createdAt">
): Promise<MarketplaceItem> {
  const id = `mkt-${Date.now()}`;
  const newItem: MarketplaceItem = {
    ...data,
    id,
    status: "available",
    createdAt: new Date().toISOString()
  };

  if (isFirebaseConfigured) {
    try {
      await setDoc(doc(db, "marketplace_items", id), cleanFirestorePayload(newItem));
    } catch (e: any) {
      console.error("Firestore createMarketplaceListing error:", e);
      throw new Error(`Failed to write listing to Firestore: ${e.message}`);
    }
  }

  reactiveStore.setDoc("marketplace_items", newItem);

  await recordAuditEvent({
    actorUserId: data.sellerUserId,
    actorRole: "resident",
    societyId: data.societyId,
    action: "marketplace_item_listed",
    entityType: "community",
    entityId: newItem.id,
    metadata: { title: data.title, price: data.price }
  });

  return newItem;
}

// ─── SOCIETY EVENTS ─────────────────────────────────────────────────────────

export function subscribeEvents(
  societyId: string,
  callback: (events: SocietyEvent[]) => void
): () => void {
  if (!isFirebaseConfigured) {
    return () => {};
  }

  let isUnsubscribed = false;
  let firestoreUnsub: (() => void) | null = null;

  const attachListener = () => {
    if (isUnsubscribed || firestoreUnsub) return;
    try {
      const q = query(
        collection(db, "society_events"),
        where("societyId", "==", societyId)
      );
      firestoreUnsub = onSnapshot(
        q,
        (snap) => {
          if (isUnsubscribed) return;
          const list: SocietyEvent[] = [];
          snap.forEach((d) => list.push({ id: d.id, ...d.data() } as SocietyEvent));
          callback(list);
        },
        (err) => {
          console.warn("Firestore society_events listener error:", err);
        }
      );
    } catch (e) {
      console.warn("Could not attach society_events listener:", e);
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

// ─── NOTICES ────────────────────────────────────────────────────────────────

export function subscribeNotices(
  societyId: string,
  callback: (notices: any[]) => void
): () => void {
  if (!isFirebaseConfigured) {
    return () => {};
  }

  let isUnsubscribed = false;
  let firestoreUnsub: (() => void) | null = null;

  const attachListener = () => {
    if (isUnsubscribed || firestoreUnsub) return;
    try {
      const q = query(
        collection(db, "notices"),
        where("societyId", "==", societyId)
      );
      firestoreUnsub = onSnapshot(
        q,
        (snap) => {
          if (isUnsubscribed) return;
          const list: any[] = [];
          snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
          list.sort((a, b) => new Date(b.createdAt || b.publishedAt || 0).getTime() - new Date(a.createdAt || a.publishedAt || 0).getTime());
          callback(list);
        },
        (err) => {
          console.warn("Firestore notices listener error:", err);
        }
      );
    } catch (e) {
      console.warn("Could not attach notices listener:", e);
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

export async function createNotice(params: {
  societyId: string;
  title: string;
  body: string;
  priority?: "low" | "medium" | "high" | "urgent";
  authorRole?: string;
  createdByUserId: string;
}): Promise<any> {
  const now = new Date().toISOString();
  const id = `notc-${Date.now()}`;
  const noticePayload = {
    id,
    societyId: params.societyId,
    title: params.title.trim(),
    body: params.body.trim(),
    description: params.body.trim(),
    priority: params.priority || "medium",
    authorRole: params.authorRole || "society_admin",
    createdByUserId: params.createdByUserId,
    createdAt: now,
    publishedAt: now,
    acknowledgedBy: []
  };

  if (isFirebaseConfigured) {
    try {
      await setDoc(doc(db, "notices", id), cleanFirestorePayload(noticePayload));
    } catch (err: any) {
      console.error("Firestore createNotice error:", err);
      throw new Error(`Failed to create notice in Firestore: ${err.message}`);
    }
  }

  await recordAuditEvent({
    actorUserId: params.createdByUserId,
    actorRole: "society_admin",
    societyId: params.societyId,
    action: "notice_published",
    entityType: "community",
    entityId: id,
    metadata: { title: params.title }
  });

  return noticePayload;
}

export async function rsvpEvent(params: {
  eventId: string;
  societyId: string;
  userId: string;
  attending: boolean;
}): Promise<void> {
  if (isFirebaseConfigured) {
    try {
      const eventRef = doc(db, "society_events", params.eventId);
      const snap = await getDoc(eventRef);
      if (snap.exists()) {
        await updateDoc(eventRef, {
          attendeeUserIds: params.attending ? arrayUnion(params.userId) : arrayRemove(params.userId)
        });
      }
    } catch (e: any) {
      console.warn("Firestore rsvpEvent update note:", e?.message || e);
    }
  }

  await recordAuditEvent({
    actorUserId: params.userId,
    actorRole: "resident",
    societyId: params.societyId,
    action: params.attending ? "event_rsvp_confirmed" : "event_rsvp_cancelled",
    entityType: "community",
    entityId: params.eventId,
    metadata: { attending: params.attending }
  });
}

export async function getSocietyConfig(societyId: string): Promise<any> {
  if (isFirebaseConfigured) {
    try {
      const snap = await getDoc(doc(db, "societies", societyId));
      if (snap.exists()) {
        return snap.data();
      }
    } catch (e: any) {
      console.warn("Firestore getSocietyConfig error:", e);
    }
  }
  return null;
}

export async function updateSocietyConfig(
  societyId: string,
  updates: Record<string, any>,
  actorUserId: string
): Promise<void> {
  const clean = cleanFirestorePayload({
    ...updates,
    id: societyId,
    updatedAt: new Date().toISOString()
  });

  if (isFirebaseConfigured) {
    await setDoc(doc(db, "societies", societyId), clean, { merge: true });
  }

  await recordAuditEvent({
    actorUserId,
    actorRole: "society_admin",
    societyId,
    action: "society_config_updated",
    entityType: "community",
    entityId: societyId,
    metadata: updates
  });
}
