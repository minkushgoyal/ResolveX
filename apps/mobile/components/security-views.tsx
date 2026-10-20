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
  AlertCircle,
  Bell,
  Box,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileCheck,
  LogIn,
  LogOut,
  MapPin,
  Package,
  Phone,
  Plus,
  QrCode,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Truck,
  User,
  UserCheck,
  UserPlus,
  Users,
  X
} from "lucide-react-native";
import type { Delivery, VisitorPass } from "@resolvex/types";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Card, colors, EmptyState, LogoutButton, Muted, Pill, Title } from "./mobile-ui";
import { useMobileSessionStore } from "../lib/session-store";
import {
  broadcastSecurityEmergency,
  checkInVisitor,
  checkOutVisitor,
  createDirectVisitorEntry,
  logDeliveryReceipt,
  markDeliveryCollected,
  subscribeDeliveries,
  subscribeVisitorPasses,
  validateVisitorPass
} from "../lib/security-service";

// ─── 1. GATE DESK (HOME) VIEW ──────────────────────────────────────────────
export function SecurityGateDeskView() {
  const { societyId, userProfile } = useMobileSessionStore();
  const guardId = userProfile?.uid || "usr-guard";
  const guardName = userProfile?.displayName || userProfile?.name || "Security Officer";

  const [passes, setPasses] = useState<VisitorPass[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [walkinModalOpen, setWalkinModalOpen] = useState(false);
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);

  useEffect(() => {
    const unsubPasses = subscribeVisitorPasses(societyId, (data) => setPasses(data));
    const unsubDeliv = subscribeDeliveries(societyId, (data) => setDeliveries(data));
    return () => {
      unsubPasses();
      unsubDeliv();
    };
  }, [societyId]);

  const activeVisitors = passes.filter((p) => p.status === "entered");
  const expectedVisitors = passes.filter((p) => p.status === "expected" || p.status === "pending" || p.status === "approved");
  const pendingDeliveries = deliveries.filter((d) => d.status === "received_at_gate" || d.status === "expected");

  async function handleQuickCheckIn(pass: VisitorPass) {
    const res = await checkInVisitor(pass.id, guardId, pass);
    if (res.success) {
      Alert.alert("Gate Cleared", `Barrier opened for ${pass.visitorName} to ${pass.flatId}. Resident alerted.`);
    } else {
      Alert.alert("Error", res.error || "Could not check in visitor.");
    }
  }

  async function handleQuickCheckOut(pass: VisitorPass) {
    const res = await checkOutVisitor(pass.id);
    if (res.success) {
      Alert.alert("Exit Logged", `${pass.visitorName} recorded as exited from the premises.`);
    } else {
      Alert.alert("Error", res.error || "Could not check out visitor.");
    }
  }

  function handleTriggerEmergency() {
    Alert.alert(
      "SECURITY EMERGENCY ALERT",
      "Broadcast society-wide emergency siren and alert Command Center?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Trigger Alert",
          style: "destructive",
          onPress: async () => {
            const res = await broadcastSecurityEmergency(
              societyId,
              guardId,
              "EMERGENCY PERIMETER ALERT",
              `Gate Officer ${guardName} reported perimeter security alert. Emergency protocol activated.`
            );
            if (res.success) {
              Alert.alert("Emergency Broadcast", "Perimeter alarm triggered. All residents & control room alerted.");
            }
          }
        }
      ]
    );
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
      {/* Top Bar */}
      <View style={secStyles.topBar}>
        <View>
          <Text style={secStyles.societyHeader}>Gate Operations · Control Desk</Text>
          <Title>{guardName}</Title>
        </View>
        <Pressable
          style={[secStyles.iconButton, { backgroundColor: "#fee2e2", borderColor: "#fecaca" }]}
          onPress={handleTriggerEmergency}
        >
          <Siren color={colors.danger} size={20} />
        </Pressable>
      </View>

      {/* Armed Post Banner */}
      <View style={[secStyles.postBanner, { borderColor: "#bfdbfe", backgroundColor: "#f0f9ff" }]}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View>
            <Text style={secStyles.identityFlat}>North Gate 1 · Main Barrier</Text>
            <Text style={secStyles.identityHousehold}>RFID Tagging Active · ANPR Online</Text>
          </View>
          <Pill tone="primary">GATE ARMED</Pill>
        </View>

        <View style={secStyles.telemetryRow}>
          <View style={secStyles.telemetryItem}>
            <Text style={secStyles.telemetryLabel}>Inside Now</Text>
            <Text style={secStyles.telemetryValue}>{activeVisitors.length}</Text>
          </View>
          <View style={secStyles.telemetryDivider} />
          <View style={secStyles.telemetryItem}>
            <Text style={secStyles.telemetryLabel}>Expected</Text>
            <Text style={secStyles.telemetryValue}>{expectedVisitors.length}</Text>
          </View>
          <View style={secStyles.telemetryDivider} />
          <View style={secStyles.telemetryItem}>
            <Text style={secStyles.telemetryLabel}>Gate Parcels</Text>
            <Text style={secStyles.telemetryValue}>{pendingDeliveries.length}</Text>
          </View>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={{ marginTop: 16 }}>
        <Text style={secStyles.sectionHeading}>Gate Actions</Text>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
          <Pressable
            style={[secStyles.actionCard, { flex: 1 }]}
            onPress={() => setScanModalOpen(true)}
          >
            <View style={secStyles.actionIconBox}>
              <QrCode color={colors.primary} size={20} />
            </View>
            <Text style={secStyles.actionCardTitle}>Verify Pass QR</Text>
            <Text style={secStyles.actionCardSub}>Instant scan</Text>
          </Pressable>

          <Pressable
            style={[secStyles.actionCard, { flex: 1 }]}
            onPress={() => setWalkinModalOpen(true)}
          >
            <View style={[secStyles.actionIconBox, { backgroundColor: "#f0fdf4" }]}>
              <UserPlus color={colors.success} size={20} />
            </View>
            <Text style={secStyles.actionCardTitle}>Admit Walk-in</Text>
            <Text style={secStyles.actionCardSub}>Direct entry</Text>
          </Pressable>

          <Pressable
            style={[secStyles.actionCard, { flex: 1 }]}
            onPress={() => setDeliveryModalOpen(true)}
          >
            <View style={[secStyles.actionIconBox, { backgroundColor: "#fef3c7" }]}>
              <Package color="#d97706" size={20} />
            </View>
            <Text style={secStyles.actionCardTitle}>Log Parcel</Text>
            <Text style={secStyles.actionCardSub}>At guardhouse</Text>
          </Pressable>
        </View>
      </View>

      {/* Currently Inside Premises */}
      <View style={{ marginTop: 20 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={secStyles.sectionHeading}>Currently on Premises ({activeVisitors.length})</Text>
          <Text style={{ fontSize: 11, color: colors.muted }}>Tap Check-Out on exit</Text>
        </View>

        {activeVisitors.length === 0 ? (
          <View style={{ marginTop: 8 }}>
            <Card style={{ padding: 16, alignItems: "center" }}>
              <ShieldCheck size={28} color={colors.muted} />
              <Text style={{ fontSize: 12, color: colors.muted, marginTop: 6, fontWeight: "600" }}>
                No external visitors currently inside premises.
              </Text>
            </Card>
          </View>
        ) : (
          <View style={{ gap: 8, marginTop: 8 }}>
            {activeVisitors.map((pass) => (
              <Card key={pass.id} style={{ padding: 14 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={{ fontSize: 14, fontWeight: "800", color: colors.text }}>
                        {pass.visitorName}
                      </Text>
                      <Pill tone="success">INSIDE</Pill>
                    </View>
                    <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
                      Destination: <Text style={{ fontWeight: "700", color: colors.text }}>{pass.flatId}</Text>
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.muted }}>
                      Vehicle: {pass.vehicleNumber || "Pedestrian"} · In: {pass.gateEntryAt ? pass.gateEntryAt.split("T")[1]?.slice(0, 5) : "Active"}
                    </Text>
                  </View>

                  <Pressable
                    style={[secStyles.actionBtn, { backgroundColor: "#fee2e2" }]}
                    onPress={() => handleQuickCheckOut(pass)}
                  >
                    <LogOut size={14} color={colors.danger} />
                    <Text style={[secStyles.actionBtnText, { color: colors.danger }]}>Check Out</Text>
                  </Pressable>
                </View>
              </Card>
            ))}
          </View>
        )}
      </View>

      {/* Expected Visitors Queue */}
      <View style={{ marginTop: 20 }}>
        <Text style={secStyles.sectionHeading}>Expected Visitors Today ({expectedVisitors.length})</Text>
        {expectedVisitors.length === 0 ? (
          <View style={{ marginTop: 8 }}>
            <Card style={{ padding: 16, alignItems: "center" }}>
              <Clock size={28} color={colors.muted} />
              <Text style={{ fontSize: 12, color: colors.muted, marginTop: 6, fontWeight: "600" }}>
                No pending expected visitor passes for today.
              </Text>
            </Card>
          </View>
        ) : (
          <View style={{ gap: 8, marginTop: 8 }}>
            {expectedVisitors.map((pass) => (
              <Card key={pass.id} style={{ padding: 14 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: "800", color: colors.text }}>
                      {pass.visitorName}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
                      Visiting: <Text style={{ fontWeight: "700", color: colors.text }}>{pass.flatId}</Text>
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.muted }}>
                      Code: <Text style={{ fontWeight: "700", color: colors.primary }}>{pass.qrToken || pass.id}</Text> · {pass.purpose || "Visitor"}
                    </Text>
                  </View>

                  <Pressable
                    style={[secStyles.actionBtn, { backgroundColor: colors.primary }]}
                    onPress={() => handleQuickCheckIn(pass)}
                  >
                    <LogIn size={14} color="#ffffff" />
                    <Text style={[secStyles.actionBtnText, { color: "#ffffff" }]}>Admit</Text>
                  </Pressable>
                </View>
              </Card>
            ))}
          </View>
        )}
      </View>

      {/* Pass Scan Modal */}
      <PassScanModal
        visible={scanModalOpen}
        societyId={societyId}
        onClose={() => setScanModalOpen(false)}
        onCheckedIn={() => setScanModalOpen(false)}
      />

      {/* Walk-in Modal */}
      <WalkinGuestModal
        visible={walkinModalOpen}
        societyId={societyId}
        onClose={() => setWalkinModalOpen(false)}
      />

      {/* Parcel Modal */}
      <DeliveryEntryModal
        visible={deliveryModalOpen}
        societyId={societyId}
        onClose={() => setDeliveryModalOpen(false)}
      />
    </ScrollView>
  );
}

