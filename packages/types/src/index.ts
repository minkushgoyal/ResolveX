export type ID = string;

export type PlatformRole =
  | "resident"
  | "flat_owner"
  | "tenant"
  | "society_admin"
  | "society_manager"
  | "security_guard"
  | "maintenance_staff"
  | "service_provider"
  | "super_admin";

export type HouseholdRole =
  | "owner"
  | "co_owner"
  | "family_member"
  | "tenant"
  | "relative"
  | "other_resident";

export type VerificationStatus = "verified" | "pending" | "pending_verification" | "rejected" | "suspended";
export type FlatType = "1BHK" | "2BHK" | "3BHK" | "4BHK" | "Studio" | "Penthouse";
export type ComplaintPriority = "low" | "medium" | "high" | "emergency";

/**
 * Canonical Complaint Status Lifecycle:
 * open (submitted) -> assigned -> in_progress -> resident_confirmation -> closed
 * Alternative Branch:
 * resident_confirmation -> reopened -> assigned
 *
 * Aliases for backward compatibility:
 * - "work_completed" maps to "resident_confirmation"
 * - "resolved" maps to "closed"
 * - "under_review" maps to "open"
 */
export type ComplaintStatus =
  | "open"
  | "under_review"
  | "assigned"
  | "in_progress"
  | "work_completed"
  | "resident_confirmation"
  | "resolved"
  | "closed"
  | "reopened";

export type ComplaintCategory =
  | "plumbing"
  | "electrical"
  | "carpentry"
  | "lift"
  | "security"
  | "cleanliness"
  | "water_supply"
  | "parking"
  | "pest_control"
  | "common_area"
  | "noise"
  | "other";

export type BillStatus = "paid" | "pending" | "overdue";
export type NoticeType = "important" | "maintenance" | "event" | "emergency" | "general";
export type MarketplaceStatus = "available" | "reserved" | "sold";
export type VisitorType = "guest" | "domestic_help" | "delivery" | "cab" | "regular";
export type NotificationCategory = "complaint" | "bill" | "notice" | "visitor" | "amenity" | "emergency";

export interface Society {
  id: ID;
  name: string;
  tagline: string;
  address: string;
  city: string;
  settings: SocietySettings;
  createdAt: string;
}

export interface SocietySettings {
  approvalRequiredForJoin: boolean;
  tenantsCanViewBills: boolean;
  directoryPhoneVisibleByDefault: boolean;
  complaintEscalationHours: {
    notifyManager: number;
    increasePriority: number;
    notifyAdmin: number;
  };
}

export interface Tower {
  id: ID;
  societyId: ID;
  name: string;
  floors: number;
}

export interface Flat {
  id: ID;
  societyId: ID;
  towerId: ID;
  householdId: ID;
  flatNumber: string;
  flatType: FlatType;
  floor: number;
  ownerUserId: ID;
}

export interface Household {
  id: ID;
  societyId: ID;
  towerId: ID;
  flatId: ID;
  displayName: string;
  inviteCode: string;
  memberIds: ID[];
  pendingRequestIds: ID[];
  createdAt: string;
}

