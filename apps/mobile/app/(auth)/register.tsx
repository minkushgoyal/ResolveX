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
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CheckCircle,
  Home,
  Lock,
  Mail,
  Phone,
  Shield,
  ShieldCheck,
  User,
  Wrench
} from "lucide-react-native";
import type { HouseholdRole, StaffDepartment } from "@resolvex/types";
import { verifiedSocieties } from "@resolvex/utils";
import { colors } from "../../components/mobile-ui";
import { mobileRegister } from "../../lib/auth-service";

type PrimaryRole = "resident" | "maintenance_staff" | "security_guard";
type ResidentSubType = "resident" | "flat_owner" | "tenant";

interface SpecializationOption {
  id: string;
  label: string;
  department: StaffDepartment;
}

const SPECIALIZATIONS: SpecializationOption[] = [
  { id: "Plumber", label: "Plumber", department: "plumbing" },
  { id: "Electrician", label: "Electrician", department: "electrical" },
  { id: "Carpenter", label: "Carpenter", department: "carpentry" },
  { id: "Painter", label: "Painter", department: "general_maintenance" },
  { id: "Housekeeping / Cleaning", label: "Housekeeping / Cleaning", department: "housekeeping" },
  { id: "Lift / Elevator Technician", label: "Lift / Elevator Technician", department: "lift" },
  { id: "HVAC / AC Technician", label: "HVAC / AC Technician", department: "electrical" },
  { id: "Gardener", label: "Gardener", department: "gardening" },
  { id: "General Maintenance", label: "General Maintenance", department: "general_maintenance" },
  { id: "Other", label: "Other", department: "other" }
];

const GUARD_GATES = [
  "Main Gate (Gate 1)",
  "North Gate (Gate 2)",
  "Service & Delivery Gate",
  "Perimeter Patrol"
];

const GUARD_SHIFTS = [
  "Day Shift (08:00 AM – 08:00 PM)",
  "Night Shift (08:00 PM – 08:00 AM)",
  "Rotational Shift"
];

