import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useRouter } from "expo-router";
import { AlertCircle, LogOut } from "lucide-react-native";
import { colors } from "../../components/mobile-ui";
import { mobileSignOut } from "../../lib/auth-service";

export default function SuspendedScreen() {
  const router = useRouter();

  async function handleSignOut() {
    await mobileSignOut();
    router.replace("/(auth)/login");
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <AlertCircle size={44} color="#dc2626" />
        </View>

        <Text style={styles.statusBadge}>ACCOUNT SUSPENDED</Text>
        <Text style={styles.title}>Access Revoked</Text>
        <Text style={styles.description}>
          Your access to the ResolveX society platform has been suspended by the society administration.
        </Text>

        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            Please contact the management committee or estate office to resolve any outstanding compliance, dues, or security matters.
          </Text>
        </View>

        <Pressable style={styles.signOutBtn} onPress={handleSignOut}>
          <LogOut size={16} color="#ffffff" />
          <Text style={styles.signOutBtnText}>Sign Out</Text>
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
  infoCard: {
    width: "100%",
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0"
  },
  infoText: {
    fontSize: 12,
    color: colors.text,
    lineHeight: 18,
    textAlign: "center"
  },
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    height: 48,
    borderRadius: 10,
    backgroundColor: colors.primary,
    marginTop: 24
  },
  signOutBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#ffffff"
  }
});
