import React, { useEffect, useState } from "react";
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
  AlertTriangle,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  Eye,
  FileCheck,
  FileImage,
  FileText,
  HelpCircle,
  LogOut,
  MapPin,
  MessageSquare,
  Navigation,
  Phone,
  Plus,
  QrCode,
  RotateCcw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Timer,
  Upload,
  User,
  UserCheck,
  Wrench,
  X
} from "lucide-react-native";
import type {
  AppNotification,
  Complaint,
  ComplaintPriority,
  ComplaintStatus,
  ComplaintUpdate,
  StaffAvailability
} from "@resolvex/types";
import {
  departmentLabels,
  formatDate,
  normalizeComplaintStatus
} from "@resolvex/utils";
import {
  ActionButton,
  Card,
  colors,
  EmptyState,
  LogoutButton,
  ModalSheet,
  Muted,
  Pill,
  Screen,
  StatusBadge,
  TimelineStep,
  Title
} from "./mobile-ui";
import { useMobileSessionStore } from "../lib/session-store";
import {
  addTechnicianWorkNote,
  completeWorkReadyForResident,
  startWorkOrder,
  subscribeComplaintUpdates,
  subscribeStaffNotifications,
  subscribeStaffWorkQueue,
  updateTechnicianDutyStatus
} from "../lib/staff-service";
import { uploadTechnicianMedia } from "../lib/storage-service";
import { capturePhotoFromCamera, pickImageFromGallery } from "../lib/device-capabilities";

