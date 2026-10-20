import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useRouter } from "expo-router";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Clock,
  LogOut,
  Mail,
  RefreshCw,
  Send,
  Shield,
  ShieldAlert,
  UserCheck
} from "lucide-react-native";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { sendEmailVerification } from "firebase/auth";
import type { UserProfile } from "@resolvex/types";
import { colors } from "../../components/mobile-ui";
import { auth, db } from "../../lib/firebase";
import { mobileSignOut } from "../../lib/auth-service";
import { useMobileSessionStore } from "../../lib/session-store";

export default function PendingApprovalScreen() {
  const router = useRouter();
  const { firebaseUser, userProfile } = useMobileSessionStore();
  const [profile, setProfile] = useState<UserProfile | null>(userProfile);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);

  const targetUid = firebaseUser?.uid || auth.currentUser?.uid || userProfile?.uid;

  // Monitor live profile changes in real time via onSnapshot
  useEffect(() => {
    if (!targetUid) return;

    console.log(`[PENDING LISTENER START] uid=${targetUid}`);

    const unsub = onSnapshot(
      doc(db, "users", targetUid),
      (snap) => {
        if (!snap.exists()) return;
        const updated = snap.data() as UserProfile;
        const currentLocal = profile || userProfile;
        const oldStatus = currentLocal?.status || "pending";
        const newStatus = updated.status;

        setProfile(updated);

        if (oldStatus !== newStatus) {
          console.log(`[PENDING STATUS CHANGE] ${oldStatus} -> ${newStatus}`);
        }

        if (newStatus === "verified") {
          console.log("[PENDING APPROVAL NAVIGATING]");
          const currentAuthUser = auth.currentUser || firebaseUser;
          if (currentAuthUser) {
            useMobileSessionStore.getState().setSession(currentAuthUser, updated);
          }
          router.replace("/(tabs)");
        } else if (newStatus === "rejected") {
          const currentAuthUser = auth.currentUser || firebaseUser;
          if (currentAuthUser) {
            useMobileSessionStore.getState().setSession(currentAuthUser, updated);
          }
          router.replace("/(auth)/rejected");
        } else if (newStatus === "suspended") {
          router.replace("/(auth)/suspended");
        }
      },
      (err) => {
        console.warn("[PendingApproval] Real-time snapshot error:", err);
      }
    );

    return () => unsub();
  }, [targetUid, router]);

  async function handleRefresh() {
    if (!targetUid) return;
    setIsRefreshing(true);
    try {
      if (auth.currentUser) {
        await auth.currentUser.reload();
      }
      const snap = await getDoc(doc(db, "users", targetUid));
      if (snap.exists()) {
        const data = snap.data() as UserProfile;
        setProfile(data);
        const currentAuthUser = auth.currentUser || firebaseUser;
        if (currentAuthUser) {
          useMobileSessionStore.getState().setSession(currentAuthUser, data);
        }
        if (data.status === "verified") {
          console.log("[PENDING STATUS CHANGE] pending -> verified");
          console.log("[PENDING APPROVAL NAVIGATING]");
          router.replace("/(tabs)");
        } else if (data.status === "rejected") {
          router.replace("/(auth)/rejected");
        }
      }
    } catch (e) {
      console.warn("Could not refresh profile:", e);
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleResendEmailVerification() {
    const user = auth.currentUser || firebaseUser;
    if (!user) return;
    try {
      await sendEmailVerification(user);
      setResendStatus("Verification email sent! Check your inbox.");
    } catch (e: any) {
      setResendStatus(e.message || "Failed to resend email.");
    }
  }

  async function handleSignOut() {
    await mobileSignOut();
    router.replace("/(auth)/login");
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        {/* Status Icon */}
        <View style={styles.iconCircle}>
          <Clock size={44} color={colors.accent} />
        </View>

        <Text style={styles.statusBadge}>VERIFICATION PENDING</Text>
        <Text style={styles.title}>Account Under Review</Text>
        <Text style={styles.description}>
          Your registration has been submitted to the society management office. For security and privacy, an administrator must review your application before full access is granted.
        </Text>

        {/* Applicant Details */}
        <View style={styles.detailsCard}>
          <Text style={styles.detailsHeader}>SUBMITTED DETAILS</Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Applicant Name:</Text>
            <Text style={styles.detailValue}>{profile?.displayName || firebaseUser?.displayName || "Resident"}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Registered Email:</Text>
            <Text style={styles.detailValue}>{profile?.email || firebaseUser?.email}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Requested Role:</Text>
            <Text style={[styles.detailValue, { textTransform: "capitalize" }]}>
              {profile?.role?.replace(/_/g, " ") || "Resident"}
            </Text>
          </View>

          {profile?.flatId && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Residence / Flat:</Text>
              <Text style={styles.detailValue}>
                {profile.flatId.replace("flat-", "").toUpperCase()}
              </Text>
            </View>
          )}

          {profile?.role === "maintenance_staff" && (
            <>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Specialization Trade:</Text>
                <Text style={[styles.detailValue, { color: colors.primary, fontWeight: "700" }]}>
                  {profile.specialization || "General Maintenance"}
                </Text>
              </View>
              {profile.department && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Department:</Text>
                  <Text style={[styles.detailValue, { textTransform: "capitalize" }]}>
                    {profile.department.replace(/_/g, " ")}
                  </Text>
                </View>
              )}
            </>
          )}

          {profile?.role === "security_guard" && (
            <>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Duty Post / Gate:</Text>
                <Text style={[styles.detailValue, { color: colors.primary, fontWeight: "700" }]}>
                  {profile.gate || "Main Gate Desk"}
                </Text>
              </View>
              {profile.shift && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Duty Shift:</Text>
                  <Text style={styles.detailValue}>{profile.shift}</Text>
                </View>
              )}
            </>
          )}

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Society:</Text>
            <Text style={styles.detailValue}>{profile?.societyId || "resolvex-community"}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Management Status:</Text>
            <Text style={[styles.detailValue, { color: colors.accent, textTransform: "capitalize" }]}>
              {profile?.status || "Pending"}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Email Ownership:</Text>
            <Text style={[styles.detailValue, { color: firebaseUser?.emailVerified ? "#16a34a" : "#ca8a04" }]}>
              {firebaseUser?.emailVerified ? "Verified" : "Pending Confirmation"}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Submission Time:</Text>
            <Text style={styles.detailValue}>
              {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : "Today"}
            </Text>
          </View>
        </View>

        {/* Optional Resend Verification Email if not verified */}
        {!firebaseUser?.emailVerified && (
          <Pressable style={styles.resendBtn} onPress={handleResendEmailVerification}>
            <Mail size={14} color={colors.primary} />
            <Text style={styles.resendBtnText}>Resend Email Verification</Text>
          </Pressable>
        )}
        {resendStatus && (
          <Text style={styles.resendStatusText}>{resendStatus}</Text>
        )}

        {/* Live Listening Notice */}
        <View style={styles.liveNotice}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.liveNoticeText}>
            Listening for live management approval. This screen will update automatically.
          </Text>
        </View>

        {/* Actions */}
        <Pressable
          style={[styles.refreshBtn, isRefreshing && styles.refreshBtnDisabled]}
          onPress={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw size={16} color={colors.primary} />
          <Text style={styles.refreshBtnText}>
            {isRefreshing ? "Checking Status..." : "Check Status Now"}
          </Text>
        </Pressable>

        <Pressable style={styles.signOutBtn} onPress={handleSignOut}>
          <LogOut size={16} color={colors.muted} />
          <Text style={styles.signOutBtnText}>Sign Out / Use Different Account</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#f8fafc",
    padding: 24,
    justifyContent: "center"
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#fef3c7",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16
  },
  statusBadge: {
    fontSize: 11,
    fontWeight: "800",
    color: "#b45309",
    letterSpacing: 0.8,
    marginBottom: 4
  },
  title: {
    fontSize: 22,
    fontWeight: "900",
    color: colors.text,
    textAlign: "center"
  },
  description: {
    fontSize: 13,
    color: colors.muted,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 18
  },
  detailsCard: {
    width: "100%",
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0"
  },
  detailsHeader: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.muted,
    letterSpacing: 0.5,
    marginBottom: 10
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5
  },
  detailLabel: {
    fontSize: 12,
    color: colors.muted
  },
  detailValue: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text
  },
  liveNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 18,
    paddingHorizontal: 12
  },
  liveNoticeText: {
    flex: 1,
    fontSize: 11,
    color: colors.primary,
    fontWeight: "600"
  },
  refreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    width: "100%",
    height: 46,
    borderRadius: 10,
    backgroundColor: "#e0e7ff",
    marginTop: 20
  },
  refreshBtnDisabled: {
    opacity: 0.6
  },
  refreshBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary
  },
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 16,
    paddingVertical: 8
  },
  signOutBtnText: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: "600"
  },
  resendBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#c7d2fe",
    backgroundColor: "#eef2ff",
    marginTop: 12
  },
  resendBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary
  },
  resendStatusText: {
    fontSize: 11,
    color: "#16a34a",
    textAlign: "center",
    marginTop: 6,
    fontWeight: "600"
  }
});