// ─── 2. VISITORS FULL VIEW ───────────────────────────────────────────────────
export function SecurityVisitorsView() {
  const { societyId, userProfile } = useMobileSessionStore();
  const [passes, setPasses] = useState<VisitorPass[]>([]);
  const [filter, setFilter] = useState<"all" | "expected" | "entered" | "exited">("all");
  const [search, setSearch] = useState("");
  const [walkinModalOpen, setWalkinModalOpen] = useState(false);

  useEffect(() => {
    return subscribeVisitorPasses(societyId, (data) => setPasses(data));
  }, [societyId]);

  const filtered = passes.filter((p) => {
    if (filter === "expected" && p.status !== "expected" && p.status !== "pending" && p.status !== "approved") return false;
    if (filter === "entered" && p.status !== "entered") return false;
    if (filter === "exited" && p.status !== "exited") return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = p.visitorName.toLowerCase().includes(q);
      const matchFlat = p.flatId.toLowerCase().includes(q);
      const matchVehicle = (p.vehicleNumber || "").toLowerCase().includes(q);
      const matchToken = (p.qrToken || "").toLowerCase().includes(q);
      if (!matchName && !matchFlat && !matchVehicle && !matchToken) return false;
    }
    return true;
  });

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
      <View style={secStyles.topBar}>
        <View>
          <Text style={secStyles.societyHeader}>Visitor Log & Passes</Text>
          <Title>Perimeter Registry</Title>
        </View>
        <Pressable
          style={[secStyles.iconButton, { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" }]}
          onPress={() => setWalkinModalOpen(true)}
        >
          <UserPlus color={colors.success} size={20} />
        </Pressable>
      </View>

      {/* Search Input */}
      <View style={secStyles.searchContainer}>
        <Search size={18} color={colors.muted} />
        <TextInput
          style={secStyles.searchInput}
          placeholder="Search by visitor, flat, vehicle, code..."
          placeholderTextColor={colors.muted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch("")}>
            <X size={16} color={colors.muted} />
          </Pressable>
        )}
      </View>

      {/* Segmented Filter Pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={secStyles.filterRow}>
        {(["all", "expected", "entered", "exited"] as const).map((key) => {
          const labels = { all: "All Passes", expected: "Expected", entered: "Inside Now", exited: "Departed" };
          const active = filter === key;
          return (
            <Pressable
              key={key}
              style={[secStyles.filterPill, active && secStyles.filterPillActive]}
              onPress={() => setFilter(key)}
            >
              <Text style={[secStyles.filterPillText, active && secStyles.filterPillTextActive]}>
                {labels[key]}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Visitor List */}
      <View style={{ gap: 10, marginTop: 12 }}>
        {filtered.length === 0 ? (
          <EmptyState
            title="No Visitor Passes Found"
            description="No visitor passes match the current filter or search criteria."
          />
        ) : (
          filtered.map((pass) => (
            <Card key={pass.id} style={{ padding: 14 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={{ fontSize: 14, fontWeight: "800", color: colors.text }}>
                      {pass.visitorName}
                    </Text>
                    <Pill tone={pass.status === "entered" ? "success" : pass.status === "exited" ? "secondary" : "primary"}>
                      {pass.status.toUpperCase()}
                    </Pill>
                  </View>
                  <Text style={{ fontSize: 12, color: colors.muted, marginTop: 3 }}>
                    Destination: <Text style={{ fontWeight: "700", color: colors.text }}>{pass.flatId}</Text> · {pass.purpose || "Guest"}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>
                    Phone: {pass.visitorPhone || "Not provided"} · Vehicle: {pass.vehicleNumber || "Pedestrian"}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.primary, fontWeight: "700", marginTop: 2 }}>
                    Code: {pass.qrToken || pass.id}
                  </Text>
                </View>

                {pass.status === "expected" || pass.status === "pending" || pass.status === "approved" ? (
                  <Pressable
                    style={[secStyles.actionBtn, { backgroundColor: colors.primary }]}
                    onPress={async () => {
                      const guardUid = userProfile?.uid || "usr-guard";
                      await checkInVisitor(pass.id, guardUid, pass);
                      Alert.alert("Admitted", `${pass.visitorName} cleared for entry.`);
                    }}
                  >
                    <LogIn size={13} color="#ffffff" />
                    <Text style={[secStyles.actionBtnText, { color: "#ffffff" }]}>Check In</Text>
                  </Pressable>
                ) : pass.status === "entered" ? (
                  <Pressable
                    style={[secStyles.actionBtn, { backgroundColor: "#fee2e2" }]}
                    onPress={async () => {
                      await checkOutVisitor(pass.id);
                      Alert.alert("Exited", `${pass.visitorName} cleared for exit.`);
                    }}
                  >
                    <LogOut size={13} color={colors.danger} />
                    <Text style={[secStyles.actionBtnText, { color: colors.danger }]}>Check Out</Text>
                  </Pressable>
                ) : (
                  <Text style={{ fontSize: 11, color: colors.muted, fontWeight: "600" }}>Departed</Text>
                )}
              </View>
            </Card>
          ))
        )}
      </View>

      <WalkinGuestModal
        visible={walkinModalOpen}
        societyId={societyId}
        onClose={() => setWalkinModalOpen(false)}
      />
    </ScrollView>
  );
}

