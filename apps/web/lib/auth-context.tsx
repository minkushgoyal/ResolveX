"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import type { PlatformRole, UserProfile } from "@resolvex/types";
import { isFirebaseConfigured } from "./firebase";
import {
  registerWithHouseholdValidation,
  reloadCurrentUser,
  resendVerificationEmail,
  sendPasswordReset as apiSendPasswordReset,
  signInWithEmail as apiSignInWithEmail,
  signInWithGoogle as apiSignInWithGoogle,
  signOutUser as apiSignOutUser,
  signUpWithEmail as apiSignUpWithEmail,
  subscribeToAuth,
  type RegisterParams
} from "./services/auth-service";
import { useSessionStore } from "./store";

interface AuthContextValue {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  error: string | null;
  activeRole: PlatformRole;
  isFirebaseConfigured: boolean;
  isEmailVerified: boolean;
  signIn: (email: string, pass: string) => Promise<UserProfile>;
  signUp: (email: string, pass: string, extra: Partial<UserProfile>) => Promise<UserProfile>;
  register: (params: RegisterParams) => Promise<UserProfile>;
  signInGoogle: () => Promise<{ profile: UserProfile; needsOnboarding: boolean }>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  reloadUser: () => Promise<boolean>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { activeRole, setActiveRole } = useSessionStore();

  // One-time cleanup of any legacy demo persona state in browser storage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("resolvex_active_mock_user");
        localStorage.removeItem("resolvex_active_persona");
        localStorage.removeItem("resolvex_demo_persona");
        localStorage.removeItem("activePersona");
        localStorage.removeItem("demoPersona");
        sessionStorage.removeItem("resolvex_active_mock_user");
        sessionStorage.removeItem("resolvex_active_persona");
        sessionStorage.removeItem("resolvex_demo_persona");
        sessionStorage.removeItem("activePersona");
        sessionStorage.removeItem("demoPersona");
      } catch {
        // ignore
      }
    }
  }, []);

  // Listen to single source of truth: Firebase Auth currentUser -> Firestore users/{uid}
  useEffect(() => {
    const unsubscribe = subscribeToAuth((firebaseUser, profile) => {
      setUser(firebaseUser);
      setUserProfile(profile);
      setLoading(false);

      if (profile) {
        // Automatically set active role directly from real Firestore profile
        setActiveRole(profile.role);
      }
    });

    return () => unsubscribe();
  }, [setActiveRole]);

  const handleSignIn = async (email: string, pass: string): Promise<UserProfile> => {
    setError(null);
    setLoading(true);
    try {
      const profile = await apiSignInWithEmail(email, pass);
      setUserProfile(profile);
      setActiveRole(profile.role);
      return profile;
    } catch (err: any) {
      const msg = err?.message || "Failed to sign in. Please verify your credentials.";
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (email: string, pass: string, extra: Partial<UserProfile>): Promise<UserProfile> => {
    setError(null);
    setLoading(true);
    try {
      const profile = await apiSignUpWithEmail(email, pass, extra);
      setUserProfile(profile);
      setActiveRole(profile.role);
      return profile;
    } catch (err: any) {
      const msg = err?.message || "Failed to create account. Please check your details.";
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (params: RegisterParams): Promise<UserProfile> => {
    setError(null);
    setLoading(true);
    try {
      const profile = await registerWithHouseholdValidation(params);
      setUserProfile(profile);
      setActiveRole(profile.role);
      return profile;
    } catch (err: any) {
      const msg = err?.message || "Registration failed. Please check your inputs.";
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSignInGoogle = async (): Promise<{ profile: UserProfile; needsOnboarding: boolean }> => {
    setError(null);
    setLoading(true);
    try {
      const result = await apiSignInWithGoogle();
      setUserProfile(result.profile);
      setActiveRole(result.profile.role);
      return result;
    } catch (err: any) {
      const msg = err?.message || "Google sign-in was cancelled or encountered an error.";
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSendPasswordReset = async (email: string): Promise<void> => {
    setError(null);
    try {
      await apiSendPasswordReset(email);
    } catch (err: any) {
      const msg = err?.message || "Could not send password reset email.";
      setError(msg);
      throw new Error(msg);
    }
  };

  const handleResendVerification = async (): Promise<void> => {
    setError(null);
    try {
      await resendVerificationEmail();
    } catch (err: any) {
      const msg = err?.message || "Could not resend verification email.";
      setError(msg);
      throw new Error(msg);
    }
  };

  const handleReloadUser = async (): Promise<boolean> => {
    try {
      const verified = await reloadCurrentUser();
      if (userProfile) {
        setUserProfile({ ...userProfile, emailVerified: verified });
      }
      return verified;
    } catch (err) {
      console.warn("Could not reload user:", err);
      return false;
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await apiSignOutUser();
      setUser(null);
      setUserProfile(null);
      setActiveRole("resident");
    } catch (err: any) {
      console.error("Sign out error:", err);
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => setError(null);

  const isEmailVerified = Boolean(user?.emailVerified || userProfile?.emailVerified);

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        error,
        activeRole,
        isFirebaseConfigured,
        isEmailVerified,
        signIn: handleSignIn,
        signUp: handleSignUp,
        register: handleRegister,
        signInGoogle: handleSignInGoogle,
        signOut: handleSignOut,
        sendPasswordReset: handleSendPasswordReset,
        resendVerification: handleResendVerification,
        reloadUser: handleReloadUser,
        clearError
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
