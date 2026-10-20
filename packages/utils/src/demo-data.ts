import type {
  Amenity,
  AppNotification,
  AssetQRCode,
  Bill,
  CommunityPoll,
  CommunityPost,
  Complaint,
  ComplaintUpdate,
  DashboardMetrics,
  EscalationEvent,
  Facility,
  FacilityServiceLog,
  Flat,
  Household,
  LostAndFoundItem,
  MarketplaceItem,
  Notice,
  PredefinedCommonLocation,
  ResidentUser,
  ServiceProvider,
  Society,
  SocietyEvent,
  StaffProfile,
  Tower,
  VisitorPass
} from "@resolvex/types";

export const demoSociety: Society = {
  id: "soc-ajanta-genx",
  name: "Ajanta Gen-X",
  tagline: "Everything Your Community Needs. In One Place.",
  address: "Sector 74, Noida, Uttar Pradesh",
  city: "Noida",
  createdAt: "2026-08-01T09:00:00.000Z",
  settings: {
    approvalRequiredForJoin: true,
    tenantsCanViewBills: false,
    directoryPhoneVisibleByDefault: false,
    complaintEscalationHours: {
      notifyManager: 24,
      increasePriority: 48,
      notifyAdmin: 72
    }
  }
};

export const towers: Tower[] = [
  { id: "tower-a", societyId: demoSociety.id, name: "Tower A", floors: 24 },
  { id: "tower-b", societyId: demoSociety.id, name: "Tower B", floors: 22 },
  { id: "tower-c", societyId: demoSociety.id, name: "Tower C", floors: 20 }
];

export const households: Household[] = [
  {
    id: "hh-a-1204",
    societyId: demoSociety.id,
    towerId: "tower-a",
    flatId: "flat-a-1204",
    displayName: "A-1204 Sharma Household",
    inviteCode: "AJX-A1204",
    memberIds: ["user-rahul", "user-priya", "user-aman"],
    pendingRequestIds: ["user-minkush"],
    createdAt: "2026-08-10T10:00:00.000Z"
  },
  {
    id: "hh-b-804",
    societyId: demoSociety.id,
    towerId: "tower-b",
    flatId: "flat-b-804",
    displayName: "B-804 Mehta Household",
    inviteCode: "AJX-B804",
    memberIds: ["user-neha", "user-rohan"],
    pendingRequestIds: [],
    createdAt: "2026-08-12T10:00:00.000Z"
  }
];

export const flats: Flat[] = [
  {
    id: "flat-a-1204",
    societyId: demoSociety.id,
    towerId: "tower-a",
    householdId: "hh-a-1204",
    flatNumber: "A-1204",
    flatType: "3BHK",
    floor: 12,
    ownerUserId: "user-rahul"
  },
  {
    id: "flat-b-804",
    societyId: demoSociety.id,
    towerId: "tower-b",
    householdId: "hh-b-804",
    flatNumber: "B-804",
    flatType: "2BHK",
    floor: 8,
    ownerUserId: "user-neha"
  }
];

