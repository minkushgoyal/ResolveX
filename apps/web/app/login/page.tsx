"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  Shield,
  Sparkles,
  X
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@resolvex/ui";
import { EMAIL_REGEX, mapFirebaseErrorToMessage } from "@resolvex/utils";
import { Button, Card } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const router = useRouter();
  const {
    signIn,
    signInGoogle,
    sendPasswordReset,
    isFirebaseConfigured,
    loading: authLoading,
    error: authError,
    clearError
  } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Field validation states
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Forgot password modal states
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [resetSentSuccess, setResetSentSuccess] = useState(false);

  useEffect(() => {
    clearError();
  }, []);

  const isEmailValid = EMAIL_REGEX.test(email.trim());
  const isPasswordValid = password.length >= 8;
  const isFormValid = isEmailValid && isPasswordValid;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEmailTouched(true);
    setPasswordTouched(true);
    setFormError(null);

    if (!isEmailValid) {
      setFormError("Please enter a valid email address.");
      return;
    }

    if (!isPasswordValid) {
      setFormError("Password must be at least 8 characters.");
      return;
    }

    setIsSubmitting(true);
    try {
      const profile = await signIn(email, password);
      toast.success(`Welcome back, ${profile.displayName || "Resident"}!`);
      if (!profile.societyId || !profile.flatId || !profile.onboardingCompleted) {
        router.push("/onboarding");
      } else {
        router.push("/");
      }
    } catch (err: any) {
      setFormError(err?.message || "Sign in failed. Please check your credentials.");
      toast.error(err?.message || "Authentication failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    setIsSubmitting(true);
    setFormError(null);
    try {
      const { profile, needsOnboarding } = await signInGoogle();
      toast.success(`Welcome back, ${profile.displayName || "Resident"}!`);
      if (needsOnboarding) {
        router.push("/onboarding");
      } else {
        router.push("/");
      }
    } catch (err: any) {
      setFormError(err?.message || "Google sign-in was cancelled or interrupted.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSendReset(e: React.FormEvent) {
    e.preventDefault();
    if (!resetEmail.trim() || !EMAIL_REGEX.test(resetEmail.trim())) {
      toast.error("Please enter a valid email address for password reset.");
      return;
    }

    setIsSendingReset(true);
    try {
      await sendPasswordReset(resetEmail.trim());
      setResetSentSuccess(true);
      toast.success("Password reset email sent! Check your inbox.");
    } catch (err: any) {
      toast.error(err?.message || "Could not send password reset email.");
    } finally {
      setIsSendingReset(false);
    }
  }


  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-soft">
          <Building2 size={24} />
        </div>
        <h1 className="mt-4 text-2xl font-black tracking-tight text-foreground sm:text-3xl">
          ResolveX
        </h1>
        <p className="mt-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Residential Operations & Governance Platform
        </p>

        {!isFirebaseConfigured && (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-600 border border-amber-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
            Local Reactive Fallback Active (Demo Mode)
          </div>
        )}
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <Card className="p-6 sm:p-8 shadow-sm">
            <div className="mb-6">
              <h2 className="text-xl font-black text-foreground">Sign In to ResolveX</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Enter your credentials to access your household & society dashboard
              </p>
            </div>

            {(formError || authError) && (
              <div className="mb-5 rounded-xl border border-destructive/20 bg-destructive/10 p-3.5 text-xs text-destructive flex items-start gap-2.5 animate-fadeIn">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <div className="flex-1 font-medium">{formError || authError}</div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-3 text-muted-foreground" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (formError) setFormError(null);
                    }}
                    onBlur={() => setEmailTouched(true)}
                    placeholder="name@example.com"
                    className={cn(
                      "w-full rounded-xl border bg-background pl-10 pr-3.5 py-2.5 text-sm outline-none rx-transition focus:ring-1",
                      emailTouched && !isEmailValid
                        ? "border-destructive focus:border-destructive focus:ring-destructive"
                        : "border-border focus:border-primary focus:ring-primary"
                    )}
                  />
                </div>
                {emailTouched && !isEmailValid && (
                  <p className="mt-1 text-[11px] text-destructive">
                    Please enter a valid email address (e.g. name@domain.com).
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-foreground uppercase tracking-wider">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotModal(true);
                      setResetEmail(email);
                      setResetSentSuccess(false);
                    }}
                    className="text-xs font-medium text-primary hover:underline focus:outline-none"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-3 text-muted-foreground" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (formError) setFormError(null);
                    }}
                    onBlur={() => setPasswordTouched(true)}
                    placeholder="••••••••"
                    className={cn(
                      "w-full rounded-xl border bg-background pl-10 pr-10 py-2.5 text-sm outline-none rx-transition focus:ring-1",
                      passwordTouched && !isPasswordValid
                        ? "border-destructive focus:border-destructive focus:ring-destructive"
                        : "border-border focus:border-primary focus:ring-primary"
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3 text-muted-foreground hover:text-foreground focus:outline-none"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {passwordTouched && !isPasswordValid && (
                  <p className="mt-1 text-[11px] text-destructive">
                    Password must be at least 8 characters long.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                  />
                  <span>Keep me signed in</span>
                </label>
              </div>

              <Button
                type="submit"
                disabled={isSubmitting || authLoading || (emailTouched && !isFormValid)}
                className="w-full mt-2"
              >
                {isSubmitting || authLoading ? "Authenticating…" : "Sign In to ResolveX"}
              </Button>
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-muted" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground font-semibold">Or continue with</span>
              </div>
            </div>

            <Button
              variant="outline"
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isSubmitting || authLoading}
              className="w-full gap-2.5 py-2.5"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  fill="#EA4335"
                />
              </svg>
              <span>Continue with Google</span>
            </Button>

            <div className="mt-6 text-center text-xs text-muted-foreground border-t pt-4">
              Don&apos;t have a ResolveX account yet?{" "}
              <Link href="/register" className="font-bold text-primary hover:underline">
                Create Resident Account
              </Link>
            </div>
          </Card>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <Card className="max-w-md w-full p-6 space-y-4 shadow-xl relative border-primary/20">
            <button
              type="button"
              onClick={() => setShowForgotModal(false)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <KeyRound size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Reset Your Password</h3>
                <p className="text-xs text-muted-foreground">
                  We will send a password reset link to your registered email
                </p>
              </div>
            </div>

            {resetSentSuccess ? (
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-xs text-emerald-600 flex items-start gap-3">
                <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-sm">Reset link dispatched!</p>
                  <p className="mt-1">
                    Check your inbox at <strong>{resetEmail}</strong> and follow the instructions to set a new password.
                  </p>
                  <Button
                    onClick={() => setShowForgotModal(false)}
                    variant="outline"
                    className="mt-3 text-xs"
                  >
                    Done
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSendReset} className="space-y-3 pt-2">
                <div>
                  <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-1">
                    Registered Email
                  </label>
                  <input
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full rounded-xl border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowForgotModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSendingReset}>
                    {isSendingReset ? "Sending Link…" : "Send Reset Email"}
                  </Button>
                </div>
              </form>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
