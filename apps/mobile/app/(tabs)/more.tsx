import { useEffect, useState } from "react";
import { router } from "expo-router";
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from "react-native";
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  ChevronRight,
  Clock,
  CreditCard,
  FileCheck,
  FileText,
  HelpCircle,
  Home,
  Lock,
  LogOut,
  Mail,
  Package,
  Phone,
  Plus,
  QrCode,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Sparkles,
  Tag,
  User,
  UserCheck,
  UserPlus,
  Users,
  X
} from "lucide-react-native";
import {
  householdRoleLabels,
  notices
} from "@resolvex/utils";
import type { Delivery, Notice, UserProfile, VisitorPass } from "@resolvex/types";
import { auth, db, isFirebaseConfigured } from "../../lib/firebase";
import { collection, doc, onSnapshot, query, setDoc, where } from "firebase/firestore";
import {
  ActionButton,
  Card,
  colors,
  EmptyState,
  LogoutButton,
  Muted,
  Pill,
  Screen,
  Title
} from "../../components/mobile-ui";
import {
  mobileRegister,
  mobileSignIn,
  mobileSignOut
} from "../../lib/auth-service";

type MoreSection =
  | "overview"
  | "household"
  | "visitors"
  | "deliveries"
  | "bills"
  | "notices"
  | "emergency"
  | "settings";

import { useMobileSessionStore } from "../../lib/session-store";
import { StaffProfileView } from "../../components/staff-views";
import { SecurityGuardProfileView } from "../../components/security-views";

