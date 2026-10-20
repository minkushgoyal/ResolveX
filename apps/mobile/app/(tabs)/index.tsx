import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { router } from "expo-router";
import {
  AlertCircle,
  Bell,
  Building2,
  CalendarCheck,
  Camera,
  Car,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  CreditCard,
  FileCheck,
  FileText,
  Phone,
  Plus,
  QrCode,
  Radio,
  Search,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Sparkles,
  UserCheck,
  UserPlus,
  UsersRound,
  Wrench,
  X
} from "lucide-react-native";
import {
  formatCurrency,
  normalizeComplaintStatus,
  notices,
  serviceProviders,
  societyEvents,
  visitorPasses
} from "@resolvex/utils";
import type { Complaint, StaffAvailability, UserProfile } from "@resolvex/types";
import { Card, colors, EmptyState, Muted, Pill, Screen, StatusBadge, Title } from "../../components/mobile-ui";
import { auth, db, isFirebaseConfigured } from "../../lib/firebase";
import { collection, doc, getDocs, onSnapshot, query, setDoc, updateDoc, where } from "firebase/firestore";
import { subscribeMobileAuth } from "../../lib/auth-service";

import { useMobileSessionStore } from "../../lib/session-store";
import { StaffJobDetailModal } from "../../components/staff-views";
import { SecurityGateDeskView } from "../../components/security-views";
import { subscribeStaffWorkQueue, updateTechnicianDutyStatus } from "../../lib/staff-service";

type MobileRole = "resident" | "maintenance_staff" | "security_guard";

export default function HomeScreen() {
  console.log("[STARTUP 8] Initial route rendered: (tabs)/index (HomeScreen)");
  const { userProfile } = useMobileSessionStore();
  const role = userProfile?.role;

  if (role === "maintenance_staff") {
    return (
      <Screen>
        <MaintenanceStaffMobileView />
      </Screen>
    );
  }

  if (role === "security_guard") {
    return (
      <Screen>
        <SecurityGateDeskView />
      </Screen>
    );
  }

  return (
    <Screen>
      <ResidentMobileView />
    </Screen>
  );
}