export interface UserProfile {
  uid: ID;
  displayName: string;
  email: string;
  phone: string;
  phoneNumber?: string;
  photoURL?: string;
  role: PlatformRole;
  platformRoles: PlatformRole[];
  householdRole?: HouseholdRole;
  societyId: ID;
  householdId?: ID;
  flatId?: ID;
  towerId?: ID;
  status: VerificationStatus;
  name?: string;
  department?: StaffDepartment;
  specialization?: string;
  gate?: string;
  shift?: string;
  skills?: ComplaintCategory[] | string[];
  assignedFacilityIds?: ID[];
  currentWorkload?: number;
  availabilityStatus?: StaffAvailability;
  active?: boolean;
  isSocietyAdmin?: boolean;
  rejectionReason?: string;
  rejectedAt?: string;
  verificationNotes?: string;
  verifiedAt?: string;
  verifiedBy?: ID;
  pushToken?: string;
  emailVerified?: boolean;
  onboardingCompleted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ResidentUser {
  id: ID;
  societyId: ID;
  householdId: ID;
  flatId: ID;
  towerId: ID;
  name: string;
  email: string;
  phone: string;
  avatarUrl?: string;
  platformRoles: PlatformRole[];
  householdRole: HouseholdRole;
  verificationStatus: VerificationStatus;
  privacy: {
    showPhoneInDirectory: boolean;
    showEmailInDirectory: boolean;
  };
  joinedAt: string;
}

export type StaffDepartment =
  | "plumbing"
  | "electrical"
  | "carpentry"
  | "housekeeping"
  | "general_maintenance"
  | "other"
  | "security"
  | "lift"
  | "gardening"
  | "water_management";

export type StaffAvailability = "available" | "on_duty" | "busy" | "off_duty";

export type FacilityCategory =
  | "lift"
  | "electrical"
  | "plumbing"
  | "water_supply"
  | "generator"
  | "cctv"
  | "security"
  | "housekeeping"
  | "gardening"
  | "parking"
  | "gym"
  | "clubhouse"
  | "swimming_pool";

export type FacilityStatus = "operational" | "under_maintenance" | "degraded" | "out_of_service";

export type LocationType = "flat" | "common_area";
export type ComplaintLocationType = LocationType;

export interface PredefinedCommonLocation {
  id: ID;
  name: string;
  category: FacilityCategory | "common_washroom" | "other";
  towerId?: ID;
  buildingOrArea: string;
  floorOrLevel?: string;
  qrCodeToken: string;
}

export interface AssetQRCode {
  id: ID;
  societyId: ID;
  code: string;
  locationName: string;
  category: FacilityCategory | "common_area";
  towerId?: ID;
  description: string;
}

export interface StaffProfile {
  id: ID;
  societyId: ID;
  name: string;
  email?: string;
  phone: string;
  avatarUrl?: string;
  role: Extract<PlatformRole, "security_guard" | "maintenance_staff" | "society_manager">;
  department: StaffDepartment;
  skills: ComplaintCategory[];
  assignedFacilityIds: ID[];
  currentWorkload: number;
  availabilityStatus: StaffAvailability;
  active: boolean;
}

export interface Facility {
  id: ID;
  societyId: ID;
  name: string;
  category: FacilityCategory;
  location: string;
  towerId?: ID;
  status: FacilityStatus;
  responsibleStaffId: ID;
  responsibleStaffName?: string;
  lastMaintenanceDate: string;
  nextMaintenanceDate: string;
  maintenanceSchedule: "daily" | "weekly" | "biweekly" | "monthly" | "quarterly";
  openIssueCount: number;
  serviceHistoryCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface FacilityServiceLog {
  id: ID;
  facilityId: ID;
  staffId: ID;
  servicedAt: string;
  type: "scheduled_maintenance" | "emergency_repair" | "inspection";
  notes: string;
  cost?: number;
  description?: string;
  performedBy?: string;
  photos?: string[];
  date?: string;
  nextDueDate?: string;
  createdAt?: string;
}

export interface ComplaintGPSLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  capturedAt: string;
  captureMethod: "gps" | "manual";
}

export interface ComplaintStructuredLocation {
  locationType: LocationType;
  societyId: ID;
  towerId: ID;
  flatId?: ID;
  householdId?: ID;
  roomOrArea?: string;
  commonArea?: string;
  exactLocation?: string;
  gps?: ComplaintGPSLocation;
}

export interface Complaint {
  id: ID;
  societyId: ID;
  householdId: ID;
  flatId: ID;
  towerId: ID;
  createdByUserId: ID;
  reportedBy?: ID;
  reportedByName?: string;
  reportedByPhone?: string;
  assignedStaffId?: ID;
  assignedStaffName?: string;
  assignedDepartment?: StaffDepartment;
  department?: StaffDepartment;
  title: string;
  description: string;
  category: ComplaintCategory;
  priority: ComplaintPriority;
  status: ComplaintStatus;
  locationType: LocationType;
  location: string;
  locationLabel?: string;
  locationSource?: "gps" | "qr" | "manual" | "unavailable";
  roomOrArea?: string;
  commonArea?: string;
  exactLocation?: string;
  structuredLocation?: ComplaintStructuredLocation;
  gpsLocation?: ComplaintGPSLocation;
  commonLocationId?: ID;
  assetId?: ID;
  qrToken?: string;
  qrCodeScanned?: boolean;
  latitude?: number;
  longitude?: number;
  attachments: MediaAttachment[];
  resolutionProofUrl?: string;
  resolutionNote?: string;
  resolvedAt?: string;
  completedAt?: string;
  residentConfirmedAt?: string;
  confirmedByResident?: boolean;
  reopenReason?: string;
  reopenedAt?: string;
  slaDueAt?: string;
  createdAt: string;
  updatedAt: string;
  rating?: number;
}

export interface ComplaintUpdate {
  id: ID;
  complaintId: ID;
  actorUserId: ID;
  status: ComplaintStatus;
  note: string;
  attachments: MediaAttachment[];
  createdAt: string;
}

export interface EscalationEvent {
  id: ID;
  complaintId: ID;
  action: "notify_manager" | "increase_priority" | "notify_admin";
  triggeredAt: string;
  createdAt?: string;
  note: string;
}

export interface MediaAttachment {
  id: ID;
  type: "image" | "video" | "voice" | "document";
  url: string;
  name: string;
}

export interface VisitorPass {
  id: ID;
  societyId: ID;
  householdId: ID;
  flatId: ID;
  createdByUserId: ID;
  createdBy?: ID;
  visitorName: string;
  visitorPhone?: string;
  type: VisitorType;
  purpose?: string;
  vehicleNumber?: string;
  visitDate: string;
  validFrom?: string;
  validUntil?: string;
  status: "pending" | "approved" | "denied" | "used" | "expired" | "cancelled" | "expected" | "entered" | "exited";
  qrToken: string;
  approvedAt?: string;
  approvedBy?: ID;
  gateEntryAt?: string;
  gateExitAt?: string;
}

export interface Delivery {
  id: ID;
  societyId: ID;
  householdId: ID;
  flatId?: ID;
  flatNumber?: string;
  recipientName?: string;
  courierName: string;
  trackingNumber?: string;
  status: "expected" | "received_at_gate" | "collected";
  receivedAt?: string;
  collectedAt?: string;
  securityActorId?: ID;
  createdAt: string;
}

export interface Bill {
  id: ID;
  societyId: ID;
  householdId: ID;
  flatId: ID;
  title: string;
  amount: number;
  total?: number;
  period?: string;
  lineItems?: { label: string; amount: number }[];
  subtotal?: number;
  lateFee?: number;
  dueDate: string;
  status: BillStatus;
  category: "maintenance" | "electricity" | "water" | "other";
  paidAt?: string;
  paymentReference?: string;
}

export interface Amenity {
  id: ID;
  societyId: ID;
  name: string;
  icon: string;
  openingHour: string;
  closingHour: string;
  slotMinutes: number;
  charge: number;
  capacity: number;
}

export interface AmenityBooking {
  id: ID;
  amenityId: ID;
  societyId: ID;
  householdId: ID;
  userId: ID;
  userName?: string;
  bookedBy?: ID;
  flatId?: ID;
  date: string;
  startTime: string;
  endTime: string;
  slot?: string;
  guestCount?: number;
  charge?: number;
  qrPassToken?: string;
  status: "confirmed" | "cancelled" | "completed";
  createdAt?: string;
}

export interface AuditLog {
  id: ID;
  actorUserId: ID;
  actorRole: PlatformRole;
  societyId: ID;
  action: string;
  entityType: "complaint" | "facility" | "household" | "visitor" | "bill" | "user" | "security" | "community" | "amenity";
  entityId: ID;
  metadata?: Record<string, any>;
  timestamp: string;
}

export interface PollOption {
  id: ID;
  text: string;
  votes: number;
  votedUserIds: ID[];
}

export interface CommunityPoll {
  id: ID;
  societyId: ID;
  authorUserId: ID;
  question: string;
  options: PollOption[];
  expiresAt: string;
  createdAt: string;
}

export interface PollVote {
  id: ID;
  pollId: ID;
  optionId: ID;
  userId: ID;
  societyId: ID;
  votedAt: string;
}

export interface CommunityPost {
  id: ID;
  societyId: ID;
  authorUserId: ID;
  category: "general" | "buy_sell" | "rent" | "recommendations" | "lost_found" | "events" | "help" | "polls";
  body: string;
  imageUrl?: string;
  likes: number;
  comments: number;
  createdAt: string;
  pollId?: ID;
}

export interface MarketplaceItem {
  id: ID;
  societyId: ID;
  sellerUserId: ID;
  title: string;
  description: string;
  price: number;
  condition: "like_new" | "good" | "fair";
  category: "electronics" | "furniture" | "vehicles" | "books" | "appliances" | "other";
  imageUrl?: string;
  status: MarketplaceStatus;
  createdAt: string;
}

export interface LostAndFoundItem {
  id: ID;
  societyId: ID;
  reportedByUserId: ID;
  title: string;
  description: string;
  locationFound: string;
  dateFound: string;
  imageUrl?: string;
  status: "unclaimed" | "claimed";
  claimedByUserId?: ID;
}

export interface SocietyEvent {
  id: ID;
  societyId: ID;
  title: string;
  description: string;
  venue: string;
  eventDate: string;
  time: string;
  organizer: string;
  attendeeUserIds: ID[];
}

export interface Notice {
  id: ID;
  societyId: ID;
  type: NoticeType;
  title: string;
  description: string;
  attachmentUrl?: string;
  publishedAt: string;
  acknowledgedBy: ID[];
}

export interface SocietyDocument {
  id: ID;
  societyId: ID;
  title: string;
  category: "rules" | "maintenance" | "minutes" | "circulars" | "forms" | "emergency";
  url: string;
  updatedAt: string;
  access: PlatformRole[];
}

export interface ServiceProvider {
  id: ID;
  societyId: ID;
  name: string;
  category: string;
  rating: number;
  startingPrice: number;
  nextAvailable: string;
}

export interface ServiceBooking {
  id: ID;
  serviceProviderId: ID;
  societyId: ID;
  householdId: ID;
  userId: ID;
  scheduledAt: string;
  status: "requested" | "confirmed" | "in_progress" | "completed" | "cancelled";
}

export interface AppNotification {
  id: ID;
  societyId: ID;
  userId: ID;
  category: NotificationCategory;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

export interface DashboardMetrics {
  totalResidents: number;
  totalFlats: number;
  openComplaints: number;
  resolvedComplaints: number;
  visitorsToday: number;
  pendingBills: number;
  amenityBookings: number;
  activeStaffCount: number;
  operationalFacilityCount: number;
}