export const residents: ResidentUser[] = [
  {
    id: "user-minkush",
    societyId: demoSociety.id,
    householdId: "hh-a-1204",
    flatId: "flat-a-1204",
    towerId: "tower-a",
    name: "Minkush Goyal",
    email: "minkush@example.com",
    phone: "+91 98765 43010",
    platformRoles: ["resident"],
    householdRole: "family_member",
    verificationStatus: "pending",
    privacy: { showPhoneInDirectory: false, showEmailInDirectory: false },
    joinedAt: "2026-09-01T09:00:00.000Z"
  },
  {
    id: "user-rahul",
    societyId: demoSociety.id,
    householdId: "hh-a-1204",
    flatId: "flat-a-1204",
    towerId: "tower-a",
    name: "Rahul Sharma",
    email: "rahul.sharma@example.com",
    phone: "+91 98111 22004",
    platformRoles: ["resident", "flat_owner"],
    householdRole: "owner",
    verificationStatus: "verified",
    privacy: { showPhoneInDirectory: true, showEmailInDirectory: false },
    joinedAt: "2026-08-10T10:00:00.000Z"
  },
  {
    id: "user-priya",
    societyId: demoSociety.id,
    householdId: "hh-a-1204",
    flatId: "flat-a-1204",
    towerId: "tower-a",
    name: "Priya Sharma",
    email: "priya.sharma@example.com",
    phone: "+91 98999 12004",
    platformRoles: ["resident"],
    householdRole: "family_member",
    verificationStatus: "verified",
    privacy: { showPhoneInDirectory: false, showEmailInDirectory: false },
    joinedAt: "2026-08-11T10:00:00.000Z"
  },
  {
    id: "user-aman",
    societyId: demoSociety.id,
    householdId: "hh-a-1204",
    flatId: "flat-a-1204",
    towerId: "tower-a",
    name: "Aman Verma",
    email: "aman.verma@example.com",
    phone: "+91 98222 33004",
    platformRoles: ["resident", "tenant"],
    householdRole: "tenant",
    verificationStatus: "verified",
    privacy: { showPhoneInDirectory: false, showEmailInDirectory: false },
    joinedAt: "2026-08-15T10:00:00.000Z"
  },
  {
    id: "user-neha",
    societyId: demoSociety.id,
    householdId: "hh-b-804",
    flatId: "flat-b-804",
    towerId: "tower-b",
    name: "Neha Mehta",
    email: "neha.mehta@example.com",
    phone: "+91 98666 77880",
    platformRoles: ["resident", "flat_owner"],
    householdRole: "owner",
    verificationStatus: "verified",
    privacy: { showPhoneInDirectory: true, showEmailInDirectory: false },
    joinedAt: "2026-08-12T10:00:00.000Z"
  },
  {
    id: "user-rohan",
    societyId: demoSociety.id,
    householdId: "hh-b-804",
    flatId: "flat-b-804",
    towerId: "tower-b",
    name: "Rohan Mehta",
    email: "rohan.mehta@example.com",
    phone: "+91 98666 77881",
    platformRoles: ["resident"],
    householdRole: "family_member",
    verificationStatus: "verified",
    privacy: { showPhoneInDirectory: false, showEmailInDirectory: false },
    joinedAt: "2026-08-12T10:00:00.000Z"
  }
];

export const commonLocations: PredefinedCommonLocation[] = [
  {
    id: "loc-ta-lift-1",
    name: "Tower A Lift 1 (Passenger)",
    category: "lift",
    towerId: "tower-a",
    buildingOrArea: "Tower A",
    floorOrLevel: "Ground to 24th Floor",
    qrCodeToken: "QR-AJX-TA-LIFT1"
  },
  {
    id: "loc-tb-lift-2",
    name: "Tower B Lift 2 (Service)",
    category: "lift",
    towerId: "tower-b",
    buildingOrArea: "Tower B",
    floorOrLevel: "Basement 1 to 22nd Floor",
    qrCodeToken: "QR-AJX-TB-LIFT2"
  },
  {
    id: "loc-swimming-pool",
    name: "Clubhouse Swimming Pool Deck",
    category: "swimming_pool",
    buildingOrArea: "Clubhouse Complex",
    floorOrLevel: "Ground Floor Lawn",
    qrCodeToken: "QR-AJX-POOL-01"
  },
  {
    id: "loc-electrical-room-a",
    name: "Tower A Electrical Substation Room",
    category: "electrical",
    towerId: "tower-a",
    buildingOrArea: "Tower A",
    floorOrLevel: "Basement 1",
    qrCodeToken: "QR-AJX-ELEC-TA"
  },
  {
    id: "loc-gymnasium",
    name: "Central Health & Fitness Gym",
    category: "gym",
    buildingOrArea: "Clubhouse 2nd Floor",
    floorOrLevel: "2nd Floor",
    qrCodeToken: "QR-AJX-GYM-01"
  },
  {
    id: "loc-main-gate",
    name: "Main Entrance Security Gate 1",
    category: "security",
    buildingOrArea: "North Entrance Gate",
    floorOrLevel: "Ground Level",
    qrCodeToken: "QR-AJX-GATE-1"
  },
  {
    id: "loc-water-tank-a",
    name: "Tower A Overhead Water Tank & Pump",
    category: "water_supply",
    towerId: "tower-a",
    buildingOrArea: "Tower A Roof",
    floorOrLevel: "25th Terrace",
    qrCodeToken: "QR-AJX-WATER-TA"
  }
];

