"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  HelpCircle,
  Mail,
  Phone,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserX,
  UsersRound,
  Wrench,
  X
} from "lucide-react";
import { toast } from "sonner";
import type { PlatformRole, StaffDepartment, UserProfile } from "@resolvex/types";
import { departmentLabels, roleLabels } from "@resolvex/utils";
import { AppShell } from "@/components/app-shell";
import {
  AnimatedSection,
  Badge,
  Button,
  Card,
  SectionHeader,
  StatusDot
} from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import {
  approveUserRegistration,
  rejectUserRegistration,
  requestMoreInfoRegistration,
  subscribePendingRegistrations
} from "@/lib/services";

export default function AdminVerificationsPage() {
  const { userProfile } = useAuth();
  const societyId = userProfile?.societyId || "soc-ajanta-genx";
  const managerId = userProfile?.uid || "admin-user";

  const [pendingApplicants, setPendingApplicants] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);

  // Rejection modal state
  const [rejectUser, setRejectUser] = useState<UserProfile | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  // More info modal state
  const [moreInfoUser, setMoreInfoUser] = useState<UserProfile | null>(null);
  const [moreInfoNotes, setMoreInfoNotes] = useState("");

  // Filter state
  const [roleFilter, setRoleFilter] = useState<string>("all");

  useEffect(() => {
    setLoading(true);
    const unsub = subscribePendingRegistrations(societyId, (users) => {
      setPendingApplicants(users);
      setLoading(false);
    });
    return () => unsub();
  }, [societyId, userProfile?.uid]);

  const filteredApplicants = pendingApplicants.filter((applicant) => {
    if (roleFilter === "all") return true;
    return applicant.role === roleFilter;
  });

  useEffect(() => {
    console.log(`[VERIFICATION QUEUE] role=${roleFilter} pendingCount=${filteredApplicants.length}`);
  }, [roleFilter, filteredApplicants.length]);

  async function handleApprove(applicant: UserProfile) {
    if (!applicant.uid || !societyId) return;
    setActioningId(applicant.uid);
    try {
      await approveUserRegistration(applicant.uid, societyId, managerId);
      toast.success(
        `Applicant ${applicant.displayName || applicant.email} has been approved and granted access!`
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to approve applicant.");
    } finally {
      setActioningId(null);
    }
  }

  async function handleRejectSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rejectUser || !rejectUser.uid || !societyId) return;
    const reason = rejectionReason.trim();
    if (!reason) {
      toast.error("A rejection reason is mandatory.");
      return;
    }

    setActioningId(rejectUser.uid);
    try {
      await rejectUserRegistration(rejectUser.uid, societyId, managerId, reason);
      toast.success(`Registration for ${rejectUser.displayName || rejectUser.email} has been rejected.`);
      setRejectUser(null);
      setRejectionReason("");
    } catch (err: any) {
      toast.error(err.message || "Failed to reject applicant.");
    } finally {
      setActioningId(null);
    }
  }

  async function handleMoreInfoSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!moreInfoUser || !moreInfoUser.uid) return;
    const notes = moreInfoNotes.trim();
    if (!notes) {
      toast.error("Please describe what documentation or details are needed.");
      return;
    }

    setActioningId(moreInfoUser.uid);
    try {
      await requestMoreInfoRegistration(moreInfoUser.uid, notes);
      toast.success(`Request for more information sent to ${moreInfoUser.displayName || moreInfoUser.email}.`);
      setMoreInfoUser(null);
      setMoreInfoNotes("");
    } catch (err: any) {
      toast.error(err.message || "Failed to update applicant.");
    } finally {
      setActioningId(null);
    }
  }

  return (
    <AppShell mode="admin">
      <AnimatedSection className="space-y-6">
        {/* Navigation back and header */}
        <div className="flex items-center gap-2">
          <Link
            href="/admin"
            className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={14} />
            Back to Admin Center
          </Link>
        </div>

        <SectionHeader
          eyebrow="Security & Governance"
          title="Management Verification Console"
          description="Review pending household and staff registrations, verify identities against society records, and authorize system access."
          action={
            <div className="flex items-center gap-2">
              <Badge tone={pendingApplicants.length > 0 ? "amber" : "green"}>
                {pendingApplicants.length} Pending Approval
              </Badge>
            </div>
          }
        />

        {/* Filter bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3 shadow-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground mr-1">Filter Role:</span>
            {["all", "resident", "flat_owner", "tenant", "maintenance_staff", "security_guard"].map(
              (r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRoleFilter(r)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                    roleFilter === r
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {r === "all" ? "All Roles" : roleLabels[r as PlatformRole] || r}
                </button>
              )
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{filteredApplicants.length}</span> of{" "}
            {pendingApplicants.length} applications
          </p>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse rounded-xl border bg-card p-6 space-y-3">
                <div className="h-5 w-48 bg-muted rounded" />
                <div className="h-4 w-72 bg-muted/60 rounded" />
                <div className="h-8 w-full bg-muted/40 rounded" />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && filteredApplicants.length === 0 && (
          <Card className="flex flex-col items-center justify-center p-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 mb-4">
              <CheckCircle2 size={28} />
            </div>
            <h3 className="text-base font-bold text-foreground">No Pending Registrations</h3>
            <p className="mt-1.5 max-w-md text-xs text-muted-foreground">
              {roleFilter !== "all"
                ? `No pending registration requests found matching "${roleLabels[roleFilter as PlatformRole] || roleFilter}".`
                : "All resident, owner, tenant, and staff registration requests have been reviewed and approved or rejected."}
            </p>
            {roleFilter !== "all" && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => setRoleFilter("all")}
              >
                Clear Filter
              </Button>
            )}
          </Card>
        )}

        {/* Applicants List */}
        {!loading && filteredApplicants.length > 0 && (
          <div className="space-y-4">
            {filteredApplicants.map((applicant) => {
              const isActioning = actioningId === applicant.uid;
              const formattedDate = applicant.createdAt
                ? new Date(applicant.createdAt).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit"
                  })
                : "Unknown";

              const flatNumber =
                applicant.flatId?.replace("flat-", "").toUpperCase() || "Unspecified";
              const towerNumber =
                applicant.towerId?.replace("tower-", "").toUpperCase() || "Unspecified";

              return (
                <Card
                  key={applicant.uid}
                  className="p-5 transition-all hover:border-primary/40 space-y-4"
                >
                  {/* Card top */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-bold text-foreground">
                          {applicant.displayName || "Applicant"}
                        </span>
                        <Badge
                          tone={
                            applicant.role === "flat_owner"
                              ? "teal"
                              : applicant.role === "tenant"
                              ? "blue"
                              : applicant.role === "security_guard"
                              ? "amber"
                              : applicant.role === "maintenance_staff"
                              ? "coral"
                              : "slate"
                          }
                        >
                          {roleLabels[applicant.role] || applicant.role}
                        </Badge>
                        <Badge
                          tone={
                            applicant.status === "pending_verification"
                              ? "blue"
                              : "amber"
                          }
                        >
                          {applicant.status === "pending_verification"
                            ? "Info Requested"
                            : "Pending Verification"}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
                        <span className="flex items-center gap-1">
                          <Mail size={13} className="text-muted-foreground/70" />
                          {applicant.email}
                        </span>
                        {(applicant.phone || applicant.phoneNumber) && (
                          <span className="flex items-center gap-1">
                            <Phone size={13} className="text-muted-foreground/70" />
                            {applicant.phone || applicant.phoneNumber}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock size={13} className="text-muted-foreground/70" />
                          Applied: {formattedDate}
                        </span>
                      </div>
                    </div>

                    {/* Role-specific top right indicator */}
                    {applicant.role === "maintenance_staff" ? (
                      <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/70 dark:border-amber-900/40 dark:bg-amber-950/20 px-3 py-2 shrink-0">
                        <Wrench size={16} className="text-amber-600 dark:text-amber-400" />
                        <div className="text-right">
                          <p className="text-xs font-bold text-amber-950 dark:text-amber-200">
                            {applicant.specialization || (applicant.department ? (departmentLabels[applicant.department as StaffDepartment] || applicant.department) : "General Maintenance")}
                          </p>
                          <p className="text-2xs text-amber-700/80 dark:text-amber-400">
                            Dept: {applicant.department ? (departmentLabels[applicant.department as StaffDepartment] || applicant.department) : "General"}
                          </p>
                        </div>
                      </div>
                    ) : applicant.role === "security_guard" ? (
                      <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50/70 dark:border-blue-900/40 dark:bg-blue-950/20 px-3 py-2 shrink-0">
                        <Shield size={16} className="text-blue-600 dark:text-blue-400" />
                        <div className="text-right">
                          <p className="text-xs font-bold text-blue-950 dark:text-blue-200">
                            {applicant.gate || "Main Gate Desk"}
                          </p>
                          <p className="text-2xs text-blue-700/80 dark:text-blue-400">
                            {applicant.shift || "Gate Duty Shift"}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 shrink-0">
                        <Building2 size={16} className="text-primary" />
                        <div className="text-right">
                          <p className="text-xs font-bold text-foreground">
                            Flat {flatNumber}
                          </p>
                          <p className="text-2xs text-muted-foreground">Tower {towerNumber}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Verification Notes / Info callout */}
                  {applicant.verificationNotes && (
                    <div className="rounded-lg border border-purple-200/80 bg-purple-50/60 p-3 dark:border-purple-900/40 dark:bg-purple-950/20 text-xs">
                      <p className="font-semibold text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                        <HelpCircle size={14} />
                        Requested Information / Clarification:
                      </p>
                      <p className="mt-1 text-purple-800/90 dark:text-purple-300">
                        {applicant.verificationNotes}
                      </p>
                    </div>
                  )}

                  {/* Details grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-lg border bg-muted/20 p-3 text-xs">
                    <div>
                      <span className="text-muted-foreground block text-2xs uppercase tracking-wider">
                        Applicant UID
                      </span>
                      <span className="font-mono text-2xs truncate block mt-0.5">
                        {applicant.uid}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-2xs uppercase tracking-wider">
                        Society
                      </span>
                      <span className="font-semibold block mt-0.5 truncate">
                        {applicant.societyId || societyId}
                      </span>
                    </div>
                    {applicant.role === "maintenance_staff" ? (
                      <>
                        <div>
                          <span className="text-muted-foreground block text-2xs uppercase tracking-wider">
                            Specialization Trade
                          </span>
                          <span className="font-semibold text-amber-700 dark:text-amber-300 block mt-0.5 truncate">
                            {applicant.specialization || "General Maintenance"}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-2xs uppercase tracking-wider">
                            Department
                          </span>
                          <span className="font-semibold block mt-0.5 truncate">
                            {applicant.department ? (departmentLabels[applicant.department as StaffDepartment] || applicant.department) : "General Maintenance"}
                          </span>
                        </div>
                      </>
                    ) : applicant.role === "security_guard" ? (
                      <>
                        <div>
                          <span className="text-muted-foreground block text-2xs uppercase tracking-wider">
                            Assigned Gate / Post
                          </span>
                          <span className="font-semibold text-blue-700 dark:text-blue-300 block mt-0.5 truncate">
                            {applicant.gate || "Main Gate Desk"}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-2xs uppercase tracking-wider">
                            Duty Shift
                          </span>
                          <span className="font-semibold block mt-0.5 truncate">
                            {applicant.shift || "General Shift"}
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <span className="text-muted-foreground block text-2xs uppercase tracking-wider">
                            Household ID
                          </span>
                          <span className="font-semibold block mt-0.5 truncate">
                            {applicant.householdId || "Pending Assignment"}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-2xs uppercase tracking-wider">
                            Email Verified
                          </span>
                          <span className="font-semibold block mt-0.5">
                            {applicant.emailVerified ? "Yes (Verified)" : "No (Unverified)"}
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-1 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isActioning}
                      onClick={() => {
                        setMoreInfoUser(applicant);
                        setMoreInfoNotes("");
                      }}
                      className="text-xs"
                    >
                      <HelpCircle size={14} />
                      Request More Info
                    </Button>

                    <Button
                      variant="danger"
                      size="sm"
                      disabled={isActioning}
                      onClick={() => {
                        setRejectUser(applicant);
                        setRejectionReason("");
                      }}
                      className="text-xs"
                    >
                      <UserX size={14} />
                      Reject Applicant
                    </Button>

                    <Button
                      size="sm"
                      disabled={isActioning}
                      onClick={() => handleApprove(applicant)}
                      className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <UserCheck size={14} />
                      {isActioning ? "Approving..." : "Approve & Verify Access"}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* REJECT MODAL */}
        {rejectUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rx-card-elevated overflow-hidden border border-red-200 dark:border-red-900/60 bg-card rounded-2xl shadow-2xl">
              <div className="border-b px-5 py-4 flex items-center justify-between bg-red-50/70 dark:bg-red-950/30">
                <div className="flex items-center gap-2">
                  <ShieldAlert size={18} className="text-red-600 dark:text-red-400" />
                  <h3 className="text-base font-bold text-red-950 dark:text-red-200">
                    Reject Registration
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setRejectUser(null)}
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
                      {rejectUser.displayName || rejectUser.email}
                    </span>{" "}
                    for flat {rejectUser.flatId?.replace("flat-", "").toUpperCase()}. A rejection
                    reason is mandatory and will be displayed directly to the applicant on their mobile app.
                  </p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground">
                    Reason for Rejection *
                  </label>
                  <textarea
                    rows={4}
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="e.g., Household already has verified primary owner; please submit rent agreement proof; or name does not match society maintenance ledger."
                    className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-red-500/25 border-red-200 dark:border-red-900/40"
                    required
                  />
                  <p className="mt-1 text-2xs text-muted-foreground">
                    This reason will be recorded in the immutable audit log and shown to the user upon login.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setRejectUser(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="danger"
                    size="sm"
                    disabled={actioningId === rejectUser.uid}
                  >
                    {actioningId === rejectUser.uid ? "Rejecting..." : "Confirm Rejection"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MORE INFO MODAL */}
        {moreInfoUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rx-card-elevated overflow-hidden border bg-card rounded-2xl shadow-2xl">
              <div className="border-b px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HelpCircle size={18} className="text-purple-600 dark:text-purple-400" />
                  <h3 className="text-base font-bold text-foreground">Request More Information</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setMoreInfoUser(null)}
                  className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleMoreInfoSubmit} className="p-5 space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Specify what additional documentation or verification details{" "}
                    <span className="font-semibold text-foreground">
                      {moreInfoUser.displayName || moreInfoUser.email}
                    </span>{" "}
                    must provide before their registration can be approved.
                  </p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground">
                    Information Required *
                  </label>
                  <textarea
                    rows={4}
                    value={moreInfoNotes}
                    onChange={(e) => setMoreInfoNotes(e.target.value)}
                    placeholder="e.g., Please upload signed rental agreement or electricity bill copy via the resident portal."
                    className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-purple-500/25"
                    required
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setMoreInfoUser(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={actioningId === moreInfoUser.uid}
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    {actioningId === moreInfoUser.uid ? "Submitting..." : "Send Request"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </AnimatedSection>
    </AppShell>
  );
}
