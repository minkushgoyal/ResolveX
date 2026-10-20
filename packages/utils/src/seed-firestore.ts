import type {
  Amenity,
  AmenityBooking,
  AppNotification,
  Bill,
  CommunityPoll,
  CommunityPost,
  Complaint,
  ComplaintUpdate,
  Delivery,
  Facility,
  FacilityServiceLog,
  Flat,
  Household,
  MarketplaceItem,
  Society,
  Tower,
  UserProfile,
  VisitorPass
} from "@resolvex/types";
import {
  amenities,
  bills,
  commonLocations,
  communityPolls,
  complaintUpdates,
  complaints,
  demoSociety,
  facilities,
  facilityServiceLogs,
  flats,
  households,
  marketplaceItems,
  notifications,
  posts,
  residents,
  staff,
  towers,
  visitorPasses
} from "./demo-data";

export interface SeedPayload {
  societies: Record<string, Society>;
  towers: Record<string, Tower>;
  flats: Record<string, Flat>;
  households: Record<string, Household>;
  users: Record<string, UserProfile>;
  facilities: Record<string, Facility>;
  facility_service_logs: Record<string, FacilityServiceLog>;
  complaints: Record<string, Complaint>;
  complaint_updates: Record<string, ComplaintUpdate>;
  visitor_passes: Record<string, VisitorPass>;
  deliveries: Record<string, Delivery>;
  bills: Record<string, Bill>;
  amenities: Record<string, Amenity>;
  amenity_bookings: Record<string, AmenityBooking>;
  community_posts: Record<string, CommunityPost>;
  community_polls: Record<string, CommunityPoll>;
  marketplace_items: Record<string, MarketplaceItem>;
  notifications: Record<string, AppNotification>;
}

export function buildSeedPayload(): SeedPayload {
  const societiesRecord: Record<string, Society> = {
    [demoSociety.id]: demoSociety
  };

  const towersRecord: Record<string, Tower> = {};
  for (const t of towers) {
    towersRecord[t.id] = t;
  }

  const flatsRecord: Record<string, Flat> = {};
  for (const f of flats) {
    flatsRecord[f.id] = f;
  }

  const householdsRecord: Record<string, Household> = {};
  for (const h of households) {
    householdsRecord[h.id] = h;
  }

  // Canonical Users mapping both residents and staff/persona accounts
  const usersRecord: Record<string, UserProfile> = {};

  // Add resident users
  for (const r of residents) {
    usersRecord[r.id] = {
      uid: r.id,
      displayName: r.name,
      email: r.email,
      phone: r.phone,
      photoURL: r.avatarUrl,
      role: r.platformRoles[0] || "resident",
      platformRoles: r.platformRoles,
      householdRole: r.householdRole,
      societyId: r.societyId,
      householdId: r.householdId,
      flatId: r.flatId,
      towerId: r.towerId,
      status: r.verificationStatus,
      createdAt: r.joinedAt,
      updatedAt: r.joinedAt
    };
  }

  // Add staff profiles as users
  for (const s of staff) {
    usersRecord[s.id] = {
      uid: s.id,
      displayName: s.name,
      email: `${s.id}@ajantagenx.internal`,
      phone: s.phone,
      photoURL: s.avatarUrl,
      role: s.role,
      platformRoles: [s.role],
      societyId: s.societyId,
      status: "verified",
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z"
    };
  }

  const facilitiesRecord: Record<string, Facility> = {};
  for (const f of facilities) {
    facilitiesRecord[f.id] = f;
  }

  const facilityLogsRecord: Record<string, FacilityServiceLog> = {};
  for (const l of facilityServiceLogs) {
    facilityLogsRecord[l.id] = l;
  }

  const complaintsRecord: Record<string, Complaint> = {};
  for (const c of complaints) {
    complaintsRecord[c.id] = c;
  }

  const updatesRecord: Record<string, ComplaintUpdate> = {};
  for (const u of complaintUpdates) {
    updatesRecord[u.id] = u;
  }

  const visitorPassesRecord: Record<string, VisitorPass> = {};
  for (const v of visitorPasses) {
    visitorPassesRecord[v.id] = v;
  }

  const billsRecord: Record<string, Bill> = {};
  for (const b of bills) {
    billsRecord[b.id] = b;
  }

  const amenitiesRecord: Record<string, Amenity> = {};
  for (const a of amenities) {
    amenitiesRecord[a.id] = a;
  }

  const postsRecord: Record<string, CommunityPost> = {};
  for (const p of posts) {
    postsRecord[p.id] = p;
  }

  const pollsRecord: Record<string, CommunityPoll> = {};
  for (const poll of communityPolls) {
    pollsRecord[poll.id] = poll;
  }

  const marketplaceRecord: Record<string, MarketplaceItem> = {};
  for (const m of marketplaceItems) {
    marketplaceRecord[m.id] = m;
  }

  const notificationsRecord: Record<string, AppNotification> = {};
  for (const n of notifications) {
    notificationsRecord[n.id] = n;
  }

  return {
    societies: societiesRecord,
    towers: towersRecord,
    flats: flatsRecord,
    households: householdsRecord,
    users: usersRecord,
    facilities: facilitiesRecord,
    facility_service_logs: facilityLogsRecord,
    complaints: complaintsRecord,
    complaint_updates: updatesRecord,
    visitor_passes: visitorPassesRecord,
    deliveries: {},
    bills: billsRecord,
    amenities: amenitiesRecord,
    amenity_bookings: {},
    community_posts: postsRecord,
    community_polls: pollsRecord,
    marketplace_items: marketplaceRecord,
    notifications: notificationsRecord
  };
}