export const assetQRCodes: AssetQRCode[] = [
  {
    id: "asset-qr-1",
    societyId: demoSociety.id,
    code: "QR-AJX-TA-LIFT1",
    locationName: "Tower A Lift 1 (Passenger)",
    category: "lift",
    towerId: "tower-a",
    description: "Scan to raise instant issue for Schindler Passenger Lift A1."
  },
  {
    id: "asset-qr-2",
    societyId: demoSociety.id,
    code: "QR-AJX-POOL-01",
    locationName: "Clubhouse Swimming Pool Deck",
    category: "swimming_pool",
    description: "Scan to report cleanliness, filtration, or lifeguard feedback."
  },
  {
    id: "asset-qr-3",
    societyId: demoSociety.id,
    code: "QR-AJX-ELEC-TA",
    locationName: "Tower A Electrical Substation Room",
    category: "electrical",
    towerId: "tower-a",
    description: "Scan to report trip faults, meter issues, or power fluctuations."
  }
];

export const staff: StaffProfile[] = [
  {
    id: "staff-vikas",
    societyId: demoSociety.id,
    name: "Vikas Kumar",
    phone: "+91 90000 11001",
    avatarUrl: "https://images.unsplash.com/photo-1540569014015-19a7be504e3a?auto=format&fit=crop&w=200&q=80",
    role: "maintenance_staff",
    department: "plumbing",
    skills: ["plumbing", "water_supply", "common_area"],
    assignedFacilityIds: ["fac-water-tank"],
    currentWorkload: 1,
    availabilityStatus: "on_duty",
    active: true
  },
  {
    id: "staff-rajesh",
    societyId: demoSociety.id,
    name: "Rajesh Sharma",
    phone: "+91 90000 11003",
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80",
    role: "maintenance_staff",
    department: "electrical",
    skills: ["electrical"],
    assignedFacilityIds: ["fac-elec-substation", "fac-generator"],
    currentWorkload: 2,
    availabilityStatus: "available",
    active: true
  },
  {
    id: "staff-deepak",
    societyId: demoSociety.id,
    name: "Deepak Verma",
    phone: "+91 90000 11004",
    avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80",
    role: "maintenance_staff",
    department: "lift",
    skills: ["lift"],
    assignedFacilityIds: ["fac-lift-ta1", "fac-lift-tb2"],
    currentWorkload: 1,
    availabilityStatus: "available",
    active: true
  },
  {
    id: "staff-gate-a",
    societyId: demoSociety.id,
    name: "Suresh Yadav",
    phone: "+91 90000 11002",
    avatarUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=200&q=80",
    role: "security_guard",
    department: "security",
    skills: ["security"],
    assignedFacilityIds: ["fac-cctv-gate"],
    currentWorkload: 0,
    availabilityStatus: "on_duty",
    active: true
  },
  {
    id: "staff-anjali",
    societyId: demoSociety.id,
    name: "Anjali Devi",
    phone: "+91 90000 11005",
    avatarUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80",
    role: "maintenance_staff",
    department: "housekeeping",
    skills: ["cleanliness", "common_area", "pest_control"],
    assignedFacilityIds: ["fac-pool-deck"],
    currentWorkload: 0,
    availabilityStatus: "available",
    active: true
  }
];