export default function MoreScreen() {
  const activeRole = useMobileSessionStore((state) => state.userProfile?.role);

  if (activeRole === "maintenance_staff") {
    return <StaffProfileView />;
  }

  if (activeRole === "security_guard") {
    return (
      <Screen>
        <SecurityGuardProfileView />
      </Screen>
    );
  }

  const [activeSection, setActiveSection] = useState<MoreSection>("overview");
  const profile = useMobileSessionStore((state) => state.userProfile);

  // Household State
  const household = {
    id: profile?.householdId || "hh-1",
    displayName: `${profile?.displayName || "Resident"}'s Residence`,
    inviteCode: profile?.householdId ? profile.householdId.slice(-6).toUpperCase() : "RESOLVEX"
  };
  const [members, setMembers] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);

  // Passes State
  const [passes, setPasses] = useState<VisitorPass[]>([]);
  const [newPassModalOpen, setNewPassModalOpen] = useState(false);
  const [newPassName, setNewPassName] = useState("");
  const [newPassPhone, setNewPassPhone] = useState("");
  const [newPassVehicle, setNewPassVehicle] = useState("");
  const [newPassType, setNewPassType] = useState<VisitorPass["type"]>("guest");

  // Deliveries State
  const [deliveries, setDeliveries] = useState<Array<{ id: string; courier: string; tracking: string; time: string; status: "Received at Gate" | "Collected" }>>([
    { id: "del-1", courier: "Amazon Logistics", tracking: "AZ-984210", time: "Today, 11:30 AM", status: "Received at Gate" },
    { id: "del-2", courier: "BlueDart Express", tracking: "BD-442190", time: "Yesterday, 04:00 PM", status: "Collected" }
  ]);

  // Billing State
  const [billList, setBillList] = useState<any[]>([]);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [isPaid, setIsPaid] = useState(false);

  // Notices Modal State
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [liveNotices, setLiveNotices] = useState<Notice[]>([]);

  // Privacy & Settings State
  const [showPhoneInDir, setShowPhoneInDir] = useState(false);
  const [showEmailInDir, setShowEmailInDir] = useState(false);
  const [notifComplaints, setNotifComplaints] = useState(true);
  const [notifVisitors, setNotifVisitors] = useState(true);
  const [notifBills, setNotifBills] = useState(true);

  useEffect(() => {
    const privacy = (profile as any)?.privacy;
    if (privacy) {
      setShowPhoneInDir(Boolean(privacy.showPhoneInDirectory));
      setShowEmailInDir(Boolean(privacy.showEmailInDirectory));
    }
  }, [profile]);

  // Real-time Firestore Subscriptions for Passes, Bills, and Notices
  useEffect(() => {
    if (!isFirebaseConfigured || !auth.currentUser || auth.currentUser.uid !== profile?.uid) return;
    const unsubs: Array<() => void> = [];

    // 1. Passes for this household
    if (profile?.householdId) {
      const qP = query(
        collection(db, "visitor_passes"),
        where("householdId", "==", profile.householdId)
      );
      const unsubP = onSnapshot(
        qP,
        (snap) => {
          const list: VisitorPass[] = [];
          snap.forEach((d) => list.push({ id: d.id, ...d.data() } as VisitorPass));
          list.sort((a, b) => new Date((b as any).createdAt || b.visitDate || 0).getTime() - new Date((a as any).createdAt || a.visitDate || 0).getTime());
          setPasses(list);
        },
        (err) => console.warn("More visitor passes snapshot error:", err)
      );
      unsubs.push(unsubP);

      // 2. Bills for this household
      const qB = query(
        collection(db, "bills"),
        where("householdId", "==", profile.householdId)
      );
      const unsubB = onSnapshot(
        qB,
        (snap) => {
          const list: any[] = [];
          snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
          setBillList(list);
        },
        (err) => console.warn("More bills snapshot error:", err)
      );
      unsubs.push(unsubB);
    }

    // 3. Notices for this society
    if (profile?.societyId) {
      const qN = query(
        collection(db, "notices"),
        where("societyId", "==", profile.societyId)
      );
      const unsubN = onSnapshot(
        qN,
        (snap) => {
          const list: Notice[] = [];
          snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Notice));
          list.sort(
            (a, b) =>
              new Date((b as any).publishedAt || (b as any).createdAt || 0).getTime() -
              new Date((a as any).publishedAt || (a as any).createdAt || 0).getTime()
          );
          setLiveNotices(list);
        },
        (err) => console.warn("More notices snapshot error:", err)
      );
      unsubs.push(unsubN);
    }

    return () => unsubs.forEach((u) => u());
  }, [profile?.householdId, profile?.societyId, profile?.uid]);

  const residentName = profile?.displayName || "Resident";
  const unitInfo = profile?.flatId && profile?.towerId
    ? `Tower ${profile.towerId.replace("tower-", "").toUpperCase()} · Flat ${profile.flatId.replace("flat-", "").toUpperCase()}`
    : (profile?.flatId ? `Flat ${profile.flatId.replace("flat-", "").toUpperCase()}` : "My Unit");

  async function handleSignOut() {
    Alert.alert(
      "Log Out",
      "Are you sure you want to log out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log Out",
          style: "destructive",
          onPress: async () => {
            try {
              await mobileSignOut();
              router.replace("/(auth)/login");
            } catch (err: any) {
              Alert.alert("Logout Error", err?.message || "Failed to log out.");
            }
          }
        }
      ]
    );
  }

  // ─── Household Handlers ───
  function handleApprovePending(reqId: string, name: string) {
    setPendingRequests((prev) => prev.filter((r) => r.id !== reqId));
    Alert.alert("Member Approved", `${name} has been verified and added to the household.`);
  }

  function handleRejectPending(reqId: string) {
    setPendingRequests((prev) => prev.filter((r) => r.id !== reqId));
    Alert.alert("Request Declined", "The join request was declined.");
  }

  // ─── Visitor Pass Handlers ───
  function handleCreatePass() {
    if (!newPassName.trim()) {
      Alert.alert("Required", "Please provide visitor name.");
      return;
    }
    if (!profile?.householdId || !profile?.societyId) {
      Alert.alert("Profile Incomplete", "Missing household or society assignment.");
      return;
    }
    const token = `AJX-${Math.floor(1000 + Math.random() * 9000)}`;
    const passId = `visit-${Date.now().toString().slice(-4)}`;
    const now = new Date().toISOString();
    const newPass: VisitorPass = {
      id: passId,
      societyId: profile.societyId,
      householdId: profile.householdId,
      flatId: profile.flatId || "flat-unknown",
      createdByUserId: profile.uid,
      visitorName: newPassName.trim(),
      visitorPhone: newPassPhone.trim() || undefined,
      vehicleNumber: newPassVehicle.trim() || undefined,
      type: newPassType,
      visitDate: now.split("T")[0],
      status: "approved",
      qrToken: token
    };

    if (isFirebaseConfigured) {
      setDoc(doc(db, "visitor_passes", passId), newPass).catch((e) =>
        console.warn("Visitor pass Firestore write error:", e)
      );
    }

    setPasses([newPass, ...passes]);
    setNewPassName("");
    setNewPassPhone("");
    setNewPassVehicle("");
    setNewPassModalOpen(false);
    Alert.alert(
      "Gate Pass Created",
      `Pass Code: ${token}\nValid for ${newPass.visitorName}.\nPresent code or QR to Gate 1 security guard.`
    );
  }

  // ─── Deliveries Handler ───
  function handleMarkCollected(deliveryId: string) {
    setDeliveries((prev) =>
      prev.map((d) => (d.id === deliveryId ? { ...d, status: "Collected" } : d))
    );
    Alert.alert("Parcel Collected", "Gate 1 security logs updated. Parcel marked as received.");
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
        {/* Profile Card Header */}
        <Card style={localStyles.profileCard}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <View style={localStyles.profileAvatar}>
              <Text style={localStyles.profileAvatarText}>
                {residentName.slice(0, 2).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Title>{residentName}</Title>
              <Text style={{ fontSize: 13, color: colors.muted, marginTop: 1 }}>
                {unitInfo} · {household.displayName}
              </Text>
              <View style={{ flexDirection: "row", gap: 6, marginTop: 6 }}>
                <Pill tone={profile?.status === "verified" ? "success" : "accent"}>
                  {profile?.status === "verified" ? "Verified Resident" : "Pending Verification"}
                </Pill>
                {profile?.emailVerified && <Pill tone="success">Email Verified</Pill>}
              </View>
            </View>
          </View>

          <View style={localStyles.authRow}>
            <Text style={{ fontSize: 11, color: colors.muted }}>
              {profile?.email || "Signed in with local profile"}
            </Text>
            <Pressable
              style={localStyles.authButton}
              onPress={() => (profile ? handleSignOut() : router.push("/(auth)/login"))}
            >
              <Text style={localStyles.authButtonText}>
                {profile ? "Sign Out" : "Sign In to Account"}
              </Text>
            </Pressable>
          </View>
        </Card>

        {/* Section Navigation Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 14 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {[
              { id: "overview", label: "Overview" },
              { id: "household", label: `Household (${members.length})` },
              { id: "visitors", label: `Visitors (${passes.length})` },
              { id: "deliveries", label: `Deliveries (${deliveries.filter((d) => d.status === "Received at Gate").length})` },
              { id: "bills", label: "Bills & Dues" },
              { id: "notices", label: "Notices" },
              { id: "emergency", label: "Emergency SOS" },
              { id: "settings", label: "Settings" }
            ].map((sec) => {
              const isActive = activeSection === sec.id;
              return (
                <Pressable
                  key={sec.id}
                  style={[localStyles.navPill, isActive && localStyles.navPillActive]}
                  onPress={() => setActiveSection(sec.id as MoreSection)}
                >
                  <Text style={[localStyles.navPillText, isActive && localStyles.navPillTextActive]}>
                    {sec.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        {/* ─── SECTION 1: OVERVIEW TILES ─── */}
        {activeSection === "overview" && (
          <View style={{ gap: 10 }}>
            {[
              {
                id: "household",
                title: "My Household",
                desc: `${members.length} verified residents · ${pendingRequests.length} pending join request`,
                icon: Users
              },
              {
                id: "visitors",
                title: "Visitor Gate Passes",
                desc: "Generate fast-track QR passes for guests and delivery drivers",
                icon: UserPlus
              },
              {
                id: "deliveries",
                title: "Gate Deliveries & Parcels",
                desc: "Track packages received at Guardhouse 1",
                icon: Package
              },
              {
                id: "bills",
                title: "Maintenance Bills & Receipts",
                desc: "View quarterly maintenance breakdown and official invoices",
                icon: CreditCard
              },
              {
                id: "notices",
                title: "Society Notices & Circulars",
                desc: `${notices.length} active announcements from Society Management`,
                icon: FileText
              },
              {
                id: "emergency",
                title: "Emergency Contacts & SOS",
                desc: "Gate 1 Intercom, Society Manager, Ambulance, Police",
                icon: Siren
              },
              {
                id: "settings",
                title: "Privacy & Notification Preferences",
                desc: "Directory masking and society alert controls",
                icon: Shield
              }
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => setActiveSection(item.id as MoreSection)}
                >
                  <Card style={{ padding: 14 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                      <View style={localStyles.tileIconBox}>
                        <Icon size={20} color={colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: "800", color: colors.text }}>
                          {item.title}
                        </Text>
                        <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
                          {item.desc}
                        </Text>
                      </View>
                      <ChevronRight size={18} color={colors.muted} />
                    </View>
                  </Card>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* ─── SECTION 2: HOUSEHOLD EXPERIENCE (Section 12) ─── */}
        {activeSection === "household" && (
          <View style={{ gap: 12 }}>
            <Card style={{ padding: 14 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View>
                  <Text style={{ fontSize: 16, fontWeight: "900", color: colors.text }}>
                    {household.displayName}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
                    {unitInfo} · Invite Code: <Text style={{ fontWeight: "800", color: colors.primary }}>{household.inviteCode}</Text>
                  </Text>
                </View>
                <Pressable
                  style={localStyles.smallActionButton}
                  onPress={() => Alert.alert("Invite Code Copied", `Share code: ${household.inviteCode} with household members.`)}
                >
                  <Text style={localStyles.smallActionText}>Copy Code</Text>
                </Pressable>
              </View>
            </Card>

            {/* Pending Requests */}
            {pendingRequests.length > 0 && (
              <View style={{ gap: 6 }}>
                <Text style={localStyles.subheading}>Pending Verification ({pendingRequests.length})</Text>
                {pendingRequests.map((req) => (
                  <Card key={req.id} style={{ padding: 12, backgroundColor: "#fffbeb", borderColor: "#fde68a" }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <View>
                        <Text style={{ fontSize: 14, fontWeight: "800", color: colors.text }}>
                          {req.name}
                        </Text>
                        <Text style={{ fontSize: 11, color: colors.muted }}>
                          Requested: {req.role} · {req.phone}
                        </Text>
                      </View>
                      <View style={{ flexDirection: "row", gap: 6 }}>
                        <Pressable
                          style={[localStyles.smallActionButton, { backgroundColor: colors.success }]}
                          onPress={() => handleApprovePending(req.id, req.name)}
                        >
                          <Text style={[localStyles.smallActionText, { color: "#ffffff" }]}>Approve</Text>
                        </Pressable>
                        <Pressable
                          style={[localStyles.smallActionButton, { backgroundColor: "#fee2e2" }]}
                          onPress={() => handleRejectPending(req.id)}
                        >
                          <Text style={[localStyles.smallActionText, { color: colors.danger }]}>Decline</Text>
                        </Pressable>
                      </View>
                    </View>
                  </Card>
                ))}
              </View>
            )}

            {/* Verified Household Members */}
            <Text style={localStyles.subheading}>Active Household Members ({members.length})</Text>
            {members.map((member) => (
              <Card key={member.id} style={{ padding: 12 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View>
                    <Text style={{ fontSize: 14, fontWeight: "800", color: colors.text }}>
                      {member.name}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.muted }}>
                      {member.phone} · Joined {new Date(member.joinedAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <Pill tone={member.householdRole === "owner" ? "primary" : member.householdRole === "tenant" ? "accent" : "secondary"}>
                    {(householdRoleLabels as any)[member.householdRole] || "Resident"}
                  </Pill>
                </View>
              </Card>
            ))}
          </View>
        )}

        {/* ─── SECTION 3: VISITOR EXPERIENCE (Section 13) ─── */}
        {activeSection === "visitors" && (
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={localStyles.subheading}>Active Visitor Passes</Text>
              <Pressable
                style={localStyles.primarySmallButton}
                onPress={() => setNewPassModalOpen(true)}
              >
                <Plus size={14} color="#ffffff" />
                <Text style={localStyles.primarySmallButtonText}>Create Pass</Text>
              </Pressable>
            </View>

            {passes.map((pass) => (
              <Card key={pass.id} style={{ padding: 14 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Pill tone={pass.status === "approved" ? "success" : "primary"}>
                        {pass.status.toUpperCase()}
                      </Pill>
                      <Text style={{ fontSize: 12, fontWeight: "800", color: colors.primary }}>
                        Code: {pass.qrToken}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 15, fontWeight: "800", color: colors.text, marginTop: 4 }}>
                      {pass.visitorName}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.muted }}>
                      {pass.purpose || "Guest Visit"} · Valid Date: {pass.visitDate}
                    </Text>
                    {pass.vehicleNumber && (
                      <Text style={{ fontSize: 11, color: colors.muted }}>
                        Vehicle: {pass.vehicleNumber}
                      </Text>
                    )}
                  </View>
                  <View style={{ alignItems: "center", padding: 6, backgroundColor: "#ffffff", borderRadius: 8, borderWidth: 1, borderColor: colors.border }}>
                    <Image
                      source={{
                        uri: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
                          pass.qrToken
                        )}`
                      }}
                      style={{ width: 56, height: 56 }}
                      resizeMode="contain"
                    />
                    <Text style={{ fontSize: 9, color: colors.muted, marginTop: 2 }}>GATE PASS</Text>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}

        {/* ─── SECTION 4: DELIVERIES EXPERIENCE (Section 14) ─── */}
        {activeSection === "deliveries" && (
          <View style={{ gap: 12 }}>
            <Text style={localStyles.subheading}>Guardhouse Gate Deliveries</Text>

            {deliveries.map((del) => {
              const isPendingCollection = del.status === "Received at Gate";
              return (
                <Card key={del.id} style={{ padding: 14 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <View>
                      <Pill tone={isPendingCollection ? "accent" : "success"}>
                        {del.status}
                      </Pill>
                      <Text style={{ fontSize: 15, fontWeight: "800", color: colors.text, marginTop: 6 }}>
                        {del.courier}
                      </Text>
                      <Text style={{ fontSize: 12, color: colors.muted }}>
                        Tracking: {del.tracking} · {del.time}
                      </Text>
                    </View>
                    {isPendingCollection && (
                      <Pressable
                        style={localStyles.smallActionButton}
                        onPress={() => handleMarkCollected(del.id)}
                      >
                        <Text style={localStyles.smallActionText}>Mark Collected</Text>
                      </Pressable>
                    )}
                  </View>
                </Card>
              );
            })}
          </View>
        )}

        {/* ─── SECTION 5: MAINTENANCE BILLS (Section 23) ─── */}
        {activeSection === "bills" && (
          <View style={{ gap: 12 }}>
            <Text style={localStyles.subheading}>Maintenance Accounts & Dues</Text>

            {billList.length === 0 ? (
              <Card style={{ padding: 20, alignItems: "center" }}>
                <CheckCircle2 color={colors.success} size={30} />
                <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text, marginTop: 8 }}>
                  No outstanding maintenance dues
                </Text>
                <Muted>All billing statements for your household are settled.</Muted>
              </Card>
            ) : (
              billList.map((bill) => {
                const isBillPaid = bill.status === "paid";
                return (
                  <Card key={bill.id} style={{ padding: 16 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={{ fontSize: 16, fontWeight: "900", color: colors.text }}>
                          {bill.title || "Society Maintenance"}
                        </Text>
                        <Muted>
                          {isBillPaid
                            ? "Settled · Payment Reconciled"
                            : `Due Date: ${bill.dueDate || "Due Soon"}`}
                        </Muted>
                      </View>
                      <Text
                        style={{
                          fontSize: 18,
                          fontWeight: "900",
                          color: isBillPaid ? colors.success : colors.primary
                        }}
                      >
                        ₹{bill.amount?.toLocaleString() || "4,250"}
                      </Text>
                    </View>

                    <View style={{ backgroundColor: "#f8fafc", padding: 10, borderRadius: 8, marginVertical: 12, gap: 6 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={{ fontSize: 12, color: colors.muted }}>Billing Period:</Text>
                        <Text style={{ fontSize: 12, fontWeight: "700", color: colors.text }}>{bill.billingPeriod || "Q3"}</Text>
                      </View>
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={{ fontSize: 12, color: colors.muted }}>Category:</Text>
                        <Text style={{ fontSize: 12, fontWeight: "700", color: colors.text }}>{bill.category || "Maintenance & Sinking Fund"}</Text>
                      </View>
                    </View>

                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <Pill tone={isBillPaid ? "success" : "accent"}>{isBillPaid ? "PAID" : "PENDING"}</Pill>
                      <Pressable
                        style={[
                          localStyles.smallActionButton,
                          {
                            backgroundColor: isBillPaid ? colors.surface : colors.primary,
                            borderWidth: isBillPaid ? 1 : 0,
                            borderColor: colors.border
                          }
                        ]}
                        onPress={() => {
                          if (isBillPaid) {
                            Alert.alert(
                              `Official Receipt #${bill.paymentReference || `REC-${bill.id}`}`,
                              `Amount Settled: ₹${bill.amount?.toLocaleString() || "4,250"}\nStatus: Settled in Full\nDate: ${bill.paidAt ? new Date(bill.paidAt).toLocaleDateString("en-IN") : "Recent"}\nPayment Method: Electronic Transfer / Reconciled\nVerified by Society Management Office.`
                            );
                          } else {
                            Alert.alert(
                              "Payment Information",
                              `Amount Due: ₹${bill.amount}\n\nOnline payment gateway integration is currently in transition for your society. Direct electronic transfers (NEFT/IMPS: HDFC Bank, A/C: 50200012345678, IFSC: HDFC0001234) or cheque payments at the society office are accepted and reconciled.`
                            );
                          }
                        }}
                      >
                        <Text style={[localStyles.smallActionText, { color: isBillPaid ? colors.text : "#ffffff" }]}>
                          {isBillPaid ? "View Receipt" : "Payment Info"}
                        </Text>
                      </Pressable>
                    </View>
                  </Card>
                );
              })
            )}
          </View>
        )}

        {/* ─── SECTION 6: SOCIETY NOTICES (Section 11) ─── */}
        {activeSection === "notices" && (
          <View style={{ gap: 12 }}>
            <Text style={localStyles.subheading}>Official Circulars & Notices</Text>
            {(liveNotices.length > 0 ? liveNotices : notices).map((notice) => (
              <Pressable
                key={notice.id}
                onPress={() => setSelectedNotice(notice)}
              >
                <Card style={{ padding: 14 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Pill tone={notice.type === "emergency" ? "danger" : notice.type === "maintenance" ? "accent" : "primary"}>
                      {notice.type.toUpperCase()}
                    </Pill>
                    <Text style={{ fontSize: 11, color: colors.muted }}>
                      {new Date(notice.publishedAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: "800", color: colors.text, marginTop: 6 }}>
                    {notice.title}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }} numberOfLines={2}>
                    {notice.description}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.primary, fontWeight: "700", marginTop: 6 }}>
                    Tap to view full circular →
                  </Text>
                </Card>
              </Pressable>
            ))}
          </View>
        )}

        {/* ─── SECTION 7: EMERGENCY DIRECTORY & SOS (Section 24) ─── */}
        {activeSection === "emergency" && (
          <View style={{ gap: 12 }}>
            <View style={{ backgroundColor: "#fef2f2", padding: 12, borderRadius: 10, borderWidth: 1, borderColor: "#fecaca" }}>
              <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                <Siren size={20} color={colors.danger} />
                <Text style={{ fontSize: 14, fontWeight: "900", color: colors.danger }}>
                  Society Emergency Protocol
                </Text>
              </View>
              <Text style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>
                Instant direct-dial contacts for on-duty security guard post, maintenance desk, and public safety helplines.
              </Text>
            </View>

            {[
              { name: "Security Gate 1 Intercom", phone: "+91 90000 11002", role: "Main Gate Guard Post" },
              { name: "Society Estate Manager", phone: "+91 90000 11000", role: "Office Management" },
              { name: "Maintenance Emergency (Plumbing / Lifts)", phone: "+91 90000 11001", role: "24/7 Rapid Response" },
              { name: "Unified Emergency Police", phone: "112", role: "National helpline" },
              { name: "Ambulance / Medical", phone: "102", role: "Emergency Medical Services" },
              { name: "Fire Response", phone: "101", role: "Sector 74 Fire Station" }
            ].map((contact, i) => (
              <Card key={i} style={{ padding: 12 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View>
                    <Text style={{ fontSize: 14, fontWeight: "800", color: colors.text }}>
                      {contact.name}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.muted }}>{contact.role}</Text>
                  </View>
                  <Pressable
                    style={localStyles.callButton}
                    onPress={() => Alert.alert("Emergency Call", `Connecting to ${contact.name}: ${contact.phone}`)}
                  >
                    <Phone size={14} color="#ffffff" />
                    <Text style={localStyles.callButtonText}>{contact.phone}</Text>
                  </Pressable>
                </View>
              </Card>
            ))}

            <Pressable
              style={localStyles.sosBroadcastButton}
              onPress={() => {
                Alert.alert(
                  "CONFIRM EMERGENCY ALERT",
                  "Are you sure you want to broadcast an urgent alert to Security Gate 1 and the Society Manager?",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Trigger SOS Alert",
                      style: "destructive",
                      onPress: () => Alert.alert("SOS Broadcast Sent", "Gate 1 Guard and Society Manager notified.")
                    }
                  ]
                );
              }}
            >
              <Siren size={18} color="#ffffff" />
              <Text style={localStyles.sosBroadcastText}>Broadcast Emergency Siren to Gate 1</Text>
            </Pressable>
          </View>
        )}

        {/* ─── SECTION 8: SETTINGS & PRIVACY (Section 25) ─── */}
        {activeSection === "settings" && (
          <View style={{ gap: 12 }}>
            <Card style={{ padding: 14 }}>
              <Text style={{ fontSize: 15, fontWeight: "900", color: colors.text, marginBottom: 8 }}>
                Directory Privacy Controls
              </Text>

              <View style={localStyles.switchRow}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={localStyles.switchTitle}>Show Phone in Society Directory</Text>
                  <Text style={localStyles.switchSub}>When enabled, verified neighbors in your society can view your phone.</Text>
                </View>
                <Switch
                  value={showPhoneInDir}
                  onValueChange={setShowPhoneInDir}
                  trackColor={{ false: colors.border, true: colors.primary }}
                />
              </View>

              <View style={[localStyles.switchRow, { borderTopWidth: 1, borderColor: colors.border, paddingTop: 10 }]}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={localStyles.switchTitle}>Show Email in Society Directory</Text>
                  <Text style={localStyles.switchSub}>Allow committee members to send direct announcements.</Text>
                </View>
                <Switch
                  value={showEmailInDir}
                  onValueChange={setShowEmailInDir}
                  trackColor={{ false: colors.border, true: colors.primary }}
                />
              </View>
            </Card>

            <Card style={{ padding: 14 }}>
              <Text style={{ fontSize: 15, fontWeight: "900", color: colors.text, marginBottom: 8 }}>
                Notification Preferences
              </Text>

              <View style={localStyles.switchRow}>
                <Text style={localStyles.switchTitle}>Complaint status updates</Text>
                <Switch
                  value={notifComplaints}
                  onValueChange={setNotifComplaints}
                  trackColor={{ false: colors.border, true: colors.primary }}
                />
              </View>

              <View style={localStyles.switchRow}>
                <Text style={localStyles.switchTitle}>Visitor arrival alerts at gate</Text>
                <Switch
                  value={notifVisitors}
                  onValueChange={setNotifVisitors}
                  trackColor={{ false: colors.border, true: colors.primary }}
                />
              </View>

              <View style={localStyles.switchRow}>
                <Text style={localStyles.switchTitle}>Maintenance bill due reminders</Text>
                <Switch
                  value={notifBills}
                  onValueChange={setNotifBills}
                  trackColor={{ false: colors.border, true: colors.primary }}
                />
              </View>
            </Card>
          </View>
        )}

        {/* ─── Bottom Account Session / Logout Action (Available for all roles) ─── */}
        <View style={{ marginTop: 28, marginBottom: 24 }}>
          <LogoutButton />
        </View>
      </ScrollView>

      {/* ── Notice Detail Modal ── */}
      {selectedNotice && (
        <Modal visible={!!selectedNotice} animationType="fade" transparent>
          <View style={localStyles.modalOverlay}>
            <View style={localStyles.modalContent}>
              <View style={localStyles.modalHeader}>
                <Pill tone="primary">{selectedNotice.type.toUpperCase()}</Pill>
                <Pressable onPress={() => setSelectedNotice(null)}>
                  <X size={20} color={colors.text} />
                </Pressable>
              </View>

              <Text style={{ fontSize: 17, fontWeight: "900", color: colors.text, marginTop: 4 }}>
                {selectedNotice.title}
              </Text>
              <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>
                Published on {new Date(selectedNotice.publishedAt).toLocaleDateString()}
              </Text>

              <View style={{ backgroundColor: "#f8fafc", padding: 12, borderRadius: 8, marginVertical: 12 }}>
                <Text style={{ fontSize: 13, color: colors.text, lineHeight: 20 }}>
                  {selectedNotice.description}
                </Text>
              </View>

              <View style={localStyles.modalActions}>
                <Pressable
                  style={[localStyles.modalButton, { backgroundColor: colors.primary }]}
                  onPress={() => {
                    setSelectedNotice(null);
                    Alert.alert("Notice Acknowledged", "Thank you for confirming receipt of this society circular.");
                  }}
                >
                  <Text style={[localStyles.modalButtonText, { color: "#ffffff" }]}>
                    Acknowledge Circular
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* ── Create Visitor Pass Modal ── */}
      <Modal visible={newPassModalOpen} animationType="slide" transparent>
        <View style={localStyles.modalOverlay}>
          <View style={localStyles.modalContent}>
            <View style={localStyles.modalHeader}>
              <Text style={localStyles.modalTitle}>Generate Visitor Gate Pass</Text>
              <Pressable onPress={() => setNewPassModalOpen(false)}>
                <X size={20} color={colors.text} />
              </Pressable>
            </View>

            <Text style={localStyles.inputLabel}>Visitor Full Name *</Text>
            <TextInput
              value={newPassName}
              onChangeText={setNewPassName}
              placeholder="e.g. Swiggy Delivery / Guest Name"
              placeholderTextColor="#94a3b8"
              style={localStyles.textInput}
            />

            <Text style={localStyles.inputLabel}>Phone Number (Optional)</Text>
            <TextInput
              value={newPassPhone}
              onChangeText={setNewPassPhone}
              placeholder="+91 98000 00000"
              keyboardType="phone-pad"
              placeholderTextColor="#94a3b8"
              style={localStyles.textInput}
            />

            <Text style={localStyles.inputLabel}>Vehicle Number (Optional)</Text>
            <TextInput
              value={newPassVehicle}
              onChangeText={setNewPassVehicle}
              placeholder="e.g. DL 01 AB 1234"
              placeholderTextColor="#94a3b8"
              style={localStyles.textInput}
            />

            <View style={localStyles.modalActions}>
              <Pressable
                style={[localStyles.modalButton, { backgroundColor: colors.surface }]}
                onPress={() => setNewPassModalOpen(false)}
              >
                <Text style={[localStyles.modalButtonText, { color: colors.text }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[localStyles.modalButton, { backgroundColor: colors.primary }]}
                onPress={handleCreatePass}
              >
                <Text style={[localStyles.modalButtonText, { color: "#ffffff" }]}>Create Pass</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const localStyles = StyleSheet.create({
  profileCard: {
    padding: 16
  },
  profileAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  profileAvatarText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900"
  },
  authRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: colors.border
  },
  authButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  authButtonText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "800"
  },
  navPill: {
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center"
  },
  navPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  navPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.muted
  },
  navPillTextActive: {
    color: "#ffffff"
  },
  tileIconBox: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center"
  },
  subheading: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text
  },
  smallActionButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: colors.primary
  },
  smallActionText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800"
  },
  primarySmallButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.primary,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6
  },
  primarySmallButtonText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800"
  },
  callButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: colors.danger
  },
  callButtonText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800"
  },
  sosBroadcastButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.danger,
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 8
  },
  sosBroadcastText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800"
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8
  },
  switchTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text
  },
  switchSub: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2
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
    maxHeight: "85%"
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
    color: colors.text,
    marginBottom: 8
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
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 6
  },
  submitButtonText: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 14
  }
});
