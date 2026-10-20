import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useRouter } from "expo-router";
import { AlertTriangle, LogOut, ShieldAlert } from "lucide-react-native";
import { colors } from "../../components/mobile-ui";
import { mobileSignOut } from "../../lib/auth-service";
import { useMobileSessionStore } from "../../lib/session-store";

export default function RejectedScreen() {
  const router = useRouter();
  const userProfile = useMobileSessionStore((s) => s.userProfile);

  async function handleSignOut() {
    await mobileSignOut();
    router.replace("/(auth)/login");
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <ShieldAlert size={44} color="#dc2626" />
        </View>

        <Text style={styles.statusBadge}>APPLICATION REJECTED</Text>
        <Text style={styles.title}>Verification Declined</Text>
        <Text style={styles.description}>
          Society management reviewed your registration request and could not verify your residence or operational assignment.
        </Text>

        {/* Reason Box */}
        <View style={styles.reasonCard}>
          <Text style={styles.reasonHeader}>MANAGEMENT REASON FOR REJECTION:</Text>
          <Text style={styles.reasonText}>
            {userProfile?.rejectionReason || "Flat details or occupancy documentation could not be validated. Please contact the society estate office in person with valid lease or ownership papers."}
          </Text>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Account Email:</Text>
            <Text style={styles.infoValue}>{userProfile?.email || "Unknown"}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Society:</Text>
            <Text style={styles.infoValue}>{userProfile?.societyId || "resolvex-community"}</Text>
          </View>
        </View>

        <Pressable style={styles.signOutBtn} onPress={handleSignOut}>
          <LogOut size={16} color="#ffffff" />
          <Text style={styles.signOutBtnText}>Sign Out & Return to Login</Text>
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
    borderColor: "#e2e8f0"
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#fee2e2",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16
  },
  statusBadge: {
    fontSize: 11,
    fontWeight: "800",
    color: "#dc2626",
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
  reasonCard: {
    width: "100%",
    backgroundColor: "#fef2f2",
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: "#fecaca"
  },
  reasonHeader: {
    fontSize: 10,
    fontWeight: "800",
    color: "#991b1b",
    letterSpacing: 0.5,
    marginBottom: 6
  },
  reasonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#7f1d1d",
    lineHeight: 18
  },
  infoCard: {
    width: "100%",
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 14,
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0"
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4
  },
  infoLabel: {
    fontSize: 12,
    color: colors.muted
  },
  infoValue: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text
  },
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    height: 48,
    borderRadius: 10,
    backgroundColor: "#dc2626",
    marginTop: 24
  },
  signOutBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#ffffff"
  }
});
