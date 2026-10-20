"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
    Activity,
    AlertTriangle,
    Camera,
    CheckCircle,
    Clock,
    Cpu,
    ExternalLink,
    FileText,
    Flame,
    Key,
    Plus,
    Radio,
    Shield,
    ShieldAlert,
    Sparkles,
    Users,
    Waves,
    Wrench,
    Zap
} from "lucide-react";
import { facilities as initialFacilities, facilityServiceLogs, facilityStatusLabels, staff } from "@resolvex/utils";
import type { AmenityBooking, Facility, FacilityStatus } from "@resolvex/types";
import { AppShell } from "@/components/app-shell";
import { AnimatedSection, Badge, Button, Card, SectionHeader, StatusDot } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import { cancelAmenityBooking, logMaintenanceService, subscribeAmenityBookings, subscribeFacilities } from "@/lib/services";
import { useSessionStore } from "@/lib/store";

export default function FacilitiesPage() {
    const { activeRole } = useSessionStore();

    if (activeRole === "maintenance_staff") {
        return (
            <AppShell>
                <StaffFacilitiesView />
            </AppShell>
        );
    }

    if (activeRole === "security_guard") {
        return (
            <AppShell>
                <SecurityGateAssetsView />
            </AppShell>
        );
    }

    if (activeRole === "resident" || activeRole === "flat_owner" || activeRole === "tenant") {
        return (
            <AppShell>
                <ResidentAmenitiesView />
            </AppShell>
        );
    }

    return (
        <AppShell>
            <ManagementFacilitiesView />
        </AppShell>
    );
}