// ─── 3. DELIVERIES VIEW ──────────────────────────────────────────────────────
export function SecurityDeliveriesView() {
  const { societyId } = useMobileSessionStore();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [filter, setFilter] = useState<"pending" | "collected" | "all">("pending");
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);

  useEffect(() => {
    return subscribeDeliveries(societyId, (data) => setDeliveries(data));
  }, [societyId]);

  const filtered = deliveries.filter((d) => {
    if (filter === "pending" && d.status === "collected") return false;
    if (filter === "collected" && d.status !== "collected") return false;
    return true;
  });

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
      <View style={secStyles.topBar}>
        <View>
          <Text style={secStyles.societyHeader}>Guardhouse Deliveries</Text>
          <Title>Parcel Management</Title>
        </View>
        <Pressable
          style={[secStyles.iconButton, { backgroundColor: "#fef3c7", borderColor: "#fde68a" }]}
          onPress={() => setDeliveryModalOpen(true)}
        >
          <Plus color="#d97706" size={20} />
        </Pressable>
      </View>

      {/* Status Segment */}
      <View style={secStyles.rolePillsRow}>
        <Pressable
          style={[secStyles.rolePill, filter === "pending" && secStyles.rolePillActive]}
          onPress={() => setFilter("pending")}
        >
          <Text style={[secStyles.rolePillText, filter === "pending" && secStyles.rolePillTextActive]}>
            At Guardhouse ({deliveries.filter((d) => d.status !== "collected").length})
          </Text>
        </Pressable>
        <Pressable
          style={[secStyles.rolePill, filter === "collected" && secStyles.rolePillActive]}
          onPress={() => setFilter("collected")}
        >
          <Text style={[secStyles.rolePillText, filter === "collected" && secStyles.rolePillTextActive]}>
            Collected ({deliveries.filter((d) => d.status === "collected").length})
          </Text>
        </Pressable>
        <Pressable
          style={[secStyles.rolePill, filter === "all" && secStyles.rolePillActive]}
          onPress={() => setFilter("all")}
        >
          <Text style={[secStyles.rolePillText, filter === "all" && secStyles.rolePillTextActive]}>
            All
          </Text>
        </Pressable>
      </View>

      {/* Delivery Items */}
      <View style={{ gap: 10, marginTop: 14 }}>
        {filtered.length === 0 ? (
          <EmptyState
            title="No Parcels in Queue"
            description="There are currently no deliveries logged under this filter."
          />
        ) : (
          filtered.map((item) => (
            <Card key={item.id} style={{ padding: 14 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={{ fontSize: 14, fontWeight: "800", color: colors.text }}>
                      {item.courierName}
                    </Text>
                    <Pill tone={item.status === "collected" ? "secondary" : "primary"}>
                      {item.status === "collected" ? "COLLECTED" : "AT GUARD POST"}
                    </Pill>
                  </View>
                  <Text style={{ fontSize: 12, color: colors.muted, marginTop: 3 }}>
                    Flat: <Text style={{ fontWeight: "700", color: colors.text }}>{item.flatNumber || item.flatId}</Text> · {item.recipientName || "Resident"}
                  </Text>
                  {item.trackingNumber && (
                    <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>
                      Tracking: {item.trackingNumber}
                    </Text>
                  )}
                  <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>
                    Received: {item.receivedAt ? item.receivedAt.split("T")[1]?.slice(0, 5) : "Today"}
                  </Text>
                </View>

                {item.status !== "collected" ? (
                  <Pressable
                    style={[secStyles.actionBtn, { backgroundColor: "#f0fdf4" }]}
                    onPress={async () => {
                      await markDeliveryCollected(item.id);
                      Alert.alert("Handed Over", `Parcel handed over to resident of ${item.flatNumber || item.flatId}.`);
                    }}
                  >
                    <CheckCircle2 size={14} color={colors.success} />
                    <Text style={[secStyles.actionBtnText, { color: colors.success }]}>Hand Over</Text>
                  </Pressable>
                ) : (
                  <Text style={{ fontSize: 11, color: colors.muted, fontWeight: "600" }}>Handed Over</Text>
                )}
              </View>
            </Card>
          ))
        )}
      </View>

      <DeliveryEntryModal
        visible={deliveryModalOpen}
        societyId={societyId}
        onClose={() => setDeliveryModalOpen(false)}
      />
    </ScrollView>
  );
}

