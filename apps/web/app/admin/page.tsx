"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  AlertTriangle,
  Building2,
  Calendar,
  CalendarCheck,
  CheckCircle,
  CheckCircle2,
  Clock,
  Cpu,
  CreditCard,
  FileCheck,
  FileText,
  HelpCircle,
  Home,
  LayoutDashboard,
  LifeBuoy,
  Lock,
  Mail,
  Megaphone,
  MessageSquare,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Sparkles,
  UserCheck,
  Users,
  UserX,
  UsersRound,
  Vote,
  Wrench,
  X
} from "lucide-react";
import { toast } from "sonner";
import {
  billCollectionChart,
  bills,
  complaints as initialComplaints,
  communityPolls,
  dashboardMetrics,
  demoSociety,
  departmentLabels,
  escalationHistory,
  facilities,
  facilityStatusLabels,
  flats,
  formatCurrency,
  households,
  monthlyComplaintChart,
  notices,
  residents,
  roleLabels,
  societyEvents,
  staff,
  titleCase,
  towers,
  visitorPasses
} from "@resolvex/utils";
import type { AmenityBooking, Complaint, PlatformRole, StaffDepartment, UserProfile } from "@resolvex/types";
import { AppShell } from "@/components/app-shell";
import { AnimatedSection, Badge, Button, Card, SectionHeader, StatusDot } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import {
  approveUserRegistration,
  assignStaff as serviceAssignStaff,
  cancelAmenityBooking,
  createNotice,
  getLocalAuditLogs,
  getSocietyConfig,
  rejectUserRegistration,
  subscribeAmenityBookings,
  subscribeAuditLogs,
  subscribeComplaints,
  subscribeNotices,
  subscribePendingRegistrations,
  subscribeSocietyUsers,
  updateSocietyConfig
} from "@/lib/services";

export default function AdminPage() {
  return (
    <AppShell mode="admin">
      <Suspense fallback={<AdminLoadingFallback />}>
        <AdminControlCenterContent />
      </Suspense>
    </AppShell>
  );
}

function AdminLoadingFallback() {
  return (
    <div className="space-y-4 p-6">
      <div className="h-8 w-64 bg-muted animate-pulse rounded-lg" />
      <div className="h-4 w-96 bg-muted/60 animate-pulse rounded-lg" />
      <div className="grid grid-cols-4 gap-4 pt-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-muted/40 animate-pulse rounded-xl" />
        ))}
      </div>
    </div>
  );
}

function AdminControlCenterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") || "dashboard";
  const [activeTab, setActiveTab] = useState<string>(tabParam);

  const { userProfile } = useAuth();
  const societyId = userProfile?.societyId || "soc-ajanta-genx";

  const [complaintList, setComplaintList] = useState<Complaint[]>([]);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [assignedStaffId, setAssignedStaffId] = useState<string>(staff[0]?.id ?? "");

  const [pendingUsers, setPendingUsers] = useState<UserProfile[]>([]);
  const [societyUsers, setSocietyUsers] = useState<UserProfile[]>([]);
  const [actioningUserId, setActioningUserId] = useState<string | null>(null);
  const [rejectModalUser, setRejectModalUser] = useState<UserProfile | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const [amenityBookings, setAmenityBookings] = useState<AmenityBooking[]>([]);
  const [cancellingAmenityId, setCancellingAmenityId] = useState<string | null>(null);

  // Notices State
  const [liveNotices, setLiveNotices] = useState<any[]>([]);
  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [noticeTitle, setNoticeTitle] = useState("");
  const [noticeBody, setNoticeBody] = useState("");
  const [noticePriority, setNoticePriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [isSubmittingNotice, setIsSubmittingNotice] = useState(false);

  // Sub-filter for Users / Properties tab
  const [userRoleFilter, setUserRoleFilter] = useState<string>("all");
  const [userSearchQuery, setUserSearchQuery] = useState<string>("");

  // Audit Logs State
  const [liveAuditLogs, setLiveAuditLogs] = useState<any[]>([]);

  // Society Config State
  const [societyConfig, setSocietyConfig] = useState({
    name: "Ajanta Gen-X Residency",
    rwaRegistrationNumber: "RWA-UP-NOIDA-2021-9921",
    address: "Tower A-D, Plot 4, Sector 78, Noida, Uttar Pradesh 201301",
    helplinePhone: "+91 120 499 8800"
  });
  const [isSavingSociety, setIsSavingSociety] = useState(false);

  useEffect(() => {
    setActiveTab(tabParam);
  }, [tabParam]);

  useEffect(() => {
    if (!societyId) return;
    const unsub = subscribeComplaints({ societyId }, setComplaintList);
    return () => unsub();
  }, [societyId, userProfile?.uid]);

  useEffect(() => {
    if (!societyId) return;
    const unsub = subscribePendingRegistrations(societyId, setPendingUsers);
    return () => unsub();
  }, [societyId, userProfile?.uid]);

  useEffect(() => {
    if (!societyId) return;
    const unsub = subscribeAmenityBookings(societyId, undefined, setAmenityBookings);
    return () => unsub();
  }, [societyId, userProfile?.uid]);

  useEffect(() => {
    if (!societyId) return;
    const unsub = subscribeSocietyUsers(societyId, setSocietyUsers);
    return () => unsub();
  }, [societyId, userProfile?.uid]);

  useEffect(() => {
    if (!societyId) return;
    const unsub = subscribeNotices(societyId, setLiveNotices);
    return () => unsub();
  }, [societyId, userProfile?.uid]);

  useEffect(() => {
    if (!societyId) return;
    const unsub = subscribeAuditLogs(societyId, setLiveAuditLogs);
    return () => unsub();
  }, [societyId, userProfile?.uid]);

  useEffect(() => {
    if (!societyId) return;
    let isCancelled = false;
    getSocietyConfig(societyId).then((data) => {
      if (!isCancelled && data) {
        setSocietyConfig({
          name: data.name || "Ajanta Gen-X Residency",
          rwaRegistrationNumber: data.rwaRegistrationNumber || "RWA-UP-NOIDA-2021-9921",
          address: data.address || "Tower A-D, Plot 4, Sector 78, Noida, Uttar Pradesh 201301",
          helplinePhone: data.helplinePhone || "+91 120 499 8800"
        });
      }
    });
    return () => {
      isCancelled = true;
    };
  }, [societyId, userProfile?.uid]);

  async function handleCreateNotice(e: React.FormEvent) {
    e.preventDefault();
    if (!noticeTitle.trim() || !noticeBody.trim() || !societyId) return;
    setIsSubmittingNotice(true);
    try {
      await createNotice({
        societyId,
        title: noticeTitle.trim(),
        body: noticeBody.trim(),
        priority: noticePriority,
        createdByUserId: userProfile?.uid || "admin-user"
      });
      toast.success(`Notice "${noticeTitle.trim()}" published to society in Firestore.`);
      setShowNoticeModal(false);
      setNoticeTitle("");
      setNoticeBody("");
    } catch (err: any) {
      toast.error(err.message || "Failed to publish notice.");
    } finally {
      setIsSubmittingNotice(false);
    }
  }

  async function handleSaveSocietyConfig(e: React.FormEvent) {
    e.preventDefault();
    if (!societyId) return;
    setIsSavingSociety(true);
    try {
      await updateSocietyConfig(societyId, societyConfig, userProfile?.uid || "admin-user");
      toast.success("Society settings updated successfully in Firestore.");
    } catch (err: any) {
      toast.error(err.message || "Failed to update society configuration.");
    } finally {
      setIsSavingSociety(false);
    }
  }

  async function handleAdminCancelBooking(bookingId: string) {
    if (!bookingId || !societyId) return;
    setCancellingAmenityId(bookingId);
    try {
      await cancelAmenityBooking(bookingId, userProfile?.uid || "admin", societyId);
      toast.success(`Booking #${bookingId} cancelled and slot released.`);
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel booking.");
    } finally {
      setCancellingAmenityId(null);
    }
  }

  function handleTabChange(tabKey: string) {
    setActiveTab(tabKey);
    router.replace(`/admin?tab=${tabKey}`, { scroll: false });
  }

  async function handleApproveUser(applicant: UserProfile) {
    if (!applicant.uid || !societyId) return;
    setActioningUserId(applicant.uid);
    try {
      await approveUserRegistration(applicant.uid, societyId, userProfile?.uid || "admin-user");
      toast.success(`Applicant ${applicant.displayName || applicant.email} has been approved and verified!`);
    } catch (err: any) {
      toast.error(err.message || "Failed to approve applicant.");
    } finally {
      setActioningUserId(null);
    }
  }

  async function handleRejectSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rejectModalUser || !rejectModalUser.uid || !societyId) return;
    const reason = rejectionReason.trim();
    if (!reason) {
      toast.error("A rejection reason is mandatory.");
      return;
    }
    setActioningUserId(rejectModalUser.uid);
    try {
      await rejectUserRegistration(rejectModalUser.uid, societyId, userProfile?.uid || "admin-user", reason);
      toast.success(`Registration for ${rejectModalUser.displayName || rejectModalUser.email} has been rejected.`);
      setRejectModalUser(null);
      setRejectionReason("");
    } catch (err: any) {
      toast.error(err.message || "Failed to reject applicant.");
    } finally {
      setActioningUserId(null);
    }
  }

  async function handleDispatchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedComplaint) return;
    const liveStaff = societyUsers.filter((u) => u.role === "maintenance_staff" || u.role === "security_guard");
    const staffMember = liveStaff.find((s) => s.uid === assignedStaffId) || staff.find((s) => s.id === assignedStaffId);
    try {
      const staffName = (staffMember as any)?.displayName || (staffMember as any)?.name || "Technician";
      const staffDept = (staffMember as any)?.department || ((staffMember as any)?.role === "security_guard" ? "security" : "general_maintenance");
      await serviceAssignStaff(
        selectedComplaint.id,
        assignedStaffId,
        staffName,
        staffDept,
        userProfile?.uid || "admin-user",
        societyId
      );
      toast.success(`Complaint #${selectedComplaint.id} dispatched to ${staffName}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to dispatch staff in Firestore.");
    }

    setShowDispatchModal(false);
  }

  const residentUsers = societyUsers.filter(
    (u) => u.role === "resident" || u.role === "flat_owner" || u.role === "tenant"
  );
  const staffUsers = societyUsers.filter(
    (u) => u.role === "maintenance_staff" || u.role === "security_guard"
  );

  const workforceOnDuty = staffUsers.filter(
    (s) => (s.availabilityStatus === "on_duty" || s.availabilityStatus === "available" || !s.availabilityStatus) && s.status === "verified"
  ).length;

  const openComplaints = complaintList.filter(
    (c) => c.status !== "resolved" && c.status !== "closed"
  ).length;

  const slaRisks = complaintList.filter((c) => {
    if (c.status === "resolved" || c.status === "closed") return false;
    const deadline = c.slaDueAt;
    return deadline ? new Date(deadline).getTime() < Date.now() : false;
  }).length;

  type ToneKey = "danger" | "warning" | "success";
  const toneColors: Record<ToneKey, string> = {
    danger: "text-red-600 dark:text-red-400",
    warning: "text-amber-600 dark:text-amber-400",
    success: "text-emerald-600 dark:text-emerald-400"
  };

  const primaryMetrics: Array<{
    label: string;
    value: number;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    tone: ToneKey;
  }> = [
    {
      label: "Open Complaints",
      value: openComplaints,
      icon: LifeBuoy,
      tone: (openComplaints > 3 ? "danger" : "warning") as ToneKey
    },
    {
      label: "Pending Verifications",
      value: pendingUsers.length,
      icon: UserCheck,
      tone: (pendingUsers.length > 0 ? "warning" : "success") as ToneKey
    },
    {
      label: "SLA Risks",
      value: slaRisks,
      icon: AlertTriangle,
      tone: (slaRisks > 0 ? "danger" : "success") as ToneKey
    }
  ];

  const secondaryMetrics = [
    { label: "Workforce Staff", value: staffUsers.length > 0 ? staffUsers.length : staff.length, icon: UserCheck },
    { label: "Total Residents", value: residentUsers.length, icon: UsersRound },
    { label: "Occupied Flats", value: new Set(residentUsers.map((u) => u.flatId).filter(Boolean)).size || 1, icon: Building2 },
    { label: "Facility Assets", value: facilities.length, icon: Cpu }
  ];

  const navTabs = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "verifications", label: "Verifications", icon: UserCheck, badge: pendingUsers.length },
    { id: "users", label: "Residents & Units", icon: UsersRound },
    { id: "workforce", label: "Staff & Security", icon: Wrench },
    { id: "sla", label: "Complaints & SLA", icon: AlertTriangle, badge: slaRisks },
    { id: "billing", label: "Billing & Tariffs", icon: CreditCard },
    { id: "amenities", label: "Amenities & Visitors", icon: Cpu },
    { id: "community", label: "Community & Notices", icon: Megaphone },
    { id: "audit", label: "Audit Logs", icon: FileText },
    { id: "permissions", label: "Roles & Permissions", icon: ShieldCheck },
    { id: "society", label: "Society Settings", icon: Building2 }
  ];

  return (
    <AnimatedSection className="space-y-6">
      {/* Header */}
      <SectionHeader
        eyebrow="Administrative Control Center"
        title="Society Management Command Center"
        description="Comprehensive governance, multi-tenant property oversight, workforce dispatch, and regulatory compliance."
        action={
          <div className="flex items-center gap-2">
            <Link href="/admin/verifications">
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                <UserCheck size={14} className="mr-1.5" />
                Verifications ({pendingUsers.length})
              </Button>
            </Link>
            <Button size="sm" variant="outline" onClick={() => setShowNoticeModal(true)}>
              <Megaphone size={14} className="mr-1.5" />
              Publish Broadcast
            </Button>
          </div>
        }
      />

      {/* Control Center Module Tab Strip */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b pb-2 text-xs scrollbar-none">
        {navTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 font-semibold transition-all ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
              {typeof tab.badge === "number" && tab.badge > 0 && (
                <span
                  className={`ml-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                    isActive ? "bg-white text-primary" : "bg-red-500 text-white"
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: DASHBOARD COMMAND OVERVIEW */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          {/* Primary operational metrics */}
          <div className="grid gap-3 sm:grid-cols-3">
            {primaryMetrics.map((metric) => {
              const Icon = metric.icon;
              return (
                <Card key={metric.label} className="p-4">
                  <div className="flex items-center justify-between">
                    <Icon size={17} className={toneColors[metric.tone]} />
                    <span className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Live
                    </span>
                  </div>
                  <p className={`mt-3 text-3xl font-bold tracking-tight ${toneColors[metric.tone]}`}>
                    {metric.value}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{metric.label}</p>
                </Card>
              );
            })}
          </div>

          {/* Secondary metrics */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {secondaryMetrics.map((metric) => {
              const Icon = metric.icon;
              return (
                <Card key={metric.label} className="flex items-center gap-3 p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Icon size={17} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg font-bold">{metric.value}</p>
                    <p className="text-xs text-muted-foreground truncate">{metric.label}</p>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Operational Priority Action Center */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <AlertTriangle size={15} className="text-red-500" />
                Priority Operational Queues
              </h3>
              <span className="text-xs text-muted-foreground">Action items requiring management decision</span>
            </div>

            {/* CRITICAL ACTIONS */}
            <div className="rounded-xl border border-red-300/70 bg-red-50/60 p-4 dark:border-red-900/30 dark:bg-red-950/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                  <span className="flex h-2 w-2 rounded-full bg-red-600 animate-pulse" />
                  <p className="text-xs font-bold uppercase tracking-wider">
                    Critical · Immediate Attention Required ({escalationHistory.length + facilities.filter((f) => f.status === "degraded" || f.status === "out_of_service").length})
                  </p>
                </div>
                <Badge tone="red">High SLA Impact</Badge>
              </div>

              <div className="space-y-2">
                {escalationHistory.map((esc) => (
                  <div
                    key={esc.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-red-200/80 bg-white px-4 py-3 dark:border-red-900/40 dark:bg-red-950/40"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge tone="red">SLA Breach</Badge>
                        <p className="text-sm font-bold text-red-900 dark:text-red-200">{esc.note}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Crossed society 24-hour response threshold · Triggered on{" "}
                        {new Date(esc.triggeredAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="danger"
                      className="shrink-0"
                      onClick={() => {
                        const escComplaint = complaintList.find((c) => c.id === esc.complaintId);
                        if (escComplaint) {
                          setSelectedComplaint(escComplaint);
                          setShowDispatchModal(true);
                        } else {
                          toast.success("Fast-track emergency dispatch alert routed to Department Head.");
                        }
                      }}
                    >
                      Fast-Track Dispatch
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* HIGH PRIORITY ACTIONS */}
            <div className="rounded-xl border border-amber-300/70 bg-amber-50/60 p-4 dark:border-amber-900/30 dark:bg-amber-950/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <span className="flex h-2 w-2 rounded-full bg-amber-500" />
                  <p className="text-xs font-bold uppercase tracking-wider">
                    High Priority · Pending Verifications ({pendingUsers.length}) & Open Tickets ({complaintList.filter((c) => c.status === "open").length})
                  </p>
                </div>
                <Link href="/admin/verifications" className="text-xs font-semibold text-primary hover:underline">
                  Open Verification Console &rarr;
                </Link>
              </div>

              <div className="space-y-2">
                {pendingUsers.map((u) => {
                  const flatLabel = u.flatId ? `Flat ${u.flatId.replace("flat-", "").toUpperCase()}` : "Unassigned Flat";
                  const roleLabel = roleLabels[u.role] || u.role;
                  const isActioning = actioningUserId === u.uid;

                  return (
                    <div
                      key={u.uid}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-teal-200/80 bg-white px-4 py-3 dark:border-teal-900/30 dark:bg-teal-950/30"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge tone="teal">{roleLabel}</Badge>
                          <span className="text-sm font-semibold">{u.displayName || u.email}</span>
                          <span className="font-mono text-xs text-muted-foreground">({flatLabel})</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {u.email} {u.phone || u.phoneNumber ? `· ${u.phone || u.phoneNumber}` : ""} · Applied{" "}
                          {new Date(u.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          disabled={isActioning}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => handleApproveUser(u)}
                        >
                          {isActioning ? "Approving..." : "Approve"}
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={isActioning}
                          onClick={() => {
                            setRejectModalUser(u);
                            setRejectionReason("");
                          }}
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
            <Card className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Monthly Complaint Analytics</h3>
                <span className="text-xs text-muted-foreground">YTD Trend</span>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyComplaintChart}>
                    <defs>
                      <linearGradient id="open" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4338ca" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#4338ca" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        fontSize: 12,
                        borderRadius: 8,
                        border: "1px solid hsl(var(--border))",
                        background: "hsl(var(--card))"
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="open"
                      stroke="#4338ca"
                      fill="url(#open)"
                      strokeWidth={2}
                      name="Open Tickets"
                    />
                    <Area
                      type="monotone"
                      dataKey="resolved"
                      stroke="#0d9488"
                      fill="transparent"
                      strokeWidth={2}
                      name="Resolved"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Maintenance Dues Collection</h3>
                <span className="text-xs text-muted-foreground">Monthly</span>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={billCollectionChart}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        fontSize: 12,
                        borderRadius: 8,
                        border: "1px solid hsl(var(--border))",
                        background: "hsl(var(--card))"
                      }}
                    />
                    <Bar dataKey="collected" fill="#0d9488" radius={[4, 4, 0, 0]} name="Collected (₹)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: VERIFICATIONS CONSOLE */}
      {activeTab === "verifications" && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h3 className="text-base font-bold text-foreground">Pending Registration Queue</h3>
              <p className="text-xs text-muted-foreground">
                Authorize pending resident, flat owner, and staff account requests for {demoSociety.name}.
              </p>
            </div>
            <Link href="/admin/verifications">
              <Button size="sm">Dedicated Full-Page Console &rarr;</Button>
            </Link>
          </div>

          <div className="space-y-3">
            {pendingUsers.length > 0 ? (
              pendingUsers.map((u) => (
                <div
                  key={u.uid}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border p-4 hover:bg-muted/20"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge tone="blue">{roleLabels[u.role] || u.role}</Badge>
                      <span className="font-bold text-sm">{u.displayName || u.email}</span>
                      <span className="text-xs text-muted-foreground font-mono">
                        ({u.flatId ? `Flat ${u.flatId.replace("flat-", "").toUpperCase()}` : "No Flat"})
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {u.email} {u.phone || u.phoneNumber ? `· ${u.phone || u.phoneNumber}` : ""} · UID: {u.uid}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => handleApproveUser(u)}
                      disabled={actioningUserId === u.uid}
                    >
                      {actioningUserId === u.uid ? "Approving..." : "Approve & Verify"}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        setRejectModalUser(u);
                        setRejectionReason("");
                      }}
                      disabled={actioningUserId === u.uid}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-xs text-muted-foreground rounded-lg border border-dashed">
                <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-500" />
                No pending registrations in queue. All user requests are up to date!
              </div>
            )}
          </div>
        </Card>
      )}

      {/* TAB 3: RESIDENTS, OWNERS, TENANTS, TOWERS, FLATS */}
      {activeTab === "users" && (
        <Card className="p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
            <div>
              <h3 className="text-base font-bold text-foreground">Property & Resident Directory</h3>
              <p className="text-xs text-muted-foreground">
                All registered unit owners, verified tenants, family occupants, and assigned flats.
              </p>
            </div>
            <Link href="/households">
              <Button size="sm" variant="outline">
                <Building2 size={14} className="mr-1.5" />
                Manage Units & Towers
              </Button>
            </Link>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">Filter:</span>
              {["all", "flat_owner", "tenant", "resident"].map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setUserRoleFilter(role)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                    userRoleFilter === role
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {role === "all" ? "All Perspectives" : roleLabels[role as PlatformRole] || role}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                placeholder="Search resident, flat, phone..."
                className="w-full rounded-lg border bg-background pl-8 pr-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/25"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b bg-muted/30 text-2xs font-semibold uppercase text-muted-foreground">
                <tr>
                  <th className="p-3">Resident / Contact</th>
                  <th className="p-3">Platform Role</th>
                  <th className="p-3">Flat & Tower</th>
                  <th className="p-3">Household Reference</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(societyUsers.length > 0 ? societyUsers : residents as any[])
                  .filter((r) => {
                    const role = r.role || r.householdRole;
                    if (userRoleFilter === "flat_owner") {
                      return role === "flat_owner" || role === "owner" || role === "co_owner";
                    }
                    if (userRoleFilter === "tenant") {
                      return role === "tenant";
                    }
                    if (userRoleFilter === "resident") {
                      return role === "resident";
                    }
                    if (userSearchQuery.trim()) {
                      const q = userSearchQuery.toLowerCase();
                      const name = (r.displayName || r.name || "").toLowerCase();
                      const email = (r.email || "").toLowerCase();
                      const flat = (r.flatId || "").toLowerCase();
                      return name.includes(q) || email.includes(q) || flat.includes(q);
                    }
                    return true;
                  })
                  .map((r) => (
                    <tr key={r.uid || r.id} className="hover:bg-muted/20">
                      <td className="p-3">
                        <p className="font-bold text-foreground">{r.displayName || r.name}</p>
                        <p className="text-muted-foreground text-2xs">{r.email}</p>
                      </td>
                      <td className="p-3">
                        <Badge tone="teal">{r.role ? titleCase(r.role) : (r.householdRole ? titleCase(r.householdRole) : "Resident")}</Badge>
                      </td>
                      <td className="p-3 font-medium">
                        {r.flatId ? `Flat ${r.flatId.replace("flat-", "").toUpperCase()}` : "N/A"}
                      </td>
                      <td className="p-3 font-mono text-2xs text-muted-foreground">{r.householdId || "Pending"}</td>
                      <td className="p-3">
                        {r.status === "verified" ? (
                          <StatusDot tone="green" label="Verified Active" />
                        ) : (
                          <StatusDot tone="amber" label={titleCase(r.status || "pending")} />
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7"
                          onClick={() => toast.info(`Viewing profile for ${r.displayName || r.name}`)}
                        >
                          Details
                        </Button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 4: WORKFORCE & SECURITY */}
      {activeTab === "workforce" && (
        <Card className="p-6 space-y-5">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h3 className="text-base font-bold text-foreground">Workforce & Security Personnel Roster</h3>
              <p className="text-xs text-muted-foreground">
                Duty statuses, skill sets, active assignments, and gate security coverage.
              </p>
            </div>
            <Link href="/staff">
              <Button size="sm">Staff Shift Console &rarr;</Button>
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(staffUsers.length > 0 ? staffUsers : staff as any[]).map((s) => {
              const staffId = s.uid || s.id;
              const staffName = s.displayName || s.name;
              const activeCount = complaintList.filter((c) => c.assignedStaffId === staffId && c.status === "in_progress").length;
              return (
                <div key={staffId} className="rounded-xl border p-4 space-y-3 bg-card hover:border-primary/40">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-foreground">{staffName}</h4>
                      <p className="text-xs text-muted-foreground">
                        {s.department ? (departmentLabels[s.department as keyof typeof departmentLabels] || s.department) : (s.role === "maintenance_staff" ? "Maintenance Operations" : "Gate Security")}
                      </p>
                    </div>
                    <StatusDot
                      tone={
                        s.availabilityStatus === "off_duty"
                          ? "slate"
                          : s.availabilityStatus === "available"
                          ? "amber"
                          : "green"
                      }
                      label={
                        s.availabilityStatus === "off_duty"
                          ? "Off Duty"
                          : s.availabilityStatus === "available"
                          ? "Available"
                          : "On Duty"
                      }
                    />
                  </div>

                  <div className="text-xs space-y-1 bg-muted/30 p-2.5 rounded-lg">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Phone:</span>
                      <span className="font-mono">{s.phone || s.phoneNumber || "+91 98000 00000"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Workload:</span>
                      <span className="font-bold">{activeCount} active jobs</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Role:</span>
                      <span className="text-primary font-semibold">{s.role ? titleCase(s.role) : "Staff"}</span>
                    </div>
                  </div>

                  {s.skills && (
                    <div className="flex flex-wrap gap-1">
                      {s.skills.map((skill: string) => (
                        <Badge key={skill} tone="blue">
                          {skill.replace("_", " ")}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* TAB 5: COMPLAINTS, ASSIGNMENTS & SLA ESCALATIONS */}
      {activeTab === "sla" && (
        <Card className="p-6 space-y-5">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h3 className="text-base font-bold text-foreground">SLA Governance & Dispatch Management</h3>
              <p className="text-xs text-muted-foreground">
                24-hour response thresholds, breach risk queues, and fast-track assignments.
              </p>
            </div>
            <Link href="/complaints">
              <Button size="sm">Triage All Complaints &rarr;</Button>
            </Link>
          </div>

          <div className="rounded-xl border border-red-200 bg-red-50/50 p-4 dark:border-red-900/30 dark:bg-red-950/20 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-red-700 dark:text-red-400 flex items-center gap-1.5">
              <Siren size={15} />
              SLA Breached Tickets (24h+ elapsed)
            </h4>
            {escalationHistory.map((esc) => (
              <div
                key={esc.id}
                className="flex items-center justify-between rounded-lg border bg-card p-3 shadow-xs"
              >
                <div>
                  <p className="text-xs font-bold text-foreground">{esc.note}</p>
                  <p className="text-2xs text-muted-foreground">
                    Ticket Ref: #{esc.complaintId} · Escalated to General Manager
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => toast.success(`Emergency supervisor dispatched to ${esc.complaintId}`)}
                >
                  Fast-Track Escalation
                </Button>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Active Complaint Triage ({complaintList.length} total)
            </h4>
            <div className="divide-y divide-border rounded-xl border bg-card">
              {complaintList.slice(0, 5).map((c) => (
                <div key={c.id} className="flex items-center justify-between p-3.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge tone={c.priority === "high" ? "red" : "amber"}>{titleCase(c.priority)}</Badge>
                      <span className="font-bold text-xs">#{c.id}</span>
                      <span className="font-semibold text-sm truncate">{c.title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      📍 {c.location} · Category: {departmentLabels[c.category as keyof typeof departmentLabels] || c.category}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedComplaint(c);
                      setShowDispatchModal(true);
                    }}
                  >
                    Assign Staff
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* TAB 6: BILLING & RECONCILIATION */}
      {activeTab === "billing" && (
        <Card className="p-6 space-y-5">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h3 className="text-base font-bold text-foreground">Maintenance Ledger & Payment Reconciliation</h3>
              <p className="text-xs text-muted-foreground">
                Society tariff schedules, offline cheque reconciliation, and verified payment audit trail.
              </p>
            </div>
            <Link href="/services">
              <Button size="sm">Resident Services &rarr;</Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border p-4 bg-muted/20 space-y-1">
              <span className="text-2xs font-semibold text-muted-foreground uppercase">Base Maintenance Tariff</span>
              <p className="text-2xl font-bold text-foreground">₹4.50 <span className="text-xs font-normal">/ sq.ft</span></p>
              <p className="text-2xs text-muted-foreground">Due 10th of every month</p>
            </div>
            <div className="rounded-xl border p-4 bg-muted/20 space-y-1">
              <span className="text-2xs font-semibold text-muted-foreground uppercase">Q3 Total Billed</span>
              <p className="text-2xl font-bold text-foreground">₹4,86,000</p>
              <p className="text-2xs text-emerald-600">87.4% Collection Efficiency</p>
            </div>
            <div className="rounded-xl border p-4 bg-muted/20 space-y-1">
              <span className="text-2xs font-semibold text-muted-foreground uppercase">Outstanding Arrears</span>
              <p className="text-2xl font-bold text-amber-600">₹61,000</p>
              <p className="text-2xs text-muted-foreground">14 Overdue Units</p>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Recent Billing Invoices & Reconciliation Status
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b bg-muted/30 text-2xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-3">Bill ID / Period</th>
                    <th className="p-3">Household / Flat</th>
                    <th className="p-3">Amount</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Reconciliation Reference</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {bills.map((b) => (
                    <tr key={b.id} className="hover:bg-muted/20">
                      <td className="p-3 font-semibold">
                        #{b.id}
                        <span className="block text-2xs text-muted-foreground">{b.title}</span>
                      </td>
                      <td className="p-3 font-mono">{b.householdId}</td>
                      <td className="p-3 font-bold">{formatCurrency(b.amount)}</td>
                      <td className="p-3">
                        <Badge tone={b.status === "paid" ? "green" : "amber"}>
                          {b.status === "paid" ? "Paid (Reconciled)" : "Pending"}
                        </Badge>
                      </td>
                      <td className="p-3 text-2xs font-mono text-muted-foreground">
                        {b.status === "paid" ? "TXN-SIM-77192 (Estate Office Cleared)" : "Awaiting Transfer"}
                      </td>
                      <td className="p-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => toast.info(`Viewing receipt for bill #${b.id}`)}
                        >
                          View Receipt
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}

      {/* TAB 7: AMENITIES & VISITOR MANAGEMENT */}
      {activeTab === "amenities" && (
        <Card className="p-6 space-y-6">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h3 className="text-base font-bold text-foreground">Facility Assets, Bookings & Gate Visitor Logs</h3>
              <p className="text-xs text-muted-foreground">
                Live society amenity reservations, diagnostic asset health, and security gate entry records.
              </p>
            </div>
            <Link href="/facilities">
              <Button size="sm">Asset Diagnostics &rarr;</Button>
            </Link>
          </div>

          {/* Real-time Amenity Bookings Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Resident Amenity Reservations ({amenityBookings.length} Total)
                </h4>
                <p className="text-2xs text-muted-foreground">
                  Synchronized live from Firestore for society #{societyId}.
                </p>
              </div>
              <Badge tone="blue">Real-time Multi-tenant</Badge>
            </div>

            {amenityBookings.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center bg-muted/10">
                <p className="text-sm font-semibold text-muted-foreground">No resident reservations recorded yet.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  When residents book swimming pool, gym, or tennis court slots, they will appear here in real time.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border bg-card">
                <table className="w-full text-left text-xs">
                  <thead className="border-b bg-muted/40 text-2xs uppercase text-muted-foreground font-semibold">
                    <tr>
                      <th className="p-3">Booking / Pass</th>
                      <th className="p-3">Resident / Flat</th>
                      <th className="p-3">Facility</th>
                      <th className="p-3">Date & Slot</th>
                      <th className="p-3">Guests</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {amenityBookings.map((b) => {
                      const isConfirmed = b.status === "confirmed";
                      const isCancelling = cancellingAmenityId === b.id;
                      return (
                        <tr key={b.id} className="hover:bg-muted/20 rx-transition">
                          <td className="p-3 font-semibold">
                            <span className="font-mono text-xs">{b.qrPassToken || b.id}</span>
                            <span className="block text-2xs font-mono text-muted-foreground">#{b.id}</span>
                          </td>
                          <td className="p-3">
                            <span className="font-bold text-foreground">{b.userName || "Resident"}</span>
                            <span className="block text-2xs text-muted-foreground font-mono">
                              {b.householdId ? `Flat ${b.householdId}` : b.userId}
                            </span>
                          </td>
                          <td className="p-3 font-medium text-foreground">
                            {b.amenityId}
                          </td>
                          <td className="p-3">
                            <span className="font-semibold text-foreground">{b.date}</span>
                            <span className="block text-2xs text-muted-foreground">{b.slot || `${b.startTime} - ${b.endTime}`}</span>
                          </td>
                          <td className="p-3">
                            <span className="text-xs">{b.guestCount || 1} Guests</span>
                            <span className="block text-2xs text-muted-foreground">
                              {b.charge ? formatCurrency(b.charge) : "Complimentary"}
                            </span>
                          </td>
                          <td className="p-3">
                            <Badge tone={isConfirmed ? "green" : b.status === "completed" ? "blue" : "red"}>
                              {titleCase(b.status)}
                            </Badge>
                          </td>
                          <td className="p-3 text-right">
                            {isConfirmed && (
                              <Button
                                size="sm"
                                variant="danger"
                                className="h-7 text-xs"
                                disabled={isCancelling}
                                onClick={() => handleAdminCancelBooking(b.id)}
                              >
                                {isCancelling ? "Cancelling..." : "Cancel Slot"}
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t">
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Critical Facility Health
              </h4>
              <div className="space-y-2">
                {facilities.map((f) => (
                  <div key={f.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-xs font-bold text-foreground">{f.name}</p>
                      <p className="text-2xs text-muted-foreground">{f.location}</p>
                    </div>
                    <StatusDot
                      tone={
                        f.status === "operational"
                          ? "green"
                          : f.status === "under_maintenance"
                          ? "amber"
                          : "red"
                      }
                      label={facilityStatusLabels[f.status]}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Live Visitor Gate Passes
              </h4>
              <div className="space-y-2">
                {visitorPasses.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs">{p.visitorName}</span>
                        <Badge tone="blue">{p.type}</Badge>
                      </div>
                      <p className="text-2xs text-muted-foreground">
                        Valid: {p.visitDate} · Pass #{p.id}
                      </p>
                    </div>
                    <Badge tone={p.status === "approved" || p.status === "entered" ? "green" : "amber"}>
                      {titleCase(p.status)}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* TAB 8: COMMUNITY & NOTICES */}
      {activeTab === "community" && (
        <Card className="p-6 space-y-5">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h3 className="text-base font-bold text-foreground">Community Moderation & Notice Broadcasts</h3>
              <p className="text-xs text-muted-foreground">
                Publish society circulars, moderate marketplace posts, and review active member polls.
              </p>
            </div>
            <Link href="/community">
              <Button size="sm">Community Feed &rarr;</Button>
            </Link>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Published Notices & Circulars
              </h4>
              <div className="space-y-2">
                {(liveNotices.length > 0 ? liveNotices : notices).map((n) => (
                  <div key={n.id} className="rounded-lg border p-3.5 space-y-1 bg-card">
                    <div className="flex items-center justify-between">
                      <Badge tone={n.priority === "urgent" || n.priority === "high" || n.type === "emergency" ? "red" : "blue"}>
                        {titleCase(n.priority || n.type || "Notice")}
                      </Badge>
                      <span className="text-2xs text-muted-foreground">{(n.publishedAt || n.createdAt || "").substring(0, 10)}</span>
                    </div>
                    <p className="text-xs font-bold text-foreground">{n.title}</p>
                    <p className="text-2xs text-muted-foreground line-clamp-2">{n.body || n.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Active Society Polls & Events
              </h4>
              <div className="space-y-2">
                {communityPolls.map((poll) => (
                  <div key={poll.id} className="rounded-lg border p-3.5 space-y-2 bg-card">
                    <p className="text-xs font-bold text-foreground">{poll.question}</p>
                    <div className="space-y-1 text-2xs">
                      {poll.options.map((opt) => (
                        <div key={opt.id} className="flex justify-between items-center text-muted-foreground">
                          <span>{opt.text}</span>
                          <span className="font-bold">{opt.votes} votes</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* TAB 9: AUDIT LOGS */}
      {activeTab === "audit" && (
        <Card className="p-6 space-y-5">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h3 className="text-base font-bold text-foreground">Immutable Society Audit Trail</h3>
              <p className="text-xs text-muted-foreground">
                Cryptographically verifiable event log of administrative approvals, rejections, and access changes.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => toast.success("Audit log exported as CSV")}>
              Export Audit CSV
            </Button>
          </div>

          <div className="space-y-2">
            {liveAuditLogs.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center bg-muted/10">
                <p className="text-sm font-semibold text-muted-foreground">No audit log entries recorded yet.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Administrative approvals, staff dispatches, and security actions will be recorded here live from Firestore.
                </p>
              </div>
            ) : (
              liveAuditLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border bg-muted/20 p-3 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge tone={log.action.includes("REJECT") || log.action.includes("BLOCK") ? "red" : "green"}>
                        {log.action}
                      </Badge>
                      <span className="font-mono text-2xs text-muted-foreground">[{log.id}]</span>
                    </div>
                    <p className="mt-1 text-muted-foreground">
                      Actor: <span className="font-semibold text-foreground">{log.actorUserId || log.actorRole || "Admin"}</span> · Target:{" "}
                      <span className="font-semibold text-foreground">{log.entityType ? `${log.entityType} #${log.entityId}` : (log.target || log.entityId || "Society Resource")}</span>
                    </p>
                  </div>
                  <span className="font-mono text-2xs text-muted-foreground shrink-0">{log.timestamp ? String(log.timestamp).replace("T", " ").substring(0, 19) : "Just now"}</span>
                </div>
              ))
            )}
          </div>
        </Card>
      )}

      {/* TAB 10: ROLES & PERMISSIONS */}
      {activeTab === "permissions" && (
        <Card className="p-6 space-y-5">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h3 className="text-base font-bold text-foreground">Platform Role Matrix & Access Boundaries</h3>
              <p className="text-xs text-muted-foreground">
                Strict multi-tenant privilege levels across society residents, workforce, and administration.
              </p>
            </div>
            <Badge tone="teal">9 Core Perspectives</Badge>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { role: "Society Admin", code: "society_admin", level: "Tier 1 Administration", desc: "Full society control, verifications, billing configuration, audit logs." },
              { role: "Society Manager", code: "society_manager", level: "Tier 2 Operations", desc: "Operational dispatch, complaint SLA triage, workforce scheduling." },
              { role: "Flat Owner", code: "flat_owner", level: "Tier 3 Property", desc: "Deed verified owner, household management, tenant verification, billing ledger." },
              { role: "Tenant", code: "tenant", level: "Tier 4 Resident", desc: "Active lease occupant, amenity bookings, visitor passes, stay complaints." },
              { role: "Resident Member", code: "resident", level: "Tier 4 Resident", desc: "Household occupant authorized by verified deed owner or primary tenant." },
              { role: "Maintenance Staff", code: "maintenance_staff", level: "Tier 5 Workforce", desc: "Assigned work orders, duty log, facility asset inspection telemetry." },
              { role: "Security Guard", code: "security_guard", level: "Tier 5 Gate Security", desc: "Visitor QR check-in/out, vehicle sticker verification, gate incident logs." },
              { role: "Service Provider", code: "service_provider", level: "Tier 6 Marketplace", desc: "Third-party contracted vendors, job cards, service rating tracking." },
              { role: "Super Admin", code: "super_admin", level: "Tier 0 Platform", desc: "Global multi-society root administrator and developer telemetry." }
            ].map((p) => (
              <div key={p.code} className="rounded-xl border p-4 space-y-2 bg-card">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm text-foreground">{p.role}</h4>
                  <Badge tone="slate">{p.code}</Badge>
                </div>
                <p className="text-2xs font-semibold text-primary">{p.level}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* TAB 11: SOCIETY CONFIGURATION */}
      {activeTab === "society" && (
        <Card className="p-6 space-y-5">
          <form onSubmit={handleSaveSocietyConfig} className="space-y-5">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h3 className="text-base font-bold text-foreground">Society Metadata & Bylaw Configuration</h3>
                <p className="text-xs text-muted-foreground">
                  Official RWA registration details, society addresses, and governance policies (persisted live to Firestore).
                </p>
              </div>
              <Button type="submit" size="sm" disabled={isSavingSociety}>
                {isSavingSociety ? "Saving..." : "Save Configuration"}
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Society Legal Entity Name</label>
                <input
                  type="text"
                  value={societyConfig.name}
                  onChange={(e) => setSocietyConfig((prev) => ({ ...prev, name: e.target.value }))}
                  className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/25"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">RWA Registration Number</label>
                <input
                  type="text"
                  value={societyConfig.rwaRegistrationNumber}
                  onChange={(e) => setSocietyConfig((prev) => ({ ...prev, rwaRegistrationNumber: e.target.value }))}
                  className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/25"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Society Physical Address</label>
                <input
                  type="text"
                  value={societyConfig.address}
                  onChange={(e) => setSocietyConfig((prev) => ({ ...prev, address: e.target.value }))}
                  className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/25"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Official Society Helpline Phone</label>
                <input
                  type="text"
                  value={societyConfig.helplinePhone}
                  onChange={(e) => setSocietyConfig((prev) => ({ ...prev, helplinePhone: e.target.value }))}
                  className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/25"
                  required
                />
              </div>
            </div>
          </form>
        </Card>
      )}

      {/* Dispatch modal */}
      {showDispatchModal && selectedComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rx-card-elevated overflow-hidden bg-card rounded-2xl border">
            <div className="border-b px-5 py-4">
              <h3 className="text-base font-bold">Dispatch Ticket to Staff</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Assign ticket <span className="font-semibold text-foreground">#{selectedComplaint.id}</span> to maintenance staff.
              </p>
            </div>

            <form onSubmit={handleDispatchSubmit} className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Select Staff Member</label>
                <select
                  value={assignedStaffId}
                  onChange={(e) => setAssignedStaffId(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/25"
                >
                  {staffUsers.length > 0 ? (
                    staffUsers.map((s) => {
                      const roleLabel = s.role === "security_guard" ? "Security Guard" : "Maintenance Staff";
                      const deptName = s.department ? (departmentLabels[s.department as StaffDepartment] || s.department) : (s.role === "security_guard" ? "Security" : "General Maintenance");
                      const spec = (s as any).specialization ? ` (${(s as any).specialization})` : "";
                      return (
                        <option key={s.uid} value={s.uid}>
                          {s.displayName || s.email} — {roleLabel} — {deptName}{spec}
                        </option>
                      );
                    })
                  ) : (
                    staff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} — {s.department ? departmentLabels[s.department] : "General"} ({s.availabilityStatus})
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <Button type="button" variant="ghost" onClick={() => setShowDispatchModal(false)}>
                  Cancel
                </Button>
                <Button type="submit">Dispatch Staff</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Applicant Modal */}
      {rejectModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rx-card-elevated overflow-hidden border border-red-200 dark:border-red-900/60 bg-card rounded-2xl shadow-2xl">
            <div className="border-b px-5 py-4 flex items-center justify-between bg-red-50/70 dark:bg-red-950/30">
              <div className="flex items-center gap-2">
                <ShieldAlert size={18} className="text-red-600 dark:text-red-400" />
                <h3 className="text-base font-bold text-red-950 dark:text-red-200">Reject Registration</h3>
              </div>
              <button
                type="button"
                onClick={() => setRejectModalUser(null)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRejectSubmit} className="p-5 space-y-4">
              <div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  You are rejecting the registration for{" "}
                  <span className="font-semibold text-foreground">
                    {rejectModalUser.displayName || rejectModalUser.email}
                  </span>
                  . A rejection reason is mandatory and will be displayed directly to the applicant on their mobile app.
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">Reason for Rejection *</label>
                <textarea
                  rows={4}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g., Household already has verified primary owner; please submit rent agreement proof."
                  className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-red-500/25 border-red-200 dark:border-red-900/40"
                  required
                />
                <p className="mt-1 text-2xs text-muted-foreground">
                  This reason will be recorded in the immutable audit log and shown upon user login.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <Button type="button" variant="ghost" size="sm" onClick={() => setRejectModalUser(null)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="danger"
                  size="sm"
                  disabled={actioningUserId === rejectModalUser.uid}
                >
                  {actioningUserId === rejectModalUser.uid ? "Rejecting..." : "Confirm Rejection"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* NOTICE BROADCAST COMPOSER MODAL */}
      {showNoticeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-card border shadow-2xl overflow-hidden">
            <div className="border-b px-5 py-4 flex items-center justify-between bg-primary/5">
              <div className="flex items-center gap-2">
                <Megaphone size={18} className="text-primary" />
                <h3 className="text-base font-bold text-foreground">Publish Society Notice Broadcast</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNoticeModal(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateNotice} className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-foreground">Notice Title *</label>
                <input
                  type="text"
                  required
                  value={noticeTitle}
                  onChange={(e) => setNoticeTitle(e.target.value)}
                  placeholder="e.g., Scheduled Generator Maintenance & Power Outage Notice"
                  className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/25"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">Priority Level</label>
                <select
                  value={noticePriority}
                  onChange={(e) => setNoticePriority(e.target.value as any)}
                  className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/25"
                >
                  <option value="low">Low (General Info)</option>
                  <option value="medium">Medium (Standard Circular)</option>
                  <option value="high">High (Action Required)</option>
                  <option value="urgent">Urgent / Emergency</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">Notice Content / Instructions *</label>
                <textarea
                  rows={4}
                  required
                  value={noticeBody}
                  onChange={(e) => setNoticeBody(e.target.value)}
                  placeholder="Detail the operational notice, effective timings, impacted towers, and resident guidelines..."
                  className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/25"
                />
                <p className="mt-1 text-2xs text-muted-foreground">
                  Published notice will instantly broadcast to all verified resident mobile apps and Firestore subscribers.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowNoticeModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isSubmittingNotice}>
                  {isSubmittingNotice ? "Broadcasting..." : "Publish Broadcast"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AnimatedSection>
  );
}
