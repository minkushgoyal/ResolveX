import { useEffect, useState } from "react";
import {
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
import {
  AlertCircle,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Compass,
  Crosshair,
  Filter,
  MapPin,
  Plus,
  QrCode,
  RefreshCw,
  ShieldCheck,
  User,
  Wrench,
  X
} from "lucide-react-native";
import {
  getTechnicianAssignmentRecommendation,
  normalizeComplaintStatus
} from "@resolvex/utils";
import type {
  Complaint,
  ComplaintCategory,
  ComplaintPriority,
  ComplaintStatus,
  ComplaintUpdate,
  StaffDepartment,
  StaffProfile,
  UserProfile
} from "@resolvex/types";
import {
  ActionButton,
  Card,
  colors,
  EmptyState,
  getCanonicalStatusInfo,
  Muted,
  Pill,
  Screen,
  StatusBadge,
  TimelineStep,
  Title
} from "../../components/mobile-ui";
import { auth, db, isFirebaseConfigured } from "../../lib/firebase";
import { collection, doc, getDoc, getDocs, onSnapshot, query, setDoc, updateDoc, where } from "firebase/firestore";
import { subscribeMobileAuth } from "../../lib/auth-service";
import { cleanFirestorePayload } from "../../lib/firestore-clean";

const CATEGORIES: Array<{ id: ComplaintCategory; label: string; icon: any }> = [
  { id: "plumbing", label: "Plumbing", icon: Wrench },
  { id: "electrical", label: "Electrical", icon: Wrench },
  { id: "lift", label: "Elevator / Lift", icon: Compass },
  { id: "security", label: "Security", icon: ShieldCheck },
  { id: "cleanliness", label: "Cleanliness", icon: RefreshCw },
  { id: "water_supply", label: "Water Supply", icon: Wrench },
  { id: "parking", label: "Parking", icon: MapPin },
  { id: "noise", label: "Noise", icon: AlertCircle },
  { id: "other", label: "General / Other", icon: Wrench }
];

import { useMobileSessionStore } from "../../lib/session-store";
import { StaffWorkQueueView } from "../../components/staff-views";
import { SecurityVisitorsView } from "../../components/security-views";
import {
  capturePhotoFromCamera,
  getCurrentDeviceLocation,
  pickImageFromGallery
} from "../../lib/device-capabilities";
import { uploadComplaintMedia } from "../../lib/storage-service";

export default function ComplaintsScreen() {
  const { userProfile, societyId } = useMobileSessionStore();
  const activeRole = userProfile?.role;

  if (activeRole === "maintenance_staff") {
    return <StaffWorkQueueView />;
  }

  if (activeRole === "security_guard") {
    return (
      <Screen>
        <SecurityVisitorsView />
      </Screen>
    );
  }

  const [complaintList, setComplaintList] = useState<Complaint[]>([]);
  const [filter, setFilter] = useState<"all" | "active" | "awaiting" | "closed">("all");
  const profile = useMobileSessionStore((s) => s.userProfile);

  // Selected Ticket for Full Detail Modal
  const [selectedTicket, setSelectedTicket] = useState<Complaint | null>(null);

  // 4-Step Raise Issue Modal State
  const [showRaiseModal, setShowRaiseModal] = useState(false);
  const [createStep, setCreateStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: Problem
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ComplaintCategory>("plumbing");
  const [priority, setPriority] = useState<ComplaintPriority>("medium");

  // Step 2: Location & GPS
  const [locationType, setLocationType] = useState<"flat" | "common_area">("flat");
  const [flatRoom, setFlatRoom] = useState("Bathroom");
  const [commonAreaZone, setCommonAreaZone] = useState("Elevator Bay");
  const [commonAreaLocation, setCommonAreaLocation] = useState("");
  const [gpsStatus, setGpsStatus] = useState<"not_requested" | "captured" | "unavailable">("not_requested");
  const [capturedCoordinates, setCapturedCoordinates] = useState<{ lat: number; lng: number; accuracy?: number | null } | null>(null);

  // Step 3: Photo Evidence
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  // Resolution Proof Modal State
  const [selectedProofTicket, setSelectedProofTicket] = useState<Complaint | null>(null);

  // Reopen Modal State
  const [reopeningTicket, setReopeningTicket] = useState<Complaint | null>(null);
  const [reopenReason, setReopenReason] = useState("");

  useEffect(() => {
    if (!isFirebaseConfigured || !profile?.householdId || !auth.currentUser || auth.currentUser.uid !== profile.uid) return;
    const q = query(
      collection(db, "complaints"),
      where("householdId", "==", profile.householdId)
    );
    const unsubSnapshot = onSnapshot(
      q,
      (snapshot) => {
        const list: Complaint[] = [];
        snapshot.forEach((snap) => {
          list.push({ id: snap.id, ...snap.data() } as Complaint);
        });
        list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        setComplaintList(list);
      },
      (err) => {
        console.warn("Mobile complaints snapshot error:", err);
      }
    );
    return () => unsubSnapshot();
  }, [profile?.householdId]);

  const userFlat = profile?.flatId ? `Flat ${profile.flatId.replace("flat-", "").toUpperCase()}` : "My Flat";
  const userTower = profile?.towerId ? `Tower ${profile.towerId.replace("tower-", "").toUpperCase()}` : "My Tower";

  const filtered = complaintList.filter((c) => {
    const canonical = normalizeComplaintStatus(c.status);
    if (filter === "active") return canonical === "open" || canonical === "assigned" || canonical === "in_progress" || canonical === "reopened";
    if (filter === "awaiting") return canonical === "resident_confirmation";
    if (filter === "closed") return canonical === "closed";
    return true;
  });

  async function handleCaptureGPS() {
    try {
      const loc = await getCurrentDeviceLocation();
      if (!loc.denied && loc.gps) {
        setGpsStatus("captured");
        setCapturedCoordinates({
          lat: loc.gps.latitude,
          lng: loc.gps.longitude,
          accuracy: loc.gps.accuracy
        });
        Alert.alert(
          "Real Device GPS Captured",
          `Coordinates: ${loc.gps.latitude.toFixed(5)}° N, ${loc.gps.longitude.toFixed(5)}° E (Accuracy: ±${Math.round(loc.gps.accuracy || 5)}m)`
        );
      } else {
        setGpsStatus("unavailable");
        setCapturedCoordinates(null);
        Alert.alert(
          "GPS Unavailable",
          loc.error || "Location permission was denied or unavailable. Fallback to manual location description."
        );
      }
    } catch (err: any) {
      setGpsStatus("unavailable");
      setCapturedCoordinates(null);
      Alert.alert(
        "GPS Unavailable",
        err.message || "Location services are unavailable. Continuing with manual location details."
      );
    }
  }

  async function handleCameraCapture() {
    try {
      const photo = await capturePhotoFromCamera();
      if (!photo) return;
      setIsUploadingPhoto(true);
      const tempId = `cmp-${Date.now().toString().slice(-4)}`;
      const res = await uploadComplaintMedia(
        societyId,
        tempId,
        { uri: photo.uri, name: photo.name || `camera_${Date.now()}.jpg`, type: photo.type, size: photo.size },
        "attachment"
      );
      setPhotoUrl(res.url);
      Alert.alert("Photo Attached", "Live camera verification recorded.");
    } catch (e: any) {
      Alert.alert("Upload Failed", e.message || "Could not upload image. Please try again.");
    } finally {
      setIsUploadingPhoto(false);
    }
  }

  async function handleGalleryPick() {
    try {
      const photo = await pickImageFromGallery();
      if (!photo) return;
      setIsUploadingPhoto(true);
      const tempId = `cmp-${Date.now().toString().slice(-4)}`;
      const res = await uploadComplaintMedia(
        societyId,
        tempId,
        { uri: photo.uri, name: photo.name || `gallery_${Date.now()}.jpg`, type: photo.type, size: photo.size },
        "attachment"
      );
      setPhotoUrl(res.url);
      Alert.alert("Photo Attached", "Gallery image recorded.");
    } catch (e: any) {
      Alert.alert("Upload Failed", e.message || "Could not upload image. Please try again.");
    } finally {
      setIsUploadingPhoto(false);
    }
  }

  async function handleCreateComplaint() {
    if (!profile?.householdId || !profile?.societyId) {
      Alert.alert("Account Incomplete", "Your profile is missing household or society assignment. Please wait or contact management.");
      return;
    }

    const id = `cmp-${Date.now().toString().slice(-4)}`;
    const now = new Date().toISOString();

    let computedLocation = `${userFlat}, ${userTower} (${flatRoom})`;
    if (locationType === "common_area") {
      computedLocation = `${userTower} · ${commonAreaZone}${commonAreaLocation ? ` (${commonAreaLocation})` : ""}`;
    }

    const userUid = auth.currentUser?.uid || profile.uid;
    const userDocPath = `users/${userUid}`;
    const collectionPath = "complaints";
    const complaintDocPath = `${collectionPath}/${id}`;

    // Dynamic skill-based assignment lookup within the same society
    let autoAssignedStaffId: string | undefined;
    let autoAssignedStaffName: string | undefined;
    let autoAssignedDept: StaffDepartment | undefined;
    let initialStatus: ComplaintStatus = "open";
    let initialNote = "Complaint submitted from mobile application.";

    if (isFirebaseConfigured) {
      try {
        const staffSnap = await getDocs(
          query(
            collection(db, "users"),
            where("societyId", "==", profile.societyId)
          )
        );
        const societyStaffProfiles: StaffProfile[] = [];
        staffSnap.forEach((d: any) => {
          const u = d.data() as any;
          if (["maintenance_staff", "security_guard"].includes(u.role) && u.status === "verified") {
            societyStaffProfiles.push({
              id: d.id,
              societyId: u.societyId || profile.societyId,
              name: u.displayName || u.name || "Staff Member",
              phone: u.phone || "",
              role: u.role,
              department: u.department || (u.role === "security_guard" ? "security" : "general_maintenance"),
              skills: u.skills || [],
              specialization: u.specialization,
              assignedFacilityIds: u.assignedFacilityIds || [],
              currentWorkload: u.currentWorkload || 0,
              availabilityStatus: u.availabilityStatus || "on_duty",
              active: u.active !== false
            } as StaffProfile);
          }
        });

        const rec = getTechnicianAssignmentRecommendation(category as ComplaintCategory, societyStaffProfiles, {
          societyId: profile.societyId,
          priority
        });

        if (rec.recommendedStaff) {
          autoAssignedStaffId = rec.recommendedStaff.id;
          autoAssignedStaffName = rec.recommendedStaff.name;
          autoAssignedDept = rec.recommendedStaff.department;
          initialStatus = "assigned";
          initialNote = `Complaint auto-assigned to ${autoAssignedStaffName} (${autoAssignedDept}). ${rec.reason}`;
          console.log(`[COMPLAINT AUTO-ASSIGN MATCH] id=${id} category=${category} staff=${autoAssignedStaffId} dept=${autoAssignedDept} reason=${rec.reason}`);
        } else {
          console.log(`[COMPLAINT AUTO-ASSIGN NO MATCH] id=${id} category=${category} reason=${rec.reason}`);
          initialNote = `Complaint submitted. Unassigned: ${rec.reason}`;
        }
      } catch (err: any) {
        console.warn("[COMPLAINT AUTO-ASSIGN LOOKUP WARN]", err?.message || err);
      }
    }

    const newComplaint: Complaint = {
      id,
      societyId: profile.societyId,
      householdId: profile.householdId,
      flatId: profile.flatId || "flat-unknown",
      towerId: profile.towerId || "tower-unknown",
      createdByUserId: userUid,
      reportedBy: userUid,
      reportedByName: profile.displayName || "Resident",
      reportedByPhone: profile.phone || "",
      title: title.trim(),
      description: description.trim() || title.trim(),
      category: category,
      priority: priority,
      status: initialStatus,
      locationType: locationType,
      location: computedLocation,
      locationLabel: computedLocation,
      locationSource: gpsStatus === "captured" ? "gps" : "manual",
      latitude: capturedCoordinates?.lat,
      longitude: capturedCoordinates?.lng,
      structuredLocation:
        locationType === "flat"
          ? {
              locationType: "flat",
              societyId: profile.societyId,
              towerId: profile.towerId || "tower-unknown",
              flatId: profile.flatId || "flat-unknown",
              householdId: profile.householdId,
              roomOrArea: flatRoom
            }
          : {
              locationType: "common_area",
              societyId: profile.societyId,
              towerId: profile.towerId || "tower-unknown",
              commonArea: commonAreaZone,
              exactLocation: commonAreaLocation || commonAreaZone
            },
      gpsLocation: capturedCoordinates
        ? {
            latitude: capturedCoordinates.lat,
            longitude: capturedCoordinates.lng,
            accuracy: capturedCoordinates.accuracy ?? 0,
            capturedAt: now,
            captureMethod: "gps"
          }
        : {
            latitude: 0,
            longitude: 0,
            accuracy: 0,
            capturedAt: now,
            captureMethod: "manual"
          },
      attachments: photoUrl
        ? [
            {
              id: `att-${Date.now()}`,
              url: photoUrl,
              type: "image",
              name: "resident_evidence.jpg"
            }
          ]
        : [],
      assignedStaffId: autoAssignedStaffId,
      assignedStaffName: autoAssignedStaffName,
      assignedDepartment: autoAssignedDept,
      createdAt: now,
      updatedAt: now
    };

    console.log("[COMPLAINT DEBUG] Preparing to submit complaint:", {
      authUID: userUid,
      userProfileDocumentPath: userDocPath,
      societyId: profile.societyId,
      householdId: profile.householdId,
      flatId: profile.flatId,
      complaintDocumentId: id,
      collectionPath,
      payload: newComplaint
    });

    if (isFirebaseConfigured) {
      try {
        const cleanPayload = cleanFirestorePayload(newComplaint);
        await setDoc(doc(db, collectionPath, id), cleanPayload);
        console.log("[COMPLAINT DEBUG] FIRESTORE WRITE SUCCESS", {
          complaintId: id,
          path: complaintDocPath
        });

        // Immediately read document back
        const readBackSnap = await getDoc(doc(db, collectionPath, id));
        if (!readBackSnap.exists()) {
          throw new Error(`Read-back verification failed: Document ${complaintDocPath} does not exist.`);
        }
        console.log("[COMPLAINT DEBUG] READ-BACK SUCCESS", {
          complaintId: readBackSnap.id,
          data: readBackSnap.data()
        });

        // Write update record
        await setDoc(doc(db, "complaint_updates", `cu-${Date.now()}`), cleanFirestorePayload({
          id: `cu-${Date.now()}`,
          complaintId: id,
          actorUserId: userUid,
          status: initialStatus,
          note: initialNote,
          attachments: newComplaint.attachments || [],
          createdAt: now
        }));
      } catch (err: any) {
        console.error("[COMPLAINT DEBUG] Write or read-back error:", {
          code: err?.code,
          message: err?.message,
          error: err
        });
        Alert.alert(
          "Complaint Submission Failed",
          `FirebaseError: ${err?.code || "unknown"} — ${err?.message || "Failed to submit complaint to Firestore."}`
        );
        return;
      }
    }

    setComplaintList((prev) => [newComplaint, ...prev.filter((c) => c.id !== newComplaint.id)]);
    setShowRaiseModal(false);
    setCreateStep(1);
    setTitle("");
    setDescription("");
    setPhotoUrl(null);
    setGpsStatus("not_requested");
    setCommonAreaLocation("");

    Alert.alert(
      "Complaint Submitted",
      `Issue #${newComplaint.id} logged.\nAuto-routed to ${newComplaint.assignedDepartment} maintenance lead.`
    );
  }

  function handleConfirmResolution(ticketId: string) {
    const now = new Date().toISOString();
    if (isFirebaseConfigured) {
      updateDoc(doc(db, "complaints", ticketId), {
        status: "closed",
        confirmedByResident: true,
        residentConfirmedAt: now,
        resolvedAt: now,
        closedAt: now,
        updatedAt: now
      }).catch((e) => console.warn("Mobile Firestore confirm error:", e));

      setDoc(doc(db, "complaint_updates", `cu-${Date.now()}`), {
        id: `cu-${Date.now()}`,
        complaintId: ticketId,
        actorUserId: profile?.uid || "usr-resident-1",
        status: "closed",
        note: "Resident confirmed satisfactory resolution. Ticket officially closed.",
        attachments: [],
        createdAt: now
      }).catch((e) => console.warn("Mobile complaint update write error:", e));
    }

    setComplaintList((prev) =>
      prev.map((c) =>
        c.id === ticketId
          ? {
              ...c,
              status: "closed",
              confirmedByResident: true,
              residentConfirmedAt: now,
              resolvedAt: now,
              updatedAt: now
            }
          : c
      )
    );
    setSelectedProofTicket(null);
    if (selectedTicket?.id === ticketId) {
      setSelectedTicket((prev) =>
        prev
          ? {
              ...prev,
              status: "closed",
              confirmedByResident: true,
              residentConfirmedAt: now,
              resolvedAt: now,
              updatedAt: now
            }
          : null
      );
    }
    Alert.alert("Resolution Confirmed", "Thank you! The ticket is marked as successfully resolved & closed.");
  }

  function handleReopenComplaint() {
    if (!reopeningTicket) return;
    if (!reopenReason.trim()) {
      Alert.alert("Reason Required", "A mandatory reason is required to reopen this issue for staff briefing.");
      return;
    }

    const now = new Date().toISOString();
    if (isFirebaseConfigured) {
      updateDoc(doc(db, "complaints", reopeningTicket.id), {
        status: "reopened",
        confirmedByResident: false,
        reopenedAt: now,
        reopenReason: reopenReason.trim(),
        updatedAt: now
      }).catch((e) => console.warn("Mobile Firestore reopen error:", e));

      setDoc(doc(db, "complaint_updates", `cu-${Date.now()}`), {
        id: `cu-${Date.now()}`,
        complaintId: reopeningTicket.id,
        actorUserId: profile?.uid || "usr-resident-1",
        status: "reopened",
        note: `Ticket reopened by resident: ${reopenReason.trim()}`,
        attachments: [],
        createdAt: now
      }).catch((e) => console.warn("Mobile complaint update write error:", e));
    }

    setComplaintList((prev) =>
      prev.map((c) =>
        c.id === reopeningTicket.id
          ? {
              ...c,
              status: "reopened",
              confirmedByResident: false,
              reopenedAt: now,
              reopenReason: reopenReason.trim(),
              updatedAt: now
            }
          : c
      )
    );
    if (selectedTicket?.id === reopeningTicket.id) {
      setSelectedTicket((prev) =>
        prev
          ? {
              ...prev,
              status: "reopened",
              confirmedByResident: false,
              reopenedAt: now,
              reopenReason: reopenReason.trim(),
              updatedAt: now
            }
          : null
      );
    }
    setReopeningTicket(null);
    setSelectedProofTicket(null);
    setReopenReason("");
    Alert.alert("Complaint Reopened", "Management has been notified and maintenance staff re-dispatched.");
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
        {/* Header */}
        <View style={localStyles.header}>
          <View>
            <Muted>{userFlat} · {userTower} Service Desk</Muted>
            <Title>My Complaints</Title>
          </View>
          <Pressable
            style={localStyles.raiseButton}
            onPress={() => {
              setCreateStep(1);
              setShowRaiseModal(true);
            }}
            accessibilityLabel="Report New Issue"
          >
            <Plus color="#ffffff" size={18} />
            <Text style={localStyles.raiseButtonText}>Report Issue</Text>
          </Pressable>
        </View>

        {/* Filter Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={localStyles.filterScroll}>
          <View style={localStyles.filterRow}>
            {[
              { id: "all", label: `All (${complaintList.length})` },
              { id: "active", label: "Active" },
              { id: "awaiting", label: "Verification Needed" },
              { id: "closed", label: "Resolved & Closed" }
            ].map((f) => (
              <Pressable
                key={f.id}
                onPress={() => setFilter(f.id as typeof filter)}
                style={[
                  localStyles.filterPill,
                  filter === f.id ? localStyles.filterPillActive : localStyles.filterPillInactive
                ]}
              >
                <Text
                  style={[
                    localStyles.filterPillText,
                    filter === f.id ? localStyles.filterPillTextActive : localStyles.filterPillTextInactive
                  ]}
                >
                  {f.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {/* Tickets List */}
        {filtered.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="You're all clear. No active complaints."
            description="No tickets found for this filter. If you observe any issues in your flat or society, report them immediately."
            actionLabel="Report New Issue"
            onAction={() => setShowRaiseModal(true)}
          />
        ) : (
          <View style={{ marginTop: 14, gap: 12 }}>
            {filtered.map((item) => {
              const canonical = normalizeComplaintStatus(item.status);
              const isAwaitingVerification = canonical === "resident_confirmation";

              return (
                <Pressable
                  key={item.id}
                  onPress={() => setSelectedTicket(item)}
                  style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
                >
                  <Card style={{ padding: 14 }}>
                    <View style={localStyles.cardHeader}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Pill
                          tone={
                            item.priority === "emergency"
                              ? "danger"
                              : item.priority === "high"
                              ? "accent"
                              : "primary"
                          }
                        >
                          {item.priority.toUpperCase()}
                        </Pill>
                        <Text style={localStyles.ticketId}>#{item.id}</Text>
                      </View>
                      <StatusBadge status={item.status} />
                    </View>

                    <Text style={localStyles.ticketTitle}>{item.title}</Text>
                    <Muted>{item.location} · {item.category.toUpperCase()}</Muted>

                    {/* Timeline Preview */}
                    <View style={localStyles.timelineMiniBar}>
                      {["open", "assigned", "in_progress", "resident_confirmation", "closed"].map(
                        (stepKey, idx) => {
                          const stepOrder = ["open", "assigned", "in_progress", "resident_confirmation", "closed"];
                          const currentIdx = stepOrder.indexOf(canonical === "reopened" ? "in_progress" : canonical);
                          const isDone = idx <= currentIdx;
                          return (
                            <View key={stepKey} style={localStyles.miniStepContainer}>
                              <View
                                style={[
                                  localStyles.miniStepDot,
                                  isDone && localStyles.miniStepDotDone
                                ]}
                              />
                              {idx < 4 && (
                                <View
                                  style={[
                                    localStyles.miniStepLine,
                                    isDone && idx < currentIdx && localStyles.miniStepLineDone
                                  ]}
                                />
                              )}
                            </View>
                          );
                        }
                      )}
                    </View>

                    {/* Action Prompt for Resident Verification */}
                    {isAwaitingVerification && (
                      <View style={localStyles.confirmationBanner}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <AlertCircle size={15} color={colors.accent} />
                          <Text style={localStyles.confirmationBannerText}>
                            Staff completed work. Your verification is required.
                          </Text>
                        </View>
                        <View style={localStyles.confirmActionRow}>
                          <Pressable
                            style={localStyles.proofButton}
                            onPress={() => setSelectedProofTicket(item)}
                          >
                            <Text style={localStyles.proofButtonText}>Review Proof & Confirm</Text>
                          </Pressable>
                          <Pressable
                            style={localStyles.reopenButton}
                            onPress={() => setReopeningTicket(item)}
                          >
                            <Text style={localStyles.reopenButtonText}>Reopen</Text>
                          </Pressable>
                        </View>
                      </View>
                    )}

                    {canonical === "closed" && (
                      <View style={localStyles.resolvedBanner}>
                        <CheckCircle2 size={15} color={colors.success} />
                        <Text style={localStyles.resolvedBannerText}>
                          Resolved & verified by resident. Closed.
                        </Text>
                      </View>
                    )}
                  </Card>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* ── 1. Comprehensive Complaint Detail Modal ───────────────────────── */}
      {selectedTicket && (
        <Modal visible={!!selectedTicket} animationType="slide" transparent>
          <View style={localStyles.modalOverlay}>
            <View style={[localStyles.modalContent, { maxHeight: "92%" }]}>
              <View style={localStyles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={localStyles.modalTitle}>Complaint #{selectedTicket.id}</Text>
                  <Text style={{ fontSize: 11, color: colors.muted }}>
                    Created: {new Date(selectedTicket.createdAt).toLocaleDateString()}
                  </Text>
                </View>
                <Pressable onPress={() => setSelectedTicket(null)} style={localStyles.closeButton}>
                  <X size={20} color={colors.text} />
                </Pressable>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {/* Title and Badges */}
                <View style={{ flexDirection: "row", gap: 6, marginBottom: 8, alignItems: "center" }}>
                  <StatusBadge status={selectedTicket.status} />
                  <Pill tone={selectedTicket.priority === "emergency" ? "danger" : "primary"}>
                    {selectedTicket.priority.toUpperCase()}
                  </Pill>
                  <Pill tone="secondary">{selectedTicket.category.toUpperCase()}</Pill>
                </View>

                <Text style={{ fontSize: 18, fontWeight: "900", color: colors.text }}>
                  {selectedTicket.title}
                </Text>
                <Text style={{ fontSize: 13, color: colors.muted, marginTop: 4 }}>
                  Location: <Text style={{ color: colors.text, fontWeight: "700" }}>{selectedTicket.location}</Text>
                </Text>
                {selectedTicket.locationSource && (
                  <Text style={{ fontSize: 11, color: colors.primary, marginTop: 2 }}>
                    Source: {selectedTicket.locationSource.toUpperCase()}
                    {selectedTicket.qrToken ? ` (Tag: ${selectedTicket.qrToken})` : ""}
                  </Text>
                )}

                {/* Description */}
                <View style={{ backgroundColor: "#f8fafc", padding: 12, borderRadius: 10, marginVertical: 12 }}>
                  <Text style={{ fontSize: 11, fontWeight: "800", color: colors.muted, textTransform: "uppercase" }}>
                    Issue Description
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.text, marginTop: 4, lineHeight: 18 }}>
                    {selectedTicket.description}
                  </Text>
                </View>

                {/* Assigned Technician Profile */}
                <View style={{ backgroundColor: "#f1f5f9", padding: 12, borderRadius: 10, marginBottom: 12 }}>
                  <Text style={{ fontSize: 11, fontWeight: "800", color: colors.muted, textTransform: "uppercase" }}>
                    Assigned Technician
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}>
                      <User size={18} color="#ffffff" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: "800", color: colors.text }}>
                        {selectedTicket.assignedStaffName ||
                          (selectedTicket.assignedStaffId === "staff-deepak"
                            ? "Deepak Verma (Lift Machinery Lead)"
                            : selectedTicket.assignedStaffId === "staff-rajesh"
                            ? "Rajesh Sharma (Electrical Lead)"
                            : selectedTicket.assignedStaffId === "staff-vikas"
                            ? "Vikas Kumar (Plumbing Lead)"
                            : selectedTicket.assignedStaffId
                            ? "Assigned Staff Member"
                            : "Unassigned (Awaiting Management Dispatch)")}
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.muted }}>
                        Department: {selectedTicket.assignedDepartment || "Pending Trade Assignment"} · SLA Target: Within 24h
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Step-by-Step Visual Timeline */}
                <Text style={localStyles.inputLabel}>Lifecycle Milestone Timeline</Text>
                <View style={{ paddingLeft: 4, marginVertical: 6 }}>
                  {(() => {
                    const canonical = normalizeComplaintStatus(selectedTicket.status);
                    const steps = [
                      {
                        key: "open",
                        title: "Submitted",
                        sub: `Reported on ${new Date(selectedTicket.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                      },
                      {
                        key: "assigned",
                        title: "Assigned",
                        sub: `Assigned to ${selectedTicket.assignedDepartment || "Maintenance"} Staff`
                      },
                      {
                        key: "in_progress",
                        title: "In Progress",
                        sub: "Technician dispatched to inspect & repair"
                      },
                      {
                        key: "resident_confirmation",
                        title: "Resolution Verification",
                        sub: "Work completed & awaiting resident confirmation"
                      },
                      {
                        key: "closed",
                        title: "Resolved & Closed",
                        sub: selectedTicket.confirmedByResident ? "Verified and signed off by resident" : "Pending sign-off"
                      }
                    ];

                    const stepOrder = ["open", "assigned", "in_progress", "resident_confirmation", "closed"];
                    const activeIdx = stepOrder.indexOf(canonical === "reopened" ? "in_progress" : canonical);

                    return steps.map((st, i) => (
                      <TimelineStep
                        key={st.key}
                        number={i + 1}
                        title={st.title}
                        subtitle={st.sub}
                        completed={i < activeIdx || (i === 4 && canonical === "closed")}
                        active={i === activeIdx}
                        isLast={i === steps.length - 1}
                      />
                    ));
                  })()}
                </View>

                {/* Resolution Proof & Notes if available */}
                {(selectedTicket.resolutionProofUrl || selectedTicket.resolutionNote) && (
                  <View style={{ marginTop: 10, padding: 12, backgroundColor: "#f0fdf4", borderRadius: 10, borderWidth: 1, borderColor: "#bbf7d0" }}>
                    <Text style={{ fontSize: 12, fontWeight: "800", color: colors.success }}>
                      Resolution Proof & Completion Log
                    </Text>
                    {selectedTicket.resolutionProofUrl && (
                      <Image
                        source={{ uri: selectedTicket.resolutionProofUrl }}
                        style={{ width: "100%", height: 160, borderRadius: 8, marginVertical: 8 }}
                        resizeMode="cover"
                      />
                    )}
                    <Text style={{ fontSize: 12, color: colors.text, marginTop: 4 }}>
                      Technician Note: {selectedTicket.resolutionNote}
                    </Text>
                  </View>
                )}

                {/* Reopen Reason if reopened */}
                {selectedTicket.reopenReason && (
                  <View style={{ marginTop: 10, padding: 12, backgroundColor: "#fff1f2", borderRadius: 10, borderWidth: 1, borderColor: "#fecdd3" }}>
                    <Text style={{ fontSize: 12, fontWeight: "800", color: colors.danger }}>
                      Reopen Log:
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.text, marginTop: 2 }}>
                      {selectedTicket.reopenReason}
                    </Text>
                  </View>
                )}
              </ScrollView>

              {/* Modal Footer Actions */}
              <View style={localStyles.modalActions}>
                {normalizeComplaintStatus(selectedTicket.status) === "resident_confirmation" ? (
                  <>
                    <Pressable
                      style={[localStyles.modalButton, { backgroundColor: "#fee2e2" }]}
                      onPress={() => setReopeningTicket(selectedTicket)}
                    >
                      <Text style={[localStyles.modalButtonText, { color: colors.danger }]}>
                        Reopen (Need More Work)
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[localStyles.modalButton, { backgroundColor: colors.success }]}
                      onPress={() => handleConfirmResolution(selectedTicket.id)}
                    >
                      <Text style={[localStyles.modalButtonText, { color: "#ffffff" }]}>
                        Confirm Resolution
                      </Text>
                    </Pressable>
                  </>
                ) : normalizeComplaintStatus(selectedTicket.status) === "closed" ? (
                  <Pressable
                    style={[localStyles.modalButton, { backgroundColor: "#fee2e2" }]}
                    onPress={() => setReopeningTicket(selectedTicket)}
                  >
                    <Text style={[localStyles.modalButtonText, { color: colors.danger }]}>
                      Reopen Complaint
                    </Text>
                  </Pressable>
                ) : (
                  <Pressable
                    style={[localStyles.modalButton, { backgroundColor: colors.surface }]}
                    onPress={() => setSelectedTicket(null)}
                  >
                    <Text style={[localStyles.modalButtonText, { color: colors.text }]}>Close View</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* ── 2. Structured 4-Step Issue Creation Modal ────────────────────── */}
      <Modal visible={showRaiseModal} animationType="slide" transparent>
        <View style={localStyles.modalOverlay}>
          <View style={[localStyles.modalContent, { maxHeight: "92%" }]}>
            <View style={localStyles.modalHeader}>
              <View>
                <Text style={localStyles.modalTitle}>Report Maintenance Issue</Text>
                <Text style={{ fontSize: 11, color: colors.muted }}>
                  Step {createStep} of 4: {createStep === 1 ? "Problem" : createStep === 2 ? "Location" : createStep === 3 ? "Photo Evidence" : "Review & Submit"}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  setShowRaiseModal(false);
                  setCreateStep(1);
                }}
                style={localStyles.closeButton}
                accessibilityLabel="Close"
              >
                <X size={20} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              {/* STEP 1: Problem */}
              {createStep === 1 && (
                <View>
                  <Text style={localStyles.inputLabel}>Issue Title *</Text>
                  <TextInput
                    value={title}
                    onChangeText={setTitle}
                    placeholder="e.g. Master bathroom tap dripping constantly"
                    placeholderTextColor="#94a3b8"
                    style={localStyles.textInput}
                  />

                  <Text style={localStyles.inputLabel}>Category</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                    <View style={{ flexDirection: "row", gap: 6 }}>
                      {CATEGORIES.map((cat) => (
                        <Pressable
                          key={cat.id}
                          onPress={() => setCategory(cat.id)}
                          style={[
                            localStyles.categoryChip,
                            category === cat.id && localStyles.categoryChipActive
                          ]}
                        >
                          <Text
                            style={[
                              localStyles.categoryChipText,
                              category === cat.id && localStyles.categoryChipTextActive
                            ]}
                          >
                            {cat.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </ScrollView>

                  <Text style={localStyles.inputLabel}>Priority Level</Text>
                  <View style={localStyles.priorityRow}>
                    {(["low", "medium", "high", "emergency"] as ComplaintPriority[]).map((p) => (
                      <Pressable
                        key={p}
                        onPress={() => setPriority(p)}
                        style={[
                          localStyles.priorityButton,
                          priority === p && localStyles.priorityButtonActive
                        ]}
                      >
                        <Text
                          style={[
                            localStyles.priorityText,
                            priority === p && localStyles.priorityTextActive
                          ]}
                        >
                          {p.toUpperCase()}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={localStyles.inputLabel}>Detailed Description</Text>
                  <TextInput
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Provide details to assist the technician with spare parts and timing..."
                    placeholderTextColor="#94a3b8"
                    multiline
                    numberOfLines={3}
                    style={[localStyles.textInput, { height: 74, textAlignVertical: "top" }]}
                  />
                </View>
              )}

              {/* STEP 2: Location */}
              {createStep === 2 && (
                <View>
                  <Text style={localStyles.inputLabel}>Location Type</Text>
                  <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
                    <Pressable
                      style={[
                        localStyles.typeOptionButton,
                        locationType === "flat" && localStyles.typeOptionButtonActive
                      ]}
                      onPress={() => setLocationType("flat")}
                    >
                      <Text
                        style={[
                          localStyles.typeOptionText,
                          locationType === "flat" && localStyles.typeOptionTextActive
                        ]}
                      >
                        My Flat ({userFlat})
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[
                        localStyles.typeOptionButton,
                        locationType === "common_area" && localStyles.typeOptionButtonActive
                      ]}
                      onPress={() => setLocationType("common_area")}
                    >
                      <Text
                        style={[
                          localStyles.typeOptionText,
                          locationType === "common_area" && localStyles.typeOptionTextActive
                        ]}
                      >
                        Society Common Area
                      </Text>
                    </Pressable>
                  </View>

                  {locationType === "flat" ? (
                    <View>
                      <Text style={localStyles.inputLabel}>Room / Section</Text>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                        {["Living Room", "Master Bedroom", "Kitchen", "Bathroom", "Balcony", "Utility Area"].map((rm) => (
                          <Pressable
                            key={rm}
                            onPress={() => setFlatRoom(rm)}
                            style={[
                              localStyles.categoryChip,
                              flatRoom === rm && localStyles.categoryChipActive
                            ]}
                          >
                            <Text
                              style={[
                                localStyles.categoryChipText,
                                flatRoom === rm && localStyles.categoryChipTextActive
                              ]}
                            >
                              {rm}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  ) : (
                    <View>
                      <Text style={localStyles.inputLabel}>Common Area Zone</Text>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                        {[
                          "Elevator Bay",
                          "Entrance Lobby",
                          "Staircase",
                          "Clubhouse & Gym",
                          "Swimming Pool",
                          "Basement Parking",
                          "Garden / Walkway",
                          "Pump House & Tanks"
                        ].map((zone) => (
                          <Pressable
                            key={zone}
                            onPress={() => setCommonAreaZone(zone)}
                            style={[
                              localStyles.categoryChip,
                              commonAreaZone === zone && localStyles.categoryChipActive
                            ]}
                          >
                            <Text
                              style={[
                                localStyles.categoryChipText,
                                commonAreaZone === zone && localStyles.categoryChipTextActive
                              ]}
                            >
                              {zone}
                            </Text>
                          </Pressable>
                        ))}
                      </View>

                      <Text style={localStyles.inputLabel}>Specific Location Details</Text>
                      <TextInput
                        value={commonAreaLocation}
                        onChangeText={setCommonAreaLocation}
                        placeholder="e.g. 4th Floor corridor, near Lift 2"
                        placeholderTextColor="#94a3b8"
                        style={localStyles.textInput}
                      />
                    </View>
                  )}

                  {/* Section 8: GPS Geo-Verification */}
                  <Text style={localStyles.inputLabel}>GPS Geo-Verification</Text>
                  <View style={{ backgroundColor: "#f8fafc", padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={{ fontSize: 13, fontWeight: "800", color: colors.text }}>
                          {gpsStatus === "captured"
                            ? "Real Hardware GPS Captured"
                            : gpsStatus === "unavailable"
                            ? "Location unavailable — manual location details recorded."
                            : "No GPS captured yet"}
                        </Text>
                        {gpsStatus === "captured" && capturedCoordinates && (
                          <Text style={{ fontSize: 11, color: colors.success, marginTop: 2 }}>
                            Verified at {capturedCoordinates.lat.toFixed(5)}° N, {capturedCoordinates.lng.toFixed(5)}° E
                            {capturedCoordinates.accuracy ? ` (±${Math.round(capturedCoordinates.accuracy)}m)` : ""}
                          </Text>
                        )}
                      </View>
                      <Pressable
                        style={[
                          localStyles.gpsActionButton,
                          { backgroundColor: gpsStatus === "captured" ? colors.successLight : colors.primary }
                        ]}
                        onPress={handleCaptureGPS}
                      >
                        <Crosshair size={14} color={gpsStatus === "captured" ? colors.success : "#ffffff"} />
                        <Text
                          style={[
                            localStyles.gpsActionText,
                            { color: gpsStatus === "captured" ? colors.success : "#ffffff" }
                          ]}
                        >
                          {gpsStatus === "captured" ? "Recapture" : "Capture GPS"}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              )}

              {/* STEP 3: Add Real Photo Evidence */}
              {createStep === 3 && (
                <View>
                  <Text style={localStyles.inputLabel}>Attach Evidence Photo</Text>
                  <Text style={{ fontSize: 11, color: colors.muted, marginBottom: 10 }}>
                    Upload genuine photos to help maintenance technicians inspect the issue and bring the right replacement components.
                  </Text>

                  <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
                    <Pressable
                      style={[localStyles.modalButton, { flex: 1, backgroundColor: colors.primary }]}
                      onPress={handleCameraCapture}
                      disabled={isUploadingPhoto}
                    >
                      <Camera size={16} color="#ffffff" style={{ marginRight: 6 }} />
                      <Text style={[localStyles.modalButtonText, { color: "#ffffff" }]}>
                        {isUploadingPhoto ? "Uploading..." : "Camera Photo"}
                      </Text>
                    </Pressable>

                    <Pressable
                      style={[localStyles.modalButton, { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}
                      onPress={handleGalleryPick}
                      disabled={isUploadingPhoto}
                    >
                      <Text style={[localStyles.modalButtonText, { color: colors.primary }]}>
                        Choose Gallery
                      </Text>
                    </Pressable>
                  </View>

                  {photoUrl && (
                    <View style={{ marginTop: 6 }}>
                      <Image
                        source={{ uri: photoUrl }}
                        style={{ width: "100%", height: 180, borderRadius: 8 }}
                        resizeMode="cover"
                      />
                      <Pressable
                        onPress={() => setPhotoUrl(null)}
                        style={{ alignSelf: "flex-end", marginTop: 6 }}
                      >
                        <Text style={{ fontSize: 11, color: colors.danger, fontWeight: "700" }}>
                          Remove Photo
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              )}

              {/* STEP 4: Review & Submit */}
              {createStep === 4 && (
                <View>
                  <Text style={{ fontSize: 14, fontWeight: "800", color: colors.text, marginBottom: 8 }}>
                    Review Complaint Summary
                  </Text>
                  <Card style={{ padding: 12, backgroundColor: "#f8fafc" }}>
                    <Text style={{ fontSize: 15, fontWeight: "900", color: colors.text }}>{title}</Text>
                    <Muted style={{ marginTop: 2 }}>
                      Category: {category.toUpperCase()} · Priority: {priority.toUpperCase()}
                    </Muted>
                    <Text style={{ fontSize: 12, color: colors.text, marginTop: 6 }}>
                      Location: <Text style={{ fontWeight: "700" }}>{locationType === "flat" ? `${userFlat} (${flatRoom})` : `${userTower} Common Area`}</Text>
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>
                      GPS: {gpsStatus === "captured" ? "Verified" : "Unavailable"} · Photo: {photoUrl ? "Attached (1)" : "None"}
                    </Text>
                  </Card>
                  <View style={{ marginTop: 12, padding: 10, backgroundColor: "#eff6ff", borderRadius: 8 }}>
                    <Text style={{ fontSize: 11, color: colors.primary, fontWeight: "700" }}>
                      Auto-routing SLA: This issue will be immediately notified to the on-duty lead technician.
                    </Text>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Stepper Navigation Buttons */}
            <View style={localStyles.modalActions}>
              {createStep > 1 ? (
                <Pressable
                  style={[localStyles.modalButton, { backgroundColor: colors.surface }]}
                  onPress={() => setCreateStep((prev) => (prev - 1) as any)}
                >
                  <Text style={[localStyles.modalButtonText, { color: colors.text }]}>Back</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={[localStyles.modalButton, { backgroundColor: colors.surface }]}
                  onPress={() => setShowRaiseModal(false)}
                >
                  <Text style={[localStyles.modalButtonText, { color: colors.text }]}>Cancel</Text>
                </Pressable>
              )}

              {createStep < 4 ? (
                <Pressable
                  style={[localStyles.modalButton, { backgroundColor: colors.primary }]}
                  onPress={() => {
                    if (createStep === 1 && !title.trim()) {
                      Alert.alert("Required", "Please provide an issue summary title.");
                      return;
                    }
                    setCreateStep((prev) => (prev + 1) as any);
                  }}
                >
                  <Text style={[localStyles.modalButtonText, { color: "#ffffff" }]}>Next Step →</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={[localStyles.modalButton, { backgroundColor: colors.primary }]}
                  onPress={handleCreateComplaint}
                >
                  <Text style={[localStyles.modalButtonText, { color: "#ffffff" }]}>Submit Issue</Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* ── 3. Review Resolution Proof Modal ─────────────────────────────── */}
      {selectedProofTicket && (
        <Modal visible={!!selectedProofTicket} animationType="fade" transparent>
          <View style={localStyles.modalOverlay}>
            <View style={localStyles.modalContent}>
              <View style={localStyles.modalHeader}>
                <Text style={localStyles.modalTitle}>Technician Resolution Proof</Text>
                <Pressable
                  onPress={() => setSelectedProofTicket(null)}
                  style={localStyles.closeButton}
                >
                  <X size={20} color={colors.text} />
                </Pressable>
              </View>

              <View style={{ gap: 10, marginVertical: 10 }}>
                <Text style={{ fontSize: 15, fontWeight: "800", color: colors.text }}>
                  {selectedProofTicket.title}
                </Text>

                {selectedProofTicket.resolutionProofUrl ? (
                  <Image
                    source={{ uri: selectedProofTicket.resolutionProofUrl }}
                    style={{ width: "100%", height: 160, borderRadius: 8 }}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={{ height: 100, backgroundColor: "#f1f5f9", borderRadius: 8, alignItems: "center", justifyContent: "center" }}>
                    <Wrench size={24} color={colors.muted} />
                    <Text style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>Work Completed On-Site</Text>
                  </View>
                )}

                <View style={{ backgroundColor: "#f8fafc", padding: 10, borderRadius: 8 }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: colors.muted }}>Technician Note:</Text>
                  <Text style={{ fontSize: 13, color: colors.text, marginTop: 2 }}>
                    {selectedProofTicket.resolutionNote || "Issue repaired and verified. Left workspace clean."}
                  </Text>
                </View>
              </View>

              <View style={localStyles.modalActions}>
                <Pressable
                  style={[localStyles.modalButton, { backgroundColor: "#fee2e2" }]}
                  onPress={() => setReopeningTicket(selectedProofTicket)}
                >
                  <Text style={[localStyles.modalButtonText, { color: colors.danger }]}>Not Fixed (Reopen)</Text>
                </Pressable>
                <Pressable
                  style={[localStyles.modalButton, { backgroundColor: colors.success }]}
                  onPress={() => handleConfirmResolution(selectedProofTicket.id)}
                >
                  <Text style={[localStyles.modalButtonText, { color: "#ffffff" }]}>Confirm & Close</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* ── 4. Reopen Reason Modal (Mandatory Reason) ────────────────────── */}
      {reopeningTicket && (
        <Modal visible={!!reopeningTicket} animationType="slide" transparent>
          <View style={localStyles.modalOverlay}>
            <View style={localStyles.modalContent}>
              <View style={localStyles.modalHeader}>
                <Text style={localStyles.modalTitle}>Reopen Issue #{reopeningTicket.id}</Text>
                <Pressable
                  onPress={() => setReopeningTicket(null)}
                  style={localStyles.closeButton}
                >
                  <X size={20} color={colors.text} />
                </Pressable>
              </View>

              <Text style={{ fontSize: 13, color: colors.muted, marginTop: 4 }}>
                Please specify why the repair was incomplete so the technician can be re-briefed:
              </Text>

              <TextInput
                value={reopenReason}
                onChangeText={setReopenReason}
                placeholder="e.g. Faucet continues to drip slowly under high water pressure."
                placeholderTextColor="#94a3b8"
                multiline
                numberOfLines={3}
                style={[localStyles.textInput, { height: 80, marginVertical: 12, textAlignVertical: "top" }]}
              />

              <View style={localStyles.modalActions}>
                <Pressable
                  style={[localStyles.modalButton, { backgroundColor: colors.surface }]}
                  onPress={() => setReopeningTicket(null)}
                >
                  <Text style={[localStyles.modalButtonText, { color: colors.text }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[localStyles.modalButton, { backgroundColor: colors.danger }]}
                  onPress={handleReopenComplaint}
                >
                  <Text style={[localStyles.modalButtonText, { color: "#ffffff" }]}>Submit Reopen</Text>
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
  raiseButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 10
  },
  raiseButtonText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 13
  },
  filterScroll: {
    marginTop: 14
  },
  filterRow: {
    flexDirection: "row",
    gap: 8
  },
  filterPill: {
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center"
  },
  filterPillActive: {
    backgroundColor: colors.primary
  },
  filterPillInactive: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: colors.border
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: "700"
  },
  filterPillTextActive: {
    color: "#ffffff"
  },
  filterPillTextInactive: {
    color: colors.muted
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  ticketId: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.muted
  },
  ticketTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
    marginTop: 8,
    marginBottom: 2
  },
  timelineMiniBar: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: "#f1f5f9"
  },
  miniStepContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1
  },
  miniStepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border
  },
  miniStepDotDone: {
    backgroundColor: colors.success
  },
  miniStepLine: {
    flex: 1,
    height: 2,
    backgroundColor: colors.border,
    marginHorizontal: 4
  },
  miniStepLineDone: {
    backgroundColor: colors.success
  },
  confirmationBanner: {
    marginTop: 12,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#fed7aa"
  },
  confirmationBannerText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#c2410c",
    flex: 1
  },
  confirmActionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8
  },
  proofButton: {
    flex: 1,
    height: 42,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  proofButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800"
  },
  reopenButton: {
    width: 84,
    height: 42,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center"
  },
  reopenButtonText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "800"
  },
  resolvedBanner: {
    marginTop: 10,
    padding: 8,
    borderRadius: 6,
    backgroundColor: "#f0fdf4",
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  resolvedBannerText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.success
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
  closeButton: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: colors.surface
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
    paddingVertical: 9,
    fontSize: 13,
    color: colors.text
  },
  categoryChip: {
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff"
  },
  categoryChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  categoryChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.text
  },
  categoryChipTextActive: {
    color: "#ffffff"
  },
  priorityRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 10
  },
  priorityButton: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff"
  },
  priorityButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  priorityText: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.muted
  },
  priorityTextActive: {
    color: "#ffffff"
  },
  photoSimulator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
    borderRadius: 10,
    padding: 14,
    backgroundColor: "#f8fafc"
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
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  modalButtonText: {
    fontSize: 13,
    fontWeight: "800"
  },
  typeOptionButton: {
    flex: 1,
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff"
  },
  typeOptionButtonActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary
  },
  typeOptionText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.muted
  },
  typeOptionTextActive: {
    color: colors.primary,
    fontWeight: "800"
  },
  assetSelectButton: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#ffffff"
  },
  assetSelectButtonActive: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}0e`
  },
  assetSelectText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.text
  },
  assetSelectTextActive: {
    color: colors.primary,
    fontWeight: "800"
  },
  gpsActionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6
  },
  gpsActionText: {
    fontSize: 11,
    fontWeight: "800"
  }
});
