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
import { AlertCircle, ArrowLeft, CheckCircle2, KeyRound, Mail } from "lucide-react-native";
import { colors } from "../../components/mobile-ui";
import { mobileForgotPassword } from "../../lib/auth-service";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  async function handleReset() {
    setErrorMessage(null);
    if (!email.trim() || !email.includes("@")) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    setIsLoading(true);
    try {
      await mobileForgotPassword(email);
      setIsSuccess(true);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to dispatch password reset email. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={18} color={colors.primary} />
          <Text style={styles.backBtnText}>Back to Sign In</Text>
        </Pressable>

        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <KeyRound size={36} color={colors.primary} />
          </View>

          <Text style={styles.title}>Reset Your Password</Text>
          <Text style={styles.subtitle}>
            Enter your registered email address and we will send you a password recovery link.
          </Text>

          {errorMessage && (
            <View style={styles.errorBanner}>
              <AlertCircle size={16} color="#dc2626" />
              <Text style={styles.errorBannerText}>{errorMessage}</Text>
            </View>
          )}

          {isSuccess ? (
            <View style={styles.successBox}>
              <CheckCircle2 size={32} color={colors.success} />
              <Text style={styles.successTitle}>Recovery Email Sent</Text>
              <Text style={styles.successText}>
                We have sent password reset instructions to{" "}
                <Text style={{ fontWeight: "700" }}>{email}</Text>. Please check your inbox and spam folder.
              </Text>

              <Pressable
                style={styles.returnBtn}
                onPress={() => router.replace("/(auth)/login")}
              >
                <Text style={styles.returnBtnText}>Return to Sign In</Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ width: "100%", marginTop: 16 }}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Registered Email</Text>
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

              <Pressable
                style={[styles.submitBtn, isLoading && styles.submitBtnDisabled]}
                onPress={handleReset}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>Send Recovery Link</Text>
                )}
              </Pressable>
            </View>
          )}
        </View>
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
    paddingTop: Platform.OS === "ios" ? 54 : 36
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 20
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0"
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#e0e7ff",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16
  },
  title: {
    fontSize: 20,
    fontWeight: "900",
    color: colors.text
  },
  subtitle: {
    fontSize: 13,
    color: colors.muted,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fee2e2",
    borderColor: "#fca5a5",
    borderWidth: 1,
    padding: 10,
    borderRadius: 8,
    marginTop: 14,
    width: "100%"
  },
  errorBannerText: {
    flex: 1,
    fontSize: 12,
    color: "#b91c1c",
    fontWeight: "600"
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
  submitBtn: {
    backgroundColor: colors.primary,
    height: 48,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center"
  },
  submitBtnDisabled: {
    opacity: 0.7
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#ffffff"
  },
  successBox: {
    alignItems: "center",
    gap: 10,
    marginTop: 20
  },
  successTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text
  },
  successText: {
    fontSize: 13,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 18
  },
  returnBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 10
  },
  returnBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700"
  }
});
