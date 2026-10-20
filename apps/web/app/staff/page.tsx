"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
    AlertTriangle,
    ArrowRight,
    CheckCircle2,
    Clock,
    Copy,
    Cpu,
    ExternalLink,
    Filter,
    Key,
    Mail,
    Phone,
    Send,
    Shield,
    ShieldAlert,
    UserCheck,
    UserPlus,
    Users,
    Wrench,
    Zap
} from "lucide-react";
import { toast } from "sonner";
import { departmentLabels, facilities, staff as initialStaff, MAINTENANCE_DEPARTMENTS, SECURITY_DEPARTMENTS } from "@resolvex/utils";
import type { Complaint, StaffAvailability, StaffDepartment, StaffProfile } from "@resolvex/types";
import { AppShell } from "@/components/app-shell";
import { AnimatedSection, Badge, Button, Card, SectionHeader, StatusDot } from "@/components/ui";
import { useSessionStore } from "@/lib/store";
import { useAuth } from "@/lib/auth-context";
import {
    createOrInviteStaff,
    sendStaffPasswordReset,
    subscribeComplaints,
    subscribeSocietyUsers,
    updateStaffDutyStatus,
    type CreateStaffResult
} from "@/lib/services";

export default function StaffPage() {
    const { activeRole } = useSessionStore();

    return (
        <AppShell>
            {activeRole === "maintenance_staff" ? (
                <TechnicianDutyProfileView />
            ) : (
                <ManagementStaffView />
            )}
        </AppShell>
    );
}

