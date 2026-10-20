import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import type { PlatformRole, StaffAvailability, UserProfile } from "@resolvex/types";
import type { User } from "firebase/auth";
import { getFirebaseConfigError, isFirebaseConfigured } from "./firebase";

const CACHED_PROFILE_KEY = "@resolvex:cached_user_profile";

export async function getCachedProfile(): Promise<UserProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHED_PROFILE_KEY);
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch (err) {
    console.warn("[SessionStore] Failed to read cached profile:", err);
    return null;
  }
}

export async function saveCachedProfile(profile: UserProfile): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHED_PROFILE_KEY, JSON.stringify(profile));
  } catch (err) {
    console.warn("[SessionStore] Failed to persist profile to AsyncStorage:", err);
  }
}

export async function clearCachedProfile(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CACHED_PROFILE_KEY);
  } catch (err) {
    console.warn("[SessionStore] Failed to clear cached profile:", err);
  }
}

interface MobileSessionState {
  firebaseUser: User | null;
  userProfile: UserProfile | null;
  isLoading: boolean;
  isAuthLoading: boolean;
  isProfileLoading: boolean;
  isConfigured: boolean;
  configError: string | null;
  dutyStatus: StaffAvailability;
  societyId: string;
  activeStaffId: string;

  // Setters
  setSession: (user: User | null, profile: UserProfile | null) => void;
  setProfileNotFound: (user: User | null) => void;
  setCachedProfile: (profile: UserProfile) => void;
  setDutyStatus: (status: StaffAvailability) => void;
  setLoading: (loading: boolean) => void;
  clearSession: () => void;
}

export const useMobileSessionStore = create<MobileSessionState>((set) => ({
  firebaseUser: null,
  userProfile: null,
  isLoading: true,
  isAuthLoading: true,
  isProfileLoading: false,
  isConfigured: isFirebaseConfigured,
  configError: getFirebaseConfigError(),
  dutyStatus: "on_duty",
  societyId: "soc-ajanta-genx",
  activeStaffId: "",

  setSession: (user, profile) => {
    if (profile) {
      saveCachedProfile(profile);
    } else if (!user) {
      clearCachedProfile();
    }
    const isProfileLoading = Boolean(user && !profile);
    const resolvedDuty: StaffAvailability = (profile as any)?.availabilityStatus || "on_duty";
    console.log(`[SESSION STORE SET SESSION] uid=${user?.uid} role=${profile?.role} dutyStatus=${resolvedDuty}`);
    set({
      firebaseUser: user,
      userProfile: profile,
      societyId: profile?.societyId || "soc-ajanta-genx",
      activeStaffId: user?.uid || "",
      dutyStatus: resolvedDuty,
      isAuthLoading: false,
      isProfileLoading,
      isLoading: isProfileLoading
    });
  },

  setProfileNotFound: (user) => {
    set({
      firebaseUser: user,
      userProfile: null,
      isAuthLoading: false,
      isProfileLoading: false,
      isLoading: false
    });
  },

  setCachedProfile: (profile) => {
    set((state) => {
      const resolvedDuty: StaffAvailability = (profile as any)?.availabilityStatus || state.dutyStatus;
      return {
        userProfile: profile,
        societyId: profile.societyId || state.societyId,
        dutyStatus: resolvedDuty
      };
    });
  },

  setDutyStatus: (status) =>
    set((state) => ({
      dutyStatus: status,
      userProfile: state.userProfile
        ? { ...state.userProfile, availabilityStatus: status }
        : null
    })),

  setLoading: (loading) => set({ isLoading: loading }),

  clearSession: () => {
    clearCachedProfile();
    set({
      firebaseUser: null,
      userProfile: null,
      activeStaffId: "",
      dutyStatus: "on_duty",
      isAuthLoading: false,
      isProfileLoading: false,
      isLoading: false
    });
  }
}));

/**
 * Convenience selector hooks
 */
export function useActiveRole(): PlatformRole | null {
  return useMobileSessionStore((s) => s.userProfile?.role || null);
}

export function useIsMaintenanceStaff(): boolean {
  return useMobileSessionStore((s) => s.userProfile?.role === "maintenance_staff");
}

export function useIsSecurityGuard(): boolean {
  return useMobileSessionStore((s) => s.userProfile?.role === "security_guard");
}

export function useIsResident(): boolean {
  return useMobileSessionStore((s) => {
    const role = s.userProfile?.role;
    return role === "resident" || role === "flat_owner" || role === "tenant";
  });
}