// ─── 4. PASS SCAN / VERIFY VIEW ──────────────────────────────────────────────
export function SecurityPassScanView() {
  const { societyId, userProfile } = useMobileSessionStore();
  const guardId = userProfile?.uid || "usr-guard";
  const [tokenInput, setTokenInput] = useState("");
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    status: "idle" | "valid" | "invalid";
    pass?: VisitorPass;
    reason?: string;
  }>({ status: "idle" });

  async function handleVerify(code: string) {
    const clean = code.trim();
    if (!clean) return;
    setIsVerifying(true);
    try {
      const res = await validateVisitorPass(societyId, clean);
      if (res.valid && res.pass) {
        setVerificationResult({ status: "valid", pass: res.pass });
      } else {
        setVerificationResult({ status: "invalid", reason: res.reason || "Invalid / forged pass token." });
      }
    } finally {
      setIsVerifying(false);
    }
  }

  async function handleAdmit() {
    if (!verificationResult.pass) return;
    const res = await checkInVisitor(verificationResult.pass.id, guardId, verificationResult.pass);
    if (res.success) {
      Alert.alert("Access Granted", `Barrier opened for ${verificationResult.pass.visitorName}. Notification dispatched to ${verificationResult.pass.flatId}.`);
      setVerificationResult({ status: "idle" });
      setTokenInput("");
    }
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
      <View style={secStyles.topBar}>
        <View>
          <Text style={secStyles.societyHeader}>Optical & Token Scanner</Text>
          <Title>Pass Validation</Title>
        </View>
      </View>

      {/* Real Camera Barcode Scanner View */}
      {cameraActive ? (
        <Card style={{ padding: 12, marginTop: 12, overflow: "hidden" }}>
          <View style={{ height: 260, borderRadius: 10, overflow: "hidden", backgroundColor: "#000000" }}>
            <CameraView
              style={StyleSheet.absoluteFill}
              barcodeScannerSettings={{
                barcodeTypes: ["qr"]
              }}
              onBarcodeScanned={({ data }) => {
                setCameraActive(false);
                setTokenInput(data);
                handleVerify(data);
              }}
            />
          </View>
          <Pressable
            style={[secStyles.submitBtn, { backgroundColor: colors.danger, marginTop: 10 }]}
            onPress={() => setCameraActive(false)}
          >
            <Text style={secStyles.submitBtnText}>Cancel Camera Scan</Text>
          </Pressable>
        </Card>
      ) : (
        <Card style={{ padding: 24, alignItems: "center", marginTop: 12 }}>
          <View style={secStyles.scanCrosshair}>
            <QrCode size={90} color={colors.primary} />
          </View>
          <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text, marginTop: 12 }}>
            Real Hardware Barcode Scanner
          </Text>
          <Text style={{ fontSize: 12, color: colors.muted, textAlign: "center", marginTop: 4 }}>
            Scan resident-issued visitor passes with device camera or enter code manually below.
          </Text>
          <Pressable
            style={[secStyles.submitBtn, { backgroundColor: colors.primary, marginTop: 14, width: "100%" }]}
            onPress={async () => {
              if (!cameraPermission?.granted) {
                const req = await requestCameraPermission();
                if (!req.granted) {
                  Alert.alert("Permission Required", "Camera permission is required to scan visitor passes.");
                  return;
                }
              }
              setCameraActive(true);
            }}
          >
            <Text style={secStyles.submitBtnText}>Launch Camera Scanner</Text>
          </Pressable>
        </Card>
      )}

      {/* Code Input */}
      <View style={{ marginTop: 16 }}>
        <Text style={secStyles.inputLabel}>Pass Code / Token Input</Text>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
          <TextInput
            style={[secStyles.textInput, { flex: 1 }]}
            placeholder="Enter pass code (e.g. PASS-XXXX)"
            placeholderTextColor={colors.muted}
            value={tokenInput}
            onChangeText={setTokenInput}
            autoCapitalize="characters"
          />
          <Pressable
            style={[secStyles.submitBtn, { backgroundColor: colors.primary }]}
            onPress={() => handleVerify(tokenInput)}
            disabled={isVerifying}
          >
            <Text style={secStyles.submitBtnText}>{isVerifying ? "..." : "Verify"}</Text>
          </Pressable>
        </View>
      </View>

      {/* Verification Result Card */}
      {verificationResult.status === "valid" && verificationResult.pass && (
        <View style={{ marginTop: 18 }}>
          <Card style={{ padding: 16, borderColor: colors.success, borderWidth: 1.5, backgroundColor: "#f0fdf4" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <ShieldCheck size={24} color={colors.success} />
              <View>
                <Text style={{ fontSize: 15, fontWeight: "800", color: colors.success }}>
                  AUTHORIZED VISITOR PASS
                </Text>
                <Text style={{ fontSize: 11, color: colors.muted }}>
                  Verified against society database
                </Text>
              </View>
            </View>

            <View style={{ marginTop: 12, gap: 4 }}>
              <Text style={{ fontSize: 13, color: colors.text }}>
                <Text style={{ fontWeight: "700" }}>Visitor:</Text> {verificationResult.pass.visitorName}
              </Text>
              <Text style={{ fontSize: 13, color: colors.text }}>
                <Text style={{ fontWeight: "700" }}>Destination:</Text> {verificationResult.pass.flatId}
              </Text>
              <Text style={{ fontSize: 13, color: colors.text }}>
                <Text style={{ fontWeight: "700" }}>Vehicle:</Text> {verificationResult.pass.vehicleNumber || "Pedestrian"}
              </Text>
              <Text style={{ fontSize: 13, color: colors.text }}>
                <Text style={{ fontWeight: "700" }}>Purpose:</Text> {verificationResult.pass.purpose || "Guest"}
              </Text>
              <Text style={{ fontSize: 13, color: colors.text }}>
                <Text style={{ fontWeight: "700" }}>Current Status:</Text> {verificationResult.pass.status}
              </Text>
            </View>

            <Pressable
              style={[secStyles.submitBtn, { backgroundColor: colors.success, marginTop: 14, width: "100%" }]}
              onPress={handleAdmit}
            >
              <LogIn size={16} color="#ffffff" style={{ marginRight: 6 }} />
              <Text style={secStyles.submitBtnText}>Admit & Open Barrier</Text>
            </Pressable>
          </Card>
        </View>
      )}

      {verificationResult.status === "invalid" && (
        <View style={{ marginTop: 18 }}>
          <Card style={{ padding: 16, borderColor: colors.danger, borderWidth: 1.5, backgroundColor: "#fef2f2" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <ShieldAlert size={24} color={colors.danger} />
              <View>
                <Text style={{ fontSize: 15, fontWeight: "800", color: colors.danger }}>
                  ACCESS DENIED / FORGED TOKEN
                </Text>
                <Text style={{ fontSize: 11, color: colors.danger }}>
                  Security alert flagged
                </Text>
              </View>
            </View>
            <Text style={{ fontSize: 13, color: colors.danger, marginTop: 8, fontWeight: "600" }}>
              {verificationResult.reason}
            </Text>
            <Text style={{ fontSize: 11, color: colors.muted, marginTop: 4 }}>
              Do not open barrier arm. Verify resident authorization via telephone intercom.
            </Text>
          </Card>
        </View>
      )}
    </ScrollView>
  );
}

// ─── 5. SECURITY GUARD PROFILE & POST VIEW ───────────────────────────────────
export function SecurityGuardProfileView() {
  const { userProfile } = useMobileSessionStore();
  const guardName = userProfile?.displayName || userProfile?.name || "Security Officer";

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
      <View style={secStyles.topBar}>
        <View>
          <Text style={secStyles.societyHeader}>Security Post Roster</Text>
          <Title>Gate Desk Duty</Title>
        </View>
      </View>

      {/* Identity Card */}
      <Card style={{ padding: 16, marginTop: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={[secStyles.actionIconBox, { width: 50, height: 50, backgroundColor: "#f1f5f9" }]}>
            <ShieldCheck size={26} color={colors.primary} />
          </View>
          <View>
            <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text }}>{guardName}</Text>
            <Text style={{ fontSize: 12, color: colors.muted }}>Email: {userProfile?.email || "N/A"}</Text>
            <Text style={{ fontSize: 11, color: colors.muted }}>UID: {userProfile?.uid || "N/A"}</Text>
            <View style={{ marginTop: 4 }}>
              <Pill tone="success">ON ACTIVE GATE DUTY</Pill>
            </View>
          </View>
        </View>
      </Card>

      {/* Post Guidelines */}
      <View style={{ marginTop: 20 }}>
        <Text style={secStyles.sectionHeading}>Standard Operating Protocols</Text>
        <View style={{ gap: 8, marginTop: 8 }}>
          <Card style={{ padding: 12 }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text }}>Visitor Clearance</Text>
            <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>
              Every vehicle must have resident pass code verified or phone confirmation before barrier is raised.
            </Text>
          </Card>
          <Card style={{ padding: 12 }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text }}>Parcel Storage</Text>
            <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>
              Deliveries must be entered immediately into system so resident receives arrival ping.
            </Text>
          </Card>
          <Card style={{ padding: 12 }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text }}>Emergency Siren</Text>
            <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>
              Perimeter alarms alert all towers instantly. Use only in verified emergency incidents.
            </Text>
          </Card>
        </View>
      </View>

      {/* Account & Shift Session */}
      <View style={{ marginTop: 24, marginBottom: 12 }}>
        <Text style={secStyles.sectionHeading}>Account & Shift Session</Text>
        <Card style={{ padding: 16, marginTop: 8 }}>
          <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 14 }}>
            End your gate duty shift and securely sign out of this device.
          </Text>
          <LogoutButton label="Log Out of Gate Post" />
        </Card>
      </View>
    </ScrollView>
  );
}

