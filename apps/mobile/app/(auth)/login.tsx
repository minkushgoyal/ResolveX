import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useRouter } from "expo-router";
import { AlertCircle, ArrowRight, Building2, KeyRound, Lock, Mail, ShieldCheck } from "lucide-react-native";
import { colors } from "../../components/mobile-ui";
import { mobileSignIn } from "../../lib/auth-service";
import { useMobileSessionStore } from "../../lib/session-store";

export default function LoginScreen() {
  console.log("[STARTUP 8] Initial route rendered: (auth)/login");
  const router = useRouter();
  const configError = useMobileSessionStore((s) => s.configError);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleLogin() {
    setErrorMessage(null);
    if (!email.trim()) {
      setErrorMessage("Please enter your registered email address.");
      return;
    }
    if (!password) {
      setErrorMessage("Please enter your password.");
      return;
    }

    setIsLoading(true);
    try {
      const profile = await mobileSignIn(email, password);
      console.log(`[AUTH NAVIGATING] role=${profile.role} status=${profile.status} societyId=${profile.societyId}`);
      if (profile.status === "pending" || profile.status === "pending_verification") {
        router.replace("/(auth)/pending-approval");
      } else if (profile.status === "rejected") {
        router.replace("/(auth)/rejected");
      } else if (profile.status === "suspended") {
        router.replace("/(auth)/suspended");
      } else {
        router.replace("/(tabs)");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to sign in. Please verify your credentials.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* App Logo & Header */}
        <View style={styles.header}>
          <View style={styles.logoBadge}>
            <Building2 size={36} color={colors.primary} />
          </View>
          <Text style={styles.brandTitle}>ResolveX</Text>
          <Text style={styles.brandSubtitle}>Smart Society & Community Management</Text>
          <View style={styles.liveProjectPill}>
            <ShieldCheck size={12} color={colors.secondary} />
            <Text style={styles.liveProjectText}>LIVE · resolvex-community</Text>
          </View>
        </View>

        {/* Configuration Error Banner */}
        {configError && (
          <View style={styles.configErrorBanner}>
            <AlertCircle size={18} color="#dc2626" />
            <Text style={styles.configErrorText}>{configError}</Text>
          </View>
        )}

        {/* Error Banner */}
        {errorMessage && (
          <View style={styles.errorBanner}>
            <AlertCircle size={18} color="#dc2626" />
            <Text style={styles.errorBannerText}>{errorMessage}</Text>
          </View>
        )}

        {/* Login Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sign In to Your Account</Text>
          <Text style={styles.cardSubtitle}>
            Residents, Owners, Staff, and Security Guards sign in here.
          </Text>

          {/* Email Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email Address</Text>
            <View style={styles.inputContainer}>
              <Mail size={18} color={colors.muted} style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                placeholder="name@example.com"
                placeholderTextColor={colors.muted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Password Input */}
          <View style={styles.inputGroup}>
            <View style={styles.passwordHeader}>
              <Text style={styles.inputLabel}>Password</Text>
              <Pressable onPress={() => router.push("/(auth)/forgot-password")}>
                <Text style={styles.forgotPasswordText}>Forgot password?</Text>
              </Pressable>
            </View>
            <View style={styles.inputContainer}>
              <Lock size={18} color={colors.muted} style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                placeholder="••••••••"
                placeholderTextColor={colors.muted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* Sign In Button */}
          <Pressable
            style={[styles.loginBtn, isLoading && styles.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <>
                <Text style={styles.loginBtnText}>Sign In</Text>
                <ArrowRight size={18} color="#ffffff" />
              </>
            )}
          </Pressable>
        </View>

        {/* Register Navigation Card */}
        <View style={styles.registerCard}>
          <Text style={styles.registerText}>Don&apos;t have an account yet?</Text>
          <Pressable
            style={styles.registerBtn}
            onPress={() => router.push("/(auth)/register")}
          >
            <Text style={styles.registerBtnText}>Register for Society Access</Text>
          </Pressable>
        </View>

        <Text style={styles.securityNote}>
          Role access (Resident, Technician, Security) is automatically verified from your society profile.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc"
  },
  scrollContent: {
    padding: 24,
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingBottom: 40
  },
  header: {
    alignItems: "center",
    marginBottom: 24
  },
  logoBadge: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: "#e0e7ff",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#c7d2fe"
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: colors.text,
    letterSpacing: -0.5
  },
  brandSubtitle: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 4,
    textAlign: "center"
  },
  liveProjectPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#e0f2fe",
    borderColor: "#bae6fd",
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 10
  },
  liveProjectText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.secondary
  },
  configErrorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fee2e2",
    borderColor: "#fca5a5",
    borderWidth: 1,
    padding: 12,
    borderRadius: 10,
    marginBottom: 16
  },
  configErrorText: {
    flex: 1,
    fontSize: 12,
    color: "#b91c1c",
    lineHeight: 16
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fee2e2",
    borderColor: "#fca5a5",
    borderWidth: 1,
    padding: 12,
    borderRadius: 10,
    marginBottom: 16
  },
  errorBannerText: {
    flex: 1,
    fontSize: 12,
    color: "#b91c1c",
    lineHeight: 16,
    fontWeight: "600"
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text
  },
  cardSubtitle: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 4,
    marginBottom: 18
  },
  inputGroup: {
    marginBottom: 16
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 6
  },
  passwordHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6
  },
  forgotPasswordText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: "700"
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 48
  },
  inputIcon: {
    marginRight: 10
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    height: "100%"
  },
  loginBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.primary,
    height: 50,
    borderRadius: 10,
    marginTop: 8
  },
  loginBtnDisabled: {
    opacity: 0.7
  },
  loginBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#ffffff"
  },
  registerCard: {
    marginTop: 20,
    alignItems: "center",
    gap: 8
  },
  registerText: {
    fontSize: 13,
    color: colors.muted
  },
  registerBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16
  },
  registerBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary
  },
  securityNote: {
    fontSize: 11,
    color: colors.muted,
    textAlign: "center",
    marginTop: 24,
    lineHeight: 16
  }
});
