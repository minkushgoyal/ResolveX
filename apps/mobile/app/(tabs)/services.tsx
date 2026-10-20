import { useEffect, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import {
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  Clock,
  Dumbbell,
  Info,
  MapPin,
  QrCode,
  ShieldAlert,
  Sparkles,
  Star,
  Users,
  Wrench,
  X
} from "lucide-react-native";
import {
  amenities as initialAmenities,
  formatCurrency,
  serviceProviders as initialProviders
} from "@resolvex/utils";
import type { Amenity, AmenityBooking, ServiceProvider, UserProfile } from "@resolvex/types";
import {
  ActionButton,
  Card,
  colors,
  EmptyState,
  Muted,
  Pill,
  Screen,
  Title
} from "../../components/mobile-ui";
import {
  createAmenityBookingAsync,
  cancelAmenityBookingAsync,
  subscribeMyAmenityBookings,
  createServiceBookingAsync,
  subscribeMyServiceBookings,
  type MobileServiceRequestItem
} from "../../lib/booking-service";

type ServicesTab = "amenities" | "home_services" | "my_bookings";

import { useMobileSessionStore } from "../../lib/session-store";
import { StaffNotificationsView } from "../../components/staff-views";
import { SecurityPassScanView } from "../../components/security-views";

export default function ServicesScreen() {
  const activeRole = useMobileSessionStore((state) => state.userProfile?.role);

  if (activeRole === "maintenance_staff") {
    return <StaffNotificationsView />;
  }

  if (activeRole === "security_guard") {
    return (
      <Screen>
        <SecurityPassScanView />
      </Screen>
    );
  }

  const [activeTab, setActiveTab] = useState<ServicesTab>("amenities");
  const profile = useMobileSessionStore((state) => state.userProfile);

  // Amenities & Booking State
  const [amenityList] = useState<Amenity[]>([
    ...initialAmenities,
    {
      id: "amenity-pool",
      societyId: "soc-ajanta-genx",
      name: "Swimming Pool Deck",
      icon: "waves",
      openingHour: "06:00",
      closingHour: "20:00",
      slotMinutes: 60,
      charge: 0,
      capacity: 15
    },
    {
      id: "amenity-gym",
      societyId: "soc-ajanta-genx",
      name: "Central Health & Fitness Gym",
      icon: "dumbbell",
      openingHour: "05:30",
      closingHour: "22:00",
      slotMinutes: 60,
      charge: 0,
      capacity: 20
    }
  ]);

  const availableDates = [0, 1, 2].map((offset) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toISOString().split("T")[0];
  });

  const [myBookings, setMyBookings] = useState<AmenityBooking[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cancellingBookingId, setCancellingBookingId] = useState<string | null>(null);

  // Booking Modal State
  const [selectedAmenity, setSelectedAmenity] = useState<Amenity | null>(null);
  const [bookingDate, setBookingDate] = useState(availableDates[0]);
  const [selectedSlot, setSelectedSlot] = useState("07:00 - 08:00");
  const [guestCount, setGuestCount] = useState("1");
  const [rulesAccepted, setRulesAccepted] = useState(false);

  // Home Services State
  const [providers] = useState<ServiceProvider[]>([
    ...initialProviders,
    {
      id: "svc-cleaning",
      societyId: "soc-ajanta-genx",
      name: "SparkleMaid Deep Cleaning",
      category: "Deep Cleaning",
      rating: 4.9,
      startingPrice: 1299,
      nextAvailable: "Tomorrow, 11:00 AM"
    },
    {
      id: "svc-handyman",
      societyId: "soc-ajanta-genx",
      name: "ProFix Handyman & Carpentry",
      category: "Handyman",
      rating: 4.7,
      startingPrice: 349,
      nextAvailable: "Today, 5:30 PM"
    }
  ]);

  const [selectedProvider, setSelectedProvider] = useState<ServiceProvider | null>(null);
  const [serviceDate, setServiceDate] = useState("Tomorrow");
  const [serviceNotes, setServiceNotes] = useState("");
  const [myServiceRequests, setMyServiceRequests] = useState<MobileServiceRequestItem[]>([]);

  // ─── Real-time Firestore Subscription for Resident Bookings ───
  useEffect(() => {
    const societyId = profile?.societyId;
    const userId = profile?.uid;
    if (!societyId || !userId) return;

    const unsubAmenity = subscribeMyAmenityBookings(
      societyId,
      userId,
      (bookings) => setMyBookings(bookings),
      (err) => console.warn("[ServicesScreen] Error loading bookings from Firestore:", err)
    );

    const unsubServices = subscribeMyServiceBookings(
      societyId,
      userId,
      (requests) => setMyServiceRequests(requests),
      (err) => console.warn("[ServicesScreen] Error loading services from Firestore:", err)
    );

    return () => {
      unsubAmenity();
      unsubServices();
    };
  }, [profile?.societyId, profile?.uid]);

  // ─── Amenity Booking Submission (Atomic Transactional Slot Lock) ───
  async function handleConfirmAmenityBooking() {
    if (!selectedAmenity) return;

    // Validate guest count against facility capacity BEFORE submission
    const trimmedGuest = (guestCount || "").trim();
    const parsedGuestCount = Number(trimmedGuest);
    if (trimmedGuest === "" || isNaN(parsedGuestCount) || !Number.isInteger(parsedGuestCount) || parsedGuestCount < 0) {
      Alert.alert(
        "Invalid Guest Count",
        "Please enter a valid whole number of guests (0 or more)."
      );
      return;
    }

    const facilityCapacity = typeof selectedAmenity.capacity === "number" ? selectedAmenity.capacity : 20;
    if (parsedGuestCount > facilityCapacity) {
      Alert.alert(
        "Capacity Exceeded",
        `Booking exceeds facility capacity. Maximum allowed capacity is ${facilityCapacity}.`
      );
      return;
    }

    if (!rulesAccepted) {
      Alert.alert("Rules Acceptance Required", "Please review and accept amenity rules before reserving.");
      return;
    }
    if (!profile?.uid || !profile?.societyId) {
      Alert.alert("Authentication Required", "Please sign in with a verified resident account to reserve amenities.");
      return;
    }

    setIsSubmitting(true);
    try {
      const confirmedBooking = await createAmenityBookingAsync({
        amenity: selectedAmenity,
        slot: selectedSlot,
        date: bookingDate,
        guestCount: parsedGuestCount,
        userProfile: profile
      });

      setSelectedAmenity(null);
      setRulesAccepted(false);

      Alert.alert(
        "Booking Confirmed!",
        `Reserved: ${selectedAmenity.name}\nDate: ${confirmedBooking.date}\nSlot: ${confirmedBooking.slot}\nPass Code: ${confirmedBooking.qrPassToken}\n\nShow this code at the reception desk.`
      );
    } catch (err: any) {
      console.error("[ServicesScreen] Amenity booking error:", err);
      Alert.alert(
        "Booking Failed",
        err?.message || "Could not reserve slot. Please check your network and try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleCancelBooking(bkg: AmenityBooking) {
    Alert.alert(
      "Cancel Reservation",
      `Are you sure you want to cancel your reservation for ${bkg.slot} on ${bkg.date}? Your slot will be released to fellow residents immediately.`,
      [
        { text: "Keep Booking", style: "cancel" },
        {
          text: "Cancel Reservation",
          style: "destructive",
          onPress: async () => {
            setCancellingBookingId(bkg.id);
            try {
              await cancelAmenityBookingAsync(
                bkg.id,
                bkg.amenityId,
                bkg.date,
                bkg.slot || `${bkg.startTime} - ${bkg.endTime}`
              );
              Alert.alert("Booking Cancelled", "Your booking has been cancelled and the slot has been released.");
            } catch (err: any) {
              console.error("[ServicesScreen] Error cancelling booking:", err);
              Alert.alert("Cancellation Error", err?.message || "Failed to cancel booking. Please try again.");
            } finally {
              setCancellingBookingId(null);
            }
          }
        }
      ]
    );
  }

  // ─── Home Service Booking ───
  async function handleRequestHomeService() {
    if (!selectedProvider) return;
    if (!profile?.uid || !profile?.societyId) {
      Alert.alert("Authentication Required", "Please sign in to request home services.");
      return;
    }

    setIsSubmitting(true);
    try {
      await createServiceBookingAsync({
        provider: selectedProvider,
        scheduledAt: serviceDate,
        notes: serviceNotes,
        userProfile: profile
      });

      const providerName = selectedProvider.name;
      setSelectedProvider(null);
      setServiceNotes("");

      Alert.alert(
        "Service Requested",
        `Your service request for ${providerName} has been placed for ${serviceDate}.\nThe provider will call your registered number to confirm arrival time.`
      );
    } catch (err: any) {
      console.error("[ServicesScreen] Service booking error:", err);
      Alert.alert("Request Failed", err?.message || "Could not place service request. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const availableSlots = [
    "06:00 - 07:00",
    "07:00 - 08:00",
    "08:00 - 09:00",
    "09:00 - 10:00",
    "16:00 - 17:00",
    "17:00 - 18:00",
    "18:00 - 19:00",
    "19:00 - 20:00"
  ];

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
        {/* Header */}
        <View style={localStyles.header}>
          <View>
            <Muted>Facilities & On-Demand Care</Muted>
            <Title>Services & Amenities</Title>
          </View>
        </View>

        {/* Segmented Control */}
        <View style={localStyles.segmentedRow}>
          {[
            { id: "amenities", label: "Society Amenities" },
            { id: "home_services", label: "Home Services" },
            { id: "my_bookings", label: `My Bookings (${myBookings.filter((b) => b.status === "confirmed").length})` }
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                style={[localStyles.segmentedButton, isActive && localStyles.segmentedButtonActive]}
                onPress={() => setActiveTab(tab.id as ServicesTab)}
              >
                <Text style={[localStyles.segmentedButtonText, isActive && localStyles.segmentedButtonTextActive]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* ─── 1. SOCIETY AMENITIES VIEW (Section 21) ─── */}
        {activeTab === "amenities" && (
          <View style={{ marginTop: 14, gap: 14 }}>
            {amenityList.map((amenity) => (
              <Card key={amenity.id} style={{ padding: 16 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={{ fontSize: 17, fontWeight: "900", color: colors.text }}>
                      {amenity.name}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
                      Operating Hours: {amenity.openingHour} to {amenity.closingHour}
                    </Text>
                  </View>
                  <Pill tone={amenity.charge === 0 ? "success" : "accent"}>
                    {amenity.charge === 0 ? "FREE" : `₹${amenity.charge} / SLOT`}
                  </Pill>
                </View>

                <View style={localStyles.amenityMetaRow}>
                  <View style={localStyles.amenityMetaItem}>
                    <Clock size={14} color={colors.muted} />
                    <Text style={localStyles.amenityMetaText}>{amenity.slotMinutes} min slots</Text>
                  </View>
                  <View style={localStyles.amenityMetaItem}>
                    <Users size={14} color={colors.muted} />
                    <Text style={localStyles.amenityMetaText}>Capacity: {amenity.capacity} people</Text>
                  </View>
                </View>

                <View style={{ marginTop: 14, paddingTop: 10, borderTopWidth: 1, borderColor: colors.border, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontSize: 11, color: colors.muted }}>
                    Slot lock enabled · No overlap
                  </Text>
                  <Pressable
                    style={localStyles.bookButton}
                    onPress={() => {
                      setSelectedAmenity(amenity);
                      setGuestCount("1");
                    }}
                  >
                    <Text style={localStyles.bookButtonText}>Book Slot</Text>
                  </Pressable>
                </View>
              </Card>
            ))}
          </View>
        )}

        {/* ─── 2. HOME SERVICES MARKETPLACE (Section 22) ─── */}
        {activeTab === "home_services" && (
          <View style={{ marginTop: 14, gap: 12 }}>
            {/* Disclaimer Banner (Strictly Distinguishing Complaint vs Home Service) */}
            <View style={localStyles.distinctionBanner}>
              <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
                <Info size={16} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: "800", color: colors.primary }}>
                    Private Home Services vs Society Complaints
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2, lineHeight: 16 }}>
                    These are verified private service providers for optional in-flat repairs. For society-managed issues (lifts, common pipes, water supply, security), please use the Complaints tab.
                  </Text>
                </View>
              </View>
            </View>

            {providers.map((provider) => (
              <Card key={provider.id} style={{ padding: 16 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={{ fontSize: 16, fontWeight: "900", color: colors.text }}>
                      {provider.name}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
                      Category: {provider.category}
                    </Text>
                  </View>
                  <View style={localStyles.ratingBadge}>
                    <Star size={12} color="#f59e0b" fill="#f59e0b" />
                    <Text style={localStyles.ratingText}>{provider.rating}</Text>
                  </View>
                </View>

                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderColor: colors.border }}>
                  <View>
                    <Text style={{ fontSize: 10, color: colors.muted }}>STARTING FROM</Text>
                    <Text style={{ fontSize: 17, fontWeight: "900", color: colors.primary }}>
                      {formatCurrency(provider.startingPrice)}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.success, fontWeight: "700" }}>
                      Next available: {provider.nextAvailable}
                    </Text>
                  </View>
                  <Pressable
                    style={localStyles.bookButton}
                    onPress={() => setSelectedProvider(provider)}
                  >
                    <Text style={localStyles.bookButtonText}>Request Service</Text>
                  </Pressable>
                </View>
              </Card>
            ))}
          </View>
        )}

        {/* ─── 3. MY BOOKINGS VIEW ─── */}
        {activeTab === "my_bookings" && (
          <View style={{ marginTop: 14, gap: 12 }}>
            <Text style={{ fontSize: 14, fontWeight: "800", color: colors.text }}>
              Active Amenity Passes
            </Text>

            {myBookings.length === 0 ? (
              <EmptyState
                icon={CalendarCheck}
                title="No upcoming bookings."
                description="You haven't reserved any society amenities yet. Reserve the badminton court, swimming pool, or clubhouse hall."
                actionLabel="Browse Amenities"
                onAction={() => setActiveTab("amenities")}
              />
            ) : (
              myBookings.map((bkg) => {
                const amenity = amenityList.find((a) => a.id === bkg.amenityId);
                const isConfirmed = bkg.status === "confirmed";

                return (
                  <Card key={bkg.id} style={{ padding: 14 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <Pill tone={isConfirmed ? "success" : "danger"}>
                        {bkg.status.toUpperCase()}
                      </Pill>
                      <Text style={{ fontSize: 12, fontWeight: "800", color: colors.primary }}>
                        Pass: {bkg.qrPassToken}
                      </Text>
                    </View>

                    <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text, marginTop: 6 }}>
                      {amenity?.name || "Society Amenity"}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
                      Date: {bkg.date} · Time: {bkg.slot}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.muted }}>
                      Guests: {bkg.guestCount} · Rate: {bkg.charge === 0 ? "Free" : `₹${bkg.charge}`}
                    </Text>

                    {isConfirmed && (
                      <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderColor: colors.border, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <Text style={{ fontSize: 11, color: colors.muted }}>
                          Present code to facility attendant
                        </Text>
                        <Pressable
                          style={[localStyles.cancelButton, cancellingBookingId === bkg.id && { opacity: 0.6 }]}
                          disabled={cancellingBookingId === bkg.id}
                          onPress={() => handleCancelBooking(bkg)}
                        >
                          <Text style={localStyles.cancelButtonText}>
                            {cancellingBookingId === bkg.id ? "Cancelling..." : "Cancel Slot"}
                          </Text>
                        </Pressable>
                      </View>
                    )}
                  </Card>
                );
              })
            )}

            {/* Service Requests Section */}
            <Text style={{ fontSize: 14, fontWeight: "800", color: colors.text, marginTop: 16 }}>
              Recent Home Service Requests
            </Text>
            {myServiceRequests.map((req) => (
              <Card key={req.id} style={{ padding: 12 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View>
                    <Text style={{ fontSize: 13, fontWeight: "800", color: colors.text }}>
                      {req.name}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.muted }}>
                      Scheduled: {req.date}
                    </Text>
                  </View>
                  <Pill tone="secondary">{req.status}</Pill>
                </View>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>

      {/* ── Amenity Booking Modal ── */}
      {selectedAmenity && (
        <Modal visible={!!selectedAmenity} animationType="slide" transparent>
          <View style={localStyles.modalOverlay}>
            <View style={localStyles.modalContent}>
              <View style={localStyles.modalHeader}>
                <View>
                  <Text style={localStyles.modalTitle}>Reserve {selectedAmenity.name}</Text>
                  <Text style={{ fontSize: 11, color: colors.muted }}>
                    {selectedAmenity.charge === 0 ? "Complimentary Facility" : `Charges: ₹${selectedAmenity.charge}`}
                  </Text>
                </View>
                <Pressable onPress={() => setSelectedAmenity(null)}>
                  <X size={20} color={colors.text} />
                </Pressable>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
                <Text style={localStyles.inputLabel}>Select Date</Text>
                <View style={{ flexDirection: "row", gap: 6, marginBottom: 10 }}>
                  {availableDates.map((d, i) => (
                    <Pressable
                      key={d}
                      onPress={() => setBookingDate(d)}
                      style={[
                        localStyles.datePill,
                        bookingDate === d && localStyles.datePillActive
                      ]}
                    >
                      <Text style={[localStyles.datePillText, bookingDate === d && localStyles.datePillTextActive]}>
                        {i === 0 ? "Today" : i === 1 ? "Tomorrow" : "Day After"} ({d.slice(5)})
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={localStyles.inputLabel}>Select Available Slot</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                  {availableSlots.map((s) => (
                    <Pressable
                      key={s}
                      onPress={() => setSelectedSlot(s)}
                      style={[
                        localStyles.slotPill,
                        selectedSlot === s && localStyles.slotPillActive
                      ]}
                    >
                      <Text style={[localStyles.slotPillText, selectedSlot === s && localStyles.slotPillTextActive]}>
                        {s}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={localStyles.inputLabel}>Guest Count</Text>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: colors.primary, marginTop: 10 }}>
                    Max Capacity: {selectedAmenity.capacity}
                  </Text>
                </View>

                <View style={localStyles.stepperRow}>
                  <Pressable
                    style={localStyles.stepperButton}
                    onPress={() => {
                      const cur = parseInt(guestCount, 10) || 0;
                      setGuestCount(Math.max(0, cur - 1).toString());
                    }}
                  >
                    <Text style={localStyles.stepperButtonText}>-</Text>
                  </Pressable>

                  <TextInput
                    value={guestCount}
                    onChangeText={setGuestCount}
                    keyboardType="numeric"
                    placeholder="1"
                    placeholderTextColor="#94a3b8"
                    style={[localStyles.textInput, { flex: 1, textAlign: "center", fontWeight: "700" }]}
                  />

                  <Pressable
                    style={localStyles.stepperButton}
                    onPress={() => {
                      const cur = parseInt(guestCount, 10) || 0;
                      setGuestCount(Math.min(selectedAmenity.capacity, cur + 1).toString());
                    }}
                  >
                    <Text style={localStyles.stepperButtonText}>+</Text>
                  </Pressable>
                </View>

                {Number(guestCount) > selectedAmenity.capacity ? (
                  <Text style={{ fontSize: 11, color: colors.danger, fontWeight: "700", marginBottom: 10 }}>
                    Exceeds maximum facility capacity of {selectedAmenity.capacity}.
                  </Text>
                ) : Number(guestCount) < 0 ? (
                  <Text style={{ fontSize: 11, color: colors.danger, fontWeight: "700", marginBottom: 10 }}>
                    Guest count cannot be negative.
                  </Text>
                ) : (
                  <Text style={{ fontSize: 11, color: colors.muted, marginBottom: 10 }}>
                    Permitted: 0 to {selectedAmenity.capacity} guests.
                  </Text>
                )}

                {/* Facility Rules */}
                <View style={{ backgroundColor: "#f8fafc", padding: 12, borderRadius: 8, gap: 4, marginBottom: 12 }}>
                  <Text style={{ fontSize: 12, fontWeight: "800", color: colors.text }}>Facility Rules:</Text>
                  <Text style={{ fontSize: 11, color: colors.muted }}>• Non-marking footwear mandatory inside indoor courts.</Text>
                  <Text style={{ fontSize: 11, color: colors.muted }}>• Residents must carry identity keycards.</Text>
                  <Text style={{ fontSize: 11, color: colors.muted }}>• Maximum duration: {selectedAmenity.slotMinutes} minutes per session.</Text>
                </View>

                <Pressable
                  style={{ flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 6 }}
                  onPress={() => setRulesAccepted(!rulesAccepted)}
                >
                  <View style={[localStyles.checkbox, rulesAccepted && localStyles.checkboxActive]}>
                    {rulesAccepted && <Text style={{ color: "#ffffff", fontSize: 10, fontWeight: "bold" }}>✓</Text>}
                  </View>
                  <Text style={{ fontSize: 12, color: colors.text, fontWeight: "600", flex: 1 }}>
                    I understand and agree to follow society amenity regulations.
                  </Text>
                </Pressable>
              </ScrollView>

              <View style={localStyles.modalActions}>
                <Pressable
                  style={[localStyles.modalButton, { backgroundColor: colors.surface }]}
                  onPress={() => setSelectedAmenity(null)}
                >
                  <Text style={[localStyles.modalButtonText, { color: colors.text }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  disabled={isSubmitting}
                  style={[localStyles.modalButton, { backgroundColor: isSubmitting ? colors.muted : colors.primary }]}
                  onPress={handleConfirmAmenityBooking}
                >
                  <Text style={[localStyles.modalButtonText, { color: "#ffffff" }]}>
                    {isSubmitting ? "Reserving..." : "Confirm Slot"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* ── Request Home Service Modal ── */}
      {selectedProvider && (
        <Modal visible={!!selectedProvider} animationType="slide" transparent>
          <View style={localStyles.modalOverlay}>
            <View style={localStyles.modalContent}>
              <View style={localStyles.modalHeader}>
                <View>
                  <Text style={localStyles.modalTitle}>Request {selectedProvider.name}</Text>
                  <Text style={{ fontSize: 11, color: colors.muted }}>
                    Estimated Visit Fee: {formatCurrency(selectedProvider.startingPrice)}
                  </Text>
                </View>
                <Pressable onPress={() => setSelectedProvider(null)}>
                  <X size={20} color={colors.text} />
                </Pressable>
              </View>

              <Text style={localStyles.inputLabel}>Preferred Visit Timing</Text>
              <View style={{ flexDirection: "row", gap: 6, marginBottom: 12 }}>
                {["Today, 4:30 PM", "Tomorrow, 10:00 AM", "Tomorrow, 02:00 PM"].map((t) => (
                  <Pressable
                    key={t}
                    onPress={() => setServiceDate(t)}
                    style={[
                      localStyles.datePill,
                      serviceDate === t && localStyles.datePillActive
                    ]}
                  >
                    <Text style={[localStyles.datePillText, serviceDate === t && localStyles.datePillTextActive]}>
                      {t}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={localStyles.inputLabel}>Instructions for Service Professional</Text>
              <TextInput
                value={serviceNotes}
                onChangeText={setServiceNotes}
                placeholder="Describe issue (e.g. Geyser switch sparking, tap washer leaking)..."
                placeholderTextColor="#94a3b8"
                multiline
                numberOfLines={3}
                style={[localStyles.textInput, { height: 74, marginBottom: 12 }]}
              />

              <View style={localStyles.modalActions}>
                <Pressable
                  style={[localStyles.modalButton, { backgroundColor: colors.surface }]}
                  onPress={() => setSelectedProvider(null)}
                >
                  <Text style={[localStyles.modalButtonText, { color: colors.text }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  disabled={isSubmitting}
                  style={[localStyles.modalButton, { backgroundColor: isSubmitting ? colors.muted : colors.primary }]}
                  onPress={handleRequestHomeService}
                >
                  <Text style={[localStyles.modalButtonText, { color: "#ffffff" }]}>
                    {isSubmitting ? "Submitting..." : "Submit Request"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </Screen>
  );
}

const localStyles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  segmentedRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 14,
    backgroundColor: "#ffffff",
    borderRadius: 10,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border
  },
  segmentedButton: {
    flex: 1,
    height: 38,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  segmentedButtonActive: {
    backgroundColor: colors.primary
  },
  segmentedButtonText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.muted
  },
  segmentedButtonTextActive: {
    color: "#ffffff"
  },
  amenityMetaRow: {
    flexDirection: "row",
    gap: 16,
    marginTop: 10
  },
  amenityMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  amenityMetaText: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: "600"
  },
  bookButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.primary
  },
  bookButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800"
  },
  cancelButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: "#ffffff"
  },
  cancelButtonText: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: "800"
  },
  distinctionBanner: {
    backgroundColor: "#f0fdfa",
    borderWidth: 1,
    borderColor: "#ccfbf1",
    borderRadius: 10,
    padding: 12
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#fef3c7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  ratingText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#b45309"
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    justifyContent: "flex-end"
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 18,
    maxHeight: "90%"
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 10
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: colors.text
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 10,
    marginBottom: 4
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.text
  },
  datePill: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff"
  },
  datePillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  datePillText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.text
  },
  datePillTextActive: {
    color: "#ffffff"
  },
  slotPill: {
    paddingHorizontal: 10,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff"
  },
  slotPillActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary
  },
  slotPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.text
  },
  slotPillTextActive: {
    color: colors.primary,
    fontWeight: "800"
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center"
  },
  checkboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  modalActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: "#f1f5f9"
  },
  modalButton: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  modalButtonText: {
    fontSize: 13,
    fontWeight: "800"
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6
  },
  stepperButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center"
  },
  stepperButtonText: {
    fontSize: 18,
    fontWeight: "900",
    color: colors.text
  }
});
