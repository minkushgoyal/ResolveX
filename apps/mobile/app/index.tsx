import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Redirect } from "expo-router";
import { Building2 } from "lucide-react-native";
import { colors } from "../components/mobile-ui";
import { useMobileSessionStore } from "../lib/session-store";

console.log("[STARTUP 8] Entry index route module loaded");

export default function EntryIndex() {
  const { firebaseUser, userProfile, isLoading, isAuthLoading, isProfileLoading } = useMobileSessionStore();
  console.log("[STARTUP 8] EntryIndex rendered | isLoading:", isLoading, "| hasUser:", !!firebaseUser, "| profileLoading:", isProfileLoading);

  if (isLoading || isAuthLoading || (firebaseUser && !userProfile && isProfileLoading)) {
    return (
      <View style={styles.container}>
        <View style={styles.logoBadge}>
          <Building2 size={40} color={colors.primary} />
        </View>
        <Text style={styles.brand}>ResolveX</Text>
        <Text style={styles.subText}>Connecting to resolvex-community...</Text>
        <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 20 }} />
      </View>
    );
  }

  if (!firebaseUser) {
    return <Redirect href="/(auth)/login" />;
  }

  if (userProfile) {
    const status = userProfile.status;
    if (status === "pending" || status === "pending_verification") {
      return <Redirect href="/(auth)/pending-approval" />;
    }
    if (status === "rejected") {
      return <Redirect href="/(auth)/rejected" />;
    }
    if (status === "suspended") {
      return <Redirect href="/(auth)/suspended" />;
    }
    if (status === "verified") {
      return <Redirect href="/(tabs)" />;
    }
  }

  return <Redirect href="/(auth)/login" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
    justifyContent: "center",
    alignItems: "center",
    padding: 24
  },
  logoBadge: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: "#e0e7ff",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12
  },
  brand: {
    fontSize: 24,
    fontWeight: "900",
    color: colors.text
  },
  subText: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 4
  }
});
