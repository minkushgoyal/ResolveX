"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Bell,
  Building2,
  CalendarCheck,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Cpu,
  CreditCard,
  Download,
  Eye,
  FileText,
  Heart,
  HelpCircle,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  MapPin,
  Megaphone,
  MessageCircle,
  PhoneCall,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Sparkles,
  Star,
  Store,
  ThumbsUp,
  Truck,
  User,
  UserCheck,
  UserPlus,
  Users,
  UsersRound,
  Wrench,
  X
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { AlertBanner, AnimatedSection, Badge, Button, Card, SectionHeader, StatusDot } from "@/components/ui";
import {
  bills,
  complaints as initialComplaints,
  communityPolls,
  demoSociety,
  facilities,
  formatCurrency,
  households,
  notices,
  residents,
  roleLabels,
  serviceProviders,
  societyEvents,
  staff,
  visitorPasses
} from "@resolvex/utils";
import type { Complaint, PlatformRole, ResidentUser } from "@resolvex/types";
import { useSessionStore } from "@/lib/store";
import { useAuth } from "@/lib/auth-context";
import {
  confirmResolution,
  reopenComplaint,
  subscribeComplaints,
  updateVisitorStatus,
  updateWorkProgress
} from "@/lib/services";
import { cn } from "@resolvex/ui";