export const facilities: Facility[] = [
  {
    id: "fac-lift-ta1",
    societyId: demoSociety.id,
    name: "Tower A Schindler Passenger Lift 1",
    category: "lift",
    location: "Tower A Core",
    towerId: "tower-a",
    status: "operational",
    responsibleStaffId: "staff-deepak",
    lastMaintenanceDate: "2026-08-20",
    nextMaintenanceDate: "2026-09-20",
    maintenanceSchedule: "monthly",
    openIssueCount: 0,
    serviceHistoryCount: 14
  },
  {
    id: "fac-lift-tb2",
    societyId: demoSociety.id,
    name: "Tower B Service Lift 2",
    category: "lift",
    location: "Tower B Core",
    towerId: "tower-b",
    status: "degraded",
    responsibleStaffId: "staff-deepak",
    lastMaintenanceDate: "2026-08-15",
    nextMaintenanceDate: "2026-09-15",
    maintenanceSchedule: "monthly",
    openIssueCount: 1,
    serviceHistoryCount: 9
  },
  {
    id: "fac-elec-substation",
    societyId: demoSociety.id,
    name: "Main High-Tension Electrical Substation",
    category: "electrical",
    location: "Basement 1 Utility Zone",
    status: "operational",
    responsibleStaffId: "staff-rajesh",
    lastMaintenanceDate: "2026-08-01",
    nextMaintenanceDate: "2026-10-01",
    maintenanceSchedule: "quarterly",
    openIssueCount: 0,
    serviceHistoryCount: 6
  },
  {
    id: "fac-water-tank",
    societyId: demoSociety.id,
    name: "Tower A Hydro-Pneumatic Water Supply System",
    category: "water_supply",
    location: "Tower A Terrace & Pump Room",
    towerId: "tower-a",
    status: "under_maintenance",
    responsibleStaffId: "staff-vikas",
    lastMaintenanceDate: "2026-08-28",
    nextMaintenanceDate: "2026-09-07",
    maintenanceSchedule: "weekly",
    openIssueCount: 1,
    serviceHistoryCount: 22
  },
  {
    id: "fac-generator",
    societyId: demoSociety.id,
    name: "500 KVA Diesel Backup Generator",
    category: "generator",
    location: "Behind Clubhouse",
    status: "operational",
    responsibleStaffId: "staff-rajesh",
    lastMaintenanceDate: "2026-08-10",
    nextMaintenanceDate: "2026-09-10",
    maintenanceSchedule: "monthly",
    openIssueCount: 0,
    serviceHistoryCount: 11
  },
  {
    id: "fac-pool-deck",
    societyId: demoSociety.id,
    name: "Clubhouse Swimming Pool & Filtration Unit",
    category: "swimming_pool",
    location: "Clubhouse Grounds",
    status: "operational",
    responsibleStaffId: "staff-anjali",
    lastMaintenanceDate: "2026-09-01",
    nextMaintenanceDate: "2026-09-08",
    maintenanceSchedule: "weekly",
    openIssueCount: 0,
    serviceHistoryCount: 18
  }
];

export const facilityServiceLogs: FacilityServiceLog[] = [
  {
    id: "log-1",
    facilityId: "fac-water-tank",
    staffId: "staff-vikas",
    servicedAt: "2026-08-28T10:00:00.000Z",
    type: "scheduled_maintenance",
    notes: "Cleaned booster pump strainer and calibrated pressure switch.",
    cost: 1500
  },
  {
    id: "log-2",
    facilityId: "fac-lift-tb2",
    staffId: "staff-deepak",
    servicedAt: "2026-08-15T14:30:00.000Z",
    type: "inspection",
    notes: "Inspected door sensor and elevator cables. Display module replacement scheduled.",
    cost: 0
  }
];