// ─── Maintenance Staff: Technical Machinery & Inspection ────────────────────
function StaffFacilitiesView() {
    const { userProfile } = useAuth();
    const societyId = userProfile?.societyId || "soc-ajanta-genx";
    const [facilitiesList, setFacilitiesList] = useState<Facility[]>([]);
    const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null);
    const [inspectionNote, setInspectionNote] = useState("");
    const [statusSelected, setStatusSelected] = useState<FacilityStatus>("operational");

    useEffect(() => {
        const unsub = subscribeFacilities(societyId, setFacilitiesList);
        return () => unsub();
    }, [societyId, userProfile?.uid]);

    // Filter to electro-mechanical assets
    const mechanicalAssets = facilitiesList.filter((f) =>
        ["lift", "generator", "water_supply", "electrical"].includes(f.category)
    );

    async function handleSaveInspection(e: React.FormEvent) {
        e.preventDefault();
        if (!selectedFacility) return;

        await logMaintenanceService(selectedFacility.id, {
            type: "inspection",
            notes: inspectionNote.trim() || `Technical inspection signed off: ${statusSelected}`,
            staffId: userProfile?.uid || "staff-deepak",
            actorUserId: userProfile?.uid || "staff-deepak"
        });

        toast.success(`Technical inspection signed off for ${selectedFacility.name}.`);
        setSelectedFacility(null);
        setInspectionNote("");
    }

    return (
        <AnimatedSection className="space-y-6">
            <SectionHeader
                eyebrow="Preventive Engineering"
                title="Critical Machinery & Heavy Equipment Roster"
                description="Monitor telemetry, perform routine rundown inspections, and sign off on scheduled AMC maintenance."
            />

            {/* Quick KPIs */}
            <div className="grid gap-3 sm:grid-cols-4">
                <Card className="p-4">
                    <span className="text-xs font-semibold text-muted-foreground">Assigned Machinery</span>
                    <p className="mt-2 text-xl font-bold text-foreground">{mechanicalAssets.length} Assets</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Lifts, DG, Transformers, Pumps</p>
                </Card>
                <Card className="p-4">
                    <span className="text-xs font-semibold text-muted-foreground">Normal Status</span>
                    <p className="mt-2 text-xl font-bold text-emerald-600 dark:text-emerald-400">
                        {mechanicalAssets.filter((a) => a.status === "operational").length} Healthy
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Vibration & temp normal</p>
                </Card>
                <Card className="p-4">
                    <span className="text-xs font-semibold text-muted-foreground">Service Required</span>
                    <p className="mt-2 text-xl font-bold text-amber-600 dark:text-amber-400">
                        {mechanicalAssets.filter((a) => a.status !== "operational").length} Attention
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Tower B Service Lift sensor</p>
                </Card>
                <Card className="p-4">
                    <span className="text-xs font-semibold text-muted-foreground">Next Routine AMC</span>
                    <p className="mt-2 text-xl font-bold text-primary">In 5 Days</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Schindler & Cummins visits</p>
                </Card>
            </div>

            {/* Assets Grid */}
            <div className="grid gap-4 md:grid-cols-2">
                {mechanicalAssets.map((asset) => {
                    const statusTone = asset.status === "operational" ? "green" : asset.status === "under_maintenance" ? "amber" : "red";

                    return (
                        <Card key={asset.id} className="p-5 space-y-4">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                        {asset.category === "lift" ? <Cpu size={22} /> : asset.category === "electrical" || asset.category === "generator" ? <Zap size={22} /> : <Activity size={22} />}
                                    </div>
                                    <div>
                                        <h4 className="text-base font-bold text-foreground">{asset.name}</h4>
                                        <p className="text-xs text-muted-foreground">{asset.location} · {asset.category.replace("_", " ").toUpperCase()}</p>
                                    </div>
                                </div>
                                <StatusDot tone={statusTone} label={facilityStatusLabels[asset.status]} />
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs rounded-lg bg-muted/40 p-3">
                                <div>
                                    <span className="text-muted-foreground">Last Inspection:</span>
                                    <p className="font-semibold text-foreground">{asset.lastMaintenanceDate || "12 days ago"}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Next Scheduled AMC:</span>
                                    <p className="font-semibold text-primary">{asset.nextMaintenanceDate}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Open Anomaly Tickets:</span>
                                    <p className="font-semibold text-foreground">{asset.openIssueCount ?? 0} active</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Service Logs:</span>
                                    <p className="font-semibold text-foreground">{asset.serviceHistoryCount ?? 0} entries</p>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-1">
                                <span className="text-xs text-muted-foreground font-mono">ID: {asset.id}</span>
                                <Button
                                    size="sm"
                                    onClick={() => {
                                        setSelectedFacility(asset);
                                        setStatusSelected(asset.status);
                                    }}
                                    className="gap-1.5 text-xs"
                                >
                                    <Wrench size={14} />
                                    Log Inspection & Service
                                </Button>
                            </div>
                        </Card>
                    );
                })}
            </div>

            {/* Inspection Sign-off Modal */}
            {selectedFacility && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md rx-card-elevated overflow-hidden">
                        <div className="border-b px-5 py-4">
                            <h3 className="text-base font-bold">Technician Service Sign-off</h3>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                                Asset: <span className="font-semibold text-foreground">{selectedFacility.name}</span>
                            </p>
                        </div>
                        <form onSubmit={handleSaveInspection} className="p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Updated Operational Status</label>
                                <select
                                    value={statusSelected}
                                    onChange={(e) => setStatusSelected(e.target.value as FacilityStatus)}
                                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/25"
                                >
                                    <option value="operational">Operational (Cleared for use)</option>
                                    <option value="under_maintenance">Under Active Maintenance</option>
                                    <option value="degraded">Degraded Performance (Part pending)</option>
                                    <option value="out_of_service">Out of Service (Lockout / Tagout)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Rundown Notes & Diagnostic Checklist <span className="text-danger">*</span></label>
                                <textarea
                                    required
                                    rows={3}
                                    value={inspectionNote}
                                    onChange={(e) => setInspectionNote(e.target.value)}
                                    placeholder="Checked cable tension, cleaned optical door detector, verified ARD battery backup charge…"
                                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/25 resize-none"
                                />
                            </div>

                            <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                                <p className="font-semibold text-foreground">Sign-off Technician:</p>
                                <p>Deepak Verma · Lead Elevator & Machinery Tech (STF-ELEV-04)</p>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-1 border-t">
                                <Button type="button" variant="ghost" onClick={() => setSelectedFacility(null)}>
                                    Cancel
                                </Button>
                                <Button type="submit">Sign & Commit Record</Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AnimatedSection>
    );
}