// ─── MODAL COMPONENTS ────────────────────────────────────────────────────────

function PassScanModal({
  visible,
  societyId,
  onClose,
  onCheckedIn
}: {
  visible: boolean;
  societyId: string;
  onClose: () => void;
  onCheckedIn: () => void;
}) {
  const { userProfile } = useMobileSessionStore();
  const guardId = userProfile?.uid || "usr-guard";
  const [code, setCode] = useState("");
  const [result, setResult] = useState<{ valid: boolean; pass?: VisitorPass; reason?: string } | null>(null);

  async function handleScanSim(tok: string) {
    setCode(tok);
    const res = await validateVisitorPass(societyId, tok);
    setResult(res);
  }

  async function handleConfirmAdmit() {
    if (!result?.pass) return;
    const res = await checkInVisitor(result.pass.id, guardId, result.pass);
    if (res.success) {
      Alert.alert("Admitted", `Barrier opened for ${result.pass.visitorName}.`);
      onCheckedIn();
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={secStyles.modalOverlay}>
        <View style={secStyles.modalContent}>
          <View style={secStyles.modalHeader}>
            <Text style={secStyles.modalTitle}>Scan Visitor Pass QR</Text>
            <Pressable onPress={onClose} style={{ padding: 4 }}>
              <X size={20} color={colors.text} />
            </Pressable>
          </View>

          <View style={{ alignItems: "center", paddingVertical: 14 }}>
            <View style={secStyles.scanCrosshair}>
              <QrCode size={100} color={colors.primary} />
            </View>
            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text, marginTop: 8 }}>
              Verify Visitor Pass Token
            </Text>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 12, width: "100%" }}>
              <TextInput
                style={[secStyles.textInput, { flex: 1 }]}
                placeholder="Enter pass code (e.g. PASS-8921)"
                placeholderTextColor={colors.muted}
                value={code}
                onChangeText={setCode}
                autoCapitalize="characters"
              />
              <Pressable
                style={[secStyles.submitBtn, { backgroundColor: colors.primary }]}
                onPress={() => handleScanSim(code)}
              >
                <Text style={secStyles.submitBtnText}>Verify</Text>
              </Pressable>
            </View>

            {result && (
              <View style={{ width: "100%", marginTop: 14 }}>
                {result.valid && result.pass ? (
                  <View style={{ backgroundColor: "#f0fdf4", padding: 12, borderRadius: 8, borderColor: "#bbf7d0", borderWidth: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: "800", color: colors.success }}>
                      VALID PASS: {result.pass.visitorName}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>
                      Flat: {result.pass.flatId} · Vehicle: {result.pass.vehicleNumber || "Pedestrian"}
                    </Text>
                    <Pressable
                      style={[secStyles.submitBtn, { backgroundColor: colors.success, marginTop: 10 }]}
                      onPress={handleConfirmAdmit}
                    >
                      <Text style={secStyles.submitBtnText}>Admit & Open Barrier</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={{ backgroundColor: "#fef2f2", padding: 12, borderRadius: 8, borderColor: "#fecaca", borderWidth: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: "800", color: colors.danger }}>
                      INVALID / FORGED TOKEN
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.danger, marginTop: 2 }}>
                      {result.reason || "Token not recognized in society."}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function WalkinGuestModal({
  visible,
  societyId,
  onClose
}: {
  visible: boolean;
  societyId: string;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [flat, setFlat] = useState("Flat A-1204");
  const [purpose, setPurpose] = useState("Guest");
  const [vehicle, setVehicle] = useState("");

  const { userProfile } = useMobileSessionStore();
  const guardId = userProfile?.uid || "usr-guard";

  async function handleSubmit() {
    if (!name.trim()) {
      Alert.alert("Required", "Please enter the visitor name.");
      return;
    }
    const res = await createDirectVisitorEntry(societyId, guardId, {
      visitorName: name,
      visitorPhone: phone,
      flatId: flat,
      purpose,
      vehicleNumber: vehicle
    });
    if (res.success) {
      Alert.alert("Walk-in Admitted", `${name} checked in to ${flat}. Resident notified.`);
      onClose();
      setName("");
      setPhone("");
      setVehicle("");
    } else {
      Alert.alert("Error", res.error || "Could not register walk-in.");
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={secStyles.modalOverlay}>
        <View style={secStyles.modalContent}>
          <View style={secStyles.modalHeader}>
            <Text style={secStyles.modalTitle}>Admit Walk-in Guest</Text>
            <Pressable onPress={onClose} style={{ padding: 4 }}>
              <X size={20} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
            <Text style={secStyles.inputLabel}>Visitor Full Name *</Text>
            <TextInput
              style={secStyles.textInput}
              placeholder="e.g. Ramesh Kumar"
              placeholderTextColor={colors.muted}
              value={name}
              onChangeText={setName}
            />

            <Text style={[secStyles.inputLabel, { marginTop: 10 }]}>Phone Number</Text>
            <TextInput
              style={secStyles.textInput}
              placeholder="e.g. +91 98765 43210"
              placeholderTextColor={colors.muted}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />

            <Text style={[secStyles.inputLabel, { marginTop: 10 }]}>Destination Flat *</Text>
            <TextInput
              style={secStyles.textInput}
              placeholder="e.g. Flat A-1204"
              placeholderTextColor={colors.muted}
              value={flat}
              onChangeText={setFlat}
            />

            <Text style={[secStyles.inputLabel, { marginTop: 10 }]}>Vehicle Number (Optional)</Text>
            <TextInput
              style={secStyles.textInput}
              placeholder="e.g. DL 01 AB 1234"
              placeholderTextColor={colors.muted}
              value={vehicle}
              onChangeText={setVehicle}
              autoCapitalize="characters"
            />

            <Pressable
              style={[secStyles.submitBtn, { backgroundColor: colors.success, marginTop: 16 }]}
              onPress={handleSubmit}
            >
              <Text style={secStyles.submitBtnText}>Admit & Notify Resident</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function DeliveryEntryModal({
  visible,
  societyId,
  onClose
}: {
  visible: boolean;
  societyId: string;
  onClose: () => void;
}) {
  const [flat, setFlat] = useState("Flat A-1204");
  const [courier, setCourier] = useState("Amazon");
  const [tracking, setTracking] = useState("");

  const couriers = ["Amazon", "Flipkart", "Swiggy", "Zomato", "Blinkit", "BlueDart", "Courier"];

  const { userProfile } = useMobileSessionStore();
  const guardId = userProfile?.uid || "usr-guard";

  async function handleSubmit() {
    const res = await logDeliveryReceipt(societyId, guardId, {
      flatId: flat,
      flatNumber: flat,
      courierName: courier,
      trackingNumber: tracking
    });
    if (res.success) {
      Alert.alert("Parcel Logged", `Parcel from ${courier} logged for ${flat}. Resident received ping.`);
      onClose();
      setTracking("");
    } else {
      Alert.alert("Error", res.error || "Could not log delivery.");
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={secStyles.modalOverlay}>
        <View style={secStyles.modalContent}>
          <View style={secStyles.modalHeader}>
            <Text style={secStyles.modalTitle}>Log Gate Parcel</Text>
            <Pressable onPress={onClose} style={{ padding: 4 }}>
              <X size={20} color={colors.text} />
            </Pressable>
          </View>

          <Text style={secStyles.inputLabel}>Recipient Flat *</Text>
          <TextInput
            style={secStyles.textInput}
            placeholder="e.g. Flat A-1204"
            placeholderTextColor={colors.muted}
            value={flat}
            onChangeText={setFlat}
          />

          <Text style={[secStyles.inputLabel, { marginTop: 10 }]}>Courier Provider *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginVertical: 6 }}>
            {couriers.map((c) => (
              <Pressable
                key={c}
                style={[secStyles.chipBtn, courier === c && secStyles.chipBtnActive]}
                onPress={() => setCourier(c)}
              >
                <Text style={[secStyles.chipBtnText, courier === c && secStyles.chipBtnTextActive]}>{c}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={[secStyles.inputLabel, { marginTop: 10 }]}>Tracking / AWBN (Optional)</Text>
          <TextInput
            style={secStyles.textInput}
            placeholder="e.g. TRK-8829103"
            placeholderTextColor={colors.muted}
            value={tracking}
            onChangeText={setTracking}
          />

          <Pressable
            style={[secStyles.submitBtn, { backgroundColor: colors.primary, marginTop: 16 }]}
            onPress={handleSubmit}
          >
            <Text style={secStyles.submitBtnText}>Save & Send Ping to Resident</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const secStyles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10
  },
  societyHeader: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5
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
  postBanner: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12
  },
  identityFlat: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.text
  },
  identityHousehold: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2
  },
  telemetryRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border
  },
  telemetryItem: {
    flex: 1,
    alignItems: "center"
  },
  telemetryLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.muted,
    textTransform: "uppercase"
  },
  telemetryValue: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.text,
    marginTop: 2
  },
  telemetryDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.border
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text
  },
  actionCard: {
    padding: 12,
    backgroundColor: "#ffffff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center"
  },
  actionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#e0e7ff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6
  },
  actionCardTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center"
  },
  actionCardSub: {
    fontSize: 10,
    color: colors.muted,
    textAlign: "center",
    marginTop: 1
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: "700"
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 10
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    padding: 0
  },
  filterRow: {
    gap: 8,
    marginTop: 10
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#f1f5f9"
  },
  filterPillActive: {
    backgroundColor: colors.primary
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text
  },
  filterPillTextActive: {
    color: "#ffffff"
  },
  scanCrosshair: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: "dashed"
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text
  },
  textInput: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: colors.text
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  submitBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700"
  },
  chipBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: "#f1f5f9"
  },
  chipBtnActive: {
    backgroundColor: colors.primary
  },
  chipBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.text
  },
  chipBtnTextActive: {
    color: "#ffffff"
  },
  rolePillsRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 10
  },
  rolePill: {
    flex: 1,
    height: 34,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end"
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20
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
  }
});