export const complaints: Complaint[] = [
  {
    id: "cmp-1001",
    societyId: demoSociety.id,
    householdId: "hh-a-1204",
    flatId: "flat-a-1204",
    towerId: "tower-a",
    createdByUserId: "user-priya",
    assignedStaffId: "staff-vikas",
    assignedDepartment: "plumbing",
    title: "Bathroom pipe leakage",
    description: "Water is leaking from the bathroom pipe near the wash basin. Please inspect before it spreads.",
    category: "plumbing",
    priority: "medium",
    status: "in_progress",
    locationType: "flat",
    location: "Tower A, Flat A-1204, Master Bathroom",
    attachments: [
      {
        id: "att-1",
        type: "image",
        url: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=600&q=80",
        name: "pipe_leakage.jpg"
      }
    ],
    createdAt: "2026-09-02T07:30:00.000Z",
    updatedAt: "2026-09-03T04:00:00.000Z"
  },
  {
    id: "cmp-1002",
    societyId: demoSociety.id,
    householdId: "hh-b-804",
    flatId: "flat-b-804",
    towerId: "tower-b",
    createdByUserId: "user-rohan",
    assignedStaffId: "staff-deepak",
    assignedDepartment: "lift",
    title: "Lift display blank error",
    description: "Tower B service lift display panel is completely blank. Floor buttons illuminate but indicator screen is unreadable.",
    category: "lift",
    priority: "high",
    status: "under_review",
    locationType: "common_area",
    location: "Tower B Lift 2 (Service)",
    commonLocationId: "loc-tb-lift-2",
    qrCodeScanned: true,
    attachments: [],
    createdAt: "2026-09-03T05:00:00.000Z",
    updatedAt: "2026-09-03T05:20:00.000Z"
  },
  {
    id: "cmp-1003",
    societyId: demoSociety.id,
    householdId: "hh-a-1204",
    flatId: "flat-a-1204",
    towerId: "tower-a",
    createdByUserId: "user-minkush",
    assignedStaffId: "staff-suresh",
    assignedDepartment: "electrical",
    title: "Intercom handset buzzing noise",
    description: "Intercom receiver buzzing constantly and calls from security main gate fail to connect.",
    category: "electrical",
    priority: "high",
    status: "resident_confirmation",
    locationType: "flat",
    location: "Tower A, Flat A-1204, Living Room",
    attachments: [],
    resolutionProofUrl: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80",
    resolutionNote: "Replaced oxidized RJ11 intercom modular socket and tested dial-tone with Main Gate Security post. Clear two-way audio verified.",
    resolvedAt: "2026-09-04T10:30:00.000Z",
    createdAt: "2026-09-03T09:15:00.000Z",
    updatedAt: "2026-09-04T10:30:00.000Z"
  },
  {
    id: "cmp-1004",
    societyId: demoSociety.id,
    householdId: "hh-a-1204",
    flatId: "flat-a-1204",
    towerId: "tower-a",
    createdByUserId: "user-priya",
    title: "Tower A Lobby AC condensation dripping",
    description: "Lobby cassette unit dripping condensation water onto the polished granite floor, creating a slipping hazard.",
    category: "common_area",
    priority: "high",
    status: "open",
    locationType: "common_area",
    location: "Tower A Entrance Lobby",
    attachments: [],
    createdAt: "2026-09-05T06:45:00.000Z",
    updatedAt: "2026-09-05T06:45:00.000Z"
  },
  {
    id: "cmp-1005",
    societyId: demoSociety.id,
    householdId: "hh-b-804",
    flatId: "flat-b-804",
    towerId: "tower-b",
    createdByUserId: "user-rohan",
    assignedStaffId: "staff-vikas",
    assignedDepartment: "plumbing",
    title: "Kitchen sink drain clogged",
    description: "Kitchen main drain line choked with food residue. Slow drainage.",
    category: "plumbing",
    priority: "low",
    status: "resolved",
    locationType: "flat",
    location: "Tower B, Flat B-804",
    attachments: [],
    confirmedByResident: true,
    resolvedAt: "2026-09-01T15:00:00.000Z",
    createdAt: "2026-08-31T11:00:00.000Z",
    updatedAt: "2026-09-01T16:00:00.000Z"
  }
];

