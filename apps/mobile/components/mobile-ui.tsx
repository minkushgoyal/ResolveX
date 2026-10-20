import type { ReactNode } from "react";
import { Alert, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { normalizeComplaintStatus } from "@resolvex/utils";
import type { ComplaintStatus } from "@resolvex/types";
import { LogOut, X } from "lucide-react-native";
import { useRouter } from "expo-router";
import { mobileSignOut } from "../lib/auth-service";

export const colors = {
  bg: "#f8fafc",
  card: "#ffffff",
  text: "#0f172a",
  muted: "#64748b",
  border: "#e2e8f0",
  primary: "#4338ca",
  primaryLight: "#e0e7ff",
  secondary: "#0f766e",
  secondaryLight: "#ccfbf1",
  accent: "#ea580c",
  accentLight: "#ffedd5",
  danger: "#dc2626",
  dangerLight: "#fee2e2",
  success: "#16a34a",
  successLight: "#dcfce7",
  surface: "#f1f5f9"
};

export function Screen({ children }: { children: ReactNode }) {
  return <View style={styles.screen}>{children}</View>;
}

export function Card({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Muted({ children, style }: { children: ReactNode; style?: object }) {
  return <Text style={[styles.muted, style]}>{children}</Text>;
}

export function Pill({
  children,
  tone = "primary"
}: {
  children: ReactNode;
  tone?: "primary" | "secondary" | "accent" | "success" | "danger";
}) {
  return (
    <View style={[styles.pill, { backgroundColor: `${colors[tone]}18` }]}>
      <Text style={[styles.pillText, { color: colors[tone] }]}>{children}</Text>
    </View>
  );
}

export function ActionButton({
  children,
  onPress,
  variant = "primary",
  disabled = false,
  style
}: {
  children: ReactNode;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "outline" | "danger" | "success";
  disabled?: boolean;
  style?: object;
}) {
  const getBackgroundColor = () => {
    if (disabled) return "#cbd5e1";
    switch (variant) {
      case "primary":
        return colors.primary;
      case "secondary":
        return colors.surface;
      case "outline":
        return "transparent";
      case "danger":
        return colors.danger;
      case "success":
        return colors.success;
      default:
        return colors.primary;
    }
  };

  const getTextColor = () => {
    if (disabled) return "#94a3b8";
    if (variant === "secondary") return colors.text;
    if (variant === "outline") return colors.primary;
    return "#ffffff";
  };

  return (
    <Pressable
      style={[
        styles.button,
        { backgroundColor: getBackgroundColor() },
        variant === "outline" && { borderWidth: 1, borderColor: colors.primary },
        style
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[styles.buttonText, { color: getTextColor() }]}>{children}</Text>
    </Pressable>
  );
}

/**
 * Maps any complaint status to canonical Phase 5C human-readable label and tone
 */
export function getCanonicalStatusInfo(status: ComplaintStatus | string): {
  label: string;
  tone: "primary" | "secondary" | "accent" | "success" | "danger";
} {
  const canonical = normalizeComplaintStatus(status);
  switch (canonical) {
    case "open":
      return { label: "Submitted", tone: "primary" };
    case "assigned":
      return { label: "Assigned", tone: "secondary" };
    case "in_progress":
      return { label: "In Progress", tone: "primary" };
    case "resident_confirmation":
      return { label: "Resolution Verification", tone: "accent" };
    case "closed":
      return { label: "Resolved & Closed", tone: "success" };
    case "reopened":
      return { label: "Reopened", tone: "danger" };
    default:
      return { label: "Submitted", tone: "primary" };
  }
}

export function StatusBadge({ status }: { status: ComplaintStatus | string }) {
  const { label, tone } = getCanonicalStatusInfo(status);
  return <Pill tone={tone}>{label}</Pill>;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction
}: {
  icon?: any;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <Card style={styles.emptyStateContainer}>
      {Icon && (
        <View style={styles.emptyIconBox}>
          <Icon size={28} color={colors.muted} />
        </View>
      )}
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDesc}>{description}</Text>
      {actionLabel && onAction && (
        <Pressable style={styles.emptyAction} onPress={onAction}>
          <Text style={styles.emptyActionText}>{actionLabel}</Text>
        </Pressable>
      )}
    </Card>
  );
}

export function TimelineStep({
  number,
  title,
  subtitle,
  completed,
  active,
  isLast = false
}: {
  number: number;
  title: string;
  subtitle?: string;
  completed: boolean;
  active: boolean;
  isLast?: boolean;
}) {
  return (
    <View style={styles.timelineRow}>
      <View style={styles.timelineIndicatorColumn}>
        <View
          style={[
            styles.timelineDot,
            completed && styles.timelineDotCompleted,
            active && styles.timelineDotActive
          ]}
        >
          <Text
            style={[
              styles.timelineDotText,
              (completed || active) && styles.timelineDotTextActive
            ]}
          >
            {completed ? "✓" : number}
          </Text>
        </View>
        {!isLast && (
          <View
            style={[
              styles.timelineLine,
              completed && styles.timelineLineCompleted
            ]}
          />
        )}
      </View>
      <View style={styles.timelineContent}>
        <Text style={[styles.timelineTitle, active && styles.timelineTitleActive]}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.timelineSubtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

export function ModalSheet({
  visible,
  onClose,
  title,
  subtitle,
  children
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheetContent}>
          <View style={styles.modalSheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalSheetTitle}>{title}</Text>
              {subtitle ? <Text style={styles.modalSheetSubtitle}>{subtitle}</Text> : null}
            </View>
            <Pressable onPress={onClose} style={styles.modalCloseButton} hitSlop={10}>
              <X size={20} color={colors.text} />
            </Pressable>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

export function LogoutButton({
  style,
  label = "Log Out"
}: {
  style?: object;
  label?: string;
}) {
  const router = useRouter();

  function handleLogoutPress() {
    Alert.alert(
      "Log Out",
      "Are you sure you want to log out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log Out",
          style: "destructive",
          onPress: async () => {
            try {
              await mobileSignOut();
              router.replace("/(auth)/login");
            } catch (err: any) {
              Alert.alert("Logout Error", err?.message || "Failed to log out.");
            }
          }
        }
      ]
    );
  }

  return (
    <Pressable
      style={({ pressed }) => [
        styles.logoutBtn,
        pressed && styles.logoutBtnPressed,
        style
      ]}
      onPress={handleLogoutPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.logoutIconCircle}>
        <LogOut size={18} color={colors.danger} />
      </View>
      <Text style={styles.logoutBtnText}>{label}</Text>
    </Pressable>
  );
}

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: 16,
    paddingTop: 52
  },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.3
  },
  muted: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18
  },
  pill: {
    alignSelf: "flex-start",
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4
  },
  pillText: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.3
  },
  button: {
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: colors.primary,
    paddingHorizontal: 16
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700"
  },
  emptyStateContainer: {
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 12
  },
  emptyIconBox: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center"
  },
  emptyDesc: {
    fontSize: 12,
    color: colors.muted,
    textAlign: "center",
    marginTop: 4,
    lineHeight: 18,
    maxWidth: 260
  },
  emptyAction: {
    marginTop: 14,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: colors.surface
  },
  emptyActionText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary
  },
  timelineRow: {
    flexDirection: "row",
    gap: 12,
    minHeight: 46
  },
  timelineIndicatorColumn: {
    alignItems: "center",
    width: 26
  },
  timelineDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center"
  },
  timelineDotActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight
  },
  timelineDotCompleted: {
    borderColor: colors.success,
    backgroundColor: colors.success
  },
  timelineDotText: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.muted
  },
  timelineDotTextActive: {
    color: colors.primary
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: colors.border,
    marginVertical: 3
  },
  timelineLineCompleted: {
    backgroundColor: colors.success
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 14
  },
  timelineTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.muted
  },
  timelineTitleActive: {
    color: colors.text,
    fontWeight: "800"
  },
  timelineSubtitle: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15, 23, 42, 0.65)"
  },
  modalSheetContent: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
    maxHeight: "90%"
  },
  modalSheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 12
  },
  modalSheetTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: colors.text
  },
  modalSheetSubtitle: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2
  },
  modalCloseButton: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: colors.surface
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#fef2f2",
    borderWidth: 1.5,
    borderColor: "#fecaca",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    width: "100%"
  },
  logoutBtnPressed: {
    backgroundColor: "#fee2e2",
    opacity: 0.9
  },
  logoutIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#fee2e2",
    alignItems: "center",
    justifyContent: "center"
  },
  logoutBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.danger
  }
});
