"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  Building2,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  FileText,
  Loader2,
  MapPin,
  Phone,
  ShieldAlert,
  ShieldCheck,
  Star,
  User,
  Users,
  Wrench,
  X
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { AnimatedSection, Badge, Button, Card, SectionHeader, StatusDot } from "@/components/ui";
import { amenities, formatCurrency, serviceProviders, titleCase } from "@resolvex/utils";
import type { Amenity, AmenityBooking, Bill, ServiceProvider } from "@resolvex/types";
import { cn } from "@resolvex/ui";
import { useSessionStore } from "@/lib/store";
import { useAuth } from "@/lib/auth-context";
import {
  cancelAmenityBooking,
  createAmenityBooking,
  createServiceBooking,
  payBill,
  subscribeAmenityBookings,
  subscribeBills,
  subscribeServiceBookings,
  updateServiceBookingStatus
} from "@/lib/services";

const DATES = [
  { id: "2026-09-05", label: "Today", dateStr: "Sep 5" },
  { id: "2026-09-06", label: "Tomorrow", dateStr: "Sep 6" },
  { id: "2026-09-07", label: "Sunday", dateStr: "Sep 7" }
];

const DEFAULT_SLOTS = ["07:00 - 08:00", "09:00 - 10:00", "11:00 - 12:00", "16:00 - 17:00", "18:00 - 19:00", "20:00 - 21:00"];