export const complaintUpdates: ComplaintUpdate[] = [
  {
    id: "cu-1",
    complaintId: "cmp-1001",
    actorUserId: "user-priya",
    status: "open",
    note: "Complaint raised by resident.",
    attachments: [],
    createdAt: "2026-09-02T07:30:00.000Z"
  },
  {
    id: "cu-2",
    complaintId: "cmp-1001",
    actorUserId: "user-rahul",
    status: "assigned",
    note: "Assigned to Plumbing Department lead Vikas Kumar.",
    attachments: [],
    createdAt: "2026-09-02T09:30:00.000Z"
  },
  {
    id: "cu-3",
    complaintId: "cmp-1001",
    actorUserId: "staff-vikas",
    status: "in_progress",
    note: "Replacement elbow valve ordered. Onsite repair in progress.",
    attachments: [],
    createdAt: "2026-09-03T04:00:00.000Z"
  },
  {
    id: "cu-4",
    complaintId: "cmp-1003",
    actorUserId: "user-minkush",
    status: "open",
    note: "Intercom issue submitted by resident Minkush Goyal.",
    attachments: [],
    createdAt: "2026-09-03T09:15:00.000Z"
  },
  {
    id: "cu-5",
    complaintId: "cmp-1003",
    actorUserId: "user-rahul",
    status: "assigned",
    note: "Routed to Electrical Department & assigned to Suresh Patil.",
    attachments: [],
    createdAt: "2026-09-03T11:00:00.000Z"
  },
  {
    id: "cu-6",
    complaintId: "cmp-1003",
    actorUserId: "staff-suresh",
    status: "in_progress",
    note: "Technician arrived on-site. Testing living room modular port line voltage.",
    attachments: [],
    createdAt: "2026-09-04T09:30:00.000Z"
  },
  {
    id: "cu-7",
    complaintId: "cmp-1003",
    actorUserId: "staff-suresh",
    status: "resident_confirmation",
    note: "Port connector replaced. Two-way call tested with Main Gate. Marked ready for resident sign-off.",
    attachments: [],
    createdAt: "2026-09-04T10:30:00.000Z"
  }
];

export const escalationHistory: EscalationEvent[] = [
  {
    id: "esc-1",
    complaintId: "cmp-1001",
    action: "notify_manager",
    triggeredAt: "2026-09-03T07:30:00.000Z",
    note: "Manager notified because the complaint crossed the 24 hour SLA threshold."
  }
];

export const bills: Bill[] = [
  {
    id: "bill-sep-maint-a1204",
    societyId: demoSociety.id,
    householdId: "hh-a-1204",
    flatId: "flat-a-1204",
    title: "September Maintenance",
    amount: 4250,
    dueDate: "2026-09-10",
    status: "pending",
    category: "maintenance"
  },
  {
    id: "bill-aug-water-a1204",
    societyId: demoSociety.id,
    householdId: "hh-a-1204",
    flatId: "flat-a-1204",
    title: "August Water Charges",
    amount: 680,
    dueDate: "2026-08-25",
    status: "overdue",
    category: "water"
  }
];

export const notices: Notice[] = [
  {
    id: "notice-maint",
    societyId: demoSociety.id,
    type: "maintenance",
    title: "Overhead Water Tank Cleaning & Disinfection",
    description: "Water supply to Tower A and B will be temporarily paused from 10 AM to 1 PM this Sunday for mandatory quarterly tank cleaning.",
    publishedAt: "2026-09-02T12:00:00.000Z",
    acknowledgedBy: ["user-rahul", "user-priya"]
  },
  {
    id: "notice-event",
    societyId: demoSociety.id,
    type: "event",
    title: "Ganesh Utsav Cultural Gala & Community Feast",
    description: "Join fellow residents at the Clubhouse Lawn at 6 PM for cultural performances, children's art showcase, and dinner buffet.",
    publishedAt: "2026-09-01T12:00:00.000Z",
    acknowledgedBy: ["user-neha"]
  }
];

export const communityPolls: CommunityPoll[] = [
  {
    id: "poll-ev-charger",
    societyId: demoSociety.id,
    authorUserId: "user-rahul",
    question: "Should the society install EV Fast Chargers in Basement 1 parking zone?",
    options: [
      { id: "opt-1", text: "Yes, install 4 charging stations immediately", votes: 42, votedUserIds: ["user-rahul", "user-neha"] },
      { id: "opt-2", text: "Yes, but start with 2 trial chargers", votes: 28, votedUserIds: ["user-priya"] },
      { id: "opt-3", text: "No, defer to next AGM meeting", votes: 6, votedUserIds: ["user-aman"] }
    ],
    expiresAt: "2026-09-15T23:59:59.000Z",
    createdAt: "2026-09-01T08:00:00.000Z"
  }
];