// ─── Maintenance Staff: Duty Profile & Station ──────────────────────────────
function TechnicianDutyProfileView() {
    const [isOnDuty, setIsOnDuty] = useState(true);
    const [dutyNotice, setDutyNotice] = useState<string | null>(null);

    function toggleDuty() {
        const next = !isOnDuty;
        setIsOnDuty(next);
        setDutyNotice(next ? "You are marked ON ACTIVE DUTY. Control room dispatch enabled." : "You are marked OFF DUTY / STANDBY.");
        setTimeout(() => setDutyNotice(null), 4000);
    }

    return (
        <AnimatedSection className="space-y-6">
            <SectionHeader
                eyebrow="Staff Operations"
                title="Technician Duty Station"
                description="Manage your active shift status, certified machinery roster, and assigned critical assets."
                action={
                    <Button
                        variant={isOnDuty ? "primary" : "outline"}
                        onClick={toggleDuty}
                        className="gap-2"
                    >
                        <UserCheck size={16} />
                        {isOnDuty ? "Status: Active On-Duty" : "Status: Off Duty / Standby"}
                    </Button>
                }
            />

            {dutyNotice && (
                <div className="flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/20 px-4 py-3 text-sm font-semibold text-primary">
                    <CheckCircle2 size={16} />
                    <span>{dutyNotice}</span>
                </div>
            )}

            {/* Profile Overview Card */}
            <Card className="p-5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <img
                            src="https://images.unsplash.com/photo-1544723795-3fb6469f5b39?w=160&auto=format&fit=crop&q=80"
                            alt="Deepak Verma"
                            className="h-16 w-16 rounded-2xl object-cover border-2 border-primary/20 shadow-sm"
                        />
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-lg font-bold text-foreground">Deepak Verma</h3>
                                <Badge tone="amber">Lift & Machinery Lead</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Staff ID: <span className="font-mono font-semibold">STF-ELEV-04</span> · Shift A: 08:00 AM – 06:00 PM
                            </p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1 font-mono">
                                <Phone size={12} />
                                +91 98765 00004 · Dispatch Radiophone Ch 4
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col sm:items-end gap-1 text-xs">
                        <span className="text-muted-foreground">Emergency Society Escalation Lead:</span>
                        <span className="font-semibold text-foreground">Neha Mehta (Estate Manager · Ext 101)</span>
                        <Link href="/complaints">
                            <Button size="sm" className="mt-2 gap-1.5">
                                <Wrench size={14} />
                                View Assigned Tickets (2 Active)
                            </Button>
                        </Link>
                    </div>
                </div>
            </Card>

            {/* Metrics */}
            <div className="grid gap-3 sm:grid-cols-4">
                <Card className="p-4">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground">Duty Status</span>
                        <StatusDot tone={isOnDuty ? "green" : "slate"} label={isOnDuty ? "On Duty" : "Standby"} />
                    </div>
                    <p className="mt-2 text-xl font-bold text-foreground">{isOnDuty ? "Available for Dispatch" : "Off Shift"}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Shift ends 06:00 PM</p>
                </Card>

                <Card className="p-4">
                    <span className="text-xs font-semibold text-muted-foreground">Assigned Machinery</span>
                    <p className="mt-2 text-xl font-bold text-foreground">3 Assets</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Lift TA-1, Lift TB-2, DG-1</p>
                </Card>

                <Card className="p-4">
                    <span className="text-xs font-semibold text-muted-foreground">Active Work Orders</span>
                    <p className="mt-2 text-xl font-bold text-amber-600 dark:text-amber-400">2 In-Progress</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">1 High Priority Lift sensor</p>
                </Card>

                <Card className="p-4">
                    <span className="text-xs font-semibold text-muted-foreground">SLA Adherence</span>
                    <p className="mt-2 text-xl font-bold text-emerald-600 dark:text-emerald-400">98.4%</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Avg response 18 mins</p>
                </Card>
            </div>

            {/* Assigned Machinery Roster */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <h3 className="text-base font-bold text-foreground">Equipment & Facility Roster</h3>
                        <p className="text-xs text-muted-foreground">Societal assets under your direct preventive maintenance assignment.</p>
                    </div>
                    <Link href="/facilities">
                        <Button variant="outline" size="sm" className="gap-1 text-xs">
                            Inspect Facilities <ArrowRight size={13} />
                        </Button>
                    </Link>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                    <Card className="p-4 space-y-3">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                                    <Cpu size={18} />
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-foreground">Tower A - Lift 1</h4>
                                    <p className="text-xs text-muted-foreground font-mono">Schindler 3300 AP</p>
                                </div>
                            </div>
                            <Badge tone="green">Healthy</Badge>
                        </div>
                        <div className="rounded-lg bg-muted/40 p-2.5 space-y-1 text-xs text-muted-foreground">
                            <p>Last PM inspection: <span className="font-semibold text-foreground">12 days ago</span></p>
                            <p>Next routine check: <span className="font-semibold text-foreground">In 18 days</span></p>
                            <p>Controller Status: <span className="font-semibold text-emerald-600 dark:text-emerald-400">Normal (0 Faults)</span></p>
                        </div>
                    </Card>

                    <Card className="p-4 space-y-3 border-amber-500/30">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                                    <Cpu size={18} />
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-foreground">Tower B - Service Lift</h4>
                                    <p className="text-xs text-muted-foreground font-mono">Schindler 5500 Freight</p>
                                </div>
                            </div>
                            <Badge tone="amber">Action Req.</Badge>
                        </div>
                        <div className="rounded-lg bg-amber-500/10 p-2.5 space-y-1 text-xs text-amber-800 dark:text-amber-300">
                            <p className="font-semibold">Work Order #CMP-004 Active</p>
                            <p>Door infrared sensor glitch reported on 6th floor landing. Under active inspection.</p>
                        </div>
                    </Card>

                    <Card className="p-4 space-y-3">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
                                    <Zap size={18} />
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-foreground">Main Substation & DG 1</h4>
                                    <p className="text-xs text-muted-foreground font-mono">Cummins 500kVA</p>
                                </div>
                            </div>
                            <Badge tone="green">Standby Ready</Badge>
                        </div>
                        <div className="rounded-lg bg-muted/40 p-2.5 space-y-1 text-xs text-muted-foreground">
                            <p>Fuel level: <span className="font-semibold text-foreground">88% (Diesel)</span></p>
                            <p>Battery bank: <span className="font-semibold text-foreground">27.4V Normal</span></p>
                            <p>Auto-transfer switch: <span className="font-semibold text-emerald-600 dark:text-emerald-400">Armed</span></p>
                        </div>
                    </Card>
                </div>
            </div>

            {/* Certifications & Skills */}
            <Card className="p-5 space-y-3">
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Shield size={16} className="text-primary" />
                    Certified Qualifications & Operational Permissions
                </h4>
                <div className="flex flex-wrap gap-2">
                    <span className="rounded-lg border bg-muted/30 px-3 py-1.5 text-xs font-semibold text-foreground">
                        Elevator Mechanical & Electrical License (Cat A)
                    </span>
                    <span className="rounded-lg border bg-muted/30 px-3 py-1.5 text-xs font-semibold text-foreground">
                        Emergency Passenger Trap Rescue Certified
                    </span>
                    <span className="rounded-lg border bg-muted/30 px-3 py-1.5 text-xs font-semibold text-foreground">
                        High Voltage Safety Isolation (415V 3-Phase)
                    </span>
                    <span className="rounded-lg border bg-muted/30 px-3 py-1.5 text-xs font-semibold text-foreground">
                        Automatic Rescue Device (ARD) Calibration
                    </span>
                </div>
            </Card>
        </AnimatedSection>
    );
}

// ─── Society Management / Admin: Staff Management Table ─────────────────────
function ManagementStaffView() {
    const { userProfile } = useAuth();
    const societyId = userProfile?.societyId || "soc-ajanta-genx";
    const [staffList, setStaffList] = useState<StaffProfile[]>(initialStaff);
    const [complaintList, setComplaintList] = useState<Complaint[]>([]);
    const [selectedDept, setSelectedDept] = useState<string>("all");
    const [showAddModal, setShowAddModal] = useState(false);
    const [newStaffName, setNewStaffName] = useState("");
    const [newStaffEmail, setNewStaffEmail] = useState("");
    const [newStaffPhone, setNewStaffPhone] = useState("");
    const [newStaffRole, setNewStaffRole] = useState<"maintenance_staff" | "security_guard">("maintenance_staff");
    const [newStaffDept, setNewStaffDept] = useState<StaffDepartment>("plumbing");
    const [newStaffPassword, setNewStaffPassword] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [modalError, setModalError] = useState<string | null>(null);
    const [createdCredentials, setCreatedCredentials] = useState<CreateStaffResult | null>(null);

    useEffect(() => {
        const unsubStaff = subscribeSocietyUsers(societyId, (users) => {
            const staffMembers = users.filter((u) =>
                ["maintenance_staff", "security_guard", "technician", "facility_manager", "society_manager", "society_admin"].includes(u.role)
            );
            const mappedStaff: StaffProfile[] = staffMembers.map((u) => {
                const uAny = u as any;
                const status = (uAny.availabilityStatus || "on_duty") as StaffAvailability;
                console.log(`[MANAGEMENT WORKFORCE RECEIVED] uid=${u.uid} societyId=${societyId} name=${u.displayName || u.email} role=${u.role} availabilityStatus=${status}`);
                return {
                    id: u.uid,
                    societyId: u.societyId || societyId,
                    name: u.displayName || u.email?.split("@")[0] || "Staff",
                    email: u.email,
                    phone: u.phone || "+91 98765 00000",
                    role: (u.role === "maintenance_staff" || u.role === "security_guard" ? u.role : "maintenance_staff") as any,
                    department: (u.department || (u.role === "security_guard" ? "security" : "general_maintenance")) as any,
                    skills: (uAny.skills && uAny.skills.length > 0 ? uAny.skills : ["facility_maintenance", "electrical", "plumbing"]) as any,
                    assignedFacilityIds: uAny.assignedFacilityIds || [],
                    currentWorkload: uAny.currentWorkload || 0,
                    availabilityStatus: status,
                    active: u.status === "verified"
                };
            });
            setStaffList(mappedStaff);
        });
        const unsubComplaints = subscribeComplaints({ societyId }, setComplaintList);
        return () => {
            unsubStaff();
            unsubComplaints();
        };
    }, [societyId, userProfile?.uid]);

    const filteredStaff = staffList.filter(
        (s) => selectedDept === "all" || s.department === selectedDept
    );

    const totalStaff = staffList.length;
    const onDutyCount = staffList.filter((s) => s.availabilityStatus === "on_duty").length;
    const availableCount = staffList.filter((s) => s.availabilityStatus === "available").length;

    const deptCounts = Object.fromEntries(
        Object.keys(departmentLabels).map((key) => [
            key,
            staffList.filter((s) => s.department === key).length
        ])
    );

    async function handleAddStaff(e: React.FormEvent) {
        e.preventDefault();
        if (!newStaffName.trim() || !newStaffPhone.trim() || !newStaffEmail.trim()) {
            toast.error("Please fill in Name, Email, and Phone number.");
            return;
        }
        if (!newStaffRole) {
            toast.error("Please select a staff role.");
            return;
        }
        if (!newStaffDept) {
            toast.error("Please select a department.");
            return;
        }

        setIsSubmitting(true);
        setModalError(null);
        try {
            const result = await createOrInviteStaff({
                name: newStaffName,
                email: newStaffEmail,
                phone: newStaffPhone,
                role: newStaffRole,
                department: newStaffDept,
                societyId,
                initialPassword: newStaffPassword.trim() || undefined,
                actorUserId: userProfile?.uid
            });

            setCreatedCredentials(result);
            setShowAddModal(false);
            setNewStaffName("");
            setNewStaffEmail("");
            setNewStaffPhone("");
            setNewStaffPassword("");
            setNewStaffRole("maintenance_staff");
            setNewStaffDept("plumbing");
            toast.success(result.message);
        } catch (err: any) {
            console.error("Failed to create staff member:", err);
            setModalError(err.message || "Failed to provision staff member.");
            toast.error(err.message || "Failed to provision staff member.");
        } finally {
            setIsSubmitting(false);
        }
    }

    async function toggleDuty(id: string) {
        const staffMember = staffList.find((s) => s.id === id);
        if (!staffMember) return;
        const nextStatus =
            staffMember.availabilityStatus === "on_duty"
                ? "available"
                : staffMember.availabilityStatus === "available"
                    ? "off_duty"
                    : "on_duty";

        // Optimistic local update
        setStaffList(
            staffList.map((s) => (s.id === id ? { ...s, availabilityStatus: nextStatus } : s))
        );

        try {
            await updateStaffDutyStatus(id, societyId, nextStatus);
            toast.success(`Duty status updated to ${nextStatus.replace("_", " ")}`);
        } catch (err: any) {
            console.error("Failed to update staff duty status:", err);
            toast.error(`Failed to update duty status: ${err.message}`);
        }
    }

    async function handleSendInvite(email?: string) {
        if (!email) {
            toast.error("Staff member does not have an email address configured.");
            return;
        }
        try {
            await sendStaffPasswordReset(email);
            toast.success(`Password reset / invitation link dispatched to ${email}`);
        } catch (err: any) {
            console.error("Failed to send staff password reset:", err);
            toast.error(`Failed to send invite: ${err.message}`);
        }
    }

    return (
        <AnimatedSection className="space-y-6">
            <SectionHeader
                eyebrow="Workforce Management"
                title="Staff & Department Directory"
                description="Monitor department leads, assign work tickets, track availability, and manage maintenance staff."
                action={
                    <Button onClick={() => setShowAddModal(true)}>
                        <UserPlus size={15} />
                        Add Staff Member
                    </Button>
                }
            />

            {/* Summary stats */}
            <div className="grid gap-3 sm:grid-cols-4">
                <Card className="flex items-center gap-3 p-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <Users size={17} className="text-primary" />
                    </div>
                    <div>
                        <p className="text-xl font-bold">{totalStaff}</p>
                        <p className="text-xs text-muted-foreground">Total Personnel</p>
                    </div>
                </Card>

                <Card className="flex items-center gap-3 p-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/50">
                        <CheckCircle2 size={17} className="text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                        <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{onDutyCount}</p>
                        <p className="text-xs text-muted-foreground">On Active Duty</p>
                    </div>
                </Card>

                <Card className="flex items-center gap-3 p-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/50">
                        <Clock size={17} className="text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                        <p className="text-xl font-bold text-amber-700 dark:text-amber-400">{availableCount}</p>
                        <p className="text-xs text-muted-foreground">Available Standby</p>
                    </div>
                </Card>

                <Card className="flex items-center gap-3 p-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950/50">
                        <Zap size={17} className="text-primary" />
                    </div>
                    <div>
                        <p className="text-xl font-bold">2.4 hrs</p>
                        <p className="text-xs text-muted-foreground">Avg Resolution</p>
                    </div>
                </Card>
            </div>

            {/* Dept filter */}
            <div className="flex flex-wrap gap-1.5">
                <button
                    onClick={() => setSelectedDept("all")}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-semibold rx-transition ${selectedDept === "all"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:text-foreground"
                        }`}
                >
                    All ({staffList.length})
                </button>
                {Object.entries(departmentLabels).map(([key, label]) => {
                    const count = deptCounts[key] ?? 0;
                    if (count === 0) return null;
                    return (
                        <button
                            key={key}
                            onClick={() => setSelectedDept(key)}
                            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold rx-transition ${selectedDept === key
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted text-muted-foreground hover:text-foreground"
                                }`}
                        >
                            {label} ({count})
                        </button>
                    );
                })}
            </div>

            {/* Staff table — desktop */}
            <Card className="hidden overflow-hidden md:block">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b bg-muted/30">
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Staff Member
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Role & Department
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Status
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Workload
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Skills
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Action
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {filteredStaff.map((person) => {
                            const roleLabel = person.role === "security_guard" ? "Security Guard" : "Maintenance Staff";
                            const deptName = person.department ? (departmentLabels[person.department] || person.department) : (person.role === "security_guard" ? "Security" : "General Maintenance");
                            const statusTone = person.availabilityStatus === "on_duty"
                                ? "green"
                                : person.availabilityStatus === "available"
                                    ? "amber"
                                    : "slate";
                            const statusLabel = person.availabilityStatus === "on_duty"
                                ? "On Duty"
                                : person.availabilityStatus === "available"
                                    ? "Available"
                                    : "Off Duty";

                            const activeTickets = complaintList.filter(
                                (c) => (c.assignedStaffId === person.id || c.assignedStaffId === person.name) && c.status !== "resolved" && c.status !== "closed"
                            );
                            const highPriorityTickets = activeTickets.filter(
                                (c) => c.priority === "high" || c.priority === "emergency"
                            );
                            const isOverloaded = activeTickets.length >= 2 || highPriorityTickets.length >= 1;

                            return (
                                <tr key={person.id} className="rx-transition hover:bg-muted/25">
                                    <td className="px-4 py-3.5">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                                                {person.name.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="font-semibold">{person.name}</p>
                                                    <span className="text-xs text-muted-foreground hidden sm:inline">
                                                        — {roleLabel} — {deptName}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <span className="font-mono">{person.phone}</span>
                                                    {person.email && <span>· {person.email}</span>}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3.5">
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-xs font-semibold text-foreground">{roleLabel}</span>
                                            <span className="text-xs text-muted-foreground">{deptName}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3.5">
                                        <StatusDot tone={statusTone} label={statusLabel} />
                                    </td>
                                    <td className="px-4 py-3.5">
                                        <div className="space-y-0.5">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-sm font-semibold">{activeTickets.length} active ticket{activeTickets.length === 1 ? "" : "s"}</span>
                                                {isOverloaded && (
                                                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                                                        Heavy Load
                                                    </span>
                                                )}
                                            </div>
                                            {highPriorityTickets.length > 0 ? (
                                                <p className="text-xs font-semibold text-red-600 dark:text-red-400">
                                                    {highPriorityTickets.length} high priority
                                                </p>
                                            ) : (
                                                <p className="text-xs text-muted-foreground">Normal workload</p>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3.5">
                                        <div className="flex flex-wrap gap-1">
                                            {person.skills.slice(0, 2).map((skill) => (
                                                <span
                                                    key={skill}
                                                    className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground capitalize"
                                                >
                                                    {skill.replace("_", " ")}
                                                </span>
                                            ))}
                                            {person.skills.length > 2 && (
                                                <span className="text-xs text-muted-foreground">+{person.skills.length - 2}</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3.5 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {person.email && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    title="Send Password Reset / Login Invitation Email"
                                                    onClick={() => handleSendInvite(person.email)}
                                                    className="gap-1 text-xs"
                                                >
                                                    <Mail size={13} />
                                                    Invite
                                                </Button>
                                            )}
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => toggleDuty(person.id)}
                                            >
                                                Toggle Duty
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </Card>

            {/* Staff cards — mobile */}
            <div className="grid gap-4 sm:grid-cols-2 md:hidden">
                {filteredStaff.map((person) => {
                    const roleLabel = person.role === "security_guard" ? "Security Guard" : "Maintenance Staff";
                    const deptName = person.department ? (departmentLabels[person.department] || person.department) : (person.role === "security_guard" ? "Security" : "General Maintenance");
                    const statusTone = person.availabilityStatus === "on_duty"
                        ? "green"
                        : person.availabilityStatus === "available"
                            ? "amber"
                            : "slate";
                    const statusLabel = person.availabilityStatus === "on_duty"
                        ? "On Duty"
                        : person.availabilityStatus === "available"
                            ? "Available"
                            : "Off Duty";

                    const activeTickets = complaintList.filter(
                        (c: Complaint) => (c.assignedStaffId === person.id || c.assignedStaffId === person.name) && c.status !== "resolved" && c.status !== "closed"
                    );
                    const highPriorityTickets = activeTickets.filter(
                        (c: Complaint) => c.priority === "high" || c.priority === "emergency"
                    );
                    const isOverloaded = activeTickets.length >= 2 || highPriorityTickets.length >= 1;

                    return (
                        <Card key={person.id} className="p-4 space-y-3">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                                        {person.name.charAt(0)}
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-sm">{person.name}</h4>
                                        <p className="text-xs text-muted-foreground">{person.name} — {roleLabel} — {deptName}</p>
                                    </div>
                                </div>
                                <StatusDot tone={statusTone} label={statusLabel} />
                            </div>

                            <div className="rounded-lg bg-muted/40 p-2.5 space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="font-semibold">{activeTickets.length} active tickets</span>
                                    {isOverloaded ? (
                                        <span className="font-semibold text-amber-600 dark:text-amber-400">Heavy Load</span>
                                    ) : (
                                        <span className="text-muted-foreground">Normal Capacity</span>
                                    )}
                                </div>
                                {highPriorityTickets.length > 0 && (
                                    <p className="text-xs font-semibold text-red-600 dark:text-red-400">
                                        {highPriorityTickets.length} high priority
                                    </p>
                                )}
                            </div>

                            <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
                                <span>Phone:</span>
                                <span>{person.phone}</span>
                            </div>

                            {person.email && (
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span>Email:</span>
                                    <span className="font-mono text-[11px] truncate max-w-[180px]">{person.email}</span>
                                </div>
                            )}

                            <div className="flex flex-wrap gap-1">
                                {person.skills.map((skill) => (
                                    <span
                                        key={skill}
                                        className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground capitalize"
                                    >
                                        {skill.replace("_", " ")}
                                    </span>
                                ))}
                            </div>

                            <div className="flex gap-2 pt-1">
                                {person.email && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="flex-1 text-xs gap-1"
                                        onClick={() => handleSendInvite(person.email)}
                                    >
                                        <Mail size={13} />
                                        Invite
                                    </Button>
                                )}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1 text-xs"
                                    onClick={() => toggleDuty(person.id)}
                                >
                                    Toggle Duty
                                </Button>
                            </div>
                        </Card>
                    );
                })}
            </div>

            {/* Add modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md rx-card-elevated overflow-hidden">
                        <div className="border-b px-5 py-4">
                            <h3 className="text-base font-bold">Add Staff Member</h3>
                            <p className="mt-0.5 text-sm text-muted-foreground">Register new society employee with mobile app login credentials.</p>
                        </div>

                        <form onSubmit={handleAddStaff} className="p-5 space-y-4">
                            {modalError && (
                                <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-600 dark:text-red-400">
                                    {modalError}
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Full Name *</label>
                                <input
                                    required
                                    value={newStaffName}
                                    onChange={(e) => setNewStaffName(e.target.value)}
                                    placeholder="e.g. Vikas Kumar"
                                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/25"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Email Address (Login ID) *</label>
                                <input
                                    required
                                    type="email"
                                    value={newStaffEmail}
                                    onChange={(e) => setNewStaffEmail(e.target.value)}
                                    placeholder="e.g. vikas.kumar@resolvex.com"
                                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/25"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Phone Number *</label>
                                <input
                                    required
                                    value={newStaffPhone}
                                    onChange={(e) => setNewStaffPhone(e.target.value)}
                                    placeholder="+91 90000 11001"
                                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/25"
                                />
                            </div>

                            {/* Role Select */}
                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Role *</label>
                                <select
                                    required
                                    value={newStaffRole}
                                    onChange={(e) => {
                                        const r = e.target.value as "maintenance_staff" | "security_guard";
                                        setNewStaffRole(r);
                                        if (r === "security_guard") {
                                            setNewStaffDept("security");
                                        } else if (newStaffDept === "security") {
                                            setNewStaffDept("plumbing");
                                        }
                                    }}
                                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/25"
                                >
                                    <option value="maintenance_staff">Maintenance Staff</option>
                                    <option value="security_guard">Security Guard</option>
                                </select>
                            </div>

                            {/* Department / Skill Select */}
                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                                    Department / Skill *
                                </label>
                                <select
                                    required
                                    value={newStaffDept}
                                    onChange={(e) => setNewStaffDept(e.target.value as StaffDepartment)}
                                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/25"
                                >
                                    {newStaffRole === "security_guard" ? (
                                        SECURITY_DEPARTMENTS.map((d) => (
                                            <option key={d.value} value={d.value}>
                                                {d.label}
                                            </option>
                                        ))
                                    ) : (
                                        MAINTENANCE_DEPARTMENTS.map((d) => (
                                            <option key={d.value} value={d.value}>
                                                {d.label}
                                            </option>
                                        ))
                                    )}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Initial Password (Optional)</label>
                                <input
                                    type="text"
                                    value={newStaffPassword}
                                    onChange={(e) => setNewStaffPassword(e.target.value)}
                                    placeholder="Auto-generated if left blank"
                                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/25"
                                />
                                <p className="text-[11px] text-muted-foreground mt-1">Credentials will be securely provisioned via Firebase Authentication.</p>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-1">
                                <Button type="button" variant="ghost" disabled={isSubmitting} onClick={() => setShowAddModal(false)}>
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting ? "Provisioning Auth..." : "Create Staff & Provision"}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Created credentials confirmation modal */}
            {createdCredentials && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md rx-card-elevated overflow-hidden p-6 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                                <CheckCircle2 size={22} />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-foreground">Staff Account Provisioned</h3>
                                <p className="text-xs text-muted-foreground">Real Firebase Auth account linked to society staff roster</p>
                            </div>
                        </div>

                        <div className="rounded-xl border bg-muted/40 p-4 space-y-2 text-xs">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Login Email:</span>
                                <span className="font-mono font-bold text-foreground">{createdCredentials.email}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Role:</span>
                                <span className="font-semibold text-foreground">
                                    {createdCredentials.role === "security_guard" ? "Security Guard" : "Maintenance Staff"}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Department:</span>
                                <span className="font-semibold text-foreground">
                                    {createdCredentials.department ? (departmentLabels[createdCredentials.department] || createdCredentials.department) : "Plumbing"}
                                </span>
                            </div>
                            {createdCredentials.temporaryPassword ? (
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">Temporary Password:</span>
                                    <div className="flex items-center gap-1.5">
                                        <span className="font-mono font-bold text-primary">{createdCredentials.temporaryPassword}</span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                navigator.clipboard.writeText(createdCredentials.temporaryPassword!);
                                                toast.success("Password copied to clipboard");
                                            }}
                                            className="text-muted-foreground hover:text-foreground p-1"
                                            title="Copy Password"
                                        >
                                            <Copy size={13} />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-emerald-600 font-semibold">
                                    Existing account detected. Invitation / reset link sent to email.
                                </div>
                            )}
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Firebase UID:</span>
                                <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[180px]">{createdCredentials.uid}</span>
                            </div>
                        </div>

                        <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 text-xs text-blue-700 dark:text-blue-300 space-y-1">
                            <p className="font-semibold">Mobile App Access</p>
                            <p>The technician can now open the ResolveX mobile app, log in using these credentials, view assigned complaints in "My Work Queue", and advance tickets through to resident confirmation.</p>
                        </div>

                        <div className="flex justify-end pt-2">
                            <Button onClick={() => setCreatedCredentials(null)}>
                                Done
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </AnimatedSection>
    );
}
