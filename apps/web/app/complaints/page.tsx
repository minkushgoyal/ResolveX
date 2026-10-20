"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Eye,
  FileImage,
  MapPin,
  Mic,
  Plus,
  RotateCcw,
  Sparkles,
  ThumbsUp,
  Timer,
  TriangleAlert,
  Upload,
  UserCheck,
  Wrench,
  X
} from "lucide-react";
import { toast } from "sonner";
import {
  classifyComplaint,
  commonLocations,
  complaintUpdates as initialUpdates,
  complaints as initialComplaints,
  departmentLabels,
  getRecommendedStaff,
  getTechnicianAssignmentRecommendation,
  householdRoleLabels,
  residents,
  roleLabels,
  staff
} from "@resolvex/utils";
import type { Complaint, ComplaintStatus, StaffDepartment } from "@resolvex/types";
import { AppShell } from "@/components/app-shell";
import { AlertBanner, AnimatedSection, Badge, Button, Card, SectionHeader, StatusDot } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import { useSessionStore } from "@/lib/store";
import {
  assignStaff as serviceAssignStaff,
  confirmResolution as serviceConfirmResolution,
  createComplaint as serviceCreateComplaint,
  reopenComplaint as serviceReopenComplaint,
  subscribeComplaints,
  subscribeSocietyUsers,
  updateWorkProgress as serviceUpdateWorkProgress,
  uploadFile
} from "@/lib/services";
import { cn } from "@resolvex/ui";

type TabId = "raise" | "my_complaints";

const STATUS_CONFIG: Record<
  ComplaintStatus,
  { label: string; dot: "green" | "amber" | "red" | "slate"; description: string; next: string }
> = {
  open: {
    label: "Submitted",
    dot: "slate",
    description: "Complaint received",
    next: "Management will review and route to the appropriate department."
  },
  under_review: {
    label: "Under Review",
    dot: "amber",
    description: "Management is reviewing",
    next: "A technician will be assigned once routing is confirmed."
  },
  assigned: {
    label: "Assigned",
    dot: "amber",
    description: "Technician assigned",
    next: "The assigned technician will schedule and begin work."
  },
  in_progress: {
    label: "In Progress",
    dot: "amber",
    description: "Work underway",
    next: "You will be notified when the technician marks this as complete."
  },
  resident_confirmation: {
    label: "Awaiting Confirmation",
    dot: "amber",
    description: "Pending your verification",
    next: "Please confirm whether the issue has been fully resolved."
  },
  work_completed: {
    label: "Work Completed",
    dot: "amber",
    description: "Technician marked work completed",
    next: "Awaiting resident inspection and sign-off."
  },
  resolved: {
    label: "Resolved",
    dot: "green",
    description: "Confirmed & closed",
    next: "This complaint has been resolved and closed."
  },
  closed: {
    label: "Resolved & Closed",
    dot: "green",
    description: "Confirmed & closed",
    next: "This complaint has been verified and permanently closed."
  },
  reopened: {
    label: "Reopened",
    dot: "red",
    description: "Reopened by resident",
    next: "Technician and department lead notified for re-inspection."
  }
};