export const posts: CommunityPost[] = [
  {
    id: "post-rent",
    societyId: demoSociety.id,
    authorUserId: "user-neha",
    category: "rent",
    body: "Fully furnished 2 BHK flat available for rent in Tower C from 1st October. High-floor, park facing, modular kitchen & wooden wardrobes. Prefer families.",
    imageUrl: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=600&q=80",
    likes: 24,
    comments: 7,
    createdAt: "2026-09-02T15:00:00.000Z"
  },
  {
    id: "post-help",
    societyId: demoSociety.id,
    authorUserId: "user-aman",
    category: "help",
    body: "Looking for recommendations for a reliable inverter battery electrician in Sector 74. Any tried and tested service providers in our society?",
    likes: 8,
    comments: 11,
    createdAt: "2026-09-03T07:10:00.000Z"
  }
];

export const marketplaceItems: MarketplaceItem[] = [
  {
    id: "mkt-sofa",
    societyId: demoSociety.id,
    sellerUserId: "user-rahul",
    title: "Urban Ladder L-Shaped Fabric Sofa (3 Seater + Lounger)",
    description: "Selling 1-year-old grey fabric sofa in immaculate condition. No stains or sagging. Pick up from Tower A 12th Floor.",
    price: 18500,
    condition: "like_new",
    category: "furniture",
    imageUrl: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=600&q=80",
    status: "available",
    createdAt: "2026-09-01T14:00:00.000Z"
  },
  {
    id: "mkt-cycle",
    societyId: demoSociety.id,
    sellerUserId: "user-rohan",
    title: "Decathlon Rockrider ST100 Mountain Bicycle 27.5T",
    description: "Includes LED front light, gel seat cover, and helmet. Perfectly tuned gears.",
    price: 8900,
    condition: "good",
    category: "vehicles",
    imageUrl: "https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=600&q=80",
    status: "available",
    createdAt: "2026-09-02T11:30:00.000Z"
  }
];

export const lostAndFoundItems: LostAndFoundItem[] = [
  {
    id: "lf-keys",
    societyId: demoSociety.id,
    reportedByUserId: "user-priya",
    title: "Found Honda Car Key with Red Leather Fob",
    description: "Found near Clubhouse Badminton Court bench around 7 PM yesterday.",
    locationFound: "Clubhouse Badminton Court",
    dateFound: "2026-09-02",
    imageUrl: "https://images.unsplash.com/photo-1582139329536-e7284fece509?auto=format&fit=crop&w=600&q=80",
    status: "unclaimed"
  }
];

export const societyEvents: SocietyEvent[] = [
  {
    id: "evt-ganesh",
    societyId: demoSociety.id,
    title: "Annual Ganesh Chaturthi Cultural Gala",
    description: "Grand evening with classical dance, resident choir performances, and community dinner buffet.",
    venue: "Clubhouse Main Amphitheatre",
    eventDate: "2026-09-12",
    time: "06:30 PM Onwards",
    organizer: "Ajanta Cultural Committee",
    attendeeUserIds: ["user-rahul", "user-priya", "user-neha", "user-rohan"]
  }
];

export const visitorPasses: VisitorPass[] = [
  {
    id: "visit-1",
    societyId: demoSociety.id,
    householdId: "hh-a-1204",
    flatId: "flat-a-1204",
    createdByUserId: "user-rahul",
    visitorName: "Rohit Express Courier",
    visitorPhone: "+91 90000 44444",
    type: "delivery",
    visitDate: "2026-09-03",
    status: "expected",
    qrToken: "QR-AJX-DEL-1001"
  }
];

export const amenities: Amenity[] = [
  {
    id: "amenity-clubhouse",
    societyId: demoSociety.id,
    name: "Clubhouse Banquet Hall",
    icon: "building",
    openingHour: "08:00",
    closingHour: "22:00",
    slotMinutes: 60,
    charge: 500,
    capacity: 40
  },
  {
    id: "amenity-badminton",
    societyId: demoSociety.id,
    name: "Indoor Badminton Court 1",
    icon: "dumbbell",
    openingHour: "06:00",
    closingHour: "21:00",
    slotMinutes: 45,
    charge: 0,
    capacity: 4
  }
];