// ─── Security Guard: Gate Infrastructure & Perimeter ─────────────────────────
function SecurityGateAssetsView() {
    const [gateAssets, setGateAssets] = useState([
        {
            id: "gate-01",
            name: "Main Entry Boom Barrier #1",
            location: "North Gate Entrance",
            status: "operational",
            lastCheck: "Today 07:00 AM",
            details: "RFID auto-tag scanner active, hydraulic arm responsive."
        },
        {
            id: "gate-02",
            name: "Main Exit Boom Barrier #2",
            location: "North Gate Exit",
            status: "operational",
            lastCheck: "Today 07:00 AM",
            details: "Inductive loop trigger working."
        },
        {
            id: "cctv-server",
            name: "Perimeter CCTV Network (32 Cams)",
            location: "Security Control Room",
            status: "operational",
            lastCheck: "Today 06:30 AM",
            details: "All 32 IP camera streams recording. Storage retention 45 days."
        },
        {
            id: "intercom-hub",
            name: "Gate-to-Flat Audio/Video Intercom",
            location: "Gate Guardhouse Kiosk",
            status: "operational",
            lastCheck: "Today 08:00 AM",
            details: "SIP server online. Tower A and Tower B connections verified."
        },
        {
            id: "ped-turnstile",
            name: "Pedestrian Smart Access Turnstile",
            location: "Visitor Entry Booth",
            status: "degraded",
            lastCheck: "Yesterday 09:30 PM",
            details: "Card swipe optical reader intermittent on Gate 2. Ticket logged."
        },
        {
            id: "perimeter-lights",
            name: "South Perimeter High-Mast Solar Lighting",
            location: "South Boundary Wall",
            status: "operational",
            lastCheck: "Today 05:45 AM",
            details: "Automatic photocell timer set for 06:45 PM."
        }
    ]);

    function reportIssue(assetName: string) {
        toast.info(`Malfunction report initiated for ${assetName}. Forwarded to Control Room.`);
    }

    return (
        <AnimatedSection className="space-y-6">
            <SectionHeader
                eyebrow="Gate Security Operations"
                title="Perimeter Assets & Surveillance Infrastructure"
                description="Real-time operational status of barrier arms, RFID readers, CCTV arrays, and guardhouse communications."
            />

            <div className="grid gap-3 sm:grid-cols-3">
                <Card className="p-4">
                    <span className="text-xs font-semibold text-muted-foreground">Boom Barriers</span>
                    <p className="mt-2 text-xl font-bold text-emerald-600 dark:text-emerald-400">Both Operational</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">RFID FastTag auto-open armed</p>
                </Card>
                <Card className="p-4">
                    <span className="text-xs font-semibold text-muted-foreground">Surveillance Cameras</span>
                    <p className="mt-2 text-xl font-bold text-foreground">32 / 32 Online</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">0 Blind spots detected</p>
                </Card>
                <Card className="p-4">
                    <span className="text-xs font-semibold text-muted-foreground">Emergency Siren Test</span>
                    <p className="mt-2 text-xl font-bold text-primary">Tested OK</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Last drill: Yesterday 11:00 AM</p>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {gateAssets.map((asset) => {
                    const isOperational = asset.status === "operational";
                    return (
                        <Card key={asset.id} className="p-4 space-y-3">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
                                        {asset.id.includes("cctv") ? <Camera size={18} /> : asset.id.includes("intercom") ? <Radio size={18} /> : <Shield size={18} />}
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-foreground">{asset.name}</h4>
                                        <p className="text-xs text-muted-foreground">{asset.location}</p>
                                    </div>
                                </div>
                                <StatusDot tone={isOperational ? "green" : "amber"} label={isOperational ? "Active" : "Attention"} />
                            </div>

                            <p className="text-xs text-muted-foreground leading-relaxed">{asset.details}</p>

                            <div className="flex items-center justify-between pt-2 border-t text-xs">
                                <span className="text-muted-foreground font-mono">{asset.lastCheck}</span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => reportIssue(asset.name)}
                                    className="text-xs text-amber-600 hover:text-amber-700"
                                >
                                    <AlertTriangle size={13} />
                                    Report Glitch
                                </Button>
                            </div>
                        </Card>
                    );
                })}
            </div>
        </AnimatedSection>
    );
}