export default function ServicesPage() {
  const { activeRole } = useSessionStore();

  if (activeRole === "service_provider") {
    return (
      <AppShell>
        <ContractorServicePortalView />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <ResidentServicesView />
    </AppShell>
  );
}

// ─── Service Provider: Contractor Management Portal ─────────────────────────
function ContractorServicePortalView() {
  const { userProfile } = useAuth();
  const societyId = userProfile?.societyId || "soc-ajanta-genx";
  const [activeJobs, setActiveJobs] = useState<any[]>([]);

  useEffect(() => {
    const unsub = subscribeServiceBookings(societyId, (bookings) => {
      const mapped = bookings.map((b) => ({
        id: b.id,
        flatNumber: b.householdId ? `Household ${b.householdId.replace("hh-", "").toUpperCase()}` : "Resident Flat",
        residentName: b.userName || "Resident",
        phone: b.phone || "+91 98765 00000",
        category: b.serviceName || b.category || "Home Service",
        description: b.notes || `${b.category || "Service"} requested at ${b.scheduledAt || "scheduled time"}.`,
        slot: b.scheduledAt || "Scheduled",
        status: b.status === "requested" ? "scheduled" : b.status,
        amount: b.amount || 350
      }));
      setActiveJobs(mapped);
    });
    return () => unsub();
  }, [societyId, userProfile?.uid]);

  async function handleCompleteJob(jobId: string) {
    try {
      await updateServiceBookingStatus(jobId, "completed", userProfile?.uid || "contractor", societyId);
      toast.success(`Job #${jobId} marked as completed. Resident notification and invoice sent.`);
    } catch (err: any) {
      toast.error(err.message || "Failed to update job status.");
    }
  }

  async function handleAcceptJob(jobId: string) {
    try {
      await updateServiceBookingStatus(jobId, "in_progress", userProfile?.uid || "contractor", societyId);
      toast.success(`Job #${jobId} accepted. ETA shared with resident.`);
    } catch (err: any) {
      toast.error(err.message || "Failed to accept job.");
    }
  }

  return (
    <AnimatedSection className="space-y-6">
      <SectionHeader
        eyebrow="Contractor Operations"
        title="Vendor Service Portal — Rapid Plumbing Services"
        description="Manage assigned resident bookings, update job statuses, track society vendor badges, and view rate cards."
      />

      {/* Contractor Profile Overview */}
      <Card className="p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary font-bold text-xl">
              <Wrench size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-foreground">Rapid Plumbing Services</h3>
                <Badge tone="teal">Society Authorized Partner</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Vendor ID: <span className="font-mono font-semibold">VND-PLUMB-09</span> · Gate Access: All Gates Authorized
              </p>
              <div className="flex items-center gap-2 mt-1 text-xs">
                <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold">
                  <Star size={13} className="fill-current" />
                  <span>4.8</span>
                </div>
                <span className="text-muted-foreground">(124 Society Resident Reviews)</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => toast.info("Vendor profile and rate card are synchronized with Ajanta GenX Estate Office.")}>
              Rate Card Verified
            </Button>
          </div>
        </div>
      </Card>

      {/* KPI Stats */}
      <div className="grid gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <span className="text-xs font-semibold text-muted-foreground">Today's Bookings</span>
          <p className="mt-2 text-xl font-bold text-foreground">2 Dispatches</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Flat A-1204 & B-402</p>
        </Card>
        <Card className="p-4">
          <span className="text-xs font-semibold text-muted-foreground">In Progress</span>
          <p className="mt-2 text-xl font-bold text-amber-600 dark:text-amber-400">
            {activeJobs.filter((j) => j.status === "in_progress").length} Active
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">Flat A-1204 underway</p>
        </Card>
        <Card className="p-4">
          <span className="text-xs font-semibold text-muted-foreground">Completed Today</span>
          <p className="mt-2 text-xl font-bold text-emerald-600 dark:text-emerald-400">
            {activeJobs.filter((j) => j.status === "completed").length} Done
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">All signed by residents</p>
        </Card>
        <Card className="p-4">
          <span className="text-xs font-semibold text-muted-foreground">Avg Satisfaction</span>
          <p className="mt-2 text-xl font-bold text-primary">98.2%</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Top rated plumbing partner</p>
        </Card>
      </div>

      {/* Active Work Queue */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-foreground">Resident Service Bookings</h3>

        <div className="space-y-3">
          {activeJobs.map((job) => {
            const isCompleted = job.status === "completed";
            const isInProgress = job.status === "in_progress";

            return (
              <Card key={job.id} className="p-5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-base text-foreground">{job.flatNumber}</span>
                      <span className="text-xs font-mono text-muted-foreground">#{job.id}</span>
                      <Badge tone={isCompleted ? "green" : isInProgress ? "amber" : "blue"}>
                        {isCompleted ? "Completed" : isInProgress ? "In Progress" : "Scheduled"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Resident: <span className="font-semibold text-foreground">{job.residentName}</span> · <span className="font-mono">{job.phone}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    <span className="font-semibold text-muted-foreground">{job.slot}</span>
                    <span className="font-bold text-sm text-foreground">₹{job.amount}</span>
                  </div>
                </div>

                <p className="text-sm text-foreground leading-relaxed">{job.description}</p>

                <div className="pt-2 border-t flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <MapPin size={13} />
                    <span>Ajanta GenX Society Premises</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {job.status === "scheduled" && (
                      <Button size="sm" onClick={() => handleAcceptJob(job.id)} className="text-xs gap-1">
                        <CheckCircle2 size={13} />
                        Accept & Start Job
                      </Button>
                    )}
                    {job.status === "in_progress" && (
                      <Button size="sm" onClick={() => handleCompleteJob(job.id)} className="text-xs gap-1 bg-emerald-600 hover:bg-emerald-700">
                        <CheckCircle2 size={13} />
                        Mark Work Completed
                      </Button>
                    )}
                    {isCompleted && (
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 size={14} />
                        Job Finished & Billed
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Approved Society Rate Card */}
      <Card className="p-5 space-y-3">
        <h4 className="text-sm font-bold text-foreground">Approved Society Rate Card (Fixed Pricing)</h4>
        <div className="grid gap-2 sm:grid-cols-3 text-xs">
          <div className="rounded-lg bg-muted/40 p-3 flex justify-between">
            <span className="text-muted-foreground">Base Diagnostic Inspection</span>
            <span className="font-bold text-foreground">₹199</span>
          </div>
          <div className="rounded-lg bg-muted/40 p-3 flex justify-between">
            <span className="text-muted-foreground">Tap / Mixer Replacement</span>
            <span className="font-bold text-foreground">₹350</span>
          </div>
          <div className="rounded-lg bg-muted/40 p-3 flex justify-between">
            <span className="text-muted-foreground">Concealed Leak Detection</span>
            <span className="font-bold text-foreground">₹799</span>
          </div>
        </div>
      </Card>
    </AnimatedSection>
  );
}

// ─── Resident Services View: Verified Home Services, Amenities & Dues ────────
function ResidentServicesView() {
  const { userProfile } = useAuth();
  const societyId = userProfile?.societyId || "soc-ajanta-genx";
  const householdId = userProfile?.householdId || "hh-a-1204";

  // Amenity Booking Modal State
  const [selectedAmenity, setSelectedAmenity] = useState<Amenity | null>(null);
  const [bookingDate, setBookingDate] = useState(DATES[0].id);
  const [selectedSlot, setSelectedSlot] = useState(DEFAULT_SLOTS[1]);
  const [guestCount, setGuestCount] = useState(1);
  const [isBookingSubmitting, setIsBookingSubmitting] = useState(false);
  const [myAmenityBookings, setMyAmenityBookings] = useState<AmenityBooking[]>([]);
  const [cancellingBookingId, setCancellingBookingId] = useState<string | null>(null);

  // Service Provider Modal State
  const [selectedProvider, setSelectedProvider] = useState<ServiceProvider | null>(null);
  const [providerWindow, setProviderWindow] = useState("morning");
  const [providerNotes, setProviderNotes] = useState("");
  const [isEmergency, setIsEmergency] = useState(false);

  // Bill Payment Modal State
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"upi" | "netbanking" | "card">("upi");
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [activeBill, setActiveBill] = useState<Bill | null>(null);
  const [lastReceiptId, setLastReceiptId] = useState<string>("REC-2026-9182");

  // Subscribe to bills
  useEffect(() => {
    const unsub = subscribeBills(societyId, householdId, (billsList) => {
      const q3Bill = billsList.find((b) => b.period?.includes("Q3") || b.id === "bill-1" || b.id.includes("q3")) || billsList[0];
      if (q3Bill) {
        setActiveBill(q3Bill);
        if (q3Bill.status === "paid") {
          setIsPaid(true);
        }
      }
    });
    return () => unsub();
  }, [societyId, householdId]);

  // Subscribe to resident's live amenity bookings
  useEffect(() => {
    if (!societyId || !userProfile?.uid) return;
    const unsub = subscribeAmenityBookings(societyId, userProfile.uid, setMyAmenityBookings);
    return () => unsub();
  }, [societyId, userProfile?.uid]);

  function handleOpenAmenityModal(amenity: Amenity, slot?: string) {
    setSelectedAmenity(amenity);
    setSelectedSlot(slot || DEFAULT_SLOTS[1]);
    setGuestCount(1);
  }

  async function handleConfirmAmenityBooking() {
    if (!selectedAmenity) return;
    if (!userProfile?.uid) {
      toast.error("Please sign in with your resident account to reserve amenities.");
      return;
    }
    const parsedGuestCount = Number(guestCount);
    if (isNaN(parsedGuestCount) || !Number.isInteger(parsedGuestCount) || parsedGuestCount < 0) {
      toast.error("Please enter a valid whole number of guests (0 or more).");
      return;
    }
    const facilityCapacity = typeof selectedAmenity.capacity === "number" ? selectedAmenity.capacity : 20;
    if (parsedGuestCount > facilityCapacity) {
      toast.error(`Booking exceeds facility capacity. Maximum allowed capacity is ${facilityCapacity}.`);
      return;
    }
    const dateObj = DATES.find((d) => d.id === bookingDate);
    const dateLabel = dateObj ? `${dateObj.label} (${dateObj.dateStr})` : bookingDate;

    setIsBookingSubmitting(true);
    try {
      const booking = await createAmenityBooking({
        societyId,
        amenityId: selectedAmenity.id,
        userId: userProfile.uid,
        userName: userProfile.displayName || "Resident",
        householdId,
        slot: selectedSlot,
        date: bookingDate,
        guestCount
      });
      toast.success(
        `Booking Confirmed: ${selectedAmenity.name} for ${dateLabel} at ${selectedSlot}. Pass #${booking.qrPassToken} issued.`
      );
      setSelectedAmenity(null);
    } catch (err: any) {
      toast.error(err.message || "Could not complete booking");
    } finally {
      setIsBookingSubmitting(false);
    }
  }

  async function handleResidentCancelBooking(bookingId: string) {
    if (!bookingId || !societyId) return;
    setCancellingBookingId(bookingId);
    try {
      await cancelAmenityBooking(bookingId, userProfile?.uid || "", societyId);
      toast.success("Reservation cancelled and slot released.");
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel reservation.");
    } finally {
      setCancellingBookingId(null);
    }
  }

  async function handleConfirmServiceRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProvider) return;
    const timeWindowStr =
      providerWindow === "morning"
        ? "Morning (09:00 - 12:00)"
        : providerWindow === "afternoon"
        ? "Afternoon (12:00 - 15:00)"
        : "Evening (15:00 - 18:00)";

    try {
      const booking = await createServiceBooking({
        societyId,
        householdId,
        userId: userProfile?.uid || "usr-resident-1",
        userName: userProfile?.displayName || "Resident",
        serviceProviderId: selectedProvider.id,
        serviceName: selectedProvider.name,
        category: selectedProvider.category,
        scheduledAt: timeWindowStr,
        notes: providerNotes?.trim() || undefined
      });
      toast.success(
        `Service Dispatched: ${selectedProvider.name} scheduled for ${timeWindowStr}. Booking ref #${booking.id}.`
      );
      setSelectedProvider(null);
      setProviderNotes("");
      setIsEmergency(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to book service request.");
    }
  }

  async function handleProcessPayment() {
    setIsProcessingPayment(true);
    try {
      const targetBillId = activeBill?.id || "bill-gv-q3-2026";
      const res = await payBill(targetBillId, {
        paymentMethod,
        amount: activeBill?.amount || 4250,
        actorUserId: userProfile?.uid || "usr-resident-1",
        societyIdOverride: societyId,
        householdIdOverride: householdId
      });
      setLastReceiptId(res.receipt.id);
      setIsPaid(true);
      setPaymentSuccess(true);
      toast.success(`Society Maintenance paid successfully. Official receipt #${res.receipt.id} generated.`);
    } catch (err: any) {
      toast.error(err.message || "Payment processing failed");
    } finally {
      setIsProcessingPayment(false);
    }
  }

  return (
    <AnimatedSection className="space-y-8">
      <SectionHeader
        eyebrow="Services & Amenities"
        title="Service & Facility Management"
        description="Book trusted home services, reserve society amenity slots with real-time capacity checks, and settle maintenance dues."
      />

      {/* Operational overview cards */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border p-5 space-y-2 bg-card">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Wrench size={18} />
          </div>
          <h3 className="font-bold">Verified Home Services</h3>
          <p className="text-sm text-muted-foreground">
            Pre-vetted electricians, plumbers, and technicians with security gate pre-clearance and transparent flat rates.
          </p>
        </div>
        <div className="rounded-xl border p-5 space-y-2 bg-card">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary/10 text-secondary">
            <CalendarCheck size={18} />
          </div>
          <h3 className="font-bold">Amenity Reservations</h3>
          <p className="text-sm text-muted-foreground">
            Guaranteed slot reservation, automated guest limits, and QR gate passes for clubhouse, pool, and courts.
          </p>
        </div>
        <div className="rounded-xl border p-5 space-y-2 bg-card">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <ShieldCheck size={18} />
          </div>
          <h3 className="font-bold">Accounting & Maintenance</h3>
          <p className="text-sm text-muted-foreground">
            Itemized quarterly maintenance ledger with instant receipt generation, sinking fund tracking, and UPI clearance.
          </p>
        </div>
      </div>

      {/* Service providers */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold">Verified Service Providers</h2>
            <p className="text-xs text-muted-foreground">Resident-rated contractors registered with society management</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {serviceProviders.map((provider) => (
            <Card key={provider.id} className="p-5 flex flex-col space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
                  <Wrench size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold truncate">{provider.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{provider.category}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0 bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded text-xs font-bold">
                  <Star size={11} className="fill-current" />
                  <span>{provider.rating}</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm py-2 border-y border-dashed">
                <div>
                  <p className="text-xs text-muted-foreground">Base Visit Charge</p>
                  <p className="text-base font-bold text-foreground">{formatCurrency(provider.startingPrice)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Next Arrival</p>
                  <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{provider.nextAvailable}</p>
                </div>
              </div>

              <Button
                className="w-full mt-auto"
                size="sm"
                onClick={() => setSelectedProvider(provider)}
              >
                Request Service
              </Button>
            </Card>
          ))}
        </div>
      </section>

      {/* Amenity booking */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-bold">Amenity Booking</h2>
          <p className="text-xs text-muted-foreground">Reserve community amenities for yourself and verified guests</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {amenities.map((amenity) => (
            <Card key={amenity.id} className="p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-base">{amenity.name}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Hours: {amenity.openingHour} – {amenity.closingHour} · {amenity.slotMinutes} min duration · Max {amenity.capacity} people
                  </p>
                </div>
                <Badge tone={amenity.charge > 0 ? "amber" : "green"}>
                  {amenity.charge > 0 ? `${formatCurrency(amenity.charge)} / slot` : "Complimentary"}
                </Badge>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold text-muted-foreground">Quick Slot Reservation (Today)</p>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                  {DEFAULT_SLOTS.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => handleOpenAmenityModal(amenity, slot)}
                      className="rounded-lg border bg-background py-1.5 text-xs font-semibold rx-transition hover:border-primary hover:bg-primary/5 hover:text-primary text-center"
                    >
                      {slot.split(" - ")[0]}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => handleOpenAmenityModal(amenity)}
              >
                <CalendarCheck size={14} className="mr-1.5" />
                Configure & Book Slot
              </Button>
            </Card>
          ))}
        </div>
      </section>

      {/* My Reserved Amenity Passes */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold">My Active Amenity Passes</h2>
            <p className="text-xs text-muted-foreground">Present QR pass code to facility attendants on entry</p>
          </div>
          <Badge tone="blue">{myAmenityBookings.filter((b) => b.status === "confirmed").length} Active</Badge>
        </div>

        {myAmenityBookings.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center bg-muted/10">
            <p className="text-sm font-semibold text-muted-foreground">No amenity reservations yet.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Select a facility above to reserve a slot. Your booking passes will appear here.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {myAmenityBookings.map((b) => {
              const isConfirmed = b.status === "confirmed";
              const isCancelling = cancellingBookingId === b.id;
              const amenityInfo = amenities.find((a) => a.id === b.amenityId);

              return (
                <Card key={b.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge tone={isConfirmed ? "green" : "red"}>
                      {titleCase(b.status)}
                    </Badge>
                    <span className="font-mono text-xs font-bold text-primary">
                      {b.qrPassToken || b.id}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-bold text-sm text-foreground">
                      {amenityInfo?.name || b.amenityId}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      📅 {b.date} · ⏰ {b.slot || `${b.startTime} - ${b.endTime}`}
                    </p>
                    <p className="text-2xs text-muted-foreground mt-0.5">
                      👥 {b.guestCount || 1} Person(s) · {b.charge ? formatCurrency(b.charge) : "Free"}
                    </p>
                  </div>

                  {isConfirmed && (
                    <div className="pt-2 border-t flex justify-end">
                      <Button
                        size="sm"
                        variant="danger"
                        className="h-7 text-xs"
                        disabled={isCancelling}
                        onClick={() => handleResidentCancelBooking(b.id)}
                      >
                        {isCancelling ? "Cancelling..." : "Cancel Slot"}
                      </Button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Bills & Payments */}
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-bold">Society Dues & Statements</h2>
          <p className="text-xs text-muted-foreground">Quarterly maintenance bill for Flat A-1204</p>
        </div>
        <Card className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold">Maintenance & Sinking Fund · Q3 2026</h3>
                <Badge tone={isPaid ? "green" : "amber"}>
                  {isPaid ? "Settled" : "Due Sep 15, 2026"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Invoice #BILL-2026-Q3-1204 · Flat A-1204 (Tower A) · Total ₹4,250
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isPaid ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toast.success(`Downloading receipt ${lastReceiptId}.pdf...`)}
                >
                  <Download size={14} className="mr-1.5" />
                  Download Receipt
                </Button>
              ) : (
                <Button onClick={() => { setPaymentSuccess(false); setPaymentModalOpen(true); }}>
                  <CreditCard size={15} className="mr-1.5" />
                  Pay Bill (₹4,250)
                </Button>
              )}
            </div>
          </div>
        </Card>
      </section>

      {/* ── Amenity Booking Modal ────────────────────────────────────────── */}
      {selectedAmenity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-xl border bg-card shadow-soft">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h3 className="text-base font-bold">Reserve {selectedAmenity.name}</h3>
                <p className="text-xs text-muted-foreground">Max {selectedAmenity.capacity} persons per slot · {selectedAmenity.slotMinutes} mins</p>
              </div>
              <button
                onClick={() => setSelectedAmenity(null)}
                className="rounded-md p-1 rx-transition hover:bg-muted"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Date Selection */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2">
                  Select Date
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {DATES.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setBookingDate(d.id)}
                      className={cn(
                        "rounded-lg border p-2.5 text-center rx-transition",
                        bookingDate === d.id
                          ? "border-primary bg-primary/10 text-primary font-bold shadow-xs"
                          : "border-border text-foreground hover:bg-muted"
                      )}
                    >
                      <p className="text-xs font-semibold">{d.label}</p>
                      <p className="text-xs opacity-75">{d.dateStr}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Slot Selection */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2">
                  Select Time Slot
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {DEFAULT_SLOTS.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setSelectedSlot(slot)}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-xs font-medium rx-transition text-center",
                        selectedSlot === slot
                          ? "border-primary bg-primary text-primary-foreground font-semibold shadow-xs"
                          : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                      )}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>

              {/* Guests Count */}
              <div className="rounded-lg border bg-muted/20 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-muted-foreground" />
                    <div>
                      <p className="text-sm font-semibold">Attendees / Guests</p>
                      <p className="text-xs text-muted-foreground">Including yourself (Max {selectedAmenity.capacity})</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setGuestCount((c) => Math.max(1, c - 1))}
                      className="h-8 w-8 rounded-md border bg-background text-sm font-bold hover:bg-muted"
                    >
                      -
                    </button>
                    <span className="w-6 text-center font-bold text-sm">{guestCount}</span>
                    <button
                      type="button"
                      onClick={() => setGuestCount((c) => Math.min(selectedAmenity.capacity, c + 1))}
                      className="h-8 w-8 rounded-md border bg-background text-sm font-bold hover:bg-muted"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Price Calculation */}
              <div className="rounded-lg border border-dashed p-3.5 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total Amenity Charge</span>
                <span className="font-bold text-base text-foreground">
                  {selectedAmenity.charge > 0 ? formatCurrency(selectedAmenity.charge) : "Free (Included in Maintenance)"}
                </span>
              </div>

              {/* Guidelines Disclaimer */}
              <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
                <AlertCircle size={14} className="shrink-0 mt-0.5 text-primary" />
                <p>
                  Cancellation without penalty is permitted up to 2 hours prior to the slot. Cleanliness and society club rules strictly apply.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t px-5 py-3.5 bg-muted/10">
              <Button variant="outline" size="sm" onClick={() => setSelectedAmenity(null)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleConfirmAmenityBooking} disabled={isBookingSubmitting}>
                {isBookingSubmitting ? (
                  <>
                    <Loader2 size={14} className="mr-1.5 animate-spin" />
                    Reserving...
                  </>
                ) : (
                  "Confirm Reservation"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Service Provider Request Modal ───────────────────────────────── */}
      {selectedProvider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-xl border bg-card shadow-soft">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h3 className="text-base font-bold">Request {selectedProvider.name}</h3>
                <p className="text-xs text-muted-foreground">{selectedProvider.category} · Base inspection {formatCurrency(selectedProvider.startingPrice)}</p>
              </div>
              <button
                onClick={() => setSelectedProvider(null)}
                className="rounded-md p-1 rx-transition hover:bg-muted"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmServiceRequest} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Unit Info */}
              <div className="rounded-lg border bg-muted/20 p-3 flex items-center gap-3">
                <MapPin size={16} className="text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-muted-foreground">Service Address</p>
                  <p className="text-sm font-bold text-foreground truncate">Flat A-1204, Tower A · Goyal Household</p>
                </div>
              </div>

              {/* Time Window */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2">
                  Preferred Arrival Window
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "morning", label: "Morning", time: "09:00 - 12:00" },
                    { id: "afternoon", label: "Afternoon", time: "12:00 - 15:00" },
                    { id: "evening", label: "Evening", time: "15:00 - 18:00" }
                  ].map((win) => (
                    <button
                      key={win.id}
                      type="button"
                      onClick={() => setProviderWindow(win.id)}
                      className={cn(
                        "rounded-lg border p-2 text-center rx-transition",
                        providerWindow === win.id
                          ? "border-primary bg-primary/10 text-primary font-bold shadow-xs"
                          : "border-border text-foreground hover:bg-muted"
                      )}
                    >
                      <p className="text-xs font-semibold">{win.label}</p>
                      <p className="text-[11px] text-muted-foreground">{win.time}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Problem / Work Required */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                  Job Description & Specific Instructions
                </label>
                <textarea
                  rows={3}
                  required
                  value={providerNotes}
                  onChange={(e) => setProviderNotes(e.target.value)}
                  placeholder="e.g. Master bathroom washbasin pipe leaking under sink. Requires washer replacement."
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary resize-none placeholder:text-muted-foreground/60"
                />
              </div>

              {/* Emergency toggle */}
              <label className="flex items-center gap-2 cursor-pointer rounded-lg border p-3 hover:bg-muted/20 rx-transition">
                <input
                  type="checkbox"
                  checked={isEmergency}
                  onChange={(e) => setIsEmergency(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary"
                />
                <div>
                  <p className="text-sm font-medium text-foreground">Urgent / Emergency Dispatch</p>
                  <p className="text-xs text-muted-foreground">Technician notified immediately for rapid dispatch</p>
                </div>
              </label>

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <Button type="button" variant="outline" size="sm" onClick={() => setSelectedProvider(null)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm">
                  Dispatch Request
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Bill Payment Modal ───────────────────────────────────────────── */}
      {paymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-xl border bg-card shadow-soft">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h3 className="text-base font-bold">Society Maintenance Payment</h3>
                <p className="text-xs text-muted-foreground">Invoice #BILL-2026-Q3-1204 · Due Sep 15, 2026</p>
              </div>
              <button
                onClick={() => setPaymentModalOpen(false)}
                className="rounded-md p-1 rx-transition hover:bg-muted"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {paymentSuccess ? (
              <div className="p-6 text-center space-y-4">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                  <CheckCircle2 size={28} />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-foreground">Payment Successful</h4>
                  <p className="text-xs text-muted-foreground mt-1">Receipt Ref: #{lastReceiptId} · Settled via {paymentMethod.toUpperCase()} (Simulated Gateway)</p>
                </div>
                <div className="rounded-lg border bg-muted/20 p-3.5 text-left text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Amount Paid:</span>
                    <span className="font-bold text-foreground">₹4,250.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Beneficiary:</span>
                    <span className="font-medium text-foreground">Ajanta GenX RWA Account</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Timestamp:</span>
                    <span className="font-mono text-muted-foreground">2026-09-05 15:45 IST</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 text-xs"
                    onClick={() => toast.success(`Receipt ${lastReceiptId}.pdf downloaded.`)}
                  >
                    <Download size={14} className="mr-1.5" />
                    Download PDF Receipt
                  </Button>
                  <Button
                    className="flex-1 text-xs"
                    onClick={() => setPaymentModalOpen(false)}
                  >
                    Done
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-5 space-y-4">
                {/* Itemized Table */}
                <div className="rounded-lg border bg-muted/20 p-3.5 space-y-2 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Quarterly Maintenance (₹4.5/sqft · 1,450 sqft)</span>
                    <span className="font-medium text-foreground">₹3,200.00</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Sinking & Capital Reserve Fund</span>
                    <span className="font-medium text-foreground">₹550.00</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Common Water & Sewage Cess</span>
                    <span className="font-medium text-foreground">₹500.00</span>
                  </div>
                  <div className="border-t border-dashed pt-2 flex justify-between font-bold text-sm text-foreground">
                    <span>Total Payable</span>
                    <span>₹4,250.00</span>
                  </div>
                </div>

                {/* Method selector */}
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2">
                    Select Payment Gateway Method
                  </label>
                  <div className="space-y-2">
                    {[
                      { id: "upi" as const, title: "UPI (Google Pay, PhonePe, Paytm, BHIM)", desc: "Instant zero surcharge" },
                      { id: "netbanking" as const, title: "Net Banking (HDFC, ICICI, SBI)", desc: "Direct NEFT / RTGS transfer" },
                      { id: "card" as const, title: "Credit / Debit Card", desc: "Visa, Mastercard, RuPay" }
                    ].map((m) => (
                      <label
                        key={m.id}
                        className={cn(
                          "flex items-start gap-3 rounded-lg border p-3 cursor-pointer rx-transition",
                          paymentMethod === m.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-muted/40"
                        )}
                      >
                        <input
                          type="radio"
                          name="paymentMethod"
                          checked={paymentMethod === m.id}
                          onChange={() => setPaymentMethod(m.id)}
                          className="mt-0.5 text-primary focus:ring-primary"
                        />
                        <div>
                          <p className="text-sm font-semibold text-foreground">{m.title}</p>
                          <p className="text-xs text-muted-foreground">{m.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t">
                  <Button variant="outline" size="sm" onClick={() => setPaymentModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    disabled={isProcessingPayment}
                    onClick={handleProcessPayment}
                  >
                    {isProcessingPayment ? (
                      <>
                        <Loader2 size={14} className="mr-1.5 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      "Authorize Payment of ₹4,250"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </AnimatedSection>
  );
}