export const serviceProviders: ServiceProvider[] = [
  {
    id: "svc-plumber",
    societyId: demoSociety.id,
    name: "Rapid Plumbing Services",
    category: "Plumber",
    rating: 4.8,
    startingPrice: 199,
    nextAvailable: "Today, 4:30 PM"
  },
  {
    id: "svc-electrician",
    societyId: demoSociety.id,
    name: "VoltCare Certified Electrician",
    category: "Electrician",
    rating: 4.7,
    startingPrice: 249,
    nextAvailable: "Tomorrow, 10:00 AM"
  },
  {
    id: "svc-pest",
    societyId: demoSociety.id,
    name: "CleanNest Eco Pest Control",
    category: "Pest Control",
    rating: 4.6,
    startingPrice: 899,
    nextAvailable: "Friday, 2:00 PM"
  }
];

export const notifications: AppNotification[] = [
  {
    id: "notif-1",
    societyId: demoSociety.id,
    userId: "user-minkush",
    category: "complaint",
    title: "Complaint awaiting confirmation",
    body: "Technician marked complaint #cmp-1003 as resolved. Please review and confirm fix.",
    read: false,
    createdAt: "2026-09-04T10:35:00.000Z"
  },
  {
    id: "notif-2",
    societyId: demoSociety.id,
    userId: "user-minkush",
    category: "complaint",
    title: "Complaint assigned to technician",
    body: "Your complaint #cmp-1001 has been assigned to Vikas Kumar (Plumbing).",
    read: false,
    createdAt: "2026-09-03T04:05:00.000Z"
  },
  {
    id: "notif-3",
    societyId: demoSociety.id,
    userId: "user-minkush",
    category: "emergency",
    title: "Lift B2 scheduled maintenance",
    body: "Passenger Lift B2 maintenance is scheduled tomorrow at 10:00 AM. Please use Lift B1.",
    read: false,
    createdAt: "2026-09-04T14:00:00.000Z"
  },
  {
    id: "notif-4",
    societyId: demoSociety.id,
    userId: "user-minkush",
    category: "bill",
    title: "Maintenance due reminder",
    body: "September Maintenance (₹4,250) for Flat A-1204 is due on Sept 10.",
    read: true,
    createdAt: "2026-09-03T06:00:00.000Z"
  },
  {
    id: "notif-5",
    societyId: demoSociety.id,
    userId: "user-minkush",
    category: "notice",
    title: "Household verification approved",
    body: "Your household verification request for Flat A-1204 was approved by Management.",
    read: true,
    createdAt: "2026-09-01T09:00:00.000Z"
  }
];

export const dashboardMetrics: DashboardMetrics = {
  totalResidents: residents.length,
  totalFlats: flats.length,
  openComplaints: complaints.filter((complaint) => complaint.status !== "resolved").length,
  resolvedComplaints: complaints.filter((complaint) => complaint.status === "resolved").length,
  visitorsToday: visitorPasses.filter((pass) => pass.visitDate === "2026-09-03").length,
  pendingBills: bills.filter((bill) => bill.status !== "paid").length,
  amenityBookings: 12,
  activeStaffCount: staff.filter((s) => s.active).length,
  operationalFacilityCount: facilities.filter((f) => f.status === "operational").length
};

export const complaintCategoryChart = [
  { name: "Plumbing", value: 36 },
  { name: "Lift", value: 24 },
  { name: "Electrical", value: 18 },
  { name: "Security", value: 14 },
  { name: "Cleanliness", value: 20 },
  { name: "Water Supply", value: 12 }
];

export const monthlyComplaintChart = [
  { month: "Apr", open: 18, resolved: 16 },
  { month: "May", open: 22, resolved: 20 },
  { month: "Jun", open: 26, resolved: 24 },
  { month: "Jul", open: 19, resolved: 21 },
  { month: "Aug", open: 31, resolved: 27 },
  { month: "Sep", open: 14, resolved: 9 }
];

export const billCollectionChart = [
  { month: "Apr", collected: 72 },
  { month: "May", collected: 78 },
  { month: "Jun", collected: 84 },
  { month: "Jul", collected: 81 },
  { month: "Aug", collected: 88 },
  { month: "Sep", collected: 64 }
];
