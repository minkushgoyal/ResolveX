import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Stack, useRootNavigationState, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Building2, ShieldAlert } from "lucide-react-native";
import { colors } from "../components/mobile-ui";
import { subscribeMobileAuth } from "../lib/auth-service";
import { getFirebaseConfigError, isFirebaseConfigured } from "../lib/firebase";
import { useMobileSessionStore } from "../lib/session-store";

console.log("[STARTUP 1] Root layout module loaded");

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const rootNavigationState = useRootNavigationState();
  const { firebaseUser, userProfile, isLoading, isAuthLoading, isProfileLoading, setSession, setLoading } = useMobileSessionStore();
  const [configError, setConfigError] = useState<string | null>(getFirebaseConfigError());

  console.log("[STARTUP 2] Root layout rendered | isLoading:", isLoading, "| hasUser:", !!firebaseUser, "| navReady:", !!rootNavigationState?.key);

  useEffect(() => {
    console.log("[STARTUP 3] Providers mounted / Root layout mounted");
  }, []);

  // 1. Subscribe to Firebase Auth and Firestore profile with hard safety timeout
  useEffect(() => {
    if (!isFirebaseConfigured) {
      setConfigError(getFirebaseConfigError());
      setLoading(false);
      return;
    }

    console.log("[STARTUP 4] Auth subscription started");

    // Safety timeout: Ensure unauthenticated initial startup doesn't hang indefinitely (max 2.5s)
    const safetyTimer = setTimeout(() => {
      const state = useMobileSessionStore.getState();
      if (state.isLoading && !state.firebaseUser) {
        console.warn("[RootLayout] Auth initial sync took >2.5s for unauthenticated state, unblocking initial UI.");
        setLoading(false);
      }
    }, 2500);

    const unsub = subscribeMobileAuth((user, profile) => {
      clearTimeout(safetyTimer);
      setSession(user, profile);
    });

    return () => {
      clearTimeout(safetyTimer);
      unsub();
    };
  }, [setSession, setLoading]);

  // 2. Route guards based on real authentication and verification status
  useEffect(() => {
    // CRITICAL: Ensure root navigation is ready before attempting any route replacements
    if (!rootNavigationState?.key) return;
    if (isLoading || isAuthLoading || isProfileLoading || !isFirebaseConfigured) return;

    console.log("[STARTUP 7] Navigation route guard checking | segments:", segments, "| hasUser:", !!firebaseUser, "| profileStatus:", userProfile?.status);

    const segList = segments as string[];
    const inAuthGroup = segList[0] === "(auth)";

    // A. Unauthenticated: only redirect when Firebase Auth is genuinely unauthenticated
    if (!firebaseUser && !isAuthLoading) {
      if (!inAuthGroup && segList[0] === "(tabs)") {
        router.replace("/(auth)/login");
      }
      return;
    }

    // B. Authenticated - check profile status
    if (firebaseUser && userProfile) {
      const status = userProfile.status;

      if (status === "pending" || status === "pending_verification") {
        if (segList[1] !== "pending-approval") {
          router.replace("/(auth)/pending-approval");
        }
      } else if (status === "rejected") {
        if (segList[1] !== "rejected") {
          router.replace("/(auth)/rejected");
        }
      } else if (status === "suspended") {
        if (segList[1] !== "suspended") {
          router.replace("/(auth)/suspended");
        }
      } else if (status === "verified") {
        if (inAuthGroup) {
          router.replace("/(tabs)");
        }
      }
    }
  }, [firebaseUser, userProfile, isLoading, isAuthLoading, isProfileLoading, segments, router, rootNavigationState?.key]);

  // 3. Fullscreen honest configuration error if Firebase is not configured
  if (!isFirebaseConfigured || configError) {
    return (
      <View style={styles.errorContainer}>
        <StatusBar style="dark" />
        <View style={styles.errorCard}>
          <ShieldAlert size={56} color="#dc2626" />
          <Text style={styles.errorTitle}>Firebase Configuration Missing</Text>
          <Text style={styles.errorDescription}>
            ResolveX does not use simulated, mock, or fake demo fallbacks in production.
          </Text>
          <View style={styles.errorDetailsBox}>
            <Text style={styles.errorDetailsText}>{configError}</Text>
          </View>
          <Text style={styles.errorFooter}>
            Please configure apps/mobile/.env with valid project credentials from resolvex-community and restart Expo.
          </Text>
        </View>
      </View>
    );
  }

  // 4. Mount root Stack navigator with explicit screens
  return (
    <View style={styles.rootContainer}>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: "#f8fafc"
  },
  errorContainer: {
    flex: 1,
    backgroundColor: "#fef2f2",
    justifyContent: "center",
    alignItems: "center",
    padding: 24
  },
  errorCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#fecaca",
    maxWidth: 420,
    width: "100%"
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#991b1b",
    marginTop: 14,
    textAlign: "center"
  },
  errorDescription: {
    fontSize: 12,
    color: colors.muted,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 18
  },
  errorDetailsBox: {
    backgroundColor: "#fff1f2",
    borderRadius: 10,
    padding: 12,
    marginVertical: 14,
    borderWidth: 1,
    borderColor: "#fecdd3",
    width: "100%"
  },
  errorDetailsText: {
    fontSize: 11,
    color: "#b91c1c",
    lineHeight: 16,
    fontFamily: "monospace"
  },
  errorFooter: {
    fontSize: 11,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 16
  }
});