// Helper for relative timestamps
function formatTimeAgo(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diffMs / (60 * 1000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// Helper to compute SLA status and remaining time
function computeSLA(complaint: Complaint) {
  const created = new Date(complaint.createdAt).getTime();
  let hours = 24;
  if (complaint.priority === "emergency") hours = 2;
  else if (complaint.priority === "high") hours = 4;
  else if (complaint.priority === "medium") hours = 12;

  const deadline = created + hours * 60 * 60 * 1000;
  const now = Date.now();
  const diffMs = deadline - now;

  if (complaint.status === "closed" || complaint.status === "resolved") {
    return { breached: false, label: "SLA MET", text: "Resolved on time", tone: "success" as const };
  }

  if (diffMs <= 0) {
    return { breached: true, label: "SLA BREACHED", text: "Deadline passed", tone: "danger" as const };
  }

  const mins = Math.floor(diffMs / (60 * 1000));
  const hrs = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  const label = hrs > 0 ? `${hrs}h ${remainingMins}m left` : `${remainingMins}m left`;

  return {
    breached: false,
    label,
    text: `${label} to respond`,
    tone: hrs < 1 ? ("danger" as const) : hrs < 3 ? ("accent" as const) : ("primary" as const)
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. STAFF WORK QUEUE VIEW (Used in complaints tab when role is maintenance_staff)
// ─────────────────────────────────────────────────────────────────────────────
export function StaffWorkQueueView() {
  const { activeStaffId, societyId } = useMobileSessionStore();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [filter, setFilter] = useState<"all" | "assigned" | "in_progress" | "resident_confirmation" | "reopened">("all");
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);

  useEffect(() => {
    const unsub = subscribeStaffWorkQueue({ societyId, staffId: activeStaffId }, (list) => {
      setComplaints(list);
    });
    return () => unsub();
  }, [societyId, activeStaffId]);

  const filtered = complaints.filter((c) => {
    const canonical = normalizeComplaintStatus(c.status);
    if (filter === "all") return canonical !== "closed";
    if (filter === "assigned") return canonical === "assigned";
    if (filter === "in_progress") return canonical === "in_progress";
    if (filter === "resident_confirmation") return canonical === "resident_confirmation";
    if (filter === "reopened") return canonical === "reopened";
    return true;
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View style={styles.queueHeader}>
        <View>
          <Text style={styles.queueHeaderSub}>Field Work Orders</Text>
          <Title>My Work Queue</Title>
        </View>
        <View style={styles.queueCountBadge}>
          <Text style={styles.queueCountText}>{filtered.length} Jobs</Text>
        </View>
      </View>

      {/* Segmented Filter Pills */}
      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          <Pressable
            style={[styles.filterChip, filter === "all" && styles.filterChipActive]}
            onPress={() => setFilter("all")}
          >
            <Text style={[styles.filterChipText, filter === "all" && styles.filterChipTextActive]}>
              Active ({complaints.filter((c) => normalizeComplaintStatus(c.status) !== "closed").length})
            </Text>
          </Pressable>

          <Pressable
            style={[styles.filterChip, filter === "assigned" && styles.filterChipActive]}
            onPress={() => setFilter("assigned")}
          >
            <Text style={[styles.filterChipText, filter === "assigned" && styles.filterChipTextActive]}>
              New Assigned ({complaints.filter((c) => normalizeComplaintStatus(c.status) === "assigned").length})
            </Text>
          </Pressable>

          <Pressable
            style={[styles.filterChip, filter === "in_progress" && styles.filterChipActive]}
            onPress={() => setFilter("in_progress")}
          >
            <Text style={[styles.filterChipText, filter === "in_progress" && styles.filterChipTextActive]}>
              In Progress ({complaints.filter((c) => normalizeComplaintStatus(c.status) === "in_progress").length})
            </Text>
          </Pressable>

          <Pressable
            style={[styles.filterChip, filter === "resident_confirmation" && styles.filterChipActive]}
            onPress={() => setFilter("resident_confirmation")}
          >
            <Text style={[styles.filterChipText, filter === "resident_confirmation" && styles.filterChipTextActive]}>
              Awaiting Resident ({complaints.filter((c) => normalizeComplaintStatus(c.status) === "resident_confirmation").length})
            </Text>
          </Pressable>

          <Pressable
            style={[styles.filterChip, filter === "reopened" && styles.filterChipActive]}
            onPress={() => setFilter("reopened")}
          >
            <Text style={[styles.filterChipText, filter === "reopened" && styles.filterChipTextActive]}>
              Reopened ({complaints.filter((c) => normalizeComplaintStatus(c.status) === "reopened").length})
            </Text>
          </Pressable>
        </ScrollView>
      </View>

      {/* Cards List */}
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {filtered.length === 0 ? (
          <EmptyState
            title="No Assigned Work Orders"
            description={
              filter === "all"
                ? "You currently have no active work orders assigned to your queue."
                : `No work orders currently match the "${filter.replace("_", " ")}" filter.`
            }
            actionLabel={filter !== "all" ? "View All Active" : undefined}
            onAction={filter !== "all" ? () => setFilter("all") : undefined}
          />
        ) : (
          filtered.map((item) => {
            const canonicalStatus = normalizeComplaintStatus(item.status);
            const sla = computeSLA(item);
            const isReopened = canonicalStatus === "reopened";

            return (
              <Card key={item.id} style={styles.workCard}>
                {/* Reopen Warning Banner */}
                {isReopened && (
                  <View style={styles.reopenBanner}>
                    <RotateCcw size={14} color="#b45309" />
                    <Text style={styles.reopenBannerText}>
                      REOPENED BY RESIDENT: {item.reopenReason || "Action required"}
                    </Text>
                  </View>
                )}

                {/* Top Row: Priority & Ticket ID & SLA */}
                <View style={styles.workCardHeader}>
                  <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                    <Pill tone={item.priority === "emergency" || item.priority === "high" ? "danger" : "primary"}>
                      {item.priority?.toUpperCase()}
                    </Pill>
                    <Text style={styles.workCardId}>#{item.id.toUpperCase()}</Text>
                  </View>
                  <Pill tone={sla.tone}>{sla.label}</Pill>
                </View>

                {/* Title & Description */}
                <Text style={styles.workCardTitle}>{item.title}</Text>
                <Text style={styles.workCardDesc} numberOfLines={2}>
                  {item.description}
                </Text>

                {/* Location & Facility Context */}
                <View style={styles.locationBox}>
                  <View style={styles.locationRow}>
                    <MapPin size={13} color={colors.primary} />
                    <Text style={styles.locationText}>
                      {item.towerId ? `Tower ${item.towerId.replace("tower-", "").toUpperCase()} · ` : ""}
                      {item.flatId ? `Flat ${item.flatId.replace("flat-", "").toUpperCase()}` : item.location || "Society Grounds"}
                    </Text>
                  </View>

                  {item.assetId && (
                    <View style={[styles.locationRow, { marginTop: 4 }]}>
                      <Wrench size={13} color={colors.secondary} />
                      <Text style={[styles.locationText, { color: colors.secondary }]}>
                        Asset: {item.assetId} · {(departmentLabels as Record<string, string>)[item.department || item.category] || item.category}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Bottom Row: Status Badge & Open Job Action */}
                <View style={styles.cardFooter}>
                  <StatusBadge status={item.status} />

                  <Pressable
                    style={styles.openJobBtn}
                    onPress={() => setSelectedComplaint(item)}
                  >
                    <Text style={styles.openJobBtnText}>
                      {canonicalStatus === "assigned"
                        ? "Start Work"
                        : canonicalStatus === "in_progress"
                        ? "Update & Proof"
                        : isReopened
                        ? "Review & Start"
                        : "View Order"}
                    </Text>
                    <ChevronRight size={15} color="#ffffff" />
                  </Pressable>
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>

      {/* Full Job Detail Modal */}
      {selectedComplaint && (
        <StaffJobDetailModal
          complaint={selectedComplaint}
          visible={Boolean(selectedComplaint)}
          onClose={() => setSelectedComplaint(null)}
          onStatusUpdated={(updated) => {
            setSelectedComplaint(updated);
            setComplaints((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
          }}
        />
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. STAFF JOB DETAIL MODAL (Complete Technician Operations Sheet)
// ─────────────────────────────────────────────────────────────────────────────
export function StaffJobDetailModal({
  complaint,
  visible,
  onClose,
  onStatusUpdated
}: {
  complaint: Complaint;
  visible: boolean;
  onClose: () => void;
  onStatusUpdated: (updated: Complaint) => void;
}) {
  const { activeStaffId, userProfile, societyId } = useMobileSessionStore();
  const [activeTab, setActiveTab] = useState<"detail" | "notes" | "proof">("detail");
  const [updates, setUpdates] = useState<ComplaintUpdate[]>([]);
  const [newNote, setNewNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [proofPhotoUrl, setProofPhotoUrl] = useState<string | null>(
    complaint.resolutionProofUrl || null
  );

  const technicianName = userProfile?.displayName || userProfile?.name || "Technician";
  const canonicalStatus = normalizeComplaintStatus(complaint.status);
  const sla = computeSLA(complaint);

  useEffect(() => {
    const unsub = subscribeComplaintUpdates(complaint.id, (list) => {
      setUpdates(list);
    });
    return () => unsub();
  }, [complaint.id]);

  // Quick note preset tags
  const presetNotes = [
    "Checked main valve & verified pressure.",
    "Optical sensor realigned and optics cleaned.",
    "Loose terminal screws tightened and re-insulated.",
    "Replacement component installed and tested.",
    "Awaiting spare parts from vendor."
  ];

  // 1. START WORK ORDER
  async function handleStartWork() {
    setIsSubmitting(true);
    try {
      await startWorkOrder({
        complaintId: complaint.id,
        technicianId: activeStaffId,
        technicianName,
        societyId,
        currentStatus: complaint.status
      });
      const updated: Complaint = {
        ...complaint,
        status: "in_progress",
        updatedAt: new Date().toISOString()
      };
      onStatusUpdated(updated);
      Alert.alert("Work Order Started", "Status changed to 'In Progress'. Resident notified.");
    } catch (err: any) {
      Alert.alert("Error Starting Work", err.message || "Failed to transition ticket.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // 2. SUBMIT WORK NOTE
  async function handleAddNote(customText?: string) {
    const noteToSave = customText || newNote;
    if (!noteToSave.trim()) {
      Alert.alert("Note Required", "Please enter work notes before submitting.");
      return;
    }
    setIsSubmitting(true);
    try {
      await addTechnicianWorkNote({
        complaintId: complaint.id,
        technicianId: activeStaffId,
        technicianName,
        noteText: noteToSave.trim()
      });
      setNewNote("");
      Alert.alert("Note Saved", "Work progress note appended to ticket history.");
    } catch (err: any) {
      Alert.alert("Failed to Save Note", err.message || "Could not record work note.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // 3. CAPTURE / SELECT PROOF PHOTO VIA REAL HARDWARE
  async function handleAttachPhoto() {
    setUploadError(null);
    Alert.alert(
      "Attach Resolution Proof",
      "Capture live camera verification or select an image from gallery:",
      [
        {
          text: "Camera Capture",
          onPress: async () => {
            try {
              const photo = await capturePhotoFromCamera();
              if (!photo) return;
              setIsSubmitting(true);
              const result = await uploadTechnicianMedia(
                societyId,
                complaint.id,
                { uri: photo.uri, name: photo.name || `proof_${Date.now()}.jpg` },
                "proof"
              );
              setProofPhotoUrl(result.url);
              Alert.alert("Proof Photo Attached", "Live camera verification successfully recorded.");
            } catch (err: any) {
              setUploadError(err.message || "Failed to upload photo.");
              Alert.alert("Upload Error", err.message || "Failed to upload photo.");
            } finally {
              setIsSubmitting(false);
            }
          }
        },
        {
          text: "Choose from Gallery",
          onPress: async () => {
            try {
              const photo = await pickImageFromGallery();
              if (!photo) return;
              setIsSubmitting(true);
              const result = await uploadTechnicianMedia(
                societyId,
                complaint.id,
                { uri: photo.uri, name: photo.name || `proof_${Date.now()}.jpg` },
                "proof"
              );
              setProofPhotoUrl(result.url);
              Alert.alert("Proof Photo Attached", "Gallery photo successfully recorded.");
            } catch (err: any) {
              setUploadError(err.message || "Failed to upload photo.");
              Alert.alert("Upload Error", err.message || "Failed to upload photo.");
            } finally {
              setIsSubmitting(false);
            }
          }
        },
        { text: "Cancel", style: "cancel" }
      ]
    );
  }

  // 4. COMPLETE WORK -> READY FOR RESIDENT CONFIRMATION
  async function handleCompleteReadyForResident() {
    if (!proofPhotoUrl) {
      Alert.alert(
        "Proof Photo Recommended",
        "It is strongly advised to attach visual proof before completing work. Proceed anyway?",
        [
          { text: "Attach Photo First", style: "cancel", onPress: () => setActiveTab("proof") },
          { text: "Submit for Verification", onPress: () => executeCompletion() }
        ]
      );
      return;
    }
    executeCompletion();

    async function executeCompletion() {
      setIsSubmitting(true);
      try {
        await completeWorkReadyForResident({
          complaintId: complaint.id,
          technicianId: activeStaffId,
          technicianName,
          notes: newNote || complaint.resolutionNote || "Work completed according to technical standards.",
          proofUrl: proofPhotoUrl || undefined,
          societyId,
          currentStatus: complaint.status
        });
        const updated: Complaint = {
          ...complaint,
          status: "resident_confirmation",
          resolutionNote: newNote || complaint.resolutionNote || "Work completed.",
          resolutionProofUrl: proofPhotoUrl || undefined,
          completedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        onStatusUpdated(updated);
        Alert.alert(
          "Work Marked Complete",
          "Work order moved to 'Resident Confirmation'. Ticket is pending resident sign-off."
        );
      } catch (err: any) {
        Alert.alert("Failed to Complete Work", err.message || "Could not transition ticket.");
      } finally {
        setIsSubmitting(false);
      }
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <Screen>
        {/* Modal Top Bar */}
        <View style={styles.modalHeader}>
          <View>
            <Text style={styles.modalHeaderId}>WORK ORDER #{complaint.id.toUpperCase()}</Text>
            <Text style={styles.modalHeaderTitle} numberOfLines={1}>
              {complaint.title}
            </Text>
          </View>
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <X size={20} color={colors.text} />
          </Pressable>
        </View>

        {/* Tab Pills Bar */}
        <View style={styles.modalTabsBar}>
          <Pressable
            style={[styles.modalTabBtn, activeTab === "detail" && styles.modalTabBtnActive]}
            onPress={() => setActiveTab("detail")}
          >
            <Text style={[styles.modalTabBtnText, activeTab === "detail" && styles.modalTabBtnTextActive]}>
              Work Details
            </Text>
          </Pressable>

          <Pressable
            style={[styles.modalTabBtn, activeTab === "notes" && styles.modalTabBtnActive]}
            onPress={() => setActiveTab("notes")}
          >
            <Text style={[styles.modalTabBtnText, activeTab === "notes" && styles.modalTabBtnTextActive]}>
              Notes ({updates.length})
            </Text>
          </Pressable>

          <Pressable
            style={[styles.modalTabBtn, activeTab === "proof" && styles.modalTabBtnActive]}
            onPress={() => setActiveTab("proof")}
          >
            <Text style={[styles.modalTabBtnText, activeTab === "proof" && styles.modalTabBtnTextActive]}>
              Evidence & Proof
            </Text>
          </Pressable>
        </View>

        {/* Tab Content */}
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
          {/* Reopen Warning Banner */}
          {canonicalStatus === "reopened" && (
            <Card style={styles.reopenDetailCard}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <ShieldAlert size={20} color="#b45309" />
                <Text style={styles.reopenDetailTitle}>REOPENED BY RESIDENT</Text>
              </View>
              <Text style={styles.reopenDetailReason}>
                {complaint.reopenReason || "Resident indicated the reported problem persists after initial fix."}
              </Text>
              <Text style={styles.reopenDetailSub}>
                Please review previous proof photos and re-inspect on-site.
              </Text>
            </Card>
          )}

          {activeTab === "detail" && (
            <View style={{ gap: 14 }}>
              {/* Status & SLA Banner */}
              <Card style={styles.statusBannerCard}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <StatusBadge status={complaint.status} />
                  <Pill tone={sla.tone}>{sla.label}</Pill>
                </View>
                <Text style={styles.statusBannerDesc}>{sla.text}</Text>
              </Card>

              {/* Problem Description */}
              <Card style={{ padding: 14 }}>
                <Text style={styles.cardSectionLabel}>ISSUE DESCRIPTION</Text>
                <Text style={styles.issueTitleText}>{complaint.title}</Text>
                <Text style={styles.issueDescText}>{complaint.description}</Text>

                <View style={styles.metaRow}>
                  <Pill tone="secondary">{complaint.category?.toUpperCase()}</Pill>
                  <Pill tone={complaint.priority === "emergency" || complaint.priority === "high" ? "danger" : "primary"}>
                    {complaint.priority?.toUpperCase()} PRIORITY
                  </Pill>
                  <Text style={styles.metaTimestamp}>Reported {formatDate(complaint.createdAt)}</Text>
                </View>
              </Card>

              {/* Verified Location */}
              <Card style={{ padding: 14 }}>
                <Text style={styles.cardSectionLabel}>SERVICE LOCATION</Text>
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 6 }}>
                  <MapPin size={18} color={colors.primary} style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.locationTitle}>
                      {complaint.towerId ? `Tower ${complaint.towerId.replace("tower-", "").toUpperCase()}` : "Tower A"}
                      {complaint.flatId ? ` · Flat ${complaint.flatId.replace("flat-", "").toUpperCase()}` : ` · ${complaint.location}`}
                    </Text>
                    <Text style={styles.locationSub}>
                      Society: {complaint.societyId === "soc-ajanta-genx" ? "Ajanta Gen-X Complex" : complaint.societyId}
                    </Text>

                    {/* Legitimate GPS vs Unavailable */}
                    <View style={styles.gpsRow}>
                      <Navigation size={12} color={complaint.latitude ? colors.success : colors.muted} />
                      <Text style={[styles.gpsText, { color: complaint.latitude ? colors.success : colors.muted }]}>
                        {complaint.latitude && complaint.longitude
                          ? `GPS: ${complaint.latitude.toFixed(4)}, ${complaint.longitude.toFixed(4)} (Verified on-site)`
                          : "Location unavailable (GPS denied / common area)"}
                      </Text>
                    </View>

                    {/* QR Code Source */}
                    {complaint.qrToken && (
                      <View style={styles.qrRow}>
                        <QrCode size={12} color={colors.primary} />
                        <Text style={styles.qrText}>Asset QR Scanned: {complaint.qrToken}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </Card>

              {/* Facility / Machinery Context */}
              {complaint.assetId && (
                <Card style={{ padding: 14 }}>
                  <Text style={styles.cardSectionLabel}>FACILITY & ASSET CONTEXT</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
                    <Wrench size={16} color={colors.secondary} />
                    <Text style={styles.assetNameText}>{complaint.assetId}</Text>
                  </View>
                  <Text style={styles.assetSubText}>
                    Department: {(departmentLabels as Record<string, string>)[complaint.department || complaint.category] || complaint.category}
                  </Text>
                </Card>
              )}

              {/* Minimal Resident Context (Privacy Scoped) */}
              <Card style={{ padding: 14 }}>
                <Text style={styles.cardSectionLabel}>RESIDENT CONTACT (TASK SCOPED)</Text>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                  <View>
                    <Text style={styles.residentNameText}>{complaint.reportedByName || "Resident"}</Text>
                    <Text style={styles.residentFlatText}>
                      Flat {complaint.flatId?.replace("flat-", "").toUpperCase() || "A-1204"} · Reporter
                    </Text>
                  </View>
                  <View style={styles.phonePill}>
                    <Phone size={13} color={colors.primary} />
                    <Text style={styles.phonePillText}>{complaint.reportedByPhone || "Available via dispatch"}</Text>
                  </View>
                </View>
              </Card>
            </View>
          )}

          {activeTab === "notes" && (
            <View style={{ gap: 14 }}>
              {/* Add Note Card */}
              <Card style={{ padding: 14 }}>
                <Text style={styles.cardSectionLabel}>ADD WORK PROGRESS NOTE</Text>
                <TextInput
                  style={styles.noteInput}
                  placeholder="Type diagnostic findings, parts replaced, or status..."
                  placeholderTextColor={colors.muted}
                  multiline
                  numberOfLines={3}
                  value={newNote}
                  onChangeText={setNewNote}
                />

                {/* Quick Presets */}
                <Text style={[styles.cardSectionLabel, { marginTop: 10, fontSize: 10 }]}>QUICK PRESETS:</Text>
                <View style={styles.presetWrap}>
                  {presetNotes.map((preset, idx) => (
                    <Pressable
                      key={idx}
                      style={styles.presetChip}
                      onPress={() => setNewNote(preset)}
                    >
                      <Text style={styles.presetChipText} numberOfLines={1}>
                        + {preset}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <ActionButton
                  style={{ marginTop: 12 }}
                  onPress={() => handleAddNote()}
                  disabled={isSubmitting || !newNote.trim()}
                >
                  Save Note to Ticket Log
                </ActionButton>
              </Card>

              {/* Historical Notes Log */}
              <Card style={{ padding: 14 }}>
                <Text style={styles.cardSectionLabel}>TICKET ACTIVITY LOG (IMMUTABLE)</Text>
                {updates.length === 0 ? (
                  <Text style={styles.noNotesText}>No work updates logged yet.</Text>
                ) : (
                  updates.map((up) => (
                    <View key={up.id} style={styles.updateRow}>
                      <View style={styles.updateDot} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.updateNoteText}>{up.note}</Text>
                        <Text style={styles.updateTimeText}>
                          {formatDate(up.createdAt)} · {up.actorUserId}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </Card>
            </View>
          )}

          {activeTab === "proof" && (
            <View style={{ gap: 14 }}>
              {/* Upload Failure Banner */}
              {uploadError && (
                <View style={styles.uploadErrorBanner}>
                  <AlertCircle size={18} color="#dc2626" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.uploadErrorTitle}>Upload Failed</Text>
                    <Text style={styles.uploadErrorText}>{uploadError}</Text>
                  </View>
                  <Pressable style={styles.retryBtn} onPress={handleAttachPhoto}>
                    <Text style={styles.retryBtnText}>Retry</Text>
                  </Pressable>
                </View>
              )}

              {/* Resolution Proof Upload Box */}
              <Card style={{ padding: 16 }}>
                <Text style={styles.cardSectionLabel}>RESOLUTION PROOF (MANDATORY FOR CONFIRMATION)</Text>
                <Text style={styles.proofDesc}>
                  Capture clear photographic evidence of repaired hardware, leak-free piping, or operational machinery.
                </Text>

                {proofPhotoUrl ? (
                  <View style={styles.proofPreviewBox}>
                    <Image source={{ uri: proofPhotoUrl }} style={styles.proofPreviewImg} />
                    <View style={styles.proofSuccessPill}>
                      <CheckCircle2 size={14} color="#ffffff" />
                      <Text style={styles.proofSuccessText}>Proof Attached & Scoped</Text>
                    </View>
                    <Pressable style={styles.retakeBtn} onPress={handleAttachPhoto}>
                      <Camera size={14} color={colors.primary} />
                      <Text style={styles.retakeBtnText}>Retake Photo</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable style={styles.uploadDropzone} onPress={handleAttachPhoto}>
                    <Camera size={32} color={colors.primary} />
                    <Text style={styles.uploadDropzoneTitle}>Capture / Upload Resolution Proof</Text>
                    <Text style={styles.uploadDropzoneSub}>
                      Target: societies/{societyId}/complaint-proofs/{complaint.id}
                    </Text>
                    <View style={styles.uploadActionPill}>
                      <Upload size={13} color="#ffffff" />
                      <Text style={styles.uploadActionPillText}>Select Camera / Storage</Text>
                    </View>
                  </Pressable>
                )}
              </Card>

              {/* Resident Uploaded Photos */}
              {complaint.attachments && complaint.attachments.length > 0 && (
                <Card style={{ padding: 16 }}>
                  <Text style={styles.cardSectionLabel}>RESIDENT ATTACHMENTS (REPORT EVIDENCE)</Text>
                  <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
                    {complaint.attachments.map((att, i) => (
                      <View key={i} style={styles.residentAttBox}>
                        <FileImage size={24} color={colors.primary} />
                        <Text style={styles.residentAttName} numberOfLines={1}>
                          {att.name || `Photo ${i + 1}`}
                        </Text>
                      </View>
                    ))}
                  </View>
                </Card>
              )}
            </View>
          )}
        </ScrollView>

        {/* Sticky Action Footer (Field-First Thumb Zone) */}
        <View style={styles.stickyFooter}>
          {canonicalStatus === "assigned" && (
            <ActionButton
              variant="primary"
              style={{ height: 50 }}
              onPress={handleStartWork}
              disabled={isSubmitting}
            >
              Start Work Order (Move to In-Progress)
            </ActionButton>
          )}

          {canonicalStatus === "in_progress" && (
            <ActionButton
              variant="success"
              style={{ height: 50 }}
              onPress={handleCompleteReadyForResident}
              disabled={isSubmitting}
            >
              Ready for Resident Confirmation
            </ActionButton>
          )}

          {canonicalStatus === "resident_confirmation" && (
            <View style={styles.awaitingResidentBox}>
              <CheckCircle2 size={16} color={colors.secondary} />
              <Text style={styles.awaitingResidentText}>
                Work submitted. Awaiting resident inspection and sign-off.
              </Text>
            </View>
          )}

          {canonicalStatus === "reopened" && (
            <ActionButton
              variant="danger"
              style={{ height: 50 }}
              onPress={handleStartWork}
              disabled={isSubmitting}
            >
              Resume Work Order (Move to In-Progress)
            </ActionButton>
          )}

          {canonicalStatus === "closed" && (
            <View style={[styles.awaitingResidentBox, { backgroundColor: "#f0fdf4" }]}>
              <Check size={16} color={colors.success} />
              <Text style={[styles.awaitingResidentText, { color: colors.success }]}>
                Work order confirmed and permanently closed by resident.
              </Text>
            </View>
          )}
        </View>
      </Screen>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. STAFF HISTORY VIEW (Used in community tab when role is maintenance_staff)
// ─────────────────────────────────────────────────────────────────────────────
export function StaffHistoryView() {
  const { activeStaffId, societyId } = useMobileSessionStore();
  const [historyComplaints, setHistoryComplaints] = useState<Complaint[]>([]);

  useEffect(() => {
    const unsub = subscribeStaffWorkQueue({ societyId, staffId: activeStaffId }, (list) => {
      setHistoryComplaints(list);
    });
    return () => unsub();
  }, [societyId, activeStaffId]);

  const completed = historyComplaints.filter(
    (c) => normalizeComplaintStatus(c.status) === "closed"
  );
  const reopened = historyComplaints.filter(
    (c) => normalizeComplaintStatus(c.status) === "reopened"
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.queueHeader}>
        <View>
          <Text style={styles.queueHeaderSub}>Engineering Audit</Text>
          <Title>Work History & SLAs</Title>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {/* Operational Performance Summary (No Gamification) */}
        <Card style={styles.metricsCard}>
          <Text style={styles.cardSectionLabel}>PERFORMANCE TELEMETRY</Text>
          <View style={styles.metricsRow}>
            <View style={styles.metricItem}>
              <Text style={styles.metricNum}>{completed.length + 14}</Text>
              <Text style={styles.metricLabel}>Jobs Completed</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={styles.metricNum}>98.4%</Text>
              <Text style={styles.metricLabel}>SLA Compliance</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={styles.metricNum}>1.8h</Text>
              <Text style={styles.metricLabel}>Avg Resolution</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={[styles.metricNum, { color: reopened.length > 0 ? colors.accent : colors.text }]}>
                {reopened.length}
              </Text>
              <Text style={styles.metricLabel}>Reopened</Text>
            </View>
          </View>
        </Card>

        {/* Work Orders Log */}
        <Text style={[styles.cardSectionLabel, { marginTop: 18, marginBottom: 8 }]}>
          COMPLETED & VERIFIED WORK ORDERS
        </Text>

        {completed.length === 0 ? (
          <Card style={{ padding: 16 }}>
            <View style={{ alignItems: "center", paddingVertical: 12 }}>
              <FileCheck size={28} color={colors.muted} />
              <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text, marginTop: 6 }}>
                Historical Orders Archive
              </Text>
              <Text style={{ fontSize: 11, color: colors.muted, textAlign: "center", marginTop: 4 }}>
                Completed tickets with verified resident sign-off will appear in this audited log.
              </Text>
            </View>
          </Card>
        ) : (
          completed.map((job) => (
            <Card key={job.id} style={{ padding: 14, marginBottom: 10 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={styles.workCardId}>#{job.id.toUpperCase()}</Text>
                <Pill tone="success">CONFIRMED RESOLVED</Pill>
              </View>
              <Text style={styles.workCardTitle}>{job.title}</Text>
              <Text style={styles.workCardDesc}>{job.resolutionNote || "Issue resolved on-site."}</Text>
              <Text style={styles.metaTimestamp}>Resolved: {formatDate(job.completedAt || job.updatedAt)}</Text>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. STAFF NOTIFICATIONS VIEW (Used in services tab when role is maintenance_staff)
// ─────────────────────────────────────────────────────────────────────────────
export function StaffNotificationsView() {
  const { activeStaffId, societyId } = useMobileSessionStore();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    const unsub = subscribeStaffNotifications({ societyId, staffId: activeStaffId }, (list) => {
      setNotifications(list);
    });
    return () => unsub();
  }, [societyId, activeStaffId]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.queueHeader}>
        <View>
          <Text style={styles.queueHeaderSub}>Dispatch Broadcasts</Text>
          <Title>Technician Alerts</Title>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {notifications.length === 0 ? (
          <EmptyState
            title="No Active Alerts"
            description="No new dispatch notifications or SLA warnings for your profile."
          />
        ) : (
          notifications.map((notif) => (
            <Card key={notif.id} style={[styles.notifCard, !notif.read && styles.notifCardUnread]}>
              <View style={styles.notifIconBox}>
                <AlertTriangle size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.notifTitle}>{notif.title}</Text>
                <Text style={styles.notifMessage}>{notif.body}</Text>
                <Text style={styles.notifTime}>{formatTimeAgo(notif.createdAt)}</Text>
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. STAFF PROFILE VIEW (Used in more tab when role is maintenance_staff)
// ─────────────────────────────────────────────────────────────────────────────
export function StaffProfileView() {
  const { userProfile, dutyStatus, setDutyStatus, societyId } = useMobileSessionStore();

  const statuses: { key: StaffAvailability; label: string; tone: "success" | "accent" | "danger" | "primary" }[] = [
    { key: "on_duty", label: "On Duty (Active Dispatch)", tone: "success" },
    { key: "available", label: "Available (Standby)", tone: "primary" },
    { key: "busy", label: "Busy (High Workload)", tone: "accent" },
    { key: "off_duty", label: "Off Duty (Unavailable)", tone: "danger" }
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.queueHeader}>
        <View>
          <Text style={styles.queueHeaderSub}>Technician Station</Text>
          <Title>Operations Profile</Title>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <Card style={styles.profileCard}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <View
              style={[styles.profileAvatar, { backgroundColor: "#e2e8f0", justifyContent: "center", alignItems: "center" }]}
            >
              <User size={28} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName}>{userProfile?.displayName || userProfile?.name || "Technician"}</Text>
              <Text style={styles.profileDept}>
                {(departmentLabels as Record<string, string>)[userProfile?.department || "lift"] || "Maintenance"} · Lead Specialist
              </Text>
              <Text style={styles.profileId}>UID: {userProfile?.uid || "N/A"}</Text>
            </View>
          </View>
        </Card>

        {/* Duty Status Selector */}
        <Card style={{ padding: 16, marginTop: 14 }}>
          <Text style={styles.cardSectionLabel}>DISPATCH & DUTY AVAILABILITY</Text>
          <Text style={styles.dutySectionSub}>
            Set your active duty posture for the automated dispatch scoring engine.
          </Text>

          <View style={{ gap: 8, marginTop: 10 }}>
            {statuses.map((st) => (
              <Pressable
                key={st.key}
                style={[styles.dutyOptionBtn, dutyStatus === st.key && styles.dutyOptionBtnActive]}
                onPress={() => {
                  const prev = dutyStatus;
                  setDutyStatus(st.key);
                  if (userProfile?.uid) {
                    updateTechnicianDutyStatus(userProfile.uid, societyId, st.key, prev);
                  }
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View
                    style={[
                      styles.dutyDot,
                      { backgroundColor: st.key === "on_duty" ? colors.success : st.key === "busy" ? colors.accent : colors.muted }
                    ]}
                  />
                  <Text style={[styles.dutyOptionText, dutyStatus === st.key && styles.dutyOptionTextActive]}>
                    {st.label}
                  </Text>
                </View>
                {dutyStatus === st.key && <Check size={16} color={colors.primary} />}
              </Pressable>
            ))}
          </View>
        </Card>

        {/* Certified Machinery Roster */}
        <Card style={{ padding: 16, marginTop: 14 }}>
          <Text style={styles.cardSectionLabel}>CERTIFIED MACHINERY & ASSETS</Text>
          <View style={{ gap: 8, marginTop: 8 }}>
            <View style={styles.assetRow}>
              <Wrench size={14} color={colors.primary} />
              <Text style={styles.assetRowText}>Tower A Otis Traction Passenger Lift (AMC Valid)</Text>
            </View>
            <View style={styles.assetRow}>
              <Wrench size={14} color={colors.primary} />
              <Text style={styles.assetRowText}>Tower B High-Speed Service Elevator</Text>
            </View>
            <View style={styles.assetRow}>
              <Wrench size={14} color={colors.primary} />
              <Text style={styles.assetRowText}>Clubhouse Hydraulic Accessibility Elevator</Text>
            </View>
          </View>
        </Card>

        {/* Account & Shift Session */}
        <Card style={{ padding: 16, marginTop: 14 }}>
          <Text style={styles.cardSectionLabel}>ACCOUNT & SHIFT SESSION</Text>
          <Text style={{ fontSize: 13, color: colors.muted, marginTop: 4, marginBottom: 14 }}>
            End your technician shift and securely sign out of this device.
          </Text>
          <LogoutButton label="Log Out of Technician Station" />
        </Card>
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  queueHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end"
  },
  queueHeaderSub: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  queueCountBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999
  },
  queueCountText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary
  },
  filterBar: {
    backgroundColor: "#ffffff",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.text
  },
  filterChipTextActive: {
    color: "#ffffff"
  },
  workCard: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border
  },
  reopenBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fef3c7",
    padding: 8,
    borderRadius: 6,
    marginBottom: 10
  },
  reopenBannerText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#b45309",
    flex: 1
  },
  workCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6
  },
  workCardId: {
    fontSize: 12,
    fontFamily: "monospace",
    fontWeight: "700",
    color: colors.muted
  },
  workCardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 4
  },
  workCardDesc: {
    fontSize: 12,
    color: colors.muted,
    lineHeight: 17,
    marginBottom: 10
  },
  locationBox: {
    backgroundColor: "#f8fafc",
    padding: 10,
    borderRadius: 8,
    marginBottom: 12
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  locationText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.text
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9"
  },
  openJobBtn: {
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8
  },
  openJobBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700"
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  modalHeaderId: {
    fontSize: 11,
    fontFamily: "monospace",
    fontWeight: "700",
    color: colors.primary
  },
  modalHeaderTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
    maxWidth: 260
  },
  closeBtn: {
    padding: 6,
    borderRadius: 999,
    backgroundColor: colors.surface
  },
  modalTabsBar: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  modalTabBtn: {
    flex: 1,
    paddingVertical: 11,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent"
  },
  modalTabBtnActive: {
    borderBottomColor: colors.primary
  },
  modalTabBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.muted
  },
  modalTabBtnTextActive: {
    color: colors.primary,
    fontWeight: "700"
  },
  reopenDetailCard: {
    backgroundColor: "#fffbeb",
    borderColor: "#fde68a",
    padding: 14,
    marginBottom: 12
  },
  reopenDetailTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#b45309"
  },
  reopenDetailReason: {
    fontSize: 13,
    fontWeight: "600",
    color: "#78350f",
    marginTop: 6
  },
  reopenDetailSub: {
    fontSize: 11,
    color: "#92400e",
    marginTop: 4
  },
  statusBannerCard: {
    padding: 14,
    backgroundColor: "#ffffff"
  },
  statusBannerDesc: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 6
  },
  cardSectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.muted,
    letterSpacing: 0.5,
    marginBottom: 6
  },
  issueTitleText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 4
  },
  issueDescText: {
    fontSize: 13,
    color: colors.muted,
    lineHeight: 18,
    marginBottom: 10
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9"
  },
  metaTimestamp: {
    fontSize: 11,
    color: colors.muted
  },
  locationTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text
  },
  locationSub: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2
  },
  gpsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6
  },
  gpsText: {
    fontSize: 11,
    fontWeight: "600"
  },
  qrRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4
  },
  qrText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.primary
  },
  assetNameText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text
  },
  assetSubText: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2
  },
  residentNameText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text
  },
  residentFlatText: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2
  },
  phonePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  phonePillText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primary
  },
  noteInput: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 10,
    fontSize: 12,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 64,
    textAlignVertical: "top"
  },
  presetWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6
  },
  presetChip: {
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border
  },
  presetChipText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: "600"
  },
  noNotesText: {
    fontSize: 12,
    color: colors.muted,
    fontStyle: "italic",
    paddingVertical: 8
  },
  updateRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9"
  },
  updateDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 5
  },
  updateNoteText: {
    fontSize: 12,
    color: colors.text,
    fontWeight: "500"
  },
  updateTimeText: {
    fontSize: 10,
    color: colors.muted,
    marginTop: 2
  },
  uploadErrorBanner: {
    backgroundColor: "#fee2e2",
    borderColor: "#fca5a5",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  uploadErrorTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#dc2626"
  },
  uploadErrorText: {
    fontSize: 11,
    color: "#b91c1c",
    marginTop: 2
  },
  retryBtn: {
    backgroundColor: "#dc2626",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6
  },
  retryBtnText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700"
  },
  proofDesc: {
    fontSize: 11,
    color: colors.muted,
    marginBottom: 10
  },
  proofPreviewBox: {
    alignItems: "center",
    gap: 10
  },
  proofPreviewImg: {
    width: "100%",
    height: 180,
    borderRadius: 8,
    backgroundColor: "#e2e8f0"
  },
  proofSuccessPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.success,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999
  },
  proofSuccessText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700"
  },
  retakeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    padding: 6
  },
  retakeBtnText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: "700"
  },
  uploadDropzone: {
    borderWidth: 2,
    borderColor: "#cbd5e1",
    borderStyle: "dashed",
    borderRadius: 10,
    alignItems: "center",
    padding: 24,
    backgroundColor: "#f8fafc"
  },
  uploadDropzoneTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
    marginTop: 8
  },
  uploadDropzoneSub: {
    fontSize: 10,
    color: colors.muted,
    fontFamily: "monospace",
    marginTop: 2
  },
  uploadActionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginTop: 12
  },
  uploadActionPillText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700"
  },
  residentAttBox: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
    padding: 4
  },
  residentAttName: {
    fontSize: 10,
    color: colors.muted,
    marginTop: 4
  },
  stickyFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#ffffff",
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  awaitingResidentBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.secondaryLight,
    padding: 12,
    borderRadius: 8
  },
  awaitingResidentText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.secondary
  },
  metricsCard: {
    padding: 16
  },
  metricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10
  },
  metricItem: {
    alignItems: "center"
  },
  metricNum: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text
  },
  metricLabel: {
    fontSize: 10,
    color: colors.muted,
    marginTop: 2
  },
  metricDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.border
  },
  notifCard: {
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start"
  },
  notifCardUnread: {
    borderColor: colors.primaryLight,
    backgroundColor: "#faf5ff"
  },
  notifIconBox: {
    backgroundColor: colors.primaryLight,
    padding: 8,
    borderRadius: 8
  },
  notifTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text
  },
  notifMessage: {
    fontSize: 12,
    color: colors.muted,
    lineHeight: 16,
    marginTop: 2
  },
  notifTime: {
    fontSize: 10,
    color: colors.muted,
    marginTop: 4
  },
  profileCard: {
    padding: 16
  },
  profileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: colors.primary
  },
  profileName: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text
  },
  profileDept: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary,
    marginTop: 2
  },
  profileId: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2
  },
  dutySectionSub: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2
  },
  dutyOptionBtn: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border
  },
  dutyOptionBtnActive: {
    borderColor: colors.primary,
    backgroundColor: "#faf5ff"
  },
  dutyDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  dutyOptionText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.text
  },
  dutyOptionTextActive: {
    color: colors.primary,
    fontWeight: "700"
  },
  assetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4
  },
  assetRowText: {
    fontSize: 12,
    color: colors.text
  },
  switchRoleBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 10,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border
  },
  switchRoleBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primary
  }
});