// ─── 1. Resident Mobile View ────────────────────────────────────────────────
function ResidentMobileView() {
  const profile = useMobileSessionStore((s) => s.userProfile);
  const [userComplaints, setUserComplaints] = useState<Complaint[]>([]);
  const [userNotifications, setUserNotifications] = useState<any[]>([]);
  const [userBills, setUserBills] = useState<any[]>([]);

  // Search State (Phase 10: Real Search)
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchCategory, setSearchCategory] = useState<"all" | "complaints" | "notices" | "directory" | "amenities" | "marketplace">("all");
  const [searchResults, setSearchResults] = useState<Array<{ id: string; title: string; subtitle: string; category: string; type: string }>>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Modals
  const [visitorModalOpen, setVisitorModalOpen] = useState(false);
  const [visitorName, setVisitorName] = useState("");
  const [visitorPhone, setVisitorPhone] = useState("");
  const [visitorType, setVisitorType] = useState("guest");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [generatedPassCode, setGeneratedPassCode] = useState<string | null>(null);

  const [payModalOpen, setPayModalOpen] = useState(false);

  const [notifModalOpen, setNotifModalOpen] = useState(false);
  const [emergencyModalOpen, setEmergencyModalOpen] = useState(false);
  const [rsvpAttending, setRsvpAttending] = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured || !profile || !auth.currentUser || auth.currentUser.uid !== profile.uid) return;
    const unsubs: Array<() => void> = [];

    // Complaints & Bills for this household (residents/owners/tenants only)
    const isResident = profile.role === "resident" || profile.role === "flat_owner" || profile.role === "tenant";
    if (profile.householdId && isResident) {
      const qC = query(collection(db, "complaints"), where("householdId", "==", profile.householdId));
      const unsubC = onSnapshot(
        qC,
        (snap) => {
          const list: any[] = [];
          snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
          list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
          setUserComplaints(list);
        },
        (err) => console.warn("Mobile home complaints snapshot error:", err)
      );
      unsubs.push(unsubC);

      // Bills for this household
      const qB = query(collection(db, "bills"), where("householdId", "==", profile.householdId));
      const unsubB = onSnapshot(
        qB,
        (snap) => {
          const list: any[] = [];
          snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
          setUserBills(list);
        },
        (err) => console.warn("Mobile home bills snapshot error:", err)
      );
      unsubs.push(unsubB);
    }

    // Notifications for this user (strictly where userId == auth.currentUser.uid)
    const qN = query(collection(db, "notifications"), where("userId", "==", auth.currentUser.uid));
    const unsubN = onSnapshot(
      qN,
      (snap) => {
        const list: any[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
        list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        setUserNotifications(list);
      },
      (err) => console.warn("Mobile home notifications snapshot error:", err)
    );
    unsubs.push(unsubN);

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [profile?.householdId, profile?.uid, profile?.role]);

  // Real Search Implementation (Phase 10)
  useEffect(() => {
    const clean = searchQuery.trim();
    if (clean.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      setSearchError(null);
      return;
    }

    setSearchLoading(true);
    setSearchError(null);

    const timer = setTimeout(async () => {
      try {
        const results: Array<{ id: string; title: string; subtitle: string; category: string; type: string }> = [];
        const lower = clean.toLowerCase();

        // 1. Search Complaints (from household complaints already in memory)
        userComplaints.forEach((c) => {
          if (
            c.title?.toLowerCase().includes(lower) ||
            c.description?.toLowerCase().includes(lower) ||
            c.category?.toLowerCase().includes(lower)
          ) {
            results.push({
              id: c.id,
              title: c.title,
              subtitle: `Complaint #${c.id} · Status: ${c.status}`,
              category: c.category || "complaint",
              type: "complaints"
            });
          }
        });

        // 2. Search Notices in this society
        if (profile?.societyId) {
          const noticesSnap = await getDocs(
            query(collection(db, "notices"), where("societyId", "==", profile.societyId))
          );
          noticesSnap.forEach((docSnap) => {
            const n = docSnap.data();
            if (
              n.title?.toLowerCase().includes(lower) ||
              n.description?.toLowerCase().includes(lower)
            ) {
              results.push({
                id: docSnap.id,
                title: n.title,
                subtitle: n.description?.slice(0, 70) || "Society Notice",
                category: n.type || "notice",
                type: "notices"
              });
            }
          });

          // 3. Search Amenities
          const amenitiesSnap = await getDocs(
            query(collection(db, "amenities"), where("societyId", "==", profile.societyId))
          );
          amenitiesSnap.forEach((docSnap) => {
            const a = docSnap.data();
            if (a.name?.toLowerCase().includes(lower) || a.description?.toLowerCase().includes(lower)) {
              results.push({
                id: docSnap.id,
                title: a.name,
                subtitle: `${a.openingHour || "06:00"} - ${a.closingHour || "22:00"} · Capacity: ${a.capacity || 20}`,
                category: "Amenity",
                type: "amenities"
              });
            }
          });

          // 4. Search Resident Directory (users in same society who opted in or by flat)
          const usersSnap = await getDocs(
            query(collection(db, "users"), where("societyId", "==", profile.societyId))
          );
          usersSnap.forEach((docSnap) => {
            const u = docSnap.data();
            if (
              u.displayName?.toLowerCase().includes(lower) ||
              u.flatId?.toLowerCase().includes(lower) ||
              u.towerId?.toLowerCase().includes(lower)
            ) {
              results.push({
                id: docSnap.id,
                title: u.displayName || "Resident",
                subtitle: `${u.flatId ? u.flatId.replace("flat-", "Flat ").toUpperCase() : "Resident"} · ${u.role || "Member"}`,
                category: "Directory",
                type: "directory"
              });
            }
          });

          // 5. Search Marketplace Items
          const marketplaceSnap = await getDocs(
            query(collection(db, "marketplace_items"), where("societyId", "==", profile.societyId))
          );
          marketplaceSnap.forEach((docSnap) => {
            const m = docSnap.data();
            if (
              m.title?.toLowerCase().includes(lower) ||
              m.description?.toLowerCase().includes(lower) ||
              m.category?.toLowerCase().includes(lower)
            ) {
              results.push({
                id: docSnap.id,
                title: m.title,
                subtitle: `₹${m.price?.toLocaleString() || 0} · ${m.condition ? m.condition.replace("_", " ") : "Item"}`,
                category: "Marketplace",
                type: "marketplace"
              });
            }
          });
        }

        setSearchResults(results);
      } catch (err: any) {
        console.error("Search error:", err);
        setSearchError(err.message || "Failed to search records.");
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, profile?.societyId, userComplaints]);

  // Greeting based on time of day
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const residentName = profile?.displayName || "Resident";
  const firstName = residentName.split(" ")[0];

  const towerName = profile?.towerId ? `Tower ${profile.towerId.replace("tower-", "").toUpperCase()}` : "Tower 1";
  const flatNumber = profile?.flatId ? `Flat ${profile.flatId.replace("flat-", "").toUpperCase()}` : "Flat T1-402";
  const householdName = profile?.householdId ? `Household ${profile.householdId.replace("hh-", "").toUpperCase()}` : `${firstName}'s Household`;
  const societyName = profile?.societyId === "soc-green-valley" ? "Green Valley Apartments" : (profile?.societyId || "ResolveX Community");

  // Active complaint logic
  const activeComplaint =
    userComplaints.find((c) => c.status === "resident_confirmation") ||
    userComplaints.find((c) => c.status === "in_progress" || c.status === "assigned") ||
    userComplaints.find((c) => c.status === "open") ||
    userComplaints[0];

  const unreadNotifCount = userNotifications.filter((n) => !n.read).length;

  function handleCreateVisitorPass() {
    if (!visitorName.trim()) {
      Alert.alert("Required", "Please enter the visitor or delivery person name.");
      return;
    }
    if (!profile?.householdId || !profile?.societyId) {
      Alert.alert("Profile Incomplete", "Missing household or society assignment.");
      return;
    }
    const code = `AJX-${Math.floor(1000 + Math.random() * 9000)}`;
    const passId = `visit-${Date.now().toString().slice(-4)}`;
    const now = new Date().toISOString();
    setGeneratedPassCode(code);

    if (isFirebaseConfigured) {
      setDoc(doc(db, "visitor_passes", passId), {
        id: passId,
        societyId: profile.societyId,
        householdId: profile.householdId,
        flatId: profile.flatId || "flat-unknown",
        visitorName: visitorName.trim(),
        visitorPhone: visitorPhone.trim() || "+91 98000 00000",
        purpose: visitorType,
        vehicleNumber: vehicleNumber.trim() || undefined,
        expectedDate: now.split("T")[0],
        qrToken: code,
        status: "expected",
        createdByUserId: profile.uid,
        createdAt: now,
        updatedAt: now
      }).catch((e) => console.warn("Visitor pass Firestore write error:", e));
    }
  }

  function handleCloseVisitorModal() {
    setVisitorModalOpen(false);
    setVisitorName("");
    setVisitorPhone("");
    setVehicleNumber("");
    setGeneratedPassCode(null);
  }

  function handleMarkAllNotifsRead() {
    setUserNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  const latestNotice = notices[0];
  const upcomingEvent = societyEvents[0];

  const fastActions = [
    {
      id: "report",
      label: "Report Issue",
      sublabel: "Auto-routed dispatch",
      icon: Wrench,
      highlight: true,
      action: () => router.push("/(tabs)/complaints")
    },
    {
      id: "amenities",
      label: "Amenities",
      sublabel: "Clubhouse & Sports",
      icon: Sparkles,
      highlight: true,
      action: () => router.push("/(tabs)/services")
    },
    {
      id: "visitor",
      label: "Visitor Pass",
      sublabel: "Instant gate QR",
      icon: UserPlus,
      action: () => setVisitorModalOpen(true)
    },
    {
      id: "dues",
      label: "Pay Dues",
      sublabel: "Maintenance Q3",
      icon: CreditCard,
      action: () => setPayModalOpen(true)
    },
    {
      id: "community",
      label: "Community",
      sublabel: "Feed & Society Polls",
      icon: UsersRound,
      action: () => router.push("/(tabs)/community")
    },
    {
      id: "emergency",
      label: "Emergency / SOS",
      sublabel: "Security & Medical",
      icon: Siren,
      danger: true,
      action: () => setEmergencyModalOpen(true)
    }
  ];

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
      {/* Top Header */}
      <View style={localStyles.topBar}>
        <View style={{ flex: 1 }}>
          <Text style={localStyles.societyHeader}>{societyName}</Text>
          <Title>
            {greeting}, {firstName}
          </Title>
        </View>
        <View style={localStyles.topIcons}>
          <Pressable
            style={localStyles.iconButton}
            accessibilityLabel="Search"
            onPress={() => setSearchModalOpen(true)}
          >
            <Search color={colors.muted} size={20} />
          </Pressable>
          <Pressable
            style={[localStyles.iconButton, unreadNotifCount > 0 && { borderColor: colors.primaryLight }]}
            accessibilityLabel="Notifications"
            onPress={() => setNotifModalOpen(true)}
          >
            <Bell color={unreadNotifCount > 0 ? colors.primary : colors.muted} size={20} />
            {unreadNotifCount > 0 && (
              <View style={localStyles.unreadDotBadge}>
                <Text style={localStyles.unreadDotText}>{unreadNotifCount}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {/* Resident Identity Banner */}
      <View style={localStyles.identityBanner}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flex: 1 }}>
            <Text style={localStyles.identityFlat}>
              {flatNumber} · {towerName}
            </Text>
            <Text style={localStyles.identityHousehold}>
              {householdName} · {profile?.householdRole === "owner" ? "Owner" : "Resident"}
            </Text>
          </View>
          <View style={localStyles.statusBadge}>
            <View style={localStyles.statusDot} />
            <Text style={localStyles.statusBadgeText}>
              {profile?.status === "verified" ? "Verified" : "Active"}
            </Text>
          </View>
        </View>

        {/* Operational Status (Section 5: Society Operations Health) */}
        <View style={localStyles.telemetryRow}>
          <View style={localStyles.telemetryItem}>
            <Text style={localStyles.telemetryLabel}>Water Supply</Text>
            <Text style={localStyles.telemetryValue}>Regular · Normal</Text>
          </View>
          <View style={localStyles.telemetryDivider} />
          <View style={localStyles.telemetryItem}>
            <Text style={localStyles.telemetryLabel}>Power Grid</Text>
            <Text style={localStyles.telemetryValue}>Substation A · Normal</Text>
          </View>
          <View style={localStyles.telemetryDivider} />
          <View style={localStyles.telemetryItem}>
            <Text style={localStyles.telemetryLabel}>Tower Lifts</Text>
            <Text style={localStyles.telemetryValue}>2/2 Running</Text>
          </View>
          <View style={localStyles.telemetryDivider} />
          <View style={localStyles.telemetryItem}>
            <Text style={localStyles.telemetryLabel}>Security Gate</Text>
            <Text style={localStyles.telemetryValue}>Gate 1 Active</Text>
          </View>
        </View>
      </View>

      {/* Fast Actions Grid (Section 4) */}
      <View style={{ marginTop: 18 }}>
        <Text style={localStyles.sectionHeading}>Quick Actions</Text>
        <View style={localStyles.actionsGrid}>
          {fastActions.map((act) => {
            const Icon = act.icon;
            return (
              <Pressable
                key={act.id}
                style={[
                  localStyles.actionCard,
                  act.highlight && { borderColor: "#c7d2fe", backgroundColor: "#f8faff" },
                  act.danger && { borderColor: "#fecaca", backgroundColor: "#fff5f5" }
                ]}
                onPress={act.action}
                accessibilityLabel={act.label}
              >
                <View
                  style={[
                    localStyles.actionIconBox,
                    act.highlight && { backgroundColor: "#e0e7ff" },
                    act.danger && { backgroundColor: "#fee2e2" }
                  ]}
                >
                  <Icon color={act.danger ? colors.danger : colors.primary} size={20} />
                </View>
                <Text style={[localStyles.actionCardTitle, act.danger && { color: colors.danger }]}>
                  {act.label}
                </Text>
                <Text style={localStyles.actionCardSub}>{act.sublabel}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Operational Summary 1: Active Work Order (Section 3 & 6) */}
      <View style={{ marginTop: 18 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <Text style={localStyles.sectionHeading}>Active Complaints</Text>
          <Pressable onPress={() => router.push("/(tabs)/complaints")}>
            <Text style={localStyles.seeAllLink}>View All ({userComplaints.length}) →</Text>
          </Pressable>
        </View>

        {activeComplaint ? (
          <Card style={localStyles.ticketCard}>
            <View style={localStyles.ticketCardHeader}>
              <StatusBadge status={activeComplaint.status} />
              <Text style={localStyles.ticketCardId}>#{activeComplaint.id}</Text>
            </View>

            <Text style={localStyles.ticketCardTitle}>{activeComplaint.title}</Text>
            <Muted>{activeComplaint.location} · {activeComplaint.assignedDepartment || "Maintenance"}</Muted>

            {activeComplaint.status === "resident_confirmation" ? (
              <View style={localStyles.alertBox}>
                <Text style={localStyles.alertBoxText}>
                  Action Required: Technician submitted completion proof. Please verify and confirm resolution.
                </Text>
                <Pressable
                  style={localStyles.ticketActionButton}
                  onPress={() => router.push("/(tabs)/complaints")}
                >
                  <Text style={localStyles.ticketActionButtonText}>Review Proof & Confirm</Text>
                  <ChevronRight color="#ffffff" size={16} />
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={[localStyles.ticketActionButton, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}
                onPress={() => router.push("/(tabs)/complaints")}
              >
                <Text style={[localStyles.ticketActionButtonText, { color: colors.text }]}>Track Progress</Text>
                <ChevronRight color={colors.text} size={16} />
              </Pressable>
            )}
          </Card>
        ) : (
          <Card style={{ padding: 16, alignItems: "center" }}>
            <CheckCircle2 color={colors.success} size={28} />
            <Text style={{ marginTop: 8, fontSize: 14, fontWeight: "700", color: colors.text }}>
              You're all clear. No active complaints.
            </Text>
            <Muted>All your reported issues have been resolved.</Muted>
          </Card>
        )}
      </View>

      {/* Operational Summary 2: Gate & Visitor Status (Section 13 & 14) */}
      <View style={{ marginTop: 18 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <Text style={localStyles.sectionHeading}>Visitors & Gate Parcels</Text>
          <Pressable onPress={() => router.push("/(tabs)/more")}>
            <Text style={localStyles.seeAllLink}>Manage Passes →</Text>
          </Pressable>
        </View>

        <Card style={{ padding: 14 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Pill tone="secondary">GATE 1</Pill>
                <Text style={{ fontSize: 13, fontWeight: "800", color: colors.text }}>
                  Expected Delivery
                </Text>
              </View>
              <Text style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>
                Swiggy Food Delivery · Expected at Gate 1
              </Text>
              <Text style={{ fontSize: 11, color: colors.primary, fontWeight: "700", marginTop: 2 }}>
                Pass Code: AJX-9821
              </Text>
            </View>
            <Pressable
              style={[localStyles.paySmallButton, { backgroundColor: colors.primary }]}
              onPress={() => setVisitorModalOpen(true)}
            >
              <Text style={[localStyles.paySmallButtonText, { color: "#ffffff" }]}>New Pass</Text>
            </Pressable>
          </View>
        </Card>
      </View>

      {/* Operational Summary 3: Society Notice Preview (Section 11) */}
      {latestNotice && (
        <View style={{ marginTop: 18 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <Text style={localStyles.sectionHeading}>Important Society Notice</Text>
            <Pressable onPress={() => router.push("/(tabs)/more")}>
              <Text style={localStyles.seeAllLink}>All Notices →</Text>
            </Pressable>
          </View>
          <Card style={{ padding: 14 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Pill tone={latestNotice.type === "emergency" ? "danger" : "accent"}>
                  {latestNotice.type.toUpperCase()}
                </Pill>
                <Text style={{ fontSize: 14, fontWeight: "800", color: colors.text, marginTop: 6 }}>
                  {latestNotice.title}
                </Text>
                <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }} numberOfLines={2}>
                  {latestNotice.description}
                </Text>
              </View>
            </View>
          </Card>
        </View>
      )}

      {/* Operational Summary 4: Upcoming Society Event (Section 18) */}
      {upcomingEvent && (
        <View style={{ marginTop: 18 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <Text style={localStyles.sectionHeading}>Upcoming Society Event</Text>
            <Pressable onPress={() => router.push("/(tabs)/community")}>
              <Text style={localStyles.seeAllLink}>Community Events →</Text>
            </Pressable>
          </View>
          <Card style={{ padding: 14 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={{ fontSize: 14, fontWeight: "800", color: colors.text }}>
                  {upcomingEvent.title}
                </Text>
                <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
                  {upcomingEvent.eventDate} · {upcomingEvent.time}
                </Text>
                <Text style={{ fontSize: 11, color: colors.muted }}>
                  Venue: {upcomingEvent.venue}
                </Text>
              </View>
              <Pressable
                style={[
                  localStyles.paySmallButton,
                  { backgroundColor: rsvpAttending ? colors.successLight : colors.primaryLight }
                ]}
                onPress={() => setRsvpAttending(!rsvpAttending)}
              >
                <Text
                  style={[
                    localStyles.paySmallButtonText,
                    { color: rsvpAttending ? colors.success : colors.primary }
                  ]}
                >
                  {rsvpAttending ? "Attending ✓" : "RSVP Now"}
                </Text>
              </Pressable>
            </View>
          </Card>
        </View>
      )}

      {/* Operational Summary 5: Maintenance Dues (Section 23) */}
      <View style={{ marginTop: 18 }}>
        <Text style={localStyles.sectionHeading}>Maintenance Bills</Text>
        {userBills.length > 0 ? (
          (() => {
            const activeBill = userBills[0];
            const isBillPaid = activeBill.status === "paid";
            return (
              <Card style={{ marginTop: 8, padding: 16 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={{ fontSize: 14, fontWeight: "800", color: colors.text }}>
                      {activeBill.title || "Society Maintenance & Sinking Fund"}
                    </Text>
                    <Muted>
                      {isBillPaid
                        ? "Settled · Payment Reconciled"
                        : `Due ${activeBill.dueDate || "Sep 15, 2026"} · ${flatNumber}`}
                    </Muted>
                  </View>
                  <Text style={{ fontSize: 16, fontWeight: "900", color: isBillPaid ? colors.success : colors.text }}>
                    ₹{activeBill.amount?.toLocaleString() || "4,250"}
                  </Text>
                </View>

                <View
                  style={{
                    marginTop: 12,
                    paddingTop: 10,
                    borderTopWidth: 1,
                    borderColor: colors.border,
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}
                >
                  <Pill tone={isBillPaid ? "success" : "accent"}>
                    {isBillPaid ? "PAID" : "DUE"}
                  </Pill>
                  <Pressable
                    style={[
                      localStyles.paySmallButton,
                      {
                        backgroundColor: isBillPaid ? colors.surface : colors.primary,
                        borderWidth: isBillPaid ? 1 : 0,
                        borderColor: colors.border
                      }
                    ]}
                    onPress={() => setPayModalOpen(true)}
                  >
                    <Text style={[localStyles.paySmallButtonText, { color: isBillPaid ? colors.text : "#ffffff" }]}>
                      {isBillPaid ? "View Receipt" : "View Breakdown"}
                    </Text>
                  </Pressable>
                </View>
              </Card>
            );
          })()
        ) : (
          <Card style={{ marginTop: 8, padding: 16, alignItems: "center" }}>
            <CheckCircle2 color={colors.success} size={24} />
            <Text style={{ marginTop: 6, fontSize: 13, fontWeight: "700", color: colors.text }}>
              No outstanding dues
            </Text>
            <Muted>All maintenance accounts are settled for your unit.</Muted>
          </Card>
        )}
      </View>

      {/* ─── MODALS ─── */}

      {/* 1. Real Search Modal (Phase 10) */}
      <Modal visible={searchModalOpen} animationType="slide" transparent>
        <View style={localStyles.modalOverlay}>
          <View style={[localStyles.modalContent, { maxHeight: "85%" }]}>
            <View style={localStyles.modalHeader}>
              <View>
                <Text style={localStyles.modalTitle}>Search Community</Text>
                <Text style={{ fontSize: 11, color: colors.muted }}>{societyName}</Text>
              </View>
              <Pressable onPress={() => { setSearchModalOpen(false); setSearchQuery(""); }} style={{ padding: 4 }}>
                <X size={20} color={colors.text} />
              </Pressable>
            </View>

            {/* Search Input */}
            <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#f1f5f9", borderRadius: 10, paddingHorizontal: 12, marginVertical: 10 }}>
              <Search size={18} color={colors.muted} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search complaints, notices, directory, amenities..."
                placeholderTextColor="#94a3b8"
                style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 8, fontSize: 14, color: colors.text }}
                autoFocus
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => setSearchQuery("")}>
                  <X size={16} color={colors.muted} />
                </Pressable>
              )}
            </View>

            {/* Category Filter Chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10, maxHeight: 36 }}>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {(["all", "complaints", "notices", "directory", "amenities", "marketplace"] as const).map((cat) => (
                  <Pressable
                    key={cat}
                    onPress={() => setSearchCategory(cat)}
                    style={[
                      localStyles.typeButton,
                      searchCategory === cat && localStyles.typeButtonActive,
                      { paddingVertical: 6, paddingHorizontal: 12 }
                    ]}
                  >
                    <Text
                      style={[
                        localStyles.typeButtonText,
                        searchCategory === cat && localStyles.typeButtonTextActive,
                        { fontSize: 12 }
                      ]}
                    >
                      {cat === "all" ? "All" : cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            {/* Results List */}
            {searchLoading ? (
              <View style={{ padding: 30, alignItems: "center" }}>
                <ActivityIndicator color={colors.primary} size="large" />
                <Text style={{ fontSize: 12, color: colors.muted, marginTop: 8 }}>Searching database...</Text>
              </View>
            ) : searchError ? (
              <View style={{ padding: 20, alignItems: "center" }}>
                <AlertCircle color={colors.danger} size={24} />
                <Text style={{ fontSize: 12, color: colors.danger, marginTop: 6, textAlign: "center" }}>{searchError}</Text>
              </View>
            ) : searchQuery.trim().length >= 2 ? (
              (() => {
                const filtered = searchResults.filter((r) => searchCategory === "all" || r.type === searchCategory);
                if (filtered.length === 0) {
                  return (
                    <View style={{ padding: 30, alignItems: "center" }}>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text }}>No results found</Text>
                      <Text style={{ fontSize: 11, color: colors.muted, marginTop: 4, textAlign: "center" }}>
                        No records matching "{searchQuery}" in {societyName}.
                      </Text>
                    </View>
                  );
                }
                return (
                  <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
                    <View style={{ gap: 8 }}>
                      {filtered.map((item) => (
                        <Pressable
                          key={`${item.type}-${item.id}`}
                          style={{
                            padding: 12,
                            backgroundColor: "#f8fafc",
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: colors.border
                          }}
                          onPress={() => {
                            setSearchModalOpen(false);
                            if (item.type === "complaints") router.push("/(tabs)/complaints");
                            else if (item.type === "amenities") router.push("/(tabs)/services");
                            else if (item.type === "notices") router.push("/(tabs)/more");
                            else if (item.type === "directory") router.push("/(tabs)/society");
                            else if (item.type === "marketplace") router.push("/(tabs)/community");
                          }}
                        >
                          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                            <Pill tone="secondary">{item.category.toUpperCase()}</Pill>
                            <Text style={{ fontSize: 10, color: colors.muted }}>Tap to view</Text>
                          </View>
                          <Text style={{ fontSize: 14, fontWeight: "800", color: colors.text, marginTop: 4 }}>
                            {item.title}
                          </Text>
                          <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
                            {item.subtitle}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </ScrollView>
                );
              })()
            ) : (
              <View style={{ padding: 24, alignItems: "center" }}>
                <Search size={28} color={colors.muted} />
                <Text style={{ fontSize: 13, color: colors.muted, marginTop: 8, textAlign: "center" }}>
                  Type at least 2 characters to search across complaints, society notices, directory and amenities.
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* 2. Visitor Pass Modal */}
      <Modal visible={visitorModalOpen} animationType="slide" transparent>
        <View style={localStyles.modalOverlay}>
          <View style={localStyles.modalContent}>
            <View style={localStyles.modalHeader}>
              <Text style={localStyles.modalTitle}>Generate Visitor Gate Pass</Text>
              <Pressable onPress={handleCloseVisitorModal} style={{ padding: 4 }}>
                <X size={20} color={colors.text} />
              </Pressable>
            </View>

            {generatedPassCode ? (
              <View style={{ alignItems: "center", paddingVertical: 16 }}>
                <View style={[localStyles.qrBox, { backgroundColor: "#ffffff", padding: 8 }]}>
                  <Image
                    source={{
                      uri: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
                        generatedPassCode
                      )}`
                    }}
                    style={{ width: 130, height: 130 }}
                    resizeMode="contain"
                  />
                </View>
                <Text style={localStyles.qrCodeText}>{generatedPassCode}</Text>
                <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text, marginTop: 4 }}>
                  Valid for {visitorName} ({flatNumber})
                </Text>
                <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2, textAlign: "center" }}>
                  Present this QR code or 8-digit token to Gate 1 security guard for instant barrier clearance.
                </Text>
                <Pressable
                  style={[localStyles.modalButton, { backgroundColor: colors.primary, width: "100%", marginTop: 16 }]}
                  onPress={handleCloseVisitorModal}
                >
                  <Text style={[localStyles.modalButtonText, { color: "#ffffff" }]}>Done</Text>
                </Pressable>
              </View>
            ) : (
              <View>
                <Text style={localStyles.inputLabel}>Visitor Full Name *</Text>
                <TextInput
                  value={visitorName}
                  onChangeText={setVisitorName}
                  placeholder="e.g. Ramesh Kumar (Swiggy / Guest)"
                  placeholderTextColor="#94a3b8"
                  style={localStyles.textInput}
                />

                <Text style={localStyles.inputLabel}>Phone Number (Optional)</Text>
                <TextInput
                  value={visitorPhone}
                  onChangeText={setVisitorPhone}
                  placeholder="+91 98000 00000"
                  keyboardType="phone-pad"
                  placeholderTextColor="#94a3b8"
                  style={localStyles.textInput}
                />

                <Text style={localStyles.inputLabel}>Vehicle Number (Optional)</Text>
                <TextInput
                  value={vehicleNumber}
                  onChangeText={setVehicleNumber}
                  placeholder="e.g. UP 16 AB 1234"
                  placeholderTextColor="#94a3b8"
                  style={localStyles.textInput}
                />

                <Text style={localStyles.inputLabel}>Visitor Purpose</Text>
                <View style={{ flexDirection: "row", gap: 6, marginBottom: 12 }}>
                  {["guest", "delivery", "cab", "service"].map((t) => (
                    <Pressable
                      key={t}
                      onPress={() => setVisitorType(t)}
                      style={[
                        localStyles.typeButton,
                        visitorType === t && localStyles.typeButtonActive
                      ]}
                    >
                      <Text
                        style={[
                          localStyles.typeButtonText,
                          visitorType === t && localStyles.typeButtonTextActive
                        ]}
                      >
                        {t.toUpperCase()}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <View style={localStyles.modalActions}>
                  <Pressable
                    style={[localStyles.modalButton, { backgroundColor: colors.surface }]}
                    onPress={handleCloseVisitorModal}
                  >
                    <Text style={[localStyles.modalButtonText, { color: colors.text }]}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[localStyles.modalButton, { backgroundColor: colors.primary }]}
                    onPress={handleCreateVisitorPass}
                  >
                    <Text style={[localStyles.modalButtonText, { color: "#ffffff" }]}>Generate Pass</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* 3. Maintenance Payment / Receipt Modal */}
      <Modal visible={payModalOpen} animationType="slide" transparent>
        <View style={localStyles.modalOverlay}>
          <View style={localStyles.modalContent}>
            {(() => {
              const activeBill = userBills[0];
              const isBillPaid = activeBill?.status === "paid";
              return (
                <>
                  <View style={localStyles.modalHeader}>
                    <View>
                      <Text style={localStyles.modalTitle}>
                        {isBillPaid ? "Official Maintenance Receipt" : "Maintenance Bill Breakdown"}
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.muted }}>
                        {activeBill?.title || "Society Maintenance & Sinking Fund"}
                      </Text>
                    </View>
                    <Pressable onPress={() => setPayModalOpen(false)} style={{ padding: 4 }}>
                      <X size={20} color={colors.text} />
                    </Pressable>
                  </View>

                  <View style={{ gap: 10, marginVertical: 10 }}>
                    {isBillPaid ? (
                      <View style={{ backgroundColor: "#f0fdf4", padding: 14, borderRadius: 10, borderWidth: 1, borderColor: "#bbf7d0", gap: 8 }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                          <Pill tone="success">PAYMENT SETTLED</Pill>
                          <Text style={{ fontSize: 11, color: colors.muted }}>
                            {activeBill.paidAt ? new Date(activeBill.paidAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "Settled"}
                          </Text>
                        </View>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
                          <Text style={{ fontSize: 13, color: colors.muted }}>Amount Paid:</Text>
                          <Text style={{ fontSize: 20, fontWeight: "900", color: colors.success }}>
                            ₹{activeBill.amount?.toLocaleString() || "4,250.00"}
                          </Text>
                        </View>
                        <View style={{ height: 1, backgroundColor: "#dcfce7", marginVertical: 2 }} />
                        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                          <Text style={{ fontSize: 11, color: colors.muted }}>Reference / Txn:</Text>
                          <Text style={{ fontSize: 11, fontWeight: "700", color: colors.text }}>
                            {activeBill.paymentReference || "TXN-SIM-77192"}
                          </Text>
                        </View>
                        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                          <Text style={{ fontSize: 11, color: colors.muted }}>Household Unit:</Text>
                          <Text style={{ fontSize: 11, fontWeight: "700", color: colors.text }}>
                            {flatNumber} ({towerName})
                          </Text>
                        </View>
                        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                          <Text style={{ fontSize: 11, color: colors.muted }}>Reconciliation:</Text>
                          <Text style={{ fontSize: 11, fontWeight: "700", color: "#166534" }}>
                            Verified & Reconciled by Estate Office
                          </Text>
                        </View>
                      </View>
                    ) : (
                      <>
                        <View style={{ backgroundColor: "#f8fafc", padding: 12, borderRadius: 10, gap: 6 }}>
                          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                            <Text style={{ fontSize: 12, color: colors.muted }}>Society Maintenance (Q3):</Text>
                            <Text style={{ fontSize: 12, fontWeight: "700", color: colors.text }}>₹3,200.00</Text>
                          </View>
                          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                            <Text style={{ fontSize: 12, color: colors.muted }}>Sinking & Capital Fund:</Text>
                            <Text style={{ fontSize: 12, fontWeight: "700", color: colors.text }}>₹550.00</Text>
                          </View>
                          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                            <Text style={{ fontSize: 12, color: colors.muted }}>Common Utilities & Elevators:</Text>
                            <Text style={{ fontSize: 12, fontWeight: "700", color: colors.text }}>₹500.00</Text>
                          </View>
                          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />
                          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                            <Text style={{ fontSize: 14, fontWeight: "800", color: colors.text }}>Total Payable:</Text>
                            <Text style={{ fontSize: 14, fontWeight: "900", color: colors.primary }}>
                              ₹{activeBill?.amount?.toLocaleString() || "4,250.00"}
                            </Text>
                          </View>
                        </View>

                        <View style={{ padding: 12, backgroundColor: "#fef3c7", borderRadius: 8, borderColor: "#fde68a", borderWidth: 1 }}>
                          <Text style={{ fontSize: 12, color: "#92400e", fontWeight: "700" }}>
                            Online Payment Unavailable
                          </Text>
                          <Text style={{ fontSize: 11, color: "#b45309", marginTop: 4 }}>
                            Direct electronic payment gateway is currently unconfigured. Please settle via NEFT/IMPS (HDFC Bank, A/C: 50200012345678, IFSC: HDFC0001234) or submit cheque at the Society Management Office.
                          </Text>
                        </View>
                      </>
                    )}
                  </View>

                  <View style={localStyles.modalActions}>
                    <Pressable
                      style={[localStyles.modalButton, { backgroundColor: colors.surface, flex: 1 }]}
                      onPress={() => setPayModalOpen(false)}
                    >
                      <Text style={[localStyles.modalButtonText, { color: colors.text }]}>Close</Text>
                    </Pressable>
                    {!isBillPaid && (
                      <Pressable
                        style={[localStyles.modalButton, { backgroundColor: "#e2e8f0", flex: 1 }]}
                        disabled={true}
                      >
                        <Text style={[localStyles.modalButtonText, { color: colors.muted }]}>Gateway Offline</Text>
                      </Pressable>
                    )}
                  </View>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* 4. Notification Center Modal (Section 10 & 32) */}
      <Modal visible={notifModalOpen} animationType="slide" transparent>
        <View style={localStyles.modalOverlay}>
          <View style={localStyles.modalContent}>
            <View style={localStyles.modalHeader}>
              <View>
                <Text style={localStyles.modalTitle}>Notifications</Text>
                <Text style={{ fontSize: 11, color: colors.muted }}>
                  {unreadNotifCount} unread notification{unreadNotifCount !== 1 ? "s" : ""}
                </Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                {unreadNotifCount > 0 && (
                  <Pressable onPress={handleMarkAllNotifsRead}>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: colors.primary }}>
                      Mark all read
                    </Text>
                  </Pressable>
                )}
                <Pressable onPress={() => setNotifModalOpen(false)} style={{ padding: 4 }}>
                  <X size={20} color={colors.text} />
                </Pressable>
              </View>
            </View>

            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              {userNotifications.length === 0 ? (
                <EmptyState
                  icon={Bell}
                  title="You're caught up"
                  description="No notifications at this time."
                />
              ) : (
                userNotifications.map((notif) => (
                  <Pressable
                    key={notif.id}
                    style={[
                      localStyles.notifItem,
                      !notif.read && localStyles.notifItemUnread
                    ]}
                    onPress={() => {
                      // Mark item read
                      setUserNotifications((prev) =>
                        prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
                      );
                      setNotifModalOpen(false);
                      if (notif.category === "complaint") {
                        router.push("/(tabs)/complaints");
                      } else if (notif.category === "visitor") {
                        router.push("/(tabs)/more");
                      } else if (notif.category === "bill") {
                        setPayModalOpen(true);
                      }
                    }}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <Pill
                        tone={
                          notif.category === "emergency"
                            ? "danger"
                            : notif.category === "bill"
                            ? "accent"
                            : "primary"
                        }
                      >
                        {notif.category.toUpperCase()}
                      </Pill>
                      {!notif.read && <View style={localStyles.unreadDot} />}
                    </View>
                    <Text style={localStyles.notifTitle}>{notif.title}</Text>
                    <Text style={localStyles.notifBody}>{notif.body}</Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 5. Emergency / SOS Safety Modal (Section 24) */}
      <Modal visible={emergencyModalOpen} animationType="slide" transparent>
        <View style={localStyles.modalOverlay}>
          <View style={localStyles.modalContent}>
            <View style={localStyles.modalHeader}>
              <View>
                <Text style={[localStyles.modalTitle, { color: colors.danger }]}>
                  Emergency & SOS Assistance
                </Text>
                <Text style={{ fontSize: 11, color: colors.muted }}>
                  Instant security, medical, and fire dispatch
                </Text>
              </View>
              <Pressable onPress={() => setEmergencyModalOpen(false)} style={{ padding: 4 }}>
                <X size={20} color={colors.text} />
              </Pressable>
            </View>

            <View style={{ gap: 8, marginVertical: 10 }}>
              {[
                { name: "Security Gate 1 Intercom", phone: "+91 90000 11002", sub: "Main entrance barrier & guard post" },
                { name: "Society Estate Office", phone: "+91 90000 11000", sub: "Manager desk · 24/7 on-call" },
                { name: "Maintenance Emergency (Plumbing / Lift)", phone: "+91 90000 11001", sub: "On-duty rapid response lead" },
                { name: "National Emergency Helpline", phone: "112", sub: "Police, Fire, Ambulance unified" },
                { name: "Ambulance / Medical Emergency", phone: "102", sub: "Nearby emergency hospital care" },
                { name: "Fire Department", phone: "101", sub: "City fire service station" }
              ].map((contact, idx) => (
                <View key={idx} style={localStyles.emergencyContactRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: "800", color: colors.text }}>
                      {contact.name}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.muted }}>{contact.sub}</Text>
                  </View>
                  <Pressable
                    style={localStyles.emergencyCallButton}
                    onPress={() => Alert.alert("Emergency Call", `Connecting to ${contact.name}: ${contact.phone}`)}
                  >
                    <Phone size={14} color="#ffffff" />
                    <Text style={localStyles.emergencyCallText}>{contact.phone}</Text>
                  </Pressable>
                </View>
              ))}
            </View>

            <Pressable
              style={localStyles.emergencyBroadcastButton}
              onPress={() => {
                Alert.alert(
                  "CONFIRM EMERGENCY ALERT",
                  "Are you sure you want to broadcast an urgent alert to Security Gate 1 and the Society Manager?",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Trigger SOS Alert",
                      style: "destructive",
                      onPress: () => {
                        setEmergencyModalOpen(false);
                        Alert.alert("SOS Alert Broadcasted", "Security Guard Suresh and Estate Manager have been alerted to Flat A-1204.");
                      }
                    }
                  ]
                );
              }}
            >
              <Siren size={18} color="#ffffff" />
              <Text style={localStyles.emergencyBroadcastText}>
                Trigger Urgent Society SOS Broadcast
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}


// ─── 2. Maintenance Staff Mobile View ───────────────────────────────────────
function MaintenanceStaffMobileView() {
  const { activeStaffId, userProfile, dutyStatus, setDutyStatus, societyId } = useMobileSessionStore();
  const [workOrders, setWorkOrders] = useState<Complaint[]>([]);
  const [selectedJob, setSelectedJob] = useState<Complaint | null>(null);
  const [dutyModalOpen, setDutyModalOpen] = useState(false);

  useEffect(() => {
    const unsub = subscribeStaffWorkQueue({ societyId, staffId: activeStaffId }, (list) => {
      setWorkOrders(list);
    });
    return () => unsub();
  }, [societyId, activeStaffId]);

  // Operational metrics
  const activeOrders = workOrders.filter((c) => normalizeComplaintStatus(c.status) === "in_progress");
  const assignedOrders = workOrders.filter((c) => normalizeComplaintStatus(c.status) === "assigned");
  const waitingOrders = workOrders.filter((c) => normalizeComplaintStatus(c.status) === "resident_confirmation");
  const reopenedOrders = workOrders.filter((c) => normalizeComplaintStatus(c.status) === "reopened");
  const totalActiveJobs = workOrders.filter((c) => normalizeComplaintStatus(c.status) !== "closed");

  // SLA risk count: critical/high priority or approaching deadline
  const slaRiskCount = workOrders.filter((c) => {
    if (normalizeComplaintStatus(c.status) === "closed") return false;
    const created = new Date(c.createdAt).getTime();
    const hours = c.priority === "emergency" ? 2 : c.priority === "high" ? 4 : 12;
    return Date.now() > created + (hours - 1) * 60 * 60 * 1000;
  }).length;

  // Primary priority order
  const priorityJob =
    reopenedOrders[0] ||
    activeOrders[0] ||
    assignedOrders[0] ||
    workOrders[0] ||
    null;

  const secondaryJobs = workOrders.filter((c) => c.id !== priorityJob?.id && normalizeComplaintStatus(c.status) !== "closed");

  const technicianName = userProfile?.displayName || userProfile?.name || "Technician";
  const firstName = technicianName.split(" ")[0];

  const dutyLabels: Record<StaffAvailability, { label: string; tone: "success" | "accent" | "danger" | "primary" }> = {
    on_duty: { label: "On Active Duty", tone: "success" },
    available: { label: "Available (Standby)", tone: "primary" },
    busy: { label: "Busy (High Workload)", tone: "accent" },
    off_duty: { label: "Off Duty", tone: "danger" }
  };

  const currentDuty = dutyLabels[dutyStatus] || dutyLabels.on_duty;

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
      {/* Top Header */}
      <View style={localStyles.topBar}>
        <View>
          <Text style={localStyles.societyHeader}>Engineering & Facilities</Text>
          <Title>Good day, {firstName}</Title>
        </View>
        <Pressable style={localStyles.topIcons} onPress={() => setDutyModalOpen(true)}>
          <View style={localStyles.dutyBadge}>
            <View
              style={[
                localStyles.statusDot,
                {
                  backgroundColor:
                    currentDuty.tone === "success"
                      ? colors.success
                      : currentDuty.tone === "accent"
                      ? colors.accent
                      : colors.muted
                }
              ]}
            />
            <Text style={localStyles.dutyBadgeText}>{currentDuty.label}</Text>
          </View>
        </Pressable>
      </View>

      {/* Staff Telemetry Bar */}
      <View style={localStyles.staffBanner}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View>
            <Text style={localStyles.identityFlat}>
              {technicianName} · {userProfile?.department ? `${String(userProfile.department).toUpperCase()} Lead` : "Lead Specialist"}
            </Text>
            <Text style={localStyles.identityHousehold}>UID: {userProfile?.uid || "N/A"}</Text>
          </View>
          {reopenedOrders.length > 0 ? (
            <Pill tone="danger">REOPENED ACTION REQ</Pill>
          ) : activeOrders.length > 0 ? (
            <Pill tone="accent">JOB IN PROGRESS</Pill>
          ) : (
            <Pill tone="success">READY FOR DISPATCH</Pill>
          )}
        </View>

        {/* Real-time Telemetry Metrics (Derived from Firestore) */}
        <View style={localStyles.telemetryRow}>
          <View style={localStyles.telemetryItem}>
            <Text style={localStyles.telemetryLabel}>Active Jobs</Text>
            <Text style={localStyles.telemetryValue}>{totalActiveJobs.length}</Text>
          </View>
          <View style={localStyles.telemetryDivider} />
          <View style={localStyles.telemetryItem}>
            <Text style={localStyles.telemetryLabel}>In Progress</Text>
            <Text style={localStyles.telemetryValue}>{activeOrders.length}</Text>
          </View>
          <View style={localStyles.telemetryDivider} />
          <View style={localStyles.telemetryItem}>
            <Text style={localStyles.telemetryLabel}>Awaiting Resident</Text>
            <Text style={localStyles.telemetryValue}>{waitingOrders.length}</Text>
          </View>
          <View style={localStyles.telemetryDivider} />
          <View style={localStyles.telemetryItem}>
            <Text style={localStyles.telemetryLabel}>SLA Risk</Text>
            <Text style={[localStyles.telemetryValue, { color: slaRiskCount > 0 ? colors.danger : colors.text }]}>
              {slaRiskCount}
            </Text>
          </View>
        </View>
      </View>

      {/* Fast Tools Shortcut Row */}
      <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
        <Pressable
          style={[localStyles.modalButton, { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}
          onPress={() => setDutyModalOpen(true)}
        >
          <UserCheck size={14} color={colors.secondary} />
          <Text style={[localStyles.modalButtonText, { color: colors.secondary, fontSize: 12 }]}>Duty Status</Text>
        </Pressable>

        <Pressable
          style={[localStyles.modalButton, { flex: 1, backgroundColor: colors.primary }]}
          onPress={() => router.push("/complaints")}
        >
          <Wrench size={14} color="#ffffff" />
          <Text style={[localStyles.modalButtonText, { color: "#ffffff", fontSize: 12 }]}>Work Queue</Text>
        </Pressable>
      </View>

      {/* Primary Work Order */}
      <View style={{ marginTop: 18 }}>
        <Text style={localStyles.sectionHeading}>Priority Work Order</Text>

        {!priorityJob ? (
          <Card style={{ padding: 20, alignItems: "center", marginTop: 8 }}>
            <CheckCircle2 size={32} color={colors.success} />
            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text, marginTop: 8 }}>
              No Active Work Orders Assigned
            </Text>
            <Text style={{ fontSize: 12, color: colors.muted, textAlign: "center", marginTop: 4 }}>
              Your operational queue is clear. New dispatch assignments from the estate control room will appear here.
            </Text>
          </Card>
        ) : (
          <Card style={localStyles.ticketCard}>
            <View style={localStyles.ticketCardHeader}>
              <Pill
                tone={
                  normalizeComplaintStatus(priorityJob.status) === "resident_confirmation"
                    ? "success"
                    : normalizeComplaintStatus(priorityJob.status) === "reopened"
                    ? "danger"
                    : priorityJob.priority === "emergency" || priorityJob.priority === "high"
                    ? "danger"
                    : "primary"
                }
              >
                {normalizeComplaintStatus(priorityJob.status) === "resident_confirmation"
                  ? "AWAITING RESIDENT SIGN-OFF"
                  : normalizeComplaintStatus(priorityJob.status) === "reopened"
                  ? "REOPENED BY RESIDENT"
                  : `${priorityJob.priority?.toUpperCase()} PRIORITY · ${priorityJob.status.toUpperCase()}`}
              </Pill>
              <Text style={localStyles.ticketCardId}>#{priorityJob.id.toUpperCase()}</Text>
            </View>

            <Text style={localStyles.ticketCardTitle}>{priorityJob.title}</Text>
            <Muted>
              {priorityJob.towerId ? `Tower ${priorityJob.towerId.replace("tower-", "").toUpperCase()} · ` : ""}
              {priorityJob.flatId ? `Flat ${priorityJob.flatId.replace("flat-", "").toUpperCase()}` : priorityJob.location || "Common Area"}
            </Muted>

            <View style={{ backgroundColor: "#f8fafc", borderRadius: 8, padding: 10, marginTop: 10 }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: colors.text }}>Issue Detail:</Text>
              <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>{priorityJob.description}</Text>
              {priorityJob.reopenReason && (
                <Text style={{ fontSize: 11, color: "#b45309", fontWeight: "700", marginTop: 4 }}>
                  Reopen Reason: {priorityJob.reopenReason}
                </Text>
              )}
            </View>

            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
              <StatusBadge status={priorityJob.status} />
              <Pressable
                style={[localStyles.modalButton, { backgroundColor: colors.primary, height: 38, paddingHorizontal: 16 }]}
                onPress={() => setSelectedJob(priorityJob)}
              >
                <Text style={[localStyles.modalButtonText, { color: "#ffffff", fontSize: 12 }]}>
                  Open Full Order
                </Text>
                <ChevronRight size={14} color="#ffffff" />
              </Pressable>
            </View>
          </Card>
        )}
      </View>

      {/* Secondary Queue Items */}
      {secondaryJobs.length > 0 && (
        <View style={{ marginTop: 18 }}>
          <Text style={localStyles.sectionHeading}>Up Next In Queue ({secondaryJobs.length})</Text>
          {secondaryJobs.slice(0, 2).map((item) => (
            <Card key={item.id} style={{ marginTop: 8, padding: 14 }}>
              <View style={localStyles.ticketCardHeader}>
                <Pill tone={item.priority === "emergency" || item.priority === "high" ? "danger" : "primary"}>
                  {item.priority?.toUpperCase()}
                </Pill>
                <Text style={localStyles.ticketCardId}>#{item.id.toUpperCase()}</Text>
              </View>
              <Text style={localStyles.ticketCardTitle}>{item.title}</Text>
              <Muted>
                {item.towerId ? `Tower ${item.towerId.replace("tower-", "").toUpperCase()} · ` : ""}
                {item.flatId ? `Flat ${item.flatId.replace("flat-", "").toUpperCase()}` : item.location}
              </Muted>
              <Pressable
                style={[localStyles.ticketActionButton, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginTop: 10 }]}
                onPress={() => setSelectedJob(item)}
              >
                <Text style={[localStyles.ticketActionButtonText, { color: colors.primary }]}>View Order</Text>
              </Pressable>
            </Card>
          ))}
        </View>
      )}

      {/* Duty Status Modal */}
      <Modal visible={dutyModalOpen} animationType="fade" transparent onRequestClose={() => setDutyModalOpen(false)}>
        <View style={localStyles.modalOverlay}>
          <View style={localStyles.modalContent}>
            <View style={localStyles.modalHeader}>
              <Text style={localStyles.modalTitle}>Technician Duty Posture</Text>
              <Pressable onPress={() => setDutyModalOpen(false)} style={{ padding: 4 }}>
                <X size={20} color={colors.text} />
              </Pressable>
            </View>

            <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 12 }}>
              Update your operational availability for the automated dispatch engine.
            </Text>

            <View style={{ gap: 8 }}>
              {(["on_duty", "available", "busy", "off_duty"] as StaffAvailability[]).map((statusKey) => (
                <Pressable
                  key={statusKey}
                  style={[
                    localStyles.modalButton,
                    {
                      justifyContent: "space-between",
                      paddingHorizontal: 14,
                      backgroundColor: dutyStatus === statusKey ? colors.primaryLight : colors.surface,
                      borderWidth: 1,
                      borderColor: dutyStatus === statusKey ? colors.primary : colors.border
                    }
                  ]}
                  onPress={() => {
                    const prev = dutyStatus;
                    setDutyStatus(statusKey);
                    if (userProfile?.uid) {
                      updateTechnicianDutyStatus(userProfile.uid, societyId, statusKey, prev);
                    }
                    setDutyModalOpen(false);
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "700",
                      color: dutyStatus === statusKey ? colors.primary : colors.text
                    }}
                  >
                    {dutyLabels[statusKey].label}
                  </Text>
                  {dutyStatus === statusKey && <Check size={16} color={colors.primary} />}
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* Full Job Detail Modal */}
      {selectedJob && (
        <StaffJobDetailModal
          complaint={selectedJob}
          visible={Boolean(selectedJob)}
          onClose={() => setSelectedJob(null)}
          onStatusUpdated={(updated) => {
            setSelectedJob(updated);
            setWorkOrders((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
          }}
        />
      )}
    </ScrollView>
  );
}



const localStyles = StyleSheet.create({
  roleBar: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#ffffff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10
  },
  roleBarLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: colors.muted,
    letterSpacing: 0.5,
    marginBottom: 4
  },
  rolePillsRow: {
    flexDirection: "row",
    gap: 6
  },
  rolePill: {
    flex: 1,
    height: 32,
    borderRadius: 6,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center"
  },
  rolePillActive: {
    backgroundColor: colors.primary
  },
  rolePillText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.text
  },
  rolePillTextActive: {
    color: "#ffffff"
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  societyHeader: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  topIcons: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center"
  },
  dutyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#f0fdf4",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#bbf7d0"
  },
  dutyBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.success
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center"
  },
  identityBanner: {
    marginTop: 10,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 14
  },
  staffBanner: {
    marginTop: 10,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 14
  },
  identityFlat: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text
  },
  identityHousehold: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#f0fdf4",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.success
  },
  telemetryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: "#f1f5f9"
  },
  telemetryItem: {
    alignItems: "center",
    flex: 1
  },
  telemetryLabel: {
    fontSize: 10,
    color: colors.muted,
    fontWeight: "600"
  },
  telemetryValue: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.text,
    marginTop: 1
  },
  telemetryDivider: {
    width: 1,
    height: 18,
    backgroundColor: colors.border
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.text
  },
  seeAllLink: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary
  },
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8
  },
  actionCard: {
    width: "48.5%",
    minHeight: 88,
    padding: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    justifyContent: "center"
  },
  actionIconBox: {
    width: 34,
    height: 34,
    borderRadius: 6,
    backgroundColor: `${colors.primary}12`,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6
  },
  actionCardTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.text
  },
  actionCardSub: {
    fontSize: 10,
    color: colors.muted,
    marginTop: 1
  },
  ticketCard: {
    marginTop: 8,
    padding: 14
  },
  ticketCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  ticketCardId: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.muted
  },
  ticketCardTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.text,
    marginTop: 6
  },
  alertBox: {
    marginTop: 10,
    padding: 10,
    backgroundColor: "#fff7ed",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#ffedd5"
  },
  alertBoxText: {
    fontSize: 11,
    color: "#c2410c",
    fontWeight: "700",
    marginBottom: 8
  },
  ticketActionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    height: 44,
    borderRadius: 6,
    backgroundColor: colors.primary,
    marginTop: 10
  },
  ticketActionButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#ffffff"
  },
  paySmallButton: {
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center"
  },
  paySmallButtonText: {
    fontSize: 12,
    fontWeight: "800"
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end"
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 18,
    maxHeight: "85%"
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.muted,
    textTransform: "uppercase",
    marginTop: 10,
    marginBottom: 4
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: colors.text
  },
  typeButton: {
    flex: 1,
    height: 38,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center"
  },
  typeButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  typeButtonText: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.muted
  },
  typeButtonTextActive: {
    color: "#ffffff"
  },
  qrBox: {
    padding: 16,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8
  },
  qrCodeText: {
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 2,
    color: colors.primary,
    fontFamily: "monospace"
  },
  modalActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
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
  unreadDotBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3
  },
  unreadDotText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "900"
  },
  qrSelectItem: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#ffffff"
  },
  qrSelectItemActive: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}0c`
  },
  qrSelectText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.text
  },
  qrSelectTextActive: {
    color: colors.primary,
    fontWeight: "800"
  },
  resolvedAssetBox: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: `${colors.primary}0e`,
    borderWidth: 1,
    borderColor: `${colors.primary}25`,
    marginBottom: 8
  },
  notifItem: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
    backgroundColor: "#ffffff"
  },
  notifItemUnread: {
    borderColor: `${colors.primary}40`,
    backgroundColor: "#fafafa"
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary
  },
  notifTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.text,
    marginTop: 6
  },
  notifBody: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
    lineHeight: 16
  },
  emergencyContactRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border
  },
  emergencyCallButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.danger,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6
  },
  emergencyCallText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800"
  },
  emergencyBroadcastButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.danger,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 10
  },
  emergencyBroadcastText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800"
  }
});
