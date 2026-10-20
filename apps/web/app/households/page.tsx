"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Car,
  Check,
  CheckCircle2,
  Clock,
  FileCheck,
  Home,
  Key,
  Mail,
  MapPin,
  Phone,
  PhoneCall,
  Search,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
  X
} from "lucide-react";
import { toast } from "sonner";
import { flats, households, residents, towers } from "@resolvex/utils";
import type { Household, ResidentUser, UserProfile } from "@resolvex/types";
import { AppShell } from "@/components/app-shell";
import { HouseholdCard } from "@/components/household-card";
import { AnimatedSection, Badge, Button, Card, SectionHeader, StatusDot } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import {
  inviteMember,
  removeMember,
  subscribeFlats,
  subscribeHousehold,
  subscribeHouseholdMembers,
  subscribeHouseholds,
  subscribeSocietyUsers,
  verifyMember
} from "@/lib/services";
import { useSessionStore } from "@/lib/store";

export default function HouseholdsPage() {
  const { activeRole } = useSessionStore();

  if (activeRole === "security_guard") {
    return (
      <AppShell>
        <SecurityResidentDirectoryView />
      </AppShell>
    );
  }

  if (activeRole === "tenant") {
    return (
      <AppShell>
        <TenantHouseholdView />
      </AppShell>
    );
  }

  if (activeRole === "society_admin" || activeRole === "society_manager" || activeRole === "super_admin") {
    return (
      <AppShell mode="admin">
        <ManagementHouseholdDirectoryView />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <StandardHouseholdGovernanceView isOwnerPerspective={activeRole === "flat_owner"} />
    </AppShell>
  );
}

// ─── Security Guard: Gate Verification & Intercom Directory ──────────────────
function SecurityResidentDirectoryView() {
  const [searchQuery, setSearchQuery] = useState("");
  const [verifiedEntryFlat, setVerifiedEntryFlat] = useState<string | null>(null);

  const gateDirectory = [
    {
      flatNumber: "A-1204",
      tower: "Tower A · Floor 12",
      residents: [
        { name: "Minkush Goyal", role: "Resident", phone: "+91 98765 43210", isPrimary: true },
        { name: "Sunita Goyal", role: "Family Member", phone: "+91 98765 43211", isPrimary: false }
      ],
      vehicles: [
        { plate: "DL 03 AB 1204", model: "Honda City (White)", sticker: "STK-772", type: "4-Wheeler" },
        { plate: "UP 16 CD 9901", model: "Honda Activa (Black)", sticker: "STK-773", type: "2-Wheeler" }
      ],
      intercomExt: "1204",
      status: "verified"
    },
    {
      flatNumber: "B-903",
      tower: "Tower B · Floor 9",
      residents: [
        { name: "Aman Verma", role: "Tenant", phone: "+91 98765 88990", isPrimary: true },
        { name: "Ritu Verma", role: "Family Member", phone: "+91 98765 88991", isPrimary: false }
      ],
      vehicles: [
        { plate: "DL 04 XY 9032", model: "Hyundai Creta (Silver)", sticker: "STK-419", type: "4-Wheeler" }
      ],
      intercomExt: "0903",
      status: "verified"
    },
    {
      flatNumber: "A-602",
      tower: "Tower A · Floor 6",
      residents: [
        { name: "Vikram Malhotra", role: "Owner", phone: "+91 98765 33445", isPrimary: true },
        { name: "Pooja Malhotra", role: "Co-Owner", phone: "+91 98765 33446", isPrimary: false }
      ],
      vehicles: [
        { plate: "DL 08 CA 6020", model: "Maruti Brezza (Red)", sticker: "STK-210", type: "4-Wheeler" }
      ],
      intercomExt: "0602",
      status: "verified"
    },
    {
      flatNumber: "B-1102",
      tower: "Tower B · Floor 11",
      residents: [
        { name: "Kavita Rao", role: "Owner", phone: "+91 98765 55667", isPrimary: true }
      ],
      vehicles: [
        { plate: "HR 26 DQ 1102", model: "Kia Seltos (Grey)", sticker: "STK-552", type: "4-Wheeler" }
      ],
      intercomExt: "1102",
      status: "verified"
    }
  ];

  const filtered = gateDirectory.filter(
    (item) =>
      item.flatNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.residents.some((r) => r.name.toLowerCase().includes(searchQuery.toLowerCase()) || r.phone.includes(searchQuery)) ||
      item.vehicles.some((v) => v.plate.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  function ringIntercom(flatNo: string, ext: string) {
    toast.info(`Intercom dialing Flat ${flatNo} (Ext ${ext}) from Gate Guardhouse...`);
  }

  function handleVerifyGateEntry(flatNo: string) {
    setVerifiedEntryFlat(flatNo);
    toast.success(`Entry authorized for resident/visitor to Flat ${flatNo}. Barrier arm open.`);
    setTimeout(() => setVerifiedEntryFlat(null), 4000);
  }

  return (
    <AnimatedSection className="space-y-6">
      <SectionHeader
        eyebrow="Gate Security Operations"
        title="Resident Verification & Vehicle Registry"
        description="Search authorized residents by flat number, contact residents via guardhouse intercom, and verify vehicle stickers."
      />

      {/* Search Input */}
      <div className="relative max-w-xl">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by Flat Number (e.g. A-1204), Resident Name, or Vehicle Plate..."
          className="w-full rounded-xl border bg-card pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/25 shadow-xs"
        />
      </div>

      {verifiedEntryFlat && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 size={18} />
          <span>Entry verified and gate cleared for Flat {verifiedEntryFlat}.</span>
        </div>
      )}

      {/* Directory Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {filtered.map((entry) => (
          <Card key={entry.flatNumber} className="p-5 space-y-4">
            <div className="flex items-start justify-between border-b pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-foreground">Flat {entry.flatNumber}</h3>
                  <Badge tone="teal">{entry.tower.split("·")[0].trim()}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{entry.tower}</p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => ringIntercom(entry.flatNumber, entry.intercomExt)}
                  className="gap-1.5 text-xs"
                >
                  <PhoneCall size={13} className="text-primary" />
                  Ring Intercom ({entry.intercomExt})
                </Button>
              </div>
            </div>

            {/* Residents List */}
            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Authorized Residents</span>
              <div className="space-y-1.5">
                {entry.residents.map((res) => (
                  <div key={res.phone} className="flex items-center justify-between text-xs rounded-lg bg-muted/30 px-3 py-2">
                    <div>
                      <span className="font-semibold text-foreground">{res.name}</span>
                      <span className="text-muted-foreground ml-1.5">({res.role})</span>
                    </div>
                    <span className="font-mono text-muted-foreground">{res.phone}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Registered Vehicles */}
            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Registered Society Vehicles</span>
              <div className="space-y-1.5">
                {entry.vehicles.map((v) => (
                  <div key={v.plate} className="flex items-center justify-between text-xs rounded-lg border bg-card px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Car size={14} className="text-muted-foreground" />
                      <span className="font-mono font-bold text-foreground">{v.plate}</span>
                      <span className="text-muted-foreground">· {v.model}</span>
                    </div>
                    <Badge tone="blue">{v.sticker}</Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Verification Button */}
            <div className="pt-2 border-t flex justify-end">
              <Button
                size="sm"
                onClick={() => handleVerifyGateEntry(entry.flatNumber)}
                className="gap-1.5 text-xs w-full sm:w-auto"
              >
                <ShieldCheck size={14} />
                Verify & Grant Gate Entry
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </AnimatedSection>
  );
}

// ─── Tenant: Flat B-903 Occupant & Lease View ────────────────────────────────
function TenantHouseholdView() {
  return (
    <AnimatedSection className="space-y-6">
      <SectionHeader
        eyebrow="Tenant Stay Details"
        title="Flat B-903 Household Information"
        description="View your active tenancy record, registered household members, and society move-in clearances."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <span className="text-xs font-semibold text-muted-foreground">Tenancy Status</span>
          <div className="mt-2 flex items-center gap-2">
            <StatusDot tone="green" label="Active Registered Lease" />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Valid until 30 Nov 2026</p>
        </Card>

        <Card className="p-4">
          <span className="text-xs font-semibold text-muted-foreground">Registered Flat Owner</span>
          <p className="mt-2 text-base font-bold text-foreground">Registered Deed Owner</p>
          <p className="mt-0.5 text-xs text-muted-foreground font-mono">Deed Verified</p>
        </Card>

        <Card className="p-4">
          <span className="text-xs font-semibold text-muted-foreground">Society Police Verification</span>
          <div className="mt-2 flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
            <FileCheck size={16} />
            <span>Verified & Cleared</span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">Ack #PV-2025-0982</p>
        </Card>
      </div>

      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h3 className="text-base font-bold text-foreground">Flat B-903 Registered Occupants</h3>
            <p className="text-xs text-muted-foreground">Tenants authorized for amenity access and gate pass issuance.</p>
          </div>
          <Badge tone="coral">Tenant Occupied</Badge>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border bg-card p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-foreground">Aman Verma</span>
              <Badge tone="blue">Primary Tenant</Badge>
            </div>
            <p className="text-xs text-muted-foreground">aman.verma@example.com</p>
            <p className="text-xs text-muted-foreground font-mono">+91 98765 88990</p>
          </div>

          <div className="rounded-xl border bg-card p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-foreground">Ritu Verma</span>
              <Badge tone="teal">Family Member</Badge>
            </div>
            <p className="text-xs text-muted-foreground">ritu.verma@example.com</p>
            <p className="text-xs text-muted-foreground font-mono">+91 98765 88991</p>
          </div>
        </div>

        <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground">Notice Regarding Sub-letting or Invites:</p>
          <p className="mt-0.5">As a tenant, adding new long-term residents requires landlord verification and society office NOC submission.</p>
        </div>
      </Card>
    </AnimatedSection>
  );
}

// ─── Standard Household View: Owner / Resident / Society Management ──────────
function StandardHouseholdGovernanceView({ isOwnerPerspective }: { isOwnerPerspective: boolean }) {
  const { user, userProfile } = useAuth();
  const householdId = userProfile?.householdId || "hh-a-1204";
  const [household, setHousehold] = useState<Household | null>(null);
  const [residentList, setResidentList] = useState<UserProfile[]>([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("family_member");
  const [rejectingReq, setRejectingReq] = useState<UserProfile | null>(null);

  useEffect(() => {
    const unsubH = subscribeHousehold(householdId, (h) => {
      setHousehold(h);
    });
    const unsubM = subscribeHouseholdMembers(
      householdId,
      (members) => {
        setResidentList(members);
      },
      userProfile?.societyId
    );
    return () => {
      unsubH();
      unsubM();
    };
  }, [householdId, userProfile?.societyId]);

  const pendingRequests = residentList.filter(
    (r) => r.status === "pending" || r.status === "pending_verification"
  );
  const isOwner = isOwnerPerspective || userProfile?.householdRole === "owner";
  const flatLabel = userProfile?.flatId
    ? `Flat ${userProfile.flatId.replace(/^flat-[^-]+-/, "")}`
    : "Flat A-1204";

  async function handleApprove(id: string) {
    const resident = residentList.find((r) => r.uid === id);
    await verifyMember(householdId, id, true, userProfile?.uid || user?.uid || "");
    toast.success(`${resident?.displayName || "Resident"} verified as authorized household member!`);
  }

  async function handleRejectConfirm() {
    if (!rejectingReq) return;
    await verifyMember(householdId, rejectingReq.uid, false, userProfile?.uid || user?.uid || "");
    toast.error(`Verification request for ${rejectingReq.displayName} was rejected.`);
    setRejectingReq(null);
  }

  async function handleRemoveMember(member: UserProfile) {
    const res = await removeMember(householdId, member.uid, userProfile?.uid || user?.uid || "");
    if (!res.success) {
      throw new Error(res.error || "Failed to remove member.");
    }
    toast.success(`${member.displayName || "Resident"} has been removed from this household.`);
  }

  async function handleSendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim() || !inviteName.trim()) {
      toast.error("Please provide member name and email.");
      return;
    }

    await inviteMember(householdId, {
      name: inviteName.trim(),
      email: inviteEmail.trim(),
      phone: invitePhone.trim() || "+91 98000 00000",
      householdRole: inviteRole as any,
      actorUserId: userProfile?.uid || user?.uid || "",
      societyIdOverride: userProfile?.societyId
    });

    const inviteCode = `INV-${householdId.toUpperCase().slice(-5)}-${Math.floor(1000 + Math.random() * 9000)}`;
    toast.success(`Invite generated! Code ${inviteCode} sent to ${inviteEmail}`);
    setInviteName("");
    setInviteEmail("");
    setInvitePhone("");
    setShowInviteModal(false);
  }

  return (
    <AnimatedSection className="space-y-6">
      <SectionHeader
        eyebrow={isOwner ? "Owner Governance" : "Society Structure"}
        title={isOwner ? `${flatLabel} Household Governance & Approvals` : "Households & Resident Directory"}
        description={
          isOwner
            ? "Manage verified occupants, approve pending resident registrations, and control flat invitation keys."
            : "Every flat maps to one household entity supporting owners, family members, and verified tenants."
        }
        action={
          isOwner ? (
            <Button onClick={() => setShowInviteModal(true)}>
              <UserPlus size={15} />
              Generate Invite Code
            </Button>
          ) : undefined
        }
      />

      {/* Pending verification — highlighted */}
      {pendingRequests.length > 0 && (
        <div className="rounded-xl border border-amber-200/70 bg-amber-50/60 p-4 dark:border-amber-900/30 dark:bg-amber-950/20">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <Clock size={15} />
            <p className="text-sm font-semibold">
              {pendingRequests.length} Pending Verification Request{pendingRequests.length > 1 ? "s" : ""}
            </p>
          </div>
          <div className="mt-3 space-y-2">
            {pendingRequests.map((req) => (
              <div
                key={req.uid}
                className="flex flex-col gap-3 rounded-lg border border-amber-100 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-amber-900/20 dark:bg-amber-950/20"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{req.displayName}</p>
                    <Badge tone="amber">Pending Approval</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{req.email} · Requesting resident membership for {flatLabel}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={() => handleApprove(req.uid)} className="gap-1">
                    <Check size={14} />
                    Approve Resident
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRejectingReq(req)}
                    className="text-danger hover:bg-danger/8"
                  >
                    <X size={14} />
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <HouseholdCard
        household={household}
        members={residentList}
        isOwner={isOwner}
        onOpenInvite={() => setShowInviteModal(true)}
        onRemoveMember={handleRemoveMember}
      />

      {/* Tower & Flat Mapping */}
      <section className="space-y-4">
        <h3 className="text-base font-bold">Society Towers & Flat Mapping</h3>
        <div className="grid gap-5 lg:grid-cols-3">
          {towers.map((tower) => {
            const towerFlats = flats.filter((flat) => flat.towerId === tower.id);
            return (
              <Card key={tower.id} className="overflow-hidden">
                <div className="flex items-center gap-3 border-b bg-muted/30 px-4 py-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Building2 size={16} />
                  </div>
                  <div>
                    <h4 className="font-bold">{tower.name}</h4>
                    <p className="text-xs text-muted-foreground">
                      {tower.floors} floors · {towerFlats.length} flats
                    </p>
                  </div>
                </div>

                <div className="divide-y">
                  {towerFlats.map((flat) => {
                    const household = households.find((item) => item.id === flat.householdId);
                    const linkedResidents = residentList.filter(
                      (r) => r.householdId === household?.id
                    );
                    return (
                      <div key={flat.id} className="px-4 py-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-sm">{flat.flatNumber}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {household?.displayName}
                            </p>
                          </div>
                          <Badge tone="teal">{flat.flatType}</Badge>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                            <ShieldCheck size={12} />
                            {linkedResidents.length} members
                          </span>
                          <span className="font-mono text-muted-foreground text-xs">
                            {household?.inviteCode}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Invite modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rx-card-elevated overflow-hidden">
            <div className="border-b px-5 py-4">
              <h3 className="text-base font-bold">Invite Resident to Household</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Generate an invitation passcode for a new family member, tenant, or co-owner for Flat A-1204.
              </p>
            </div>

            <form onSubmit={handleSendInvite} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Full Name <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="e.g. Ramesh Goyal"
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/25"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Email Address <span className="text-danger">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="member@example.com"
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/25"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={invitePhone}
                  onChange={(e) => setInvitePhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/25"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Household Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/25"
                >
                  <option value="family_member">Family Member</option>
                  <option value="co_owner">Co-Owner</option>
                  <option value="tenant">Tenant</option>
                  <option value="other_resident">Authorized Resident</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowInviteModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm">Generate & Send Invite</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rejection Confirmation Dialog */}
      {rejectingReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rx-card-elevated p-5 space-y-4">
            <h4 className="font-bold text-base">Reject Verification Request?</h4>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to reject the join request for <span className="font-semibold text-foreground">{rejectingReq.displayName}</span> ({rejectingReq.email})?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setRejectingReq(null)}>
                Cancel
              </Button>
              <Button variant="danger" size="sm" onClick={handleRejectConfirm}>
                Reject Request
              </Button>
            </div>
          </div>
        </div>
      )}
    </AnimatedSection>
  );
}

// ─── Management: Comprehensive Household, Tower & Flat Directory ─────────────
function ManagementHouseholdDirectoryView() {
  const { userProfile } = useAuth();
  const societyId = userProfile?.societyId || "soc-ajanta-genx";

  const [selectedTower, setSelectedTower] = useState<string>("all");
  const [occupancyFilter, setOccupancyFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [realFlats, setRealFlats] = useState<any[]>([]);
  const [realHouseholds, setRealHouseholds] = useState<any[]>([]);
  const [realResidents, setRealResidents] = useState<any[]>([]);

  useEffect(() => {
    const unsubFlats = subscribeFlats(societyId, setRealFlats);
    const unsubHouseholds = subscribeHouseholds(societyId, setRealHouseholds);
    const unsubUsers = subscribeSocietyUsers(societyId, (users) => {
      const residentUsers = users.filter((u) =>
        ["resident", "flat_owner", "tenant", "family_member"].includes(u.role)
      );
      setRealResidents(residentUsers);
    });

    return () => {
      unsubFlats();
      unsubHouseholds();
      unsubUsers();
    };
  }, [societyId, userProfile?.uid]);

  const activeFlats = realFlats.length > 0 ? realFlats : flats;
  const activeHouseholds = realHouseholds.length > 0 ? realHouseholds : households;
  const activeResidents = realResidents.length > 0 ? realResidents : residents;

  const filteredFlats = activeFlats.filter((flat) => {
    if (selectedTower !== "all" && flat.towerId !== selectedTower) return false;
    const household = activeHouseholds.find((h) => h.id === flat.householdId);
    const owner = activeResidents.find((r) => (r.id || r.uid) === flat.ownerUserId);
    const occupants = activeResidents.filter((r) => r.flatId === flat.id || r.householdId === flat.householdId);

    const hasTenant = occupants.some((o) => o.householdRole === "tenant" || o.role === "tenant");
    if (occupancyFilter === "owner" && hasTenant) return false;
    if (occupancyFilter === "tenant" && !hasTenant) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNumber = (flat.flatNumber || "").toLowerCase().includes(q);
      const matchOwner = (owner?.displayName || owner?.name || "").toLowerCase().includes(q) || (owner?.email || "").toLowerCase().includes(q);
      const matchOccupant = occupants.some(
        (o) => (o.displayName || o.name || "").toLowerCase().includes(q) || (o.email || "").toLowerCase().includes(q) || ((o.phone || o.phoneNumber) && (o.phone || o.phoneNumber).includes(q))
      );
      if (!matchNumber && !matchOwner && !matchOccupant) return false;
    }
    return true;
  });

  return (
    <AnimatedSection className="space-y-6">
      <SectionHeader
        eyebrow="Administrative Control Center"
        title="Households, Towers & Flats Directory"
        description="Oversee society housing inventory, unit ownership, registered tenants, family occupants, and gate passes."
        action={
          <Link href="/admin/verifications">
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <UserCheck size={14} className="mr-1.5" />
              Registration Verifications
            </Button>
          </Link>
        }
      />

      {/* KPI Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4">
          <span className="text-xs font-semibold text-muted-foreground">Total Towers</span>
          <p className="mt-1 text-2xl font-bold text-foreground">{towers.length}</p>
          <p className="mt-0.5 text-2xs text-muted-foreground">Tower A, B, C</p>
        </Card>
        <Card className="p-4">
          <span className="text-xs font-semibold text-muted-foreground">Total Units / Flats</span>
          <p className="mt-1 text-2xl font-bold text-foreground">{activeFlats.length}</p>
          <p className="mt-0.5 text-2xs text-emerald-600 dark:text-emerald-400">100% Registered</p>
        </Card>
        <Card className="p-4">
          <span className="text-xs font-semibold text-muted-foreground">Occupied Households</span>
          <p className="mt-1 text-2xl font-bold text-foreground">{activeHouseholds.length}</p>
          <p className="mt-0.5 text-2xs text-muted-foreground">Active Resident Groups</p>
        </Card>
        <Card className="p-4">
          <span className="text-xs font-semibold text-muted-foreground">Verified Residents</span>
          <p className="mt-1 text-2xl font-bold text-foreground">{activeResidents.length}</p>
          <p className="mt-0.5 text-2xs text-muted-foreground">Owners & Registered Tenants</p>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">Tower:</span>
          {["all", "tower-a", "tower-b", "tower-c"].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setSelectedTower(t)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                selectedTower === t
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "all" ? "All Towers" : towers.find((tw) => tw.id === t)?.name || t}
            </button>
          ))}

          <span className="text-xs font-semibold text-muted-foreground ml-2">Type:</span>
          {[
            { id: "all", label: "All Units" },
            { id: "owner", label: "Owner Occupied" },
            { id: "tenant", label: "Tenant Occupied" }
          ].map((type) => (
            <button
              key={type.id}
              type="button"
              onClick={() => setOccupancyFilter(type.id)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                occupancyFilter === type.id
                  ? "bg-secondary text-secondary-foreground shadow-xs"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search flat, resident, phone..."
            className="w-full rounded-lg border bg-background pl-8 pr-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/25"
          />
        </div>
      </div>

      {/* Flats & Households Grid */}
      <div className="space-y-4">
        {filteredFlats.map((flat) => {
          const tower = towers.find((t) => t.id === flat.towerId);
          const household = activeHouseholds.find((h) => h.id === flat.householdId);
          const owner = activeResidents.find((r) => (r.id || r.uid) === flat.ownerUserId);
          const occupants = activeResidents.filter((r) => r.flatId === flat.id || r.householdId === flat.householdId);
          const isTenantOccupied = occupants.some((o) => o.householdRole === "tenant" || o.role === "tenant");

          return (
            <Card key={flat.id} className="p-5 space-y-4 hover:border-primary/40 transition-all">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold">
                    <Building2 size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-foreground">
                        Flat {flat.flatNumber}
                      </h3>
                      <Badge tone="slate">{flat.flatType}</Badge>
                      <Badge tone={isTenantOccupied ? "blue" : "teal"}>
                        {isTenantOccupied ? "Tenant Occupied" : "Owner Occupied"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {tower?.name || "Tower"} · Floor {flat.floor} · Household Ref: {household?.id || "N/A"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono text-xs bg-muted px-2.5 py-1 rounded-md text-muted-foreground">
                    Invite Code: {household?.inviteCode || "None"}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => toast.info(`Viewing governance records for Flat ${flat.flatNumber}`)}
                  >
                    View Ledger
                  </Button>
                </div>
              </div>

              {/* Occupancy and Owner Details */}
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Deed Owner Info */}
                <div className="rounded-xl border bg-card p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <ShieldCheck size={14} className="text-emerald-600" />
                      Registered Deed Owner
                    </span>
                    <Badge tone="green">Deed Verified</Badge>
                  </div>
                  {owner ? (
                    <div className="text-xs space-y-1">
                      <p className="font-semibold text-foreground">{owner.displayName || owner.name}</p>
                      <p className="text-muted-foreground flex items-center gap-1.5">
                        <Mail size={12} /> {owner.email}
                      </p>
                      {(owner.phone || owner.phoneNumber) && (
                        <p className="text-muted-foreground flex items-center gap-1.5">
                          <Phone size={12} /> {owner.phone || owner.phoneNumber}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Owner deed record verified by society office.</p>
                  )}
                </div>

                {/* Registered Occupants */}
                <div className="rounded-xl border bg-card p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Users size={14} className="text-primary" />
                      Registered Occupants ({occupants.length})
                    </span>
                    <Badge tone="teal">Gate Cleared</Badge>
                  </div>
                  <div className="space-y-1.5">
                    {occupants.map((occ) => (
                      <div key={occ.uid || occ.id} className="flex items-center justify-between text-xs">
                        <span className="font-medium text-foreground">
                          {occ.displayName || occ.name}
                          <span className="ml-1 text-2xs text-muted-foreground">
                            ({(occ.householdRole || occ.role || "Member").replace("_", " ")})
                          </span>
                        </span>
                        <span className="text-2xs text-muted-foreground font-mono">{occ.phone || occ.phoneNumber || occ.email}</span>
                      </div>
                    ))}
                    {occupants.length === 0 && (
                      <p className="text-xs text-muted-foreground">No occupants registered under this unit.</p>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}

        {filteredFlats.length === 0 && (
          <div className="rounded-xl border border-dashed p-8 text-center text-xs text-muted-foreground">
            No properties found matching your criteria.
          </div>
        )}
      </div>
    </AnimatedSection>
  );
}