export default function ComplaintsPage() {
  const { activeRole } = useSessionStore();

  if (activeRole === "maintenance_staff") {
    return <StaffWorkOrdersView />;
  }

  if (activeRole === "society_manager" || activeRole === "society_admin" || activeRole === "super_admin") {
    return <ManagementComplaintsView />;
  }

  return <ResidentComplaintsView />;
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. MAINTENANCE STAFF WORK ORDERS VIEW
// ═════════════════════════════════════════════════════════════════════════════
function StaffWorkOrdersView() {
  const { user, userProfile } = useAuth();
  const [complaintList, setComplaintList] = useState<Complaint[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | "in_progress" | "resident_confirmation" | "resolved">("all");
  const [selectedTicket, setSelectedTicket] = useState<Complaint | null>(null);
  const [workNotes, setWorkNotes] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const societyId = userProfile?.societyId || "soc-ajanta-genx";
    const unsub = subscribeComplaints({ societyId }, (list) => {
      // Show assigned work orders or department relevant
      const forTech = list.filter(
        (c) => c.assignedStaffId === userProfile?.uid || c.assignedStaffId === "staff-deepak" || !c.assignedStaffId
      );
      setComplaintList(forTech.length > 0 ? forTech : list);
    });
    return () => unsub();
  }, [userProfile?.uid, userProfile?.societyId]);

  const filteredTickets = complaintList.filter((c) => {
    if (statusFilter === "in_progress") return c.status === "in_progress";
    if (statusFilter === "resident_confirmation") return c.status === "resident_confirmation" || c.status === "work_completed";
    if (statusFilter === "resolved") return c.status === "resolved" || c.status === "closed";
    return true;
  });

  async function handleStartWork(id: string) {
    await serviceUpdateWorkProgress(id, {
      status: "in_progress",
      actorUserId: userProfile?.uid || "staff-deepak",
      societyIdOverride: userProfile?.societyId || "soc-ajanta-genx"
    });
    toast.success("Job status updated to In Progress in Firestore.");
  }

  async function handleProofUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const societyId = userProfile?.societyId || "soc-ajanta-genx";
      const complaintId = selectedTicket?.id || "general";
      const res = await uploadFile(`societies/${societyId}/complaint-proofs/${complaintId}`, file);
      setPhotoUrl(res.url);
      toast.success("Resolution proof uploaded.");
    } catch (err: any) {
      toast.error(err.message || "Could not upload photo proof.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleCompleteWork() {
    if (!selectedTicket) return;
    if (!workNotes.trim()) {
      toast.error("Please enter technician completion notes.");
      return;
    }
    await serviceUpdateWorkProgress(selectedTicket.id, {
      status: "resident_confirmation",
      notes: workNotes.trim(),
      proofUrl: photoUrl || undefined,
      actorUserId: userProfile?.uid || "staff-deepak",
      societyIdOverride: userProfile?.societyId || "soc-ajanta-genx"
    });

    setSelectedTicket(null);
    setWorkNotes("");
    setPhotoUrl(null);
    toast.success("Work completed. Moved to Resident Verification.");
  }

  return (
    <AppShell>
      <AnimatedSection className="space-y-6">
        <SectionHeader
          eyebrow="Technician Dispatch & Work Orders"
          title={`Work Orders — ${userProfile?.displayName || user?.displayName || "Technician"}`}
          description="Manage assigned tickets, submit before/after photographic proof, and hand over completed work for resident verification."
        />

        {/* Filter Pills */}
        <div className="flex flex-wrap gap-2">
          {[
            { id: "all", label: `All Work Orders (${complaintList.length})` },
            { id: "in_progress", label: "In Progress" },
            { id: "resident_confirmation", label: "Awaiting Resident Verification" },
            { id: "resolved", label: "Resolved / Closed" }
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatusFilter(f.id as typeof statusFilter)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-semibold rx-transition",
                statusFilter === f.id
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-card border text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Work Order Cards List */}
        <div className="space-y-4">
          {filteredTickets.map((ticket) => (
            <Card key={ticket.id} className="p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge tone={ticket.priority === "emergency" ? "red" : ticket.priority === "high" ? "amber" : "blue"}>
                      {ticket.priority.toUpperCase()}
                    </Badge>
                    <span className="text-xs font-mono text-muted-foreground">#{ticket.id}</span>
                  </div>
                  <h3 className="text-base font-bold text-foreground mt-1">{ticket.title}</h3>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <MapPin size={13} />
                    {ticket.location} · {ticket.category.toUpperCase()}
                  </p>
                </div>
                <Badge tone={ticket.status === "resident_confirmation" ? "amber" : ticket.status === "resolved" ? "green" : "blue"}>
                  {ticket.status.replace("_", " ").toUpperCase()}
                </Badge>
              </div>

              <p className="text-sm text-muted-foreground leading-relaxed">{ticket.description}</p>

              {ticket.resolutionNote && (
                <div className="rounded-lg border bg-muted/20 p-3 text-xs">
                  <span className="font-semibold text-muted-foreground">Logged Technician Note:</span>
                  <p className="text-foreground mt-0.5">{ticket.resolutionNote}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t">
                <span className="text-xs text-muted-foreground">
                  Logged: {ticket.createdAt.split("T")[0]}
                </span>
                <div className="flex items-center gap-2">
                  {ticket.status === "open" || ticket.status === "assigned" ? (
                    <Button size="sm" onClick={() => handleStartWork(ticket.id)}>
                      <Wrench size={14} className="mr-1.5" />
                      Start Work
                    </Button>
                  ) : null}

                  {ticket.status === "in_progress" ? (
                    <Button size="sm" onClick={() => setSelectedTicket(ticket)}>
                      <CheckCircle2 size={14} className="mr-1.5" />
                      Submit Work & Verification Proof
                    </Button>
                  ) : null}

                  {ticket.status === "resident_confirmation" ? (
                    <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                      <Clock size={13} />
                      Awaiting Resident Verification
                    </span>
                  ) : null}

                  {ticket.status === "resolved" ? (
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                      <Check size={13} />
                      Verified by Resident · Closed
                    </span>
                  ) : null}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </AnimatedSection>

      {/* Completion & Proof Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border bg-card p-5 shadow-soft space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-base">Complete Job #{selectedTicket.id}</h3>
                <p className="text-xs text-muted-foreground">{selectedTicket.title}</p>
              </div>
              <button onClick={() => setSelectedTicket(null)} className="rounded p-1 hover:bg-muted">
                <X size={18} />
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-muted-foreground block mb-1">
                Technician Completion Notes
              </label>
              <textarea
                rows={3}
                required
                value={workNotes}
                onChange={(e) => setWorkNotes(e.target.value)}
                placeholder="Detail the work carried out, parts replaced, and sensor/pressure readings verified..."
                className="w-full rounded-lg border bg-background p-3 text-sm outline-none resize-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-muted-foreground block mb-1">
                Photographic Completion Proof
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleProofUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="w-full rounded-lg border border-dashed p-4 text-center text-xs font-medium hover:bg-muted/30 rx-transition"
              >
                {isUploading ? (
                  <span className="text-primary font-bold">Uploading proof…</span>
                ) : photoUrl ? (
                  <span className="text-emerald-600 font-bold flex items-center justify-center gap-1.5">
                    <CheckCircle2 size={16} />
                    Proof Attached (Click to change photo)
                  </span>
                ) : (
                  <span className="text-muted-foreground flex items-center justify-center gap-1.5">
                    <Camera size={16} />
                    Click to select camera photo proof of repaired asset
                  </span>
                )}
              </button>
            </div>

            <div className="rounded-lg border bg-amber-500/10 text-amber-900 dark:text-amber-300 p-3 text-xs">
              Important: Marking work complete notifies the resident to review your proof and confirm closure.
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" size="sm" onClick={() => setSelectedTicket(null)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleCompleteWork}>
                Submit for Resident Verification
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. MANAGEMENT COMPLAINTS & DISPATCH VIEW
// ═════════════════════════════════════════════════════════════════════════════
function ManagementComplaintsView() {
  const { userProfile } = useAuth();
  const societyId = userProfile?.societyId || "soc-ajanta-genx";
  const [complaintList, setComplaintList] = useState<Complaint[]>([]);
  const [filter, setFilter] = useState<"all" | "unassigned" | "escalated" | "awaiting">("all");
  const [societyStaff, setSocietyStaff] = useState<any[]>([]);

  useEffect(() => {
    const unsubComplaints = subscribeComplaints({ societyId }, setComplaintList);
    const unsubStaff = subscribeSocietyUsers(societyId, (users) => {
      const staffMembers = users.filter((u) =>
        ["maintenance_staff", "security_guard", "technician", "facility_manager", "society_manager", "society_admin"].includes(u.role)
      );
      setSocietyStaff(staffMembers.length > 0 ? staffMembers : staff);
    });
    return () => {
      unsubComplaints();
      unsubStaff();
    };
  }, [societyId, userProfile?.uid]);

  async function handleAssignStaff(complaintId: string, staffId: string) {
    const assigned = societyStaff.find((s) => (s.uid || s.id) === staffId) || staff.find((s) => s.id === staffId);
    const name = assigned?.displayName || assigned?.name || "Technician";
    const dept = assigned?.department || (assigned?.role === "security_guard" ? "security" : "general_maintenance");
    await serviceAssignStaff(
      complaintId,
      staffId,
      name,
      dept,
      userProfile?.uid || "user-manager",
      societyId
    );
    toast.success(`Assigned to ${name}`);
  }

  async function handleFastTrack(id: string) {
    await serviceUpdateWorkProgress(id, {
      status: "in_progress",
      notes: "Fast-tracked by management due to urgent SLA threshold.",
      actorUserId: userProfile?.uid || "user-manager",
      societyIdOverride: societyId
    });
    toast.success("Fast-tracked ticket to In Progress.");
  }

  const unassignedCount = complaintList.filter((c) => !c.assignedStaffId && c.status === "open").length;
  const resolvedCount = complaintList.filter((c) => c.status === "resolved" || c.status === "closed").length;
  const resolutionRate = complaintList.length > 0 ? Math.round((resolvedCount / complaintList.length) * 100) : 100;

  const filteredTickets = complaintList.filter((c) => {
    if (filter === "unassigned") return !c.assignedStaffId;
    if (filter === "escalated") return c.priority === "emergency" || c.priority === "high";
    if (filter === "awaiting") return c.status === "resident_confirmation" || c.status === "work_completed";
    return true;
  });

  return (
    <AppShell mode="admin">
      <AnimatedSection className="space-y-6">
        <SectionHeader
          eyebrow="Operations Management Console"
          title="Society Complaints & Work Orders"
          description="Triage incoming issues, route work orders to specialized technicians, and monitor resolution SLA compliance."
        />

        {/* Action strip */}
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="p-4 border-l-4 border-l-amber-500">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Unassigned Tickets</p>
            <p className="text-2xl font-black text-foreground mt-1">{unassignedCount}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Require department dispatch</p>
          </Card>
          <Card className="p-4 border-l-4 border-l-danger">
            <p className="text-xs font-semibold text-muted-foreground uppercase">High / SLA At Risk</p>
            <p className="text-2xl font-black text-foreground mt-1">
              {complaintList.filter((c) => c.priority === "high" || c.priority === "emergency").length}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Under 24h breach warning</p>
          </Card>
          <Card className="p-4 border-l-4 border-l-emerald-500">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Resolution Rate</p>
            <p className="text-2xl font-black text-foreground mt-1">{resolutionRate}%</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Verified without reopening</p>
          </Card>
        </div>

        {/* Filter Pills */}
        <div className="flex gap-2">
          {[
            { id: "all", label: `All Tickets (${complaintList.length})` },
            { id: "unassigned", label: `Unassigned (${unassignedCount})` },
            { id: "escalated", label: "High / Emergency" },
            { id: "awaiting", label: "Awaiting Verification" }
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id as typeof filter)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-semibold rx-transition",
                filter === f.id
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-card border text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Table / Card List */}
        <div className="space-y-3">
          {filteredTickets.map((ticket) => {
            const assigned = societyStaff.find((s) => (s.uid || s.id) === ticket.assignedStaffId) || staff.find((s) => s.id === ticket.assignedStaffId);
            const assignedName = assigned?.displayName || assigned?.name;
            const assignedDept = assigned?.department || assigned?.role;
            return (
              <Card key={ticket.id} className="p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge tone={ticket.priority === "emergency" ? "red" : ticket.priority === "high" ? "amber" : "blue"}>
                        {ticket.priority.toUpperCase()}
                      </Badge>
                      <span className="text-xs font-mono text-muted-foreground">#{ticket.id}</span>
                      <span className="text-xs text-muted-foreground">· {ticket.location}</span>
                    </div>
                    <h3 className="text-base font-bold text-foreground mt-1">{ticket.title}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">{ticket.description}</p>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    <Badge tone={STATUS_CONFIG[ticket.status].dot}>
                      {STATUS_CONFIG[ticket.status].label}
                    </Badge>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 mt-3 border-t text-xs">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span>Assigned:</span>
                    {assignedName ? (
                      <span className="font-semibold text-foreground">
                        {assignedName} ({departmentLabels[assignedDept as StaffDepartment] || assignedDept})
                      </span>
                    ) : (
                      <span className="text-amber-600 font-semibold bg-amber-500/10 px-2 py-0.5 rounded">
                        Unassigned
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {!ticket.assignedStaffId && (
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value) handleAssignStaff(ticket.id, e.target.value);
                        }}
                        className="rounded-lg border bg-background px-2.5 py-1 text-xs font-medium outline-none focus:border-primary"
                      >
                        <option value="" disabled>
                          Assign Technician…
                        </option>
                        {societyStaff.map((s) => {
                          const id = s.uid || s.id;
                          const name = s.displayName || s.name;
                          const roleLabel = s.role === "security_guard" ? "Security Guard" : "Maintenance Staff";
                          const spec = s.specialization ? ` (${s.specialization})` : "";
                          const dept = s.department ? (departmentLabels[s.department as StaffDepartment] || s.department) : (s.role === "security_guard" ? "Security" : "General Maintenance");
                          const workload = complaintList.filter((c) => c.assignedStaffId === id && c.status !== "resolved" && c.status !== "closed").length;
                          return (
                            <option key={id} value={id}>
                              {name} — {roleLabel} — {dept}{spec} ({workload} active)
                            </option>
                          );
                        })}
                      </select>
                    )}

                    {ticket.priority === "emergency" && ticket.status !== "in_progress" && (
                      <Button size="sm" variant="secondary" onClick={() => handleFastTrack(ticket.id)}>
                        Fast-Track
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </AnimatedSection>
    </AppShell>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. RESIDENT COMPLAINTS VIEW
// ═════════════════════════════════════════════════════════════════════════════
function ResidentComplaintsView() {
  const { user, userProfile } = useAuth();
  const [complaintList, setComplaintList] = useState<Complaint[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>("raise");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "awaiting" | "resolved">("all");
  const [selectedProofComplaint, setSelectedProofComplaint] = useState<Complaint | null>(null);
  const [reopeningComplaint, setReopeningComplaint] = useState<Complaint | null>(null);
  const [reopenFeedback, setReopenFeedback] = useState("");

  const [locationType, setLocationType] = useState<"flat" | "common_area">("flat");
  const [locationSource, setLocationSource] = useState<"gps" | "manual" | "unavailable">("manual");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [specificLocation, setSpecificLocation] = useState("");
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [attachedPhotoUrl, setAttachedPhotoUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedTicket, setSubmittedTicket] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentSocietyId = userProfile?.societyId || "soc-ajanta-genx";
  const currentHouseholdId = userProfile?.householdId || "hh-a-1204";

  useEffect(() => {
    const unsub = subscribeComplaints(
      { societyId: currentSocietyId, householdId: currentHouseholdId },
      setComplaintList
    );
    return () => unsub();
  }, [currentSocietyId, currentHouseholdId]);

  const classification = description.length >= 10 ? classifyComplaint(description) : null;
  const staffRecommendation = classification
    ? getTechnicianAssignmentRecommendation(classification.category, staff, { priority: classification.priority })
    : null;
  const suggestedStaff = staffRecommendation?.recommendedStaff ?? null;

  const myComplaints = complaintList.filter(
    (c) => c.householdId === currentHouseholdId
  );

  const filteredComplaints = myComplaints.filter((c) => {
    if (statusFilter === "active") {
      return ["open", "under_review", "assigned", "in_progress", "reopened"].includes(c.status);
    }
    if (statusFilter === "awaiting") {
      return ["resident_confirmation", "work_completed"].includes(c.status);
    }
    if (statusFilter === "resolved") {
      return ["resolved", "closed"].includes(c.status);
    }
    return true;
  });

  function handleFetchGPS() {
    if (typeof navigator !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setLocationSource("gps");
          toast.success(`GPS Coordinates Attached: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
        },
        (err) => {
          setGpsCoords(null);
          setLocationSource("unavailable");
          toast.error("Location permission denied or unavailable. Please specify your location manually.");
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      setGpsCoords(null);
      setLocationSource("unavailable");
      toast.error("Geolocation is not supported by your browser. Please specify your location manually.");
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const res = await uploadFile(`societies/${currentSocietyId}/complaints/draft`, file);
      setAttachedPhotoUrl(res.url);
      toast.success("Image evidence attached.");
    } catch (err: any) {
      toast.error(err.message || "Could not upload photo.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim() || description.trim().length < 20) {
      toast.error("Please describe the issue in at least 20 characters.");
      return;
    }

    setIsSubmitting(true);
    try {
      const unitLabel = userProfile?.towerId && userProfile?.flatId
        ? `${userProfile.towerId.replace("tower-", "Tower ").toUpperCase()}, Flat ${userProfile.flatId.replace(/^flat-[^-]+-/, "")}`
        : "My Flat";

      const resolvedLocationLabel = locationType === "flat"
        ? unitLabel
        : [selectedLocation, specificLocation.trim()].filter(Boolean).join(" · ") || "Common Area";

      const complaintPayload: any = {
        societyId: currentSocietyId,
        householdId: currentHouseholdId,
        flatId: userProfile?.flatId || "",
        towerId: userProfile?.towerId || "",
        createdByUserId: userProfile?.uid || user?.uid || "",
        reportedBy: userProfile?.uid || user?.uid || "",
        reportedByName: userProfile?.displayName || user?.displayName || user?.email?.split("@")[0] || "Resident",
        title: description.length > 50 ? `${description.slice(0, 50).trim()}…` : description.trim(),
        description: description.trim(),
        category: (category || classification?.category || "other") as any,
        priority: classification?.priority ?? "medium",
        status: "open",
        locationType,
        locationSource,
        location: resolvedLocationLabel,
        locationLabel: resolvedLocationLabel,
        structuredLocation: {
          locationType,
          societyId: currentSocietyId,
          towerId: userProfile?.towerId || "tower-a",
          flatId: locationType === "flat" ? (userProfile?.flatId || "") : undefined,
          householdId: locationType === "flat" ? currentHouseholdId : undefined,
          roomOrArea: locationType === "flat" ? "Inside Flat" : undefined,
          commonArea: locationType === "common_area" ? (selectedLocation || "Common Area") : undefined,
          exactLocation: specificLocation.trim() || undefined,
          description: description.trim()
        },
        attachments: attachedPhotoUrl
          ? [{ id: `att-${Date.now()}`, type: "image", url: attachedPhotoUrl, name: "evidence.jpg" }]
          : []
      };

      if (gpsCoords && typeof gpsCoords.lat === "number" && typeof gpsCoords.lng === "number") {
        complaintPayload.latitude = gpsCoords.lat;
        complaintPayload.longitude = gpsCoords.lng;
        complaintPayload.gpsLocation = {
          latitude: gpsCoords.lat,
          longitude: gpsCoords.lng,
          accuracy: 10,
          capturedAt: new Date().toISOString(),
          captureMethod: "gps"
        };
      }

      const newTicket = await serviceCreateComplaint(complaintPayload);

      setSubmittedTicket(newTicket.id);
      setDescription("");
      setCategory("");
      setAttachedPhotoUrl(null);
      setSpecificLocation("");
      setLocationSource("manual");
      setGpsCoords(null);
      toast.success(`Complaint #${newTicket.id} registered in Firestore.`);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to create complaint.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleConfirmResolution(id: string) {
    try {
      await serviceConfirmResolution(id, userProfile?.uid || user?.uid || "", currentSocietyId);
      toast.success("Resolution confirmed. Ticket closed.");
      setSelectedProofComplaint(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to confirm resolution.");
    }
  }

  async function handleReopenSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reopeningComplaint) return;
    if (!reopenFeedback.trim()) {
      toast.error("A specific reason is required to reopen an issue.");
      return;
    }

    try {
      await serviceReopenComplaint(reopeningComplaint.id, reopenFeedback.trim(), userProfile?.uid || user?.uid || "", currentSocietyId);
      toast.info(`Ticket #${reopeningComplaint.id} reopened. Department alerted.`);
      setReopeningComplaint(null);
      setReopenFeedback("");
    } catch (err: any) {
      toast.error(err.message || "Failed to reopen complaint.");
    }
  }

  return (
    <AppShell>
      <AnimatedSection className="space-y-5">
        <SectionHeader
          eyebrow="Location-Aware Complaints"
          title="Complaint & Issue Center"
          description="Report flat issues or specify common-area locations with optional GPS for operational routing."
          action={
            <div className="flex gap-2">
              <Button
                variant={activeTab === "raise" ? "primary" : "outline"}
                onClick={() => setActiveTab("raise")}
              >
                <Plus size={15} />
                Raise Issue
              </Button>
              <Button
                variant={activeTab === "my_complaints" ? "primary" : "outline"}
                onClick={() => setActiveTab("my_complaints")}
              >
                My Complaints ({myComplaints.length})
              </Button>
            </div>
          }
        />

        {submittedTicket && activeTab === "raise" && (
          <AlertBanner
            tone="success"
            title={`Ticket #${submittedTicket} created and routed for management review.`}
            description="You will receive a notification when a technician is assigned. You can track progress in My Complaints."
            action={
              <Button size="sm" variant="secondary" onClick={() => { setActiveTab("my_complaints"); setSubmittedTicket(null); }}>
                View complaint →
              </Button>
            }
            onDismiss={() => setSubmittedTicket(null)}
          />
        )}

        {activeTab === "raise" && (
          <div className="grid gap-5 xl:grid-cols-[1fr_280px]">
            <Card className="p-5">
              <form onSubmit={handleSubmit} className="space-y-4">
                <h3 className="text-base font-bold">Raise New Issue</h3>

                <div>
                  <label className="form-label">Location Type</label>
                  <div className="flex rounded-lg border overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setLocationType("flat")}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rx-transition",
                        locationType === "flat" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"
                      )}
                    >
                      <MapPin size={14} /> Inside My Flat
                    </button>
                    <button
                      type="button"
                      onClick={() => setLocationType("common_area")}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rx-transition border-l",
                        locationType === "common_area" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"
                      )}
                    >
                      <MapPin size={14} /> Outside / Common Area
                    </button>
                  </div>
                </div>

                {locationType === "flat" ? (
                  <div className="flex items-center justify-between rounded-lg border bg-muted/20 p-3 text-xs">
                    <div className="flex items-center gap-2 text-foreground">
                      <MapPin size={14} className="text-primary" />
                      <span>
                        {userProfile?.flatId
                          ? `Flat ${userProfile.flatId.replace("flat-", "").toUpperCase()}${userProfile?.towerId ? ` · Tower ${userProfile.towerId.replace("tower-", "").toUpperCase()}` : ""}`
                          : "My Verified Flat"}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleFetchGPS}
                      className="text-primary font-bold hover:underline flex items-center gap-1"
                    >
                      {gpsCoords ? "✓ GPS Attached" : "+ Attach GPS"}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground block mb-1">
                        Common Area Zone / Facility *
                      </label>
                      <select
                        value={selectedLocation}
                        onChange={(e) => setSelectedLocation(e.target.value)}
                        className="w-full rounded-lg border bg-background p-2.5 text-sm outline-none focus:border-primary"
                        required
                      >
                        <option value="">Select Common Area Location…</option>
                        <option value="Clubhouse">Clubhouse</option>
                        <option value="Gymnasium">Gymnasium</option>
                        <option value="Swimming Pool">Swimming Pool</option>
                        <option value="Main Gate / Security">Main Gate / Security Post</option>
                        <option value="Basement Parking B1">Basement Parking B1</option>
                        <option value="Basement Parking B2">Basement Parking B2</option>
                        <option value="Podium Garden & Play Area">Podium Garden & Children's Play Area</option>
                        <option value="Tower Lift Lobby">Tower Lift Lobby</option>
                        <option value="Terrace & Water Tanks">Terrace & Overhead Water Tanks</option>
                        <option value="Society Perimeter">Society Perimeter / Boundary</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-muted-foreground block mb-1">
                        Specific Location Details (Optional)
                      </label>
                      <input
                        type="text"
                        value={specificLocation}
                        onChange={(e) => setSpecificLocation(e.target.value)}
                        placeholder="e.g. Near Lift 2, Basement Pillar 34, Staircase 3"
                        className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-lg border bg-muted/20 p-2.5 text-xs">
                      <span className="text-muted-foreground">Attach Real GPS Location:</span>
                      <button
                        type="button"
                        onClick={handleFetchGPS}
                        className="text-primary font-bold hover:underline flex items-center gap-1"
                      >
                        {gpsCoords ? "✓ GPS Attached" : "+ Capture GPS"}
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <label className="form-label">Describe the Issue</label>
                  <textarea
                    rows={4}
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe what needs repair in detail (e.g. Master bathroom washbasin pipe leaking water continuously since morning)..."
                    className="w-full rounded-lg border bg-background p-3 text-sm outline-none resize-none"
                  />
                </div>

                {/* Evidence Photo Upload */}
                <div>
                  <label className="form-label">Attach Photo Evidence (Optional)</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="gap-1.5"
                    >
                      <Upload size={14} />
                      {isUploading ? "Uploading…" : attachedPhotoUrl ? "Change Photo" : "Upload Photo"}
                    </Button>
                    {attachedPhotoUrl && (
                      <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                        <CheckCircle2 size={14} /> Photo Attached
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button type="submit" disabled={isSubmitting || description.trim().length < 20}>
                    {isSubmitting ? "Submitting to Firestore…" : "Submit Complaint"}
                  </Button>
                </div>
              </form>
            </Card>

            {/* AI Assistant Sidebar */}
            <div className="space-y-4">
              <Card className="p-4 space-y-3 border-l-4 border-l-primary">
                <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                  <Sparkles size={14} />
                  <span>Rule-Based Issue Triage</span>
                </div>
                {classification ? (
                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Department:</span>
                      <p className="font-bold text-foreground capitalize">{classification.category}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Priority:</span>
                      <p className="font-bold text-foreground capitalize">{classification.priority}</p>
                    </div>
                    {suggestedStaff && (
                      <div>
                        <span className="text-muted-foreground">Eligible Technician:</span>
                        <p className="font-bold text-foreground">{suggestedStaff.name}</p>
                        {staffRecommendation?.workloadWarning && (
                          <p className="text-[11px] text-amber-500 font-medium mt-0.5">
                            {staffRecommendation.workloadWarning}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Type a description of your issue to see automated triage suggestions.
                  </p>
                )}
              </Card>
            </div>
          </div>
        )}

        {activeTab === "my_complaints" && (
          <div className="space-y-4">
            <div className="flex gap-2">
              {(["all", "active", "awaiting", "resolved"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold rx-transition capitalize",
                    statusFilter === s ? "bg-primary text-primary-foreground" : "bg-card border text-muted-foreground hover:bg-muted"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              {filteredComplaints.map((item) => (
                <Card key={item.id} className="p-5 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge tone={STATUS_CONFIG[item.status].dot}>{STATUS_CONFIG[item.status].label}</Badge>
                        <span className="text-xs font-mono text-muted-foreground">#{item.id}</span>
                      </div>
                      <h4 className="font-bold text-base text-foreground mt-1">{item.title}</h4>
                      <p className="text-xs text-muted-foreground">{item.location} · {item.category}</p>
                    </div>

                    {item.status === "resident_confirmation" && (
                      <Button size="sm" onClick={() => setSelectedProofComplaint(item)}>
                        <Eye size={14} className="mr-1.5" />
                        Review Proof & Confirm
                      </Button>
                    )}
                  </div>

                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </Card>
              ))}
            </div>
          </div>
        )}
      </AnimatedSection>

      {/* Proof Modal */}
      {selectedProofComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border bg-card p-5 shadow-soft space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-base">Technician Completion Proof</h3>
              <button onClick={() => setSelectedProofComplaint(null)} className="rounded p-1 hover:bg-muted">
                <X size={18} />
              </button>
            </div>
            {selectedProofComplaint.resolutionProofUrl ? (
              <img
                src={selectedProofComplaint.resolutionProofUrl}
                alt="Proof"
                className="w-full h-48 rounded-lg object-cover border"
              />
            ) : (
              <div className="w-full h-28 rounded-lg border border-dashed flex items-center justify-center text-xs text-muted-foreground bg-muted/20">
                No photographic proof attached with this work report.
              </div>
            )}
            <div className="rounded-lg border bg-muted/20 p-3 text-xs">
              <p className="font-bold text-muted-foreground">Technician Note:</p>
              <p className="text-foreground mt-0.5">{selectedProofComplaint.resolutionNote || "Issue repaired and verified on-site."}</p>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" size="sm" onClick={() => { setReopeningComplaint(selectedProofComplaint); setSelectedProofComplaint(null); }}>
                Reopen Issue
              </Button>
              <Button size="sm" onClick={() => handleConfirmResolution(selectedProofComplaint.id)}>
                Confirm Resolution
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reopen Modal */}
      {reopeningComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <form onSubmit={handleReopenSubmit} className="w-full max-w-md rounded-xl border bg-card p-5 shadow-soft space-y-4">
            <h3 className="font-bold text-base">Reopen Issue #{reopeningComplaint.id}</h3>
            <textarea
              rows={3}
              required
              value={reopenFeedback}
              onChange={(e) => setReopenFeedback(e.target.value)}
              placeholder="Explain why the repair was incomplete..."
              className="w-full rounded-lg border p-3 text-sm outline-none resize-none"
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setReopeningComplaint(null)}>
                Cancel
              </Button>
              <Button type="submit" size="sm">
                Submit Reopen
              </Button>
            </div>
          </form>
        </div>
      )}
    </AppShell>
  );
}