// ─── Residents / Owners / Tenants: Amenities & Common Facilities ────────────
function ResidentAmenitiesView() {
    const amenities = [
        {
            id: "fac-pool",
            name: "Infinity Swimming Pool & Splash Deck",
            location: "Clubhouse Terrace, 2nd Floor",
            hours: "06:00 AM – 10:00 AM & 04:30 PM – 09:30 PM",
            status: "operational",
            notes: "Lifeguard on duty during evening slots. Standard swim wear mandatory."
        },
        {
            id: "fac-gym",
            name: "Modern Health & Fitness Gymnasium",
            location: "Clubhouse, Ground Floor",
            hours: "05:30 AM – 11:00 PM (Daily)",
            status: "operational",
            notes: "Personal trainer available. Clean sports footwear required."
        },
        {
            id: "fac-hall",
            name: "Multipurpose Community Banquet Hall",
            location: "Central Courtyard",
            hours: "Bookings: 10:00 AM – 11:00 PM",
            status: "operational",
            notes: "Available for family functions and festive celebrations via society office."
        },
        {
            id: "fac-court",
            name: "Synthetic Badminton & Tennis Court",
            location: "Adjacent to Tower B",
            hours: "06:00 AM – 09:00 PM",
            status: "operational",
            notes: "Floodlights active automatically from 06:30 PM onwards."
        },
        {
            id: "fac-lift-b",
            name: "Tower B Service Elevator",
            location: "Tower B Wing",
            hours: "24x7 Operations",
            status: "degraded",
            notes: "Technician inspecting intermittent floor sensor. Passenger Lift 1 operational."
        },
        {
            id: "fac-kids",
            name: "Children's Play Park & Sandbox",
            location: "East Garden Lawn",
            hours: "06:00 AM – 08:30 PM",
            status: "operational",
            notes: "Daily equipment sanitization completed every morning."
        }
    ];

    return (
        <AnimatedSection className="space-y-6">
            <SectionHeader
                eyebrow="Society Amenities"
                title="Community Facilities & Club Status"
                description="Check operational hours, live availability, and safety guidelines across society amenities."
                action={
                    <Link href="/complaints">
                        <Button variant="outline" className="gap-1.5 text-xs">
                            <AlertTriangle size={14} />
                            Report Amenity Malfunction
                        </Button>
                    </Link>
                }
            />

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {amenities.map((item) => {
                    const isNormal = item.status === "operational";
                    return (
                        <Card key={item.id} className="p-5 space-y-3.5">
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2.5">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                                        {item.id.includes("pool") ? <Waves size={20} /> : item.id.includes("gym") ? <Activity size={20} /> : <Sparkles size={20} />}
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-foreground leading-snug">{item.name}</h4>
                                        <p className="text-xs text-muted-foreground">{item.location}</p>
                                    </div>
                                </div>
                                <StatusDot tone={isNormal ? "green" : "amber"} label={isNormal ? "Open" : "Maintenance"} />
                            </div>

                            <div className="space-y-1 rounded-lg bg-muted/40 p-2.5 text-xs">
                                <div className="flex items-center gap-1.5 font-semibold text-foreground">
                                    <Clock size={13} className="text-muted-foreground" />
                                    <span>Timings:</span>
                                </div>
                                <p className="text-muted-foreground pl-4">{item.hours}</p>
                            </div>

                            <p className="text-xs text-muted-foreground leading-relaxed">{item.notes}</p>

                            <div className="pt-2 border-t flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">Managed by Society Estate</span>
                                <Link href="/complaints">
                                    <span className="font-semibold text-primary hover:underline">Report Issue</span>
                                </Link>
                            </div>
                        </Card>
                    );
                })}
            </div>
        </AnimatedSection>
    );
}