export default function HomePage() {
  const { activeRole } = useSessionStore();

  switch (activeRole) {
    case "flat_owner":
      return <OwnerDashboardView />;
    case "tenant":
      return <TenantDashboardView />;
    case "society_manager":
      return <ManagerDashboardView />;
    case "society_admin":
      return <AdminDashboardView />;
    case "maintenance_staff":
      return <MaintenanceStaffDashboardView />;
    case "security_guard":
      return <SecurityGuardDashboardView />;
    case "service_provider":
      return <ServiceProviderDashboardView />;
    case "super_admin":
      return <SuperAdminDashboardView />;
    case "resident":
    default:
      return <ResidentDashboardView />;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. RESIDENT DASHBOARD VIEW
// ═════════════════════════════════════════════════════════════════════════════
function ResidentDashboardView() {
  const { user, userProfile } = useAuth();
  const displayName = userProfile?.displayName || user?.displayName || user?.email?.split("@")[0] || "Resident";
  const firstName = displayName.split(" ")[0];
  const unitLabel = userProfile?.flatId
    ? `Flat ${userProfile.flatId.replace("flat-", "").toUpperCase()}${userProfile?.towerId ? ` · Tower ${userProfile.towerId.replace("tower-", "").toUpperCase()}` : ""}`
    : "Flat A-1204 · Tower A";
  const householdName = userProfile?.householdId ? `${userProfile.householdId.toUpperCase()} Household` : "Resident Household";

  const [complaintList, setComplaintList] = useState<Complaint[]>(initialComplaints);
  const [showProofModal, setShowProofModal] = useState(false);
  const [reopenModalOpen, setReopenModalOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState("");

  const societyId = userProfile?.societyId || "soc-ajanta-genx";
  const householdId = userProfile?.householdId || "hh-a-1204";

  useEffect(() => {
    const unsub = subscribeComplaints({ societyId, householdId }, setComplaintList);
    return () => unsub();
  }, [societyId, householdId]);

  const activeComplaint =
    complaintList.find((c) => c.status === "resident_confirmation") ||
    complaintList.find((c) => c.householdId === householdId && c.status !== "resolved" && c.status !== "closed") ||
    complaintList[0];

  async function handleConfirmResolution(id: string) {
    try {
      await confirmResolution(id, userProfile?.uid || user?.uid || "resident", societyId);
      toast.success("Resolution verified. Ticket closed.");
      setShowProofModal(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to confirm resolution.");
    }
  }

  async function handleReopenComplaint(id: string) {
    if (!reopenReason.trim()) {
      toast.error("Please provide a reason to reopen.");
      return;
    }
    try {
      await reopenComplaint(id, reopenReason.trim(), userProfile?.uid || user?.uid || "resident", societyId);
      toast.info("Issue reopened and returned to maintenance queue.");
      setReopenModalOpen(false);
      setShowProofModal(false);
      setReopenReason("");
    } catch (err: any) {
      toast.error(err.message || "Failed to reopen issue.");
    }
  }

  return (
    <AppShell>
      <AnimatedSection className="space-y-6">
        {/* Resident Identity Banner */}
        <div className="rounded-xl border bg-card p-5 shadow-xs">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-foreground">
                  Hello, {firstName}
                </h1>
                <Badge tone="blue">Resident</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {unitLabel} · {householdName}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/complaints">
                <Button size="sm">
                  <Plus size={14} className="mr-1" />
                  Raise Complaint
                </Button>
              </Link>
              <Link href="/services">
                <Button variant="outline" size="sm">
                  <CalendarCheck size={14} className="mr-1" />
                  Book Amenity
                </Button>
              </Link>
            </div>
          </div>

          {/* Operational Health Strip */}
          <div className="mt-4 pt-3 border-t grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <p className="text-muted-foreground">Water Supply</p>
              <p className="font-bold text-foreground flex items-center gap-1 mt-0.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> Normal Pressure
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Power Grid</p>
              <p className="font-bold text-foreground flex items-center gap-1 mt-0.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> Substation A (100%)
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Tower A Lifts</p>
              <p className="font-bold text-foreground flex items-center gap-1 mt-0.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> 2/2 Lifts Operational
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Quarterly Dues</p>
              <p className="font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                ₹4,250 Due Sep 15
              </p>
            </div>
          </div>
        </div>

        {/* Active Complaint Direct Action Card */}
        {activeComplaint && (
          <Card className="p-5 border-l-4 border-l-primary">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Badge tone={activeComplaint.status === "resident_confirmation" ? "amber" : "blue"}>
                    {activeComplaint.status === "resident_confirmation" ? "Action Required" : activeComplaint.status.toUpperCase()}
                  </Badge>
                  <span className="text-xs font-mono text-muted-foreground">#{activeComplaint.id}</span>
                </div>
                <h3 className="font-bold text-base mt-1 text-foreground">{activeComplaint.title}</h3>
                <p className="text-xs text-muted-foreground">{activeComplaint.location} · {activeComplaint.category}</p>
              </div>

              {activeComplaint.status === "resident_confirmation" ? (
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" onClick={() => setShowProofModal(true)}>
                    <Eye size={14} className="mr-1.5" />
                    Review Proof & Confirm
                  </Button>
                </div>
              ) : (
                <Link href="/complaints">
                  <Button variant="outline" size="sm">
                    Track Progress →
                  </Button>
                </Link>
              )}
            </div>
          </Card>
        )}

        {/* Resident Summary Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Maintenance & Dues */}
          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base">Society Dues</h3>
              <Badge tone="amber">Due in 10 days</Badge>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Q3 Maintenance Bill:</span>
                <span className="font-bold text-foreground">₹4,250.00</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Due Date:</span>
                <span className="font-medium text-foreground">September 15, 2026</span>
              </div>
            </div>
            <Link href="/services">
              <Button size="sm" className="w-full">
                <CreditCard size={14} className="mr-1.5" />
                Pay Dues (₹4,250)
              </Button>
            </Link>
          </Card>

          {/* Upcoming Society Events */}
          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base">Community Notices & Events</h3>
              <Link href="/community" className="text-xs text-primary font-semibold hover:underline">
                View All
              </Link>
            </div>
            <div className="space-y-2">
              {societyEvents.slice(0, 2).map((evt) => (
                <div key={evt.id} className="rounded-lg border p-3 flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-xs">
                    <span>{evt.eventDate.split("-")[2] || "12"}</span>
                    <span className="text-[9px] uppercase">Sep</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-bold truncate text-foreground">{evt.title}</h4>
                    <p className="text-[11px] text-muted-foreground truncate">{evt.venue} · {evt.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </AnimatedSection>

      {/* Proof Modal */}
      {showProofModal && activeComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-xl border bg-card shadow-soft">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h3 className="font-bold text-base">Technician Resolution Proof</h3>
              <button onClick={() => setShowProofModal(false)} className="rounded p-1 hover:bg-muted">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <img
                src={activeComplaint.resolutionProofUrl || "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=600"}
                alt="Proof"
                className="w-full h-48 rounded-lg object-cover border"
              />
              <div className="rounded-lg border bg-muted/20 p-3 text-xs">
                <p className="font-semibold text-muted-foreground">Technician Work Note:</p>
                <p className="text-foreground mt-0.5">{activeComplaint.resolutionNote || "Water pressure tested. Seal re-grouted."}</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t px-5 py-3 bg-muted/10">
              <Button variant="outline" size="sm" onClick={() => setReopenModalOpen(true)}>
                Reopen Issue
              </Button>
              <Button size="sm" onClick={() => handleConfirmResolution(activeComplaint.id)}>
                Confirm & Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reopen Modal */}
      {reopenModalOpen && activeComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border bg-card p-5 shadow-soft space-y-4">
            <h3 className="font-bold text-base">Reason for Reopening</h3>
            <textarea
              rows={3}
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              placeholder="Describe what part of the issue was not solved..."
              className="w-full rounded-lg border p-3 text-sm outline-none resize-none"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setReopenModalOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={() => handleReopenComplaint(activeComplaint.id)}>
                Submit Reopen
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. FLAT OWNER DASHBOARD VIEW
// ═════════════════════════════════════════════════════════════════════════════
function OwnerDashboardView() {
  const { user, userProfile } = useAuth();
  const displayName = userProfile?.displayName || user?.displayName || user?.email?.split("@")[0] || "Owner";
  const propertyLabel = userProfile?.flatId
    ? `Property: Flat ${userProfile.flatId.replace("flat-", "").toUpperCase()}${userProfile?.towerId ? ` · Tower ${userProfile.towerId.replace("tower-", "").toUpperCase()}` : ""}`
    : "Property: Flat A-1204 · Tower A";
  const societyLabel = userProfile?.societyId === "soc-ajanta-genx" ? "Ajanta Gen-X" : (userProfile?.societyId || "ResolveX Society");

  const [pendingResidents, setPendingResidents] = useState<ResidentUser[]>([]);

  function handleApprove(name: string) {
    setPendingResidents([]);
    toast.success(`Approved ${name} as verified household member.`);
  }

  function handleReject(name: string) {
    setPendingResidents([]);
    toast.info(`Rejected verification request for ${name}.`);
  }

  return (
    <AppShell>
      <AnimatedSection className="space-y-6">
        <div className="rounded-xl border bg-card p-5 shadow-xs">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-foreground">
                  Owner Dashboard — {displayName}
                </h1>
                <Badge tone="green">Primary Deed Owner</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {propertyLabel} · {societyLabel}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/households">
                <Button size="sm">
                  <UserPlus size={14} className="mr-1" />
                  Invite Resident
                </Button>
              </Link>
              <Link href="/services">
                <Button variant="outline" size="sm">
                  <FileText size={14} className="mr-1" />
                  Property Ledger
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Pending Resident Verification Approvals */}
        {pendingResidents.length > 0 && (
          <Card className="p-5 border-l-4 border-l-amber-500 space-y-3">
            <div className="flex items-center gap-2">
              <AlertCircle size={18} className="text-amber-600" />
              <h3 className="font-bold text-base text-foreground">Pending Resident Verification Request</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              A resident has requested access to Flat A-1204 under your deed. As the primary flat owner, verify their identity to grant digital gate access.
            </p>
            {pendingResidents.map((r) => (
              <div key={r.id} className="rounded-lg border bg-muted/20 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-foreground">{r.name}</p>
                  <p className="text-xs text-muted-foreground">{r.phone} · Role: Family Member · Applied Sep 1</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleReject(r.name)}>
                    Reject
                  </Button>
                  <Button size="sm" onClick={() => handleApprove(r.name)}>
                    <Check size={14} className="mr-1" />
                    Approve Verification
                  </Button>
                </div>
              </div>
            ))}
          </Card>
        )}

        {/* Owner Financials & Tenancy */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="p-5 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Quarterly Maintenance Dues</p>
            <p className="text-2xl font-bold text-foreground">₹4,250</p>
            <p className="text-xs text-muted-foreground">Due Sep 15, 2026 · Invoice #BILL-Q3-1204</p>
            <Link href="/services" className="block pt-2">
              <Button size="sm" className="w-full">Pay Property Dues</Button>
            </Link>
          </Card>

          <Card className="p-5 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Registered Household</p>
            <p className="text-2xl font-bold text-foreground">3 Members</p>
            <p className="text-xs text-muted-foreground">{displayName} (Owner), Verified Household Members</p>
            <Link href="/households" className="block pt-2">
              <Button variant="outline" size="sm" className="w-full">Manage Residents</Button>
            </Link>
          </Card>

          <Card className="p-5 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Property Work Orders</p>
            <p className="text-2xl font-bold text-foreground">1 Active</p>
            <p className="text-xs text-muted-foreground">Seepage repair completed · Awaiting verification</p>
            <Link href="/complaints" className="block pt-2">
              <Button variant="outline" size="sm" className="w-full">Inspect Tickets</Button>
            </Link>
          </Card>
        </div>
      </AnimatedSection>
    </AppShell>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. TENANT DASHBOARD VIEW
// ═════════════════════════════════════════════════════════════════════════════
function TenantDashboardView() {
  const { user, userProfile } = useAuth();
  const displayName = userProfile?.displayName || user?.displayName || user?.email?.split("@")[0] || "Tenant";
  const unitLabel = userProfile?.flatId
    ? `Flat ${userProfile.flatId.replace("flat-", "").toUpperCase()}${userProfile?.towerId ? ` · Tower ${userProfile.towerId.replace("tower-", "").toUpperCase()}` : ""}`
    : "Flat B-903 · Tower B";

  return (
    <AppShell>
      <AnimatedSection className="space-y-6">
        <div className="rounded-xl border bg-card p-5 shadow-xs">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-foreground">
                  Tenant Stay Hub — {displayName}
                </h1>
                <Badge tone="blue">Registered Tenant</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {unitLabel} · Lease Agreement Registered
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/complaints">
                <Button size="sm">
                  <Plus size={14} className="mr-1" />
                  Raise Stay Issue
                </Button>
              </Link>
              <Link href="/households">
                <Button variant="outline" size="sm">
                  <UserPlus size={14} className="mr-1" />
                  Visitor Pass
                </Button>
              </Link>
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="p-5 space-y-3">
            <h3 className="font-bold text-base">Stay & Gate Privileges</h3>
            <div className="rounded-lg border bg-muted/20 p-3 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tower / Flat:</span>
                <span className="font-bold text-foreground">Tower B / Flat 903</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">RFID Parking Tag:</span>
                <span className="font-mono font-medium text-foreground">TAG-B903-DL</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Gate Clearance:</span>
                <span className="font-bold text-emerald-600">Active Automatic Entry</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Note: Owner financial controls and capital sinking dues are managed directly by deed owner.
            </p>
          </Card>

          <Card className="p-5 space-y-3">
            <h3 className="font-bold text-base">Quick Tenant Actions</h3>
            <div className="grid grid-cols-2 gap-2">
              <Link href="/services" className="rounded-lg border p-3 hover:bg-muted/30 rx-transition block">
                <CalendarCheck size={18} className="text-primary mb-1" />
                <p className="text-xs font-bold text-foreground">Book Clubhouse</p>
                <p className="text-[10px] text-muted-foreground">Reserve slots</p>
              </Link>
              <Link href="/community" className="rounded-lg border p-3 hover:bg-muted/30 rx-transition block">
                <Megaphone size={18} className="text-secondary mb-1" />
                <p className="text-xs font-bold text-foreground">Society Notices</p>
                <p className="text-[10px] text-muted-foreground">Stay guidelines</p>
              </Link>
            </div>
          </Card>
        </div>
      </AnimatedSection>
    </AppShell>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 4. SOCIETY MANAGER DASHBOARD VIEW
// ═════════════════════════════════════════════════════════════════════════════
function ManagerDashboardView() {
  const { user, userProfile } = useAuth();
  const displayName = userProfile?.displayName || user?.displayName || user?.email?.split("@")[0] || "Manager";
  const [complaintList, setComplaintList] = useState<Complaint[]>(initialComplaints);

  function handleFastTrack(id: string) {
    setComplaintList(
      complaintList.map((c) =>
        c.id === id ? { ...c, priority: "emergency", status: "in_progress" } : c
      )
    );
    toast.success(`Fast-track emergency dispatch authorized for #${id}`);
  }

  return (
    <AppShell mode="admin">
      <AnimatedSection className="space-y-6">
        <div className="rounded-xl border bg-card p-5 shadow-xs">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-foreground">
                  Manager Command Center — {displayName}
                </h1>
                <Badge tone="blue">General Manager</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Priority operational triage, SLA compliance, and facility health
              </p>
            </div>
            <div className="flex gap-2">
              <Link href="/complaints">
                <Button size="sm">Dispatch Queue</Button>
              </Link>
              <Link href="/staff">
                <Button variant="outline" size="sm">Workforce Status</Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Operational Queues */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* SLA Breaches & Immediate Action */}
          <Card className="p-5 border-l-4 border-l-red-500 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-red-500" />
                <h3 className="font-bold text-base text-foreground">SLA Breach Attention Queue</h3>
              </div>
              <Badge tone="red">Immediate</Badge>
            </div>
            <p className="text-xs text-muted-foreground">Tickets pending past maximum 24h operational threshold:</p>
            <div className="rounded-lg border bg-red-50/40 dark:bg-red-950/20 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-foreground">Water line pressure fluctuation (#cmp-1001)</p>
                  <p className="text-[11px] text-muted-foreground">Tower A Riser · Escalated (26h elapsed)</p>
                </div>
                <Button size="sm" onClick={() => handleFastTrack("cmp-1001")}>
                  Fast-Track Dispatch
                </Button>
              </div>
            </div>
          </Card>

          {/* Degraded Infrastructure Assets */}
          <Card className="p-5 border-l-4 border-l-amber-500 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu size={18} className="text-amber-500" />
                <h3 className="font-bold text-base text-foreground">Facility Infrastructure Alerts</h3>
              </div>
              <Badge tone="amber">1 Degraded</Badge>
            </div>
            <p className="text-xs text-muted-foreground">Degraded equipment requiring inspection:</p>
            <div className="rounded-lg border bg-amber-50/40 dark:bg-amber-950/20 p-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-foreground">Passenger Elevator B2 (Tower B)</p>
                <p className="text-[11px] text-muted-foreground">Level sensor glitch · Assigned: Deepak Verma</p>
              </div>
              <Link href="/facilities">
                <Button variant="outline" size="sm">Service Asset</Button>
              </Link>
            </div>
          </Card>
        </div>

        {/* Operational Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground font-semibold">Active Work Orders</p>
            <p className="text-2xl font-bold text-foreground mt-1">4</p>
            <p className="text-[11px] text-emerald-600 mt-0.5">3 On Track · 1 Escalated</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground font-semibold">On-Duty Technicians</p>
            <p className="text-2xl font-bold text-foreground mt-1">4 / 5</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Deepak, Vikas, Rajesh, Suresh</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground font-semibold">Q3 Dues Collection</p>
            <p className="text-2xl font-bold text-foreground mt-1">87.4%</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">₹4,25,000 / ₹4,86,000</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground font-semibold">Gate Visitors Today</p>
            <p className="text-2xl font-bold text-foreground mt-1">42</p>
            <p className="text-[11px] text-emerald-600 mt-0.5">All Cleared via Pass</p>
          </Card>
        </div>
      </AnimatedSection>
    </AppShell>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 5. SOCIETY ADMIN DASHBOARD VIEW
// ═════════════════════════════════════════════════════════════════════════════
function AdminDashboardView() {
  const { user, userProfile } = useAuth();
  const displayName = userProfile?.displayName || user?.displayName || user?.email?.split("@")[0] || "Administrator";

  return (
    <AppShell mode="admin">
      <AnimatedSection className="space-y-6">
        <div className="rounded-xl border bg-card p-5 shadow-xs">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-foreground">
                  Admin Command Center — {displayName}
                </h1>
                <Badge tone="green">Administrator Authority</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Society Bylaws, User Provisioning, Governance & Tariff Settings
              </p>
            </div>
            <div className="flex gap-2">
              <Link href="/admin">
                <Button size="sm">System Administration</Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Administration Modules */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="p-4 space-y-2">
            <UsersRound size={20} className="text-primary" />
            <h4 className="font-bold text-sm text-foreground">User Management</h4>
            <p className="text-xs text-muted-foreground">482 Registered accounts across 3 towers.</p>
            <Link href="/households" className="text-xs text-primary font-semibold hover:underline block pt-1">
              Audit Users →
            </Link>
          </Card>
          <Card className="p-4 space-y-2">
            <ShieldCheck size={20} className="text-emerald-600" />
            <h4 className="font-bold text-sm text-foreground">Roles & Permissions</h4>
            <p className="text-xs text-muted-foreground">9 Platform user perspectives active.</p>
            <Link href="/admin" className="text-xs text-primary font-semibold hover:underline block pt-1">
              Configure Matrix →
            </Link>
          </Card>
          <Card className="p-4 space-y-2">
            <CreditCard size={20} className="text-amber-500" />
            <h4 className="font-bold text-sm text-foreground">Billing & Tariffs</h4>
            <p className="text-xs text-muted-foreground">Maintenance rate ₹4.5/sqft · Due Sep 15.</p>
            <Link href="/services" className="text-xs text-primary font-semibold hover:underline block pt-1">
              Ledger Settings →
            </Link>
          </Card>
          <Card className="p-4 space-y-2">
            <FileText size={20} className="text-secondary" />
            <h4 className="font-bold text-sm text-foreground">Audit Trail</h4>
            <p className="text-xs text-muted-foreground">System events, staff dispatches, and logins.</p>
            <Link href="/admin" className="text-xs text-primary font-semibold hover:underline block pt-1">
              View Logs →
            </Link>
          </Card>
        </div>
      </AnimatedSection>
    </AppShell>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 6. MAINTENANCE STAFF DASHBOARD VIEW (CRITICAL WORK QUEUE)
// ═════════════════════════════════════════════════════════════════════════════
function MaintenanceStaffDashboardView() {
  const { user, userProfile } = useAuth();
  const displayName = userProfile?.displayName || user?.displayName || user?.email?.split("@")[0] || "Staff";
  const firstName = displayName.split(" ")[0];
  const staffUserId = userProfile?.uid || user?.uid || "usr-staff";
  const societyId = userProfile?.societyId || "soc-ajanta-genx";
  const [onDuty, setOnDuty] = useState(true);
  const [activeJobStatus, setActiveJobStatus] = useState<"pending" | "in_progress" | "work_completed">("pending");
  const [progressNotes, setProgressNotes] = useState("");
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [photoAttached, setPhotoAttached] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const unsub = subscribeComplaints({ assignedStaffId: "staff-deepak", societyId }, (data) => {
      const job = data.find((c) => c.id === "cmp-1004");
      if (job) {
        if (job.status === "in_progress") {
          setActiveJobStatus("in_progress");
        } else if (
          job.status === "resident_confirmation" ||
          job.status === "resolved" ||
          job.status === "closed"
        ) {
          setActiveJobStatus("work_completed");
        } else {
          setActiveJobStatus("pending");
        }
      }
    });
    return () => unsub();
  }, [societyId]);

  async function handleStartWork() {
    setIsSubmitting(true);
    try {
      await updateWorkProgress("cmp-1004", {
        status: "in_progress",
        actorUserId: staffUserId,
        societyIdOverride: societyId
      });
      setActiveJobStatus("in_progress");
      toast.success("Work initiated. Job status updated to In Progress.");
    } catch (err: any) {
      toast.error(err.message || "Failed to update work progress");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCompleteJob() {
    setIsSubmitting(true);
    try {
      await updateWorkProgress("cmp-1004", {
        status: "work_completed",
        notes: progressNotes || "Lift floor indicator panel replaced and circuit reset.",
        proofUrl: photoAttached
          ? "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&auto=format&fit=crop&q=80"
          : undefined,
        actorUserId: staffUserId,
        societyIdOverride: societyId
      });
      setActiveJobStatus("work_completed");
      setShowUpdateModal(false);
      toast.success("Job marked Work Completed. Transitioned to Resident Verification.");
    } catch (err: any) {
      toast.error(err.message || "Failed to mark job completed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppShell>
      <AnimatedSection className="space-y-6">
        {/* Good morning Header */}
        <div className="rounded-xl border bg-card p-5 shadow-xs">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-foreground">
                  Good morning, {firstName}
                </h1>
                <Badge tone={onDuty ? "green" : "amber"}>
                  {onDuty ? "On Duty" : "Off Duty"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {userProfile?.displayName || "Facility Specialist"} · Assigned Facilities: Lift TA1, Lift TB2
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={onDuty ? "outline" : "primary"}
                size="sm"
                onClick={() => {
                  setOnDuty(!onDuty);
                  toast.info(onDuty ? "Duty status set to Off Duty." : "You are now On Duty.");
                }}
              >
                {onDuty ? "Go Off Duty" : "Punch In (On Duty)"}
              </Button>
            </div>
          </div>
        </div>

        {/* TODAY'S WORK QUEUE */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-foreground">Today's Priority Work Queue</h2>
            <Badge tone="red">1 High Priority</Badge>
          </div>

          {/* High Priority Work Order */}
          <Card className="p-5 border-l-4 border-l-red-500 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div>
                <Badge tone="red">HIGH PRIORITY</Badge>
                <h3 className="text-lg font-bold text-foreground mt-1">
                  Lift display panel blank & flickering
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                  <MapPin size={13} />
                  Tower B · Service Lift 2 (Asset #fac-lift-tb2)
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs font-mono text-muted-foreground">Ticket #cmp-1004</span>
                <p className="text-xs font-semibold text-amber-600">SLA: 2h Remaining</p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              Floor indicator panel on Level 4 is completely unpowered. Car operating panel showing error E-04. Requires power supply check and circuit board reset.
            </p>

            <div className="rounded-lg border bg-muted/20 p-3 text-xs grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <span className="text-muted-foreground">Resident / Reporter:</span>
                <p className="font-bold text-foreground">Society Automation</p>
              </div>
              <div>
                <span className="text-muted-foreground">Location:</span>
                <p className="font-bold text-foreground">Tower B Shaft</p>
              </div>
              <div>
                <span className="text-muted-foreground">Assigned:</span>
                <p className="font-bold text-foreground">Deepak Verma</p>
              </div>
              <div>
                <span className="text-muted-foreground">Current State:</span>
                <p className="font-bold text-primary capitalize">{activeJobStatus.replace("_", " ")}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
              {activeJobStatus === "pending" && (
                <Button size="sm" onClick={handleStartWork} disabled={isSubmitting}>
                  <Wrench size={14} className="mr-1.5" />
                  {isSubmitting ? "Starting..." : "Start Work"}
                </Button>
              )}

              {activeJobStatus === "in_progress" && (
                <>
                  <Button size="sm" onClick={() => setShowUpdateModal(true)} disabled={isSubmitting}>
                    <Plus size={14} className="mr-1.5" />
                    Add Work Notes & Photos
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-emerald-600 border-emerald-600 hover:bg-emerald-50"
                    onClick={handleCompleteJob}
                    disabled={isSubmitting}
                  >
                    <CheckCircle2 size={14} className="mr-1.5" />
                    {isSubmitting ? "Saving..." : "Mark Work Completed"}
                  </Button>
                </>
              )}

              {activeJobStatus === "work_completed" && (
                <div className="flex items-center gap-2 text-xs font-bold text-amber-600 bg-amber-500/10 px-3 py-1.5 rounded-lg">
                  <Clock size={14} />
                  <span>Work Completed · Awaiting Resident / Inspector Verification</span>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Assigned Facilities & History */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="p-5 space-y-3">
            <h3 className="font-bold text-base">Assigned Equipment & Facilities</h3>
            <div className="space-y-2">
              <div className="rounded-lg border p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-foreground">Passenger Elevator A1 (Tower A)</p>
                  <p className="text-[11px] text-muted-foreground">Last Serviced: Aug 28 · Next: Sep 28</p>
                </div>
                <Badge tone="green">Operational</Badge>
              </div>
              <div className="rounded-lg border p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-foreground">Service Lift B2 (Tower B)</p>
                  <p className="text-[11px] text-muted-foreground">Open Issue: Display flicker</p>
                </div>
                <Badge tone="amber">Active Job</Badge>
              </div>
            </div>
          </Card>

          <Card className="p-5 space-y-3">
            <h3 className="font-bold text-base">Recently Completed Jobs</h3>
            <div className="space-y-2 text-xs">
              <div className="rounded-lg border p-3 flex items-center justify-between">
                <div>
                  <p className="font-bold text-foreground">Level 7 Safety Brake Sensor Inspection</p>
                  <p className="text-muted-foreground">Tower A · Closed Sep 3</p>
                </div>
                <span className="text-emerald-600 font-bold">Verified ✓</span>
              </div>
              <div className="rounded-lg border p-3 flex items-center justify-between">
                <div>
                  <p className="font-bold text-foreground">Intercom Line Emergency Battery Swap</p>
                  <p className="text-muted-foreground">Tower C · Closed Sep 1</p>
                </div>
                <span className="text-emerald-600 font-bold">Verified ✓</span>
              </div>
            </div>
          </Card>
        </div>
      </AnimatedSection>

      {/* Progress & Completion Modal */}
      {showUpdateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border bg-card p-5 shadow-soft space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-base">Log Work Progress (#cmp-1004)</h3>
              <button onClick={() => setShowUpdateModal(false)} className="rounded p-1 hover:bg-muted">
                <X size={18} />
              </button>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-muted-foreground block mb-1">
                Technician Work Notes
              </label>
              <textarea
                rows={3}
                value={progressNotes}
                onChange={(e) => setProgressNotes(e.target.value)}
                placeholder="Detail the steps taken, parts replaced, and test measurements..."
                className="w-full rounded-lg border p-3 text-sm outline-none resize-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-muted-foreground block mb-1">
                Attach Work Proof Photo
              </label>
              <button
                type="button"
                onClick={() => setPhotoAttached(!photoAttached)}
                className="w-full rounded-lg border border-dashed p-3 text-center text-xs font-medium hover:bg-muted/30"
              >
                {photoAttached ? "✓ Attached: repair_panel_photo.jpg (Click to remove)" : "+ Click to attach camera photo"}
              </button>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" size="sm" onClick={() => setShowUpdateModal(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleCompleteJob} disabled={isSubmitting}>
                {isSubmitting ? "Submitting..." : "Complete & Submit for Verification"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 7. SECURITY GUARD DASHBOARD VIEW
// ═════════════════════════════════════════════════════════════════════════════
function SecurityGuardDashboardView() {
  const { user, userProfile } = useAuth();
  const guardUserId = userProfile?.uid || user?.uid || "usr-guard";
  const displayName = userProfile?.displayName || user?.displayName || user?.email?.split("@")[0] || "Security Guard";
  const [visitors, setVisitors] = useState([
    { id: "v-1", name: "Ramesh Kumar (Swiggy)", unit: "Flat A-1204", code: "AJX-8921", status: "pending" },
    { id: "v-2", name: "Mahesh Electrician", unit: "Flat B-804", code: "AJX-7742", status: "pending" }
  ]);
  const [deliveries, setDeliveries] = useState([
    { id: "d-1", courier: "Amazon", packages: 3, vehicle: "DL-4S-8921", time: "14:10" }
  ]);
  const [qrModal, setQrModal] = useState(false);

  async function handleApproveVisitor(id: string, name: string) {
    setVisitors((prev) => prev.filter((v) => v.id !== id));
    try {
      await updateVisitorStatus(id, "approved", guardUserId);
    } catch (e) {
      console.warn("Could not sync visitor approval:", e);
    }
    toast.success(`Gate 1 Barrier Opened: ${name} entry approved.`);
  }

  async function handleDenyVisitor(id: string, name: string) {
    setVisitors((prev) => prev.filter((item) => item.id !== id));
    try {
      await updateVisitorStatus(id, "denied", guardUserId);
    } catch (e) {
      console.warn("Could not sync visitor denial:", e);
    }
    toast.info(`Entry denied for ${name}`);
  }

  return (
    <AppShell>
      <AnimatedSection className="space-y-6">
        <div className="rounded-xl border bg-card p-5 shadow-xs">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-foreground">
                  Gate Operations — {displayName}
                </h1>
                <Badge tone="blue">Main Gate 1 Active</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Perimeter Access Control · Resident Verification · Visitor Logging
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => setQrModal(true)}>
                <QrCode size={14} className="mr-1.5" />
                Scan Visitor QR
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 border-red-600 hover:bg-red-50"
                onClick={() => toast.error("Emergency Alert dispatched to RWA Office & Guards.")}
              >
                <Siren size={14} className="mr-1" />
                Emergency Alert
              </Button>
            </div>
          </div>
        </div>

        {/* Expected Visitors Queue */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-foreground">Expected Visitors & Deliveries</h2>
            <Badge tone="amber">{visitors.length} Awaiting Clearance</Badge>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {visitors.map((v) => (
              <Card key={v.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-foreground">{v.name}</h4>
                    <p className="text-xs text-muted-foreground">Destination: {v.unit}</p>
                  </div>
                  <span className="font-mono text-xs font-bold bg-muted px-2 py-0.5 rounded">{v.code}</span>
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDenyVisitor(v.id, v.name)}
                  >
                    Deny
                  </Button>
                  <Button size="sm" onClick={() => handleApproveVisitor(v.id, v.name)}>
                    Approve Entry
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Live Delivery Entry Log */}
        <Card className="p-5 space-y-3">
          <h3 className="font-bold text-base text-foreground">Courier & Vehicle Log</h3>
          <div className="space-y-2 text-xs">
            {deliveries.map((d) => (
              <div key={d.id} className="rounded-lg border p-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Truck size={16} className="text-primary" />
                  <div>
                    <p className="font-bold text-foreground">{d.courier} Delivery Van ({d.vehicle})</p>
                    <p className="text-muted-foreground">{d.packages} parcels dropped at security parcel station</p>
                  </div>
                </div>
                <span className="text-muted-foreground font-mono">{d.time} IST</span>
              </div>
            ))}
          </div>
        </Card>
      </AnimatedSection>

      {/* QR Scanner Simulator */}
      {qrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border bg-card p-5 shadow-soft space-y-4 text-center">
            <h3 className="font-bold text-base">Gate 1 QR Scanner</h3>
            <div className="h-44 rounded-lg bg-black flex items-center justify-center border">
              <QrCode size={90} className="text-white animate-pulse" />
            </div>
            <p className="text-xs text-muted-foreground">Point resident or visitor pass QR code toward camera.</p>
            <Button
              size="sm"
              className="w-full"
              onClick={() => {
                setQrModal(false);
                toast.success("Pass #AJX-8921 Verified. Visitor Approved.");
              }}
            >
              Simulate Successful Scan
            </Button>
          </div>
        </div>
      )}
    </AppShell>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 8. SERVICE PROVIDER DASHBOARD VIEW
// ═════════════════════════════════════════════════════════════════════════════
function ServiceProviderDashboardView() {
  const { user, userProfile } = useAuth();
  const displayName = userProfile?.displayName || user?.displayName || user?.email?.split("@")[0] || "Service Provider";
  const [jobs, setJobs] = useState([
    { id: "sr-1", client: "A-1204 Resident", unit: "Flat A-1204", service: "Washbasin leak repair", time: "Today, 11:00 AM", status: "assigned" },
    { id: "sr-2", client: "Vikram Sen", unit: "Flat C-402", service: "Kitchen RO tap replacement", time: "Today, 03:30 PM", status: "pending" }
  ]);

  function handleAccept(id: string) {
    setJobs(jobs.map((j) => (j.id === id ? { ...j, status: "in_progress" } : j)));
    toast.success("Service request accepted. Resident notified of arrival time.");
  }

  function handleComplete(id: string) {
    setJobs(jobs.filter((j) => j.id !== id));
    toast.success("Job completed. Invoice and rating request sent to resident.");
  }

  return (
    <AppShell>
      <AnimatedSection className="space-y-6">
        <div className="rounded-xl border bg-card p-5 shadow-xs">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-foreground">
                  Provider Workspace — {displayName}
                </h1>
                <Badge tone="green">Verified Partner (★ 4.8)</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Society Authorized Contractor · Plumbing & Sanitation
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-base font-bold text-foreground">Resident Service Bookings</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {jobs.map((j) => (
              <Card key={j.id} className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-sm text-foreground">{j.service}</h4>
                    <p className="text-xs text-muted-foreground">{j.client} · {j.unit}</p>
                  </div>
                  <Badge tone={j.status === "in_progress" ? "blue" : "amber"}>
                    {j.status.toUpperCase()}
                  </Badge>
                </div>
                <p className="text-xs font-semibold text-primary">{j.time}</p>
                <div className="flex justify-end gap-2 pt-2 border-t">
                  {j.status === "pending" ? (
                    <Button size="sm" onClick={() => handleAccept(j.id)}>
                      Accept Booking
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => handleComplete(j.id)}>
                      Mark Complete
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      </AnimatedSection>
    </AppShell>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 9. SUPER ADMIN DASHBOARD VIEW
// ═════════════════════════════════════════════════════════════════════════════
function SuperAdminDashboardView() {
  const { user, userProfile } = useAuth();
  const displayName = userProfile?.displayName || user?.displayName || user?.email?.split("@")[0] || "Super Admin";

  return (
    <AppShell mode="admin">
      <AnimatedSection className="space-y-6">
        <div className="rounded-xl border bg-card p-5 shadow-xs">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-foreground">
                  Platform Cloud Overview — {displayName}
                </h1>
                <Badge tone="teal">Global Multi-Society Cloud</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Fleet management across all residential and commercial societies on ResolveX
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => toast.success("System telemetry exported.")}>
                Export Cloud Logs
              </Button>
            </div>
          </div>
        </div>

        {/* Global Platform Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground font-semibold">Active Societies</p>
            <p className="text-2xl font-bold text-foreground mt-1">4</p>
            <p className="text-[11px] text-emerald-600 mt-0.5">100% Operational</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground font-semibold">Total Residents</p>
            <p className="text-2xl font-bold text-foreground mt-1">1,842</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Across 850 units</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground font-semibold">Platform Uptime</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">99.98%</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">API Latency 42ms</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground font-semibold">Monthly Dues Processed</p>
            <p className="text-2xl font-bold text-foreground mt-1">₹1.42 Cr</p>
            <p className="text-[11px] text-emerald-600 mt-0.5">Razorpay / UPI</p>
          </Card>
        </div>

        {/* Societies Directory */}
        <Card className="p-5 space-y-3">
          <h3 className="font-bold text-base text-foreground">Managed Society Deployments</h3>
          <div className="space-y-2 text-xs">
            <div className="rounded-lg border p-3 flex items-center justify-between">
              <div>
                <p className="font-bold text-foreground">Ajanta Gen-X RWA (Sector 74)</p>
                <p className="text-muted-foreground">3 Towers · 180 Units · Admin: Rajesh Singhania</p>
              </div>
              <Badge tone="green">Healthy (Production)</Badge>
            </div>
            <div className="rounded-lg border p-3 flex items-center justify-between">
              <div>
                <p className="font-bold text-foreground">Palm Heights Society (Sector 82)</p>
                <p className="text-muted-foreground">5 Towers · 340 Units · Admin: Amit Kapur</p>
              </div>
              <Badge tone="green">Healthy (Production)</Badge>
            </div>
            <div className="rounded-lg border p-3 flex items-center justify-between">
              <div>
                <p className="font-bold text-foreground">DLF CyberCity Residency</p>
                <p className="text-muted-foreground">4 Towers · 420 Units · Admin: Meenakshi Sen</p>
              </div>
              <Badge tone="green">Healthy (Production)</Badge>
            </div>
          </div>
        </Card>
      </AnimatedSection>
    </AppShell>
  );
}