export default function RegisterScreen() {
  const router = useRouter();

  // Role Selection
  const [primaryRole, setPrimaryRole] = useState<PrimaryRole>("resident");
  const [residentSubType, setResidentSubType] = useState<ResidentSubType>("resident");
  const [householdRole, setHouseholdRole] = useState<HouseholdRole>("family_member");

  // Maintenance Staff Specialization
  const [selectedSpecialization, setSelectedSpecialization] = useState<string>("Electrician");
  const [customSpecialization, setCustomSpecialization] = useState<string>("");

  // Security Guard Duty Post & Shift
  const [selectedGate, setSelectedGate] = useState<string>(GUARD_GATES[0]);
  const [selectedShift, setSelectedShift] = useState<string>(GUARD_SHIFTS[0]);

  // Personal Information
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Society & Hierarchy
  const [selectedSocietyId, setSelectedSocietyId] = useState(verifiedSocieties[0]?.id || "soc-ajanta-genx");
  const currentSociety = verifiedSocieties.find((s) => s.id === selectedSocietyId) || verifiedSocieties[0];
  const [selectedTowerId, setSelectedTowerId] = useState(currentSociety?.towers[0]?.id || "tower-a");
  const [flatNumber, setFlatNumber] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isResident = primaryRole === "resident";
  const isStaff = primaryRole === "maintenance_staff";
  const isGuard = primaryRole === "security_guard";

  async function handleRegister() {
    setErrorMessage(null);

    if (!fullName.trim()) {
      setErrorMessage("Please enter your full name.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }
    if (!phone.trim() || phone.length < 10) {
      setErrorMessage("Please enter a valid phone number (at least 10 digits).");
      return;
    }

    if (isResident && (!flatNumber.trim() || flatNumber.length < 2)) {
      setErrorMessage("Please enter your flat or unit number (e.g. A-1204).");
      return;
    }

    if (isStaff && selectedSpecialization === "Other" && !customSpecialization.trim()) {
      setErrorMessage("Please specify your maintenance trade or specialization.");
      return;
    }

    if (!password || password.length < 6) {
      setErrorMessage("Password must be at least 6 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      const specObj = SPECIALIZATIONS.find((s) => s.id === selectedSpecialization);
      const resolvedDepartment = isStaff
        ? (specObj?.department || "general_maintenance")
        : isGuard
        ? "security"
        : undefined;

      const finalSpecialization = isStaff
        ? (selectedSpecialization === "Other" ? customSpecialization.trim() : selectedSpecialization)
        : undefined;

      await mobileRegister({
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
        role: isResident ? residentSubType : primaryRole,
        householdRole: isResident ? householdRole : undefined,
        societyId: selectedSocietyId,
        towerId: isResident ? selectedTowerId : undefined,
        flatNumber: isResident ? flatNumber.trim().toUpperCase() : undefined,
        department: resolvedDepartment,
        specialization: finalSpecialization,
        gate: isGuard ? selectedGate : undefined,
        shift: isGuard ? selectedShift : undefined
      });

      router.replace("/(auth)/pending-approval");
    } catch (err: any) {
      setErrorMessage(err.message || "Registration failed. Please check your information and try again.");
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
        {/* Back Link */}
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={18} color={colors.primary} />
          <Text style={styles.backBtnText}>Back to Sign In</Text>
        </Pressable>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.pageTitle}>Create Account</Text>
          <Text style={styles.pageSubtitle}>
            Register for access to your smart society community
          </Text>
        </View>

        {/* Security Policy Notice */}
        <View style={styles.securityNoticeCard}>
          <ShieldCheck size={18} color={colors.primary} />
          <Text style={styles.securityNoticeText}>
            All registrations are initially pending and require verification by society management before access is granted.
          </Text>
        </View>

        {/* Error Banner */}
        {errorMessage && (
          <View style={styles.errorBanner}>
            <AlertCircle size={18} color="#dc2626" />
            <Text style={styles.errorBannerText}>{errorMessage}</Text>
          </View>
        )}

        <View style={styles.card}>
          {/* 1. Account Role Selection */}
          <Text style={styles.sectionHeading}>1. I am registering as:</Text>
          <View style={styles.roleGrid}>
            {[
              { id: "resident" as const, label: "Resident", icon: User },
              { id: "maintenance_staff" as const, label: "Maintenance Staff", icon: Wrench },
              { id: "security_guard" as const, label: "Security Guard", icon: Shield }
            ].map((item) => {
              const Icon = item.icon;
              const isSelected = primaryRole === item.id;
              return (
                <Pressable
                  key={item.id}
                  style={[styles.roleOption, isSelected && styles.roleOptionActive]}
                  onPress={() => {
                    setPrimaryRole(item.id);
                  }}
                >
                  <Icon size={16} color={isSelected ? colors.primary : colors.muted} />
                  <Text style={[styles.roleOptionText, isSelected && styles.roleOptionTextActive]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Sub-role options for Resident */}
          {isResident && (
            <View style={{ marginTop: 12 }}>
              <Text style={styles.subRoleHeading}>Select Resident Category:</Text>
              <View style={styles.chipRow}>
                {[
                  { id: "resident" as const, label: "Resident / Family", householdRole: "family_member" as const },
                  { id: "flat_owner" as const, label: "Flat Owner", householdRole: "owner" as const },
                  { id: "tenant" as const, label: "Tenant", householdRole: "tenant" as const }
                ].map((item) => {
                  const isSelected = residentSubType === item.id;
                  return (
                    <Pressable
                      key={item.id}
                      style={[styles.chip, isSelected && styles.chipActive]}
                      onPress={() => {
                        setResidentSubType(item.id);
                        setHouseholdRole(item.householdRole);
                      }}
                    >
                      <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* 2. Personal Information */}
          <Text style={[styles.sectionHeading, { marginTop: 22 }]}>2. Personal Details</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Full Name</Text>
            <TextInput
              style={styles.textInput}
              placeholder={isStaff ? "e.g. Vikas Kumar" : isGuard ? "e.g. Rajesh Singh" : "e.g. Priya Sharma"}
              placeholderTextColor={colors.muted}
              value={fullName}
              onChangeText={setFullName}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email Address</Text>
            <TextInput
              style={styles.textInput}
              placeholder="name@example.com"
              placeholderTextColor={colors.muted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Mobile Phone Number</Text>
            <TextInput
              style={styles.textInput}
              placeholder="+91 98765 43210"
              placeholderTextColor={colors.muted}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          </View>

          {/* 3. Role-Specific Details */}
          {isResident ? (
            <>
              <Text style={[styles.sectionHeading, { marginTop: 22 }]}>3. Residence & Flat</Text>

              {/* Society Selector */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Society</Text>
                <View style={styles.chipRow}>
                  {verifiedSocieties.map((soc) => (
                    <Pressable
                      key={soc.id}
                      style={[styles.chip, selectedSocietyId === soc.id && styles.chipActive]}
                      onPress={() => {
                        setSelectedSocietyId(soc.id);
                        if (soc.towers[0]) setSelectedTowerId(soc.towers[0].id);
                      }}
                    >
                      <Text style={[styles.chipText, selectedSocietyId === soc.id && styles.chipTextActive]}>
                        {soc.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Tower Selector */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Tower / Wing</Text>
                <View style={styles.chipRow}>
                  {currentSociety?.towers.map((tow) => (
                    <Pressable
                      key={tow.id}
                      style={[styles.chip, selectedTowerId === tow.id && styles.chipActive]}
                      onPress={() => setSelectedTowerId(tow.id)}
                    >
                      <Text style={[styles.chipText, selectedTowerId === tow.id && styles.chipTextActive]}>
                        {tow.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Flat Number */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Flat / Unit Number</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder={currentSociety?.flatFormatDescription || "e.g. A-1204"}
                  placeholderTextColor={colors.muted}
                  value={flatNumber}
                  onChangeText={setFlatNumber}
                  autoCapitalize="characters"
                />
              </View>

              {/* Household Relationship (for general resident) */}
              {residentSubType === "resident" && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Relationship to Household</Text>
                  <View style={styles.chipRow}>
                    {[
                      { id: "family_member" as const, label: "Family Member" },
                      { id: "co_owner" as const, label: "Co-Owner" },
                      { id: "relative" as const, label: "Relative" }
                    ].map((hr) => (
                      <Pressable
                        key={hr.id}
                        style={[styles.chip, householdRole === hr.id && styles.chipActive]}
                        onPress={() => setHouseholdRole(hr.id)}
                      >
                        <Text style={[styles.chipText, householdRole === hr.id && styles.chipTextActive]}>
                          {hr.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}
            </>
          ) : isStaff ? (
            <>
              <Text style={[styles.sectionHeading, { marginTop: 22 }]}>3. Maintenance Specialization</Text>

              {/* Society Selector */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Society</Text>
                <View style={styles.chipRow}>
                  {verifiedSocieties.map((soc) => (
                    <Pressable
                      key={soc.id}
                      style={[styles.chip, selectedSocietyId === soc.id && styles.chipActive]}
                      onPress={() => setSelectedSocietyId(soc.id)}
                    >
                      <Text style={[styles.chipText, selectedSocietyId === soc.id && styles.chipTextActive]}>
                        {soc.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Specialization Trade Selector */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Select Your Trade / Specialization</Text>
                <View style={styles.chipRow}>
                  {SPECIALIZATIONS.map((spec) => {
                    const isSelected = selectedSpecialization === spec.id;
                    return (
                      <Pressable
                        key={spec.id}
                        style={[styles.chip, isSelected && styles.chipActive]}
                        onPress={() => setSelectedSpecialization(spec.id)}
                      >
                        <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                          {spec.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Custom Specialization if "Other" is chosen */}
              {selectedSpecialization === "Other" && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Specify Trade / Specialization</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g. Masonry, Welder, Glass Technician"
                    placeholderTextColor={colors.muted}
                    value={customSpecialization}
                    onChangeText={setCustomSpecialization}
                  />
                </View>
              )}

              <View style={styles.infoBox}>
                <Wrench size={15} color={colors.primary} />
                <Text style={styles.infoBoxText}>
                  Your trade specialization will be registered with Society Management for task dispatches. Management assigns work orders based on your verified trade.
                </Text>
              </View>
            </>
          ) : (
            <>
              <Text style={[styles.sectionHeading, { marginTop: 22 }]}>3. Security Guard Duty Roster</Text>

              {/* Society Selector */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Society</Text>
                <View style={styles.chipRow}>
                  {verifiedSocieties.map((soc) => (
                    <Pressable
                      key={soc.id}
                      style={[styles.chip, selectedSocietyId === soc.id && styles.chipActive]}
                      onPress={() => setSelectedSocietyId(soc.id)}
                    >
                      <Text style={[styles.chipText, selectedSocietyId === soc.id && styles.chipTextActive]}>
                        {soc.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Gate / Duty Post */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Gate / Duty Post</Text>
                <View style={styles.chipRow}>
                  {GUARD_GATES.map((gate) => {
                    const isSelected = selectedGate === gate;
                    return (
                      <Pressable
                        key={gate}
                        style={[styles.chip, isSelected && styles.chipActive]}
                        onPress={() => setSelectedGate(gate)}
                      >
                        <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                          {gate}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Duty Shift */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Preferred Duty Shift</Text>
                <View style={styles.chipRow}>
                  {GUARD_SHIFTS.map((shift) => {
                    const isSelected = selectedShift === shift;
                    return (
                      <Pressable
                        key={shift}
                        style={[styles.chip, isSelected && styles.chipActive]}
                        onPress={() => setSelectedShift(shift)}
                      >
                        <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                          {shift}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.infoBox}>
                <Shield size={15} color={colors.primary} />
                <Text style={styles.infoBoxText}>
                  Your guard registration will be routed to Society Management for verification. Once approved, you will have exclusive access to Gate Desk, Visitor passes, and Delivery logs.
                </Text>
              </View>
            </>
          )}

          {/* 4. Password */}
          <Text style={[styles.sectionHeading, { marginTop: 22 }]}>4. Security Credentials</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Password</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Minimum 6 characters"
              placeholderTextColor={colors.muted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Confirm Password</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Re-enter password"
              placeholderTextColor={colors.muted}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          {/* Submit Button */}
          <Pressable
            style={[styles.submitBtn, isLoading && styles.submitBtnDisabled]}
            onPress={handleRegister}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.submitBtnText}>Submit Registration Request</Text>
            )}
          </Pressable>
        </View>

        <View style={{ height: 40 }} />
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
    padding: 20,
    paddingTop: Platform.OS === "ios" ? 54 : 32
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 16
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary
  },
  header: {
    marginBottom: 16
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: colors.text
  },
  pageSubtitle: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 4
  },
  securityNoticeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#e0e7ff",
    borderColor: "#c7d2fe",
    borderWidth: 1,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16
  },
  securityNoticeText: {
    flex: 1,
    fontSize: 12,
    color: colors.primary,
    fontWeight: "600",
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
    fontWeight: "600"
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0"
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.text,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10
  },
  subRoleHeading: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.muted,
    marginBottom: 6
  },
  roleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  roleOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8
  },
  roleOptionActive: {
    backgroundColor: "#e0e7ff",
    borderColor: colors.primary
  },
  roleOptionText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.text
  },
  roleOptionTextActive: {
    color: colors.primary,
    fontWeight: "800"
  },
  inputGroup: {
    marginBottom: 14
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 6
  },
  textInput: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 14,
    color: colors.text
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#cbd5e1"
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.text
  },
  chipTextActive: {
    color: "#ffffff"
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    borderRadius: 8,
    padding: 10,
    marginBottom: 14
  },
  infoBoxText: {
    flex: 1,
    fontSize: 11,
    color: "#166534",
    lineHeight: 15
  },
  submitBtn: {
    backgroundColor: colors.primary,
    height: 48,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16
  },
  submitBtnDisabled: {
    opacity: 0.7
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#ffffff"
  }
});