// ─── Management Committee / Admin Full Facility Tracking ──────────────────
function ManagementFacilitiesView() {
    const { userProfile } = useAuth();
    const societyId = userProfile?.societyId || "soc-ajanta-genx";
    const [facilityList, setFacilityList] = useState<Facility[]>([]);
    const [amenityBookings, setAmenityBookings] = useState<AmenityBooking[]>([]);
    const [cancellingBookingId, setCancellingBookingId] = useState<string | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string>("all");
    const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null);
    const [showLogModal, setShowLogModal] = useState(false);
    const [logType, setLogType] = useState<"scheduled_maintenance" | "emergency_repair" | "inspection">("scheduled_maintenance");
    const [logNotes, setLogNotes] = useState("");
    const [logCost, setLogCost] = useState("");

    useEffect(() => {
        const unsub = subscribeFacilities(societyId, setFacilityList);
        return () => unsub();
    }, [societyId, userProfile?.uid]);

    useEffect(() => {
        const unsub = subscribeAmenityBookings(societyId, undefined, setAmenityBookings);
        return () => unsub();
    }, [societyId, userProfile?.uid]);

    async function handleCancelBooking(bookingId: string) {
        setCancellingBookingId(bookingId);
        try {
            await cancelAmenityBooking(bookingId, userProfile?.uid || "admin", societyId);
            toast.success(`Booking #${bookingId} cancelled and slot released.`);
        } catch (err: any) {
            toast.error(err.message || "Failed to cancel booking.");
        } finally {
            setCancellingBookingId(null);
        }
    }

    const filteredFacilities = facilityList.filter(
        (f) => selectedCategory === "all" || f.category === selectedCategory
    );

    const operationalCount = facilityList.filter((f) => f.status === "operational").length;
    const maintenanceCount = facilityList.filter((f) => f.status === "under_maintenance").length;
    const degradedCount = facilityList.filter((f) => f.status === "degraded" || f.status === "out_of_service").length;
    const totalOpenIssues = facilityList.reduce((acc, f) => acc + (f.openIssueCount || 0), 0);

    function updateStatus(facilityId: string, newStatus: FacilityStatus) {
        setFacilityList(
            facilityList.map((f) => (f.id === facilityId ? { ...f, status: newStatus } : f))
        );
    }

    async function handleLogService(e: React.FormEvent) {
        e.preventDefault();
        if (!selectedFacility) return;

        await logMaintenanceService(selectedFacility.id, {
            type: logType,
            notes: logNotes.trim() || "Maintenance service completed.",
            cost: Number(logCost) || 0,
            staffId: userProfile?.uid || selectedFacility.responsibleStaffId || "staff-deepak",
            actorUserId: userProfile?.uid || "user-manager"
        });

        toast.success(`Service logged for ${selectedFacility.name}. Asset maintenance records updated in Firestore.`);
        setShowLogModal(false);
        setLogNotes("");
        setLogCost("");
    }

    return (
        <AnimatedSection className="space-y-6">
            <SectionHeader
                eyebrow="Infrastructure Asset Tracking"
                title="Facilities & Asset Maintenance"
                description="Monitor passenger elevators, high-tension substations, water supply pumps, backup generators, and maintenance logs."
            />

            {/* Summary stats */}
            <div className="grid gap-3 sm:grid-cols-4">
                <Card className="flex items-center gap-3 p-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/50">
                        <CheckCircle size={17} className="text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                        <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{operationalCount}</p>
                        <p className="text-xs text-muted-foreground">Operational Assets</p>
                    </div>
                </Card>

                <Card className="flex items-center gap-3 p-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/50">
                        <Wrench size={17} className="text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                        <p className="text-xl font-bold text-amber-700 dark:text-amber-400">{maintenanceCount}</p>
                        <p className="text-xs text-muted-foreground">Under Scheduled Service</p>
                    </div>
                </Card>

                <Card className="flex items-center gap-3 p-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 dark:bg-red-950/50">
                        <AlertTriangle size={17} className="text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                        <p className="text-xl font-bold text-red-700 dark:text-red-400">{degradedCount}</p>
                        <p className="text-xs text-muted-foreground">Degraded / Issue</p>
                    </div>
                </Card>

                <Card className="flex items-center gap-3 p-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950/50">
                        <FileText size={17} className="text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                        <p className="text-xl font-bold text-indigo-700 dark:text-indigo-400">{totalOpenIssues}</p>
                        <p className="text-xs text-muted-foreground">Open Asset Issues</p>
                    </div>
                </Card>
            </div>

            {/* Category filter pills */}
            <div className="flex flex-wrap gap-1.5">
                {[
                    { id: "all", label: `All Assets (${facilityList.length})` },
                    { id: "lift", label: "Elevators" },
                    { id: "generator", label: "Backup Power" },
                    { id: "water_supply", label: "Water Pumps" },
                    { id: "electrical", label: "Substation" },
                    { id: "swimming_pool", label: "Pool & Deck" }
                ].map((cat) => (
                    <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`rounded-full px-3.5 py-1.5 text-xs font-semibold rx-transition ${selectedCategory === cat.id
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground hover:text-foreground"
                            }`}
                    >
                        {cat.label}
                    </button>
                ))}
            </div>

            {/* Facilities list — table style on desktop */}
            <Card className="hidden overflow-hidden lg:block">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b bg-muted/30">
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Asset</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Location</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Responsible Person</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Last Service</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Next Service</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Open Issues</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">History</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {filteredFacilities.map((facility) => {
                            const assignedStaff = staff.find((s) => s.id === facility.responsibleStaffId);
                            const statusTone = facility.status === "operational"
                                ? "green"
                                : facility.status === "under_maintenance"
                                    ? "amber"
                                    : "red";

                            return (
                                <tr key={facility.id} className="rx-transition hover:bg-muted/20">
                                    <td className="px-4 py-3.5">
                                        <p className="font-semibold">{facility.name}</p>
                                        <p className="text-xs text-muted-foreground capitalize">{facility.category.replace("_", " ")}</p>
                                    </td>
                                    <td className="px-4 py-3.5">
                                        <StatusDot tone={statusTone} label={facilityStatusLabels[facility.status]} />
                                    </td>
                                    <td className="px-4 py-3.5 text-xs text-muted-foreground">{facility.location}</td>
                                    <td className="px-4 py-3.5 text-xs">
                                        {assignedStaff ? (
                                            <div>
                                                <p className="font-semibold text-foreground">{assignedStaff.name}</p>
                                                <p className="text-muted-foreground font-mono">{assignedStaff.phone}</p>
                                            </div>
                                        ) : (
                                            <span className="text-muted-foreground/50">Unassigned</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3.5 font-mono text-xs text-muted-foreground">
                                        {facility.lastMaintenanceDate || "—"}
                                    </td>
                                    <td className="px-4 py-3.5 font-mono text-xs font-semibold text-primary">
                                        {facility.nextMaintenanceDate}
                                    </td>
                                    <td className="px-4 py-3.5 text-xs">
                                        {(facility.openIssueCount || 0) > 0 ? (
                                            <span className="rounded bg-red-100 px-2 py-0.5 font-semibold text-red-800 dark:bg-red-950/60 dark:text-red-300">
                                                {facility.openIssueCount} open issue
                                            </span>
                                        ) : (
                                            <span className="text-muted-foreground">0 open</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3.5 text-xs text-muted-foreground font-mono">
                                        {facility.serviceHistoryCount ?? 0} logs
                                    </td>
                                    <td className="px-4 py-3.5 text-right">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                setSelectedFacility(facility);
                                                setShowLogModal(true);
                                            }}
                                        >
                                            <FileText size={13} />
                                            Log Service
                                        </Button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </Card>

            {/* Mobile card grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:hidden">
                {filteredFacilities.map((facility) => {
                    const assignedStaff = staff.find((s) => s.id === facility.responsibleStaffId);
                    const statusTone = facility.status === "operational"
                        ? "green"
                        : facility.status === "under_maintenance"
                            ? "amber"
                            : "red";

                    return (
                        <Card key={facility.id} className="p-4 space-y-3">
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                        {facility.category.replace("_", " ")}
                                    </p>
                                    <h4 className="mt-0.5 font-bold">{facility.name}</h4>
                                </div>
                                <StatusDot tone={statusTone} label={facilityStatusLabels[facility.status]} />
                            </div>

                            <div className="space-y-1.5 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Location</span>
                                    <span className="font-medium">{facility.location}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Responsible Person</span>
                                    <span className="font-medium">{assignedStaff?.name ?? "Unassigned"}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Last Service</span>
                                    <span className="font-mono text-muted-foreground">{facility.lastMaintenanceDate || "—"}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Next Service</span>
                                    <span className="font-mono font-semibold text-primary">{facility.nextMaintenanceDate}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Open Issues</span>
                                    <span className="font-semibold text-red-600 dark:text-red-400">
                                        {facility.openIssueCount || 0} issue{facility.openIssueCount === 1 ? "" : "s"}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Service History</span>
                                    <span className="font-medium">{facility.serviceHistoryCount ?? 0} logs</span>
                                </div>
                            </div>

                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full"
                                onClick={() => {
                                    setSelectedFacility(facility);
                                    setShowLogModal(true);
                                }}
                            >
                                <FileText size={13} />
                                Log Service Work
                            </Button>
                        </Card>
                    );
                })}
            </div>

            {/* Live Amenity Reservations Table */}
            <div className="space-y-3 pt-6 border-t">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-base font-bold text-foreground">Resident Amenity Reservations ({amenityBookings.length} Total)</h3>
                        <p className="text-xs text-muted-foreground">
                            Synchronized live from Firestore for society #{societyId}.
                        </p>
                    </div>
                    <Badge tone="blue">Real-time Multi-tenant</Badge>
                </div>

                {amenityBookings.length === 0 ? (
                    <div className="rounded-xl border border-dashed p-8 text-center bg-muted/10">
                        <p className="text-sm font-semibold text-muted-foreground">No resident reservations recorded yet.</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            When residents book swimming pool, gym, or badminton court slots, they will appear here in real time.
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
                                    const isCancelling = cancellingBookingId === b.id;
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
                                            </td>
                                            <td className="p-3">
                                                <Badge tone={isConfirmed ? "green" : b.status === "completed" ? "blue" : "red"}>
                                                    {b.status.toUpperCase()}
                                                </Badge>
                                            </td>
                                            <td className="p-3 text-right">
                                                {isConfirmed && (
                                                    <Button
                                                        size="sm"
                                                        variant="danger"
                                                        className="h-7 text-xs"
                                                        disabled={isCancelling}
                                                        onClick={() => handleCancelBooking(b.id)}
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

            {/* Log service modal */}
            {showLogModal && selectedFacility && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md rx-card-elevated overflow-hidden">
                        <div className="border-b px-5 py-4">
                            <h3 className="text-base font-bold">Record Infrastructure Service Log</h3>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                                Document maintenance for <span className="font-semibold text-foreground">{selectedFacility.name}</span>.
                            </p>
                        </div>

                        <form onSubmit={handleLogService} className="p-5 space-y-3.5">
                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground mb-1">Service Type</label>
                                <select
                                    value={logType}
                                    onChange={(e) => setLogType(e.target.value as any)}
                                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/25"
                                >
                                    <option value="scheduled_maintenance">Scheduled AMC Service</option>
                                    <option value="emergency_repair">Breakdown / Emergency Repair</option>
                                    <option value="inspection">Preventive Inspection & Audit</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground mb-1">Service Notes <span className="text-danger">*</span></label>
                                <textarea
                                    required
                                    rows={3}
                                    value={logNotes}
                                    onChange={(e) => setLogNotes(e.target.value)}
                                    placeholder="Describe replacement parts, calibration performed, technician sign-off…"
                                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/25 resize-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground mb-1">Maintenance Cost (₹)</label>
                                <input
                                    type="number"
                                    value={logCost}
                                    onChange={(e) => setLogCost(e.target.value)}
                                    placeholder="e.g. 4500 (Leave blank if covered under AMC)"
                                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/25"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground mb-1">Asset Operational Status</label>
                                <select
                                    value={selectedFacility.status}
                                    onChange={(e) => updateStatus(selectedFacility.id, e.target.value as FacilityStatus)}
                                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/25"
                                >
                                    {Object.entries(facilityStatusLabels).map(([key, lbl]) => (
                                        <option key={key} value={key}>{lbl}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2 border-t">
                                <Button type="button" variant="ghost" size="sm" onClick={() => setShowLogModal(false)}>
                                    Cancel
                                </Button>
                                <Button type="submit" size="sm">Save Maintenance Record</Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AnimatedSection>
    );
}
