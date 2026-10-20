"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Home,
  KeyRound,
  Mail,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  User,
  UsersRound
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@resolvex/ui";
import { validateSocietyTowerFlat, verifiedSocieties } from "@resolvex/utils";
import { AppShell } from "@/components/app-shell";
import { Badge, Button, Card, SectionHeader } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import { updateUserProfile } from "@/lib/services/auth-service";

export default function OnboardingPage() {
  const router = useRouter();
  const {
    user,
    userProfile,
    isEmailVerified,
    resendVerification,
    reloadUser,
    isFirebaseConfigured
  } = useAuth();

  const [isResending, setIsResending] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  // For users who joined via Google and need flat assignment:
  const [societyId, setSocietyId] = useState(userProfile?.societyId || verifiedSocieties[0].id);
  const [towerId, setTowerId] = useState(userProfile?.towerId || verifiedSocieties[0].towers[0].id);
  const [flatNumber, setFlatNumber] = useState(userProfile?.flatId ? userProfile.flatId.split("-").pop()?.toUpperCase() || "" : "");
  const [isSavingFlat, setIsSavingFlat] = useState(false);

  const selectedSociety = verifiedSocieties.find((s) => s.id === societyId) || verifiedSocieties[0];
  const availableTowers = selectedSociety.towers;

  const hasSocietyDetails = Boolean(userProfile?.societyId && userProfile?.towerId && userProfile?.flatId);
  const isHouseholdApproved = userProfile?.status === "verified";
  const isPendingApproval = userProfile?.status === "pending_verification";

  async function handleResendEmail() {
    setIsResending(true);
    try {
      await resendVerification();
      toast.success("Verification email dispatched. Please check your inbox.");
    } catch (err: any) {
      toast.error(err?.message || "Could not resend email.");
    } finally {
      setIsResending(false);
    }
  }

  async function handleRefreshVerification() {
    setIsChecking(true);
    try {
      const verified = await reloadUser();
      if (verified) {
        toast.success("Email verified successfully!");
      } else {
        toast.info("Email is not verified yet. Please check your inbox and click the link.");
      }
    } catch {
      toast.error("Could not refresh verification status.");
    } finally {
      setIsChecking(false);
    }
  }

  async function handleSaveFlatAssignment(e: React.FormEvent) {
    e.preventDefault();
    if (!userProfile?.uid) return;

    const check = validateSocietyTowerFlat(societyId, towerId, flatNumber);
    if (!check.valid) {
      toast.error(check.error || "Please enter a valid flat number.");
      return;
    }

    setIsSavingFlat(true);
    try {
      const cleanFlat = flatNumber.trim().toUpperCase();
      const sanitizedFlatId = check.sanitizedFlatId || `flat-${towerId}-${cleanFlat}`;
      const householdId = `hh-${towerId.replace("tower-", "")}-${cleanFlat.toLowerCase()}`;

      await updateUserProfile(userProfile.uid, {
        societyId,
        towerId,
        flatId: sanitizedFlatId,
        householdId,
        onboardingCompleted: true,
        status: "pending_verification"
      });

      toast.success("Flat and society details updated!");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save unit details.");
    } finally {
      setIsSavingFlat(false);
    }
  }

  return (
    <AppShell>
      <div className="space-y-6 pb-20">
        <SectionHeader
          eyebrow="Account Verification & Governance"
          title="Resident Onboarding Status"
          description="Review your identity verification, flat assignment, and household authorization status."
        />

        <div className="grid gap-6 lg:grid-cols-12">
          {/* Status Checklist Card (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <Card className="p-6">
              <h3 className="text-base font-bold text-foreground mb-4 flex items-center justify-between">
                <span>Verification Checklist</span>
                <Badge tone={isHouseholdApproved ? "teal" : "amber"}>
                  {isHouseholdApproved ? "Fully Verified" : "Action Required"}
                </Badge>
              </h3>

              <div className="space-y-3">
                {/* 1. Account Created */}
                <div className="flex items-start gap-3.5 p-3 rounded-xl border bg-muted/20">
                  <div className="h-7 w-7 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-foreground">ResolveX Identity Account</p>
                      <Badge tone="teal">Completed</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      UID: <code className="font-mono text-[10px]">{userProfile?.uid || "Authenticated User"}</code>
                    </p>
                  </div>
                </div>

                {/* 2. Email Verified */}
                <div className="flex items-start gap-3.5 p-3 rounded-xl border bg-muted/20">
                  <div
                    className={cn(
                      "h-7 w-7 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                      isEmailVerified ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"
                    )}
                  >
                    {isEmailVerified ? <CheckCircle2 size={16} /> : <Mail size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-foreground">Email Address Verification</p>
                      <Badge tone={isEmailVerified ? "teal" : "amber"}>
                        {isEmailVerified ? "Verified" : "Pending"}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {userProfile?.email || "No email on record"}
                    </p>
                    {!isEmailVerified && (
                      <div className="flex items-center gap-2 mt-2 pt-1 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleResendEmail}
                          disabled={isResending}
                          className="text-[11px] h-7 px-2.5 gap-1.5"
                        >
                          <Send size={12} />
                          {isResending ? "Sending…" : "Resend Email"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleRefreshVerification}
                          disabled={isChecking}
                          className="text-[11px] h-7 px-2.5 gap-1.5"
                        >
                          <RefreshCw size={12} className={cn(isChecking && "animate-spin")} />
                          {isChecking ? "Checking…" : "Refresh Status"}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. Society & Flat Unit */}
                <div className="flex items-start gap-3.5 p-3 rounded-xl border bg-muted/20">
                  <div
                    className={cn(
                      "h-7 w-7 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                      hasSocietyDetails ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"
                    )}
                  >
                    {hasSocietyDetails ? <CheckCircle2 size={16} /> : <Home size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-foreground">Society & Unit Assignment</p>
                      <Badge tone={hasSocietyDetails ? "teal" : "amber"}>
                        {hasSocietyDetails ? "Configured" : "Incomplete"}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {hasSocietyDetails
                        ? `${userProfile?.societyId} · Tower ${userProfile?.towerId?.toUpperCase()} · Flat ${userProfile?.flatId}`
                        : "Flat not yet linked to this profile"}
                    </p>
                  </div>
                </div>

                {/* 4. Household Authorization */}
                <div className="flex items-start gap-3.5 p-3 rounded-xl border bg-muted/20">
                  <div
                    className={cn(
                      "h-7 w-7 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                      isHouseholdApproved
                        ? "bg-emerald-500/10 text-emerald-600"
                        : isPendingApproval
                        ? "bg-amber-500/10 text-amber-600"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {isHouseholdApproved ? (
                      <CheckCircle2 size={16} />
                    ) : (
                      <Clock size={16} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-foreground">Household Governance Approval</p>
                      <Badge tone={isHouseholdApproved ? "teal" : "amber"}>
                        {isHouseholdApproved ? "Active Member" : "Approval Pending"}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {isHouseholdApproved
                        ? "Verified resident with full platform access."
                        : "Your membership is awaiting authorization from the flat owner or society manager."}
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-6 pt-4 border-t flex justify-end">
                <Link href="/">
                  <Button className="gap-2">
                    <span>Enter ResolveX Workspace</span>
                    <ArrowRight size={15} />
                  </Button>
                </Link>
              </div>
            </Card>
          </div>

          {/* Unit Setup / Completion Form (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <Card className="p-6">
              <h3 className="text-base font-bold text-foreground mb-1">
                {hasSocietyDetails ? "Flat Details" : "Complete Flat Assignment"}
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                {hasSocietyDetails
                  ? "Your society and residential unit on record."
                  : "Please choose your society, tower, and flat to complete onboarding."}
              </p>

              <form onSubmit={handleSaveFlatAssignment} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">
                    Society
                  </label>
                  <select
                    value={societyId}
                    onChange={(e) => {
                      setSocietyId(e.target.value);
                      const s = verifiedSocieties.find((soc) => soc.id === e.target.value);
                      if (s && s.towers.length > 0) setTowerId(s.towers[0].id);
                    }}
                    className="w-full rounded-xl border bg-background px-3 py-2 text-xs font-medium outline-none focus:border-primary"
                  >
                    {verifiedSocieties.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">
                    Tower
                  </label>
                  <select
                    value={towerId}
                    onChange={(e) => setTowerId(e.target.value)}
                    className="w-full rounded-xl border bg-background px-3 py-2 text-xs font-medium outline-none focus:border-primary"
                  >
                    {availableTowers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.floors} floors)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">
                    Flat Number
                  </label>
                  <input
                    type="text"
                    required
                    value={flatNumber}
                    onChange={(e) => setFlatNumber(e.target.value)}
                    placeholder="e.g. A-1204"
                    className="w-full rounded-xl border bg-background px-3 py-2 text-xs font-medium outline-none focus:border-primary"
                  />
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Format: {selectedSociety.flatFormatDescription}
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={isSavingFlat}
                  className="w-full mt-2 text-xs"
                >
                  {isSavingFlat ? "Updating…" : hasSocietyDetails ? "Update Unit Info" : "Link Flat to Account"}
                </Button>
              </form>
            </Card>

            <Card className="p-5 border-dashed bg-muted/10">
              <div className="flex gap-3">
                <ShieldCheck size={20} className="text-primary shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-bold text-foreground">Automated Household Security</p>
                  <p className="text-muted-foreground leading-relaxed">
                    Existing flat owners receive real-time notifications for incoming family or tenant join requests.
                    No unauthorized users can claim occupied units without explicit approval.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
