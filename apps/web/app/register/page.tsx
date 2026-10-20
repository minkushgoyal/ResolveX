"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Building2,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  Home,
  Info,
  Lock,
  Mail,
  Phone,
  Shield,
  ShieldCheck,
  Upload,
  User
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@resolvex/ui";
import type { PlatformRole } from "@resolvex/types";
import {
  EMAIL_REGEX,
  INDIAN_PHONE_REGEX,
  validateRegistrationFields,
  validateSocietyTowerFlat,
  verifiedSocieties
} from "@resolvex/utils";
import { Badge, Button, Card } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";

export default function RegisterPage() {
  const router = useRouter();
  const { register, isFirebaseConfigured } = useAuth();

  // Form fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [societyId, setSocietyId] = useState(verifiedSocieties[0].id);
  const [towerId, setTowerId] = useState(verifiedSocieties[0].towers[0].id);
  const [flatNumber, setFlatNumber] = useState("");
  const [role, setRole] = useState<PlatformRole>("resident");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Field touch tracking
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const selectedSociety = useMemo(
    () => verifiedSocieties.find((s) => s.id === societyId) || verifiedSocieties[0],
    [societyId]
  );

  const availableTowers = selectedSociety.towers;

  // Real-time field validations
  const validation = useMemo(() => {
    return validateRegistrationFields({
      fullName,
      email,
      phone,
      password,
      confirmPassword,
      societyId,
      towerId,
      flatNumber
    });
  }, [fullName, email, phone, password, confirmPassword, societyId, towerId, flatNumber]);

  function markTouched(field: string) {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  function handleSocietyChange(newSocId: string) {
    setSocietyId(newSocId);
    const soc = verifiedSocieties.find((s) => s.id === newSocId);
    if (soc && soc.towers.length > 0) {
      setTowerId(soc.towers[0].id);
    }
  }

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (PNG, JPG, WebP).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image file size must be under 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPhotoPreview(reader.result as string);
      toast.success("Profile photo attached.");
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({
      fullName: true,
      email: true,
      phone: true,
      password: true,
      confirmPassword: true,
      flatNumber: true
    });
    setFormError(null);

    if (!validation.isValid) {
      const firstError = Object.values(validation.errors)[0];
      setFormError(firstError || "Please correct the highlighted errors.");
      toast.error(firstError || "Form contains validation errors.");
      return;
    }

    setIsSubmitting(true);
    try {
      const profile = await register({
        fullName,
        email,
        password,
        phone,
        societyId,
        towerId,
        flatNumber,
        role,
        ...(photoPreview ? { photoURL: photoPreview } : {})
      });

      if (profile.status === "pending_verification") {
        toast.info("Flat already has an active household. Membership request submitted for owner approval.");
      } else {
        toast.success(`Account registered for ${selectedSociety.name}!`);
      }

      router.push("/onboarding");
    } catch (err: any) {
      setFormError(err?.message || "Registration could not be completed.");
      toast.error(err?.message || "Registration failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-xl text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-soft">
          <Building2 size={24} />
        </div>
        <h1 className="mt-3 text-2xl font-black tracking-tight text-foreground sm:text-3xl">
          Register Resident Account
        </h1>
        <p className="mt-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Join your verified society & link your household unit
        </p>

        {!isFirebaseConfigured && (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-0.5 text-xs font-medium text-amber-600 border border-amber-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
            Local Reactive Store Active (Demo Mode)
          </div>
        )}
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-2xl">
        <Card className="p-6 sm:p-8 shadow-sm">
          {formError && (
            <div className="mb-5 rounded-xl border border-destructive/20 bg-destructive/10 p-3.5 text-xs text-destructive flex items-start gap-2.5 animate-fadeIn">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{formError}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name & Phone Number (2 cols) */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-1.5">
                  Full Name <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <User size={16} className="absolute left-3.5 top-3 text-muted-foreground" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      if (formError) setFormError(null);
                    }}
                    onBlur={() => markTouched("fullName")}
                    placeholder="Minkush Goyal"
                    className={cn(
                      "w-full rounded-xl border bg-background pl-10 pr-3.5 py-2.5 text-sm outline-none rx-transition focus:ring-1",
                      touched.fullName && validation.errors.fullName
                        ? "border-destructive focus:border-destructive focus:ring-destructive"
                        : "border-border focus:border-primary focus:ring-primary"
                    )}
                  />
                </div>
                {touched.fullName && validation.errors.fullName && (
                  <p className="mt-1 text-[11px] text-destructive">{validation.errors.fullName}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-1.5">
                  Mobile Phone <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <Phone size={16} className="absolute left-3.5 top-3 text-muted-foreground" />
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      if (formError) setFormError(null);
                    }}
                    onBlur={() => markTouched("phone")}
                    placeholder="+91 98765 43210"
                    className={cn(
                      "w-full rounded-xl border bg-background pl-10 pr-3.5 py-2.5 text-sm outline-none rx-transition focus:ring-1",
                      touched.phone && validation.errors.phone
                        ? "border-destructive focus:border-destructive focus:ring-destructive"
                        : "border-border focus:border-primary focus:ring-primary"
                    )}
                  />
                </div>
                {touched.phone && validation.errors.phone && (
                  <p className="mt-1 text-[11px] text-destructive">{validation.errors.phone}</p>
                )}
              </div>
            </div>

            {/* Email Address */}
            <div>
              <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-1.5">
                Email Address <span className="text-destructive">*</span>
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
                  onBlur={() => markTouched("email")}
                  placeholder="name@example.com"
                  className={cn(
                    "w-full rounded-xl border bg-background pl-10 pr-3.5 py-2.5 text-sm outline-none rx-transition focus:ring-1",
                    touched.email && validation.errors.email
                      ? "border-destructive focus:border-destructive focus:ring-destructive"
                      : "border-border focus:border-primary focus:ring-primary"
                  )}
                />
              </div>
              {touched.email && validation.errors.email && (
                <p className="mt-1 text-[11px] text-destructive">{validation.errors.email}</p>
              )}
            </div>

            {/* Password & Confirm Password (2 cols) */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-1.5">
                  Password <span className="text-destructive">*</span>
                </label>
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
                    onBlur={() => markTouched("password")}
                    placeholder="Min. 8 chars (letters + numbers)"
                    className={cn(
                      "w-full rounded-xl border bg-background pl-10 pr-10 py-2.5 text-sm outline-none rx-transition focus:ring-1",
                      touched.password && validation.errors.password
                        ? "border-destructive focus:border-destructive focus:ring-destructive"
                        : "border-border focus:border-primary focus:ring-primary"
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {touched.password && validation.errors.password && (
                  <p className="mt-1 text-[11px] text-destructive">{validation.errors.password}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-1.5">
                  Confirm Password <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-3 text-muted-foreground" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (formError) setFormError(null);
                    }}
                    onBlur={() => markTouched("confirmPassword")}
                    placeholder="Repeat password"
                    className={cn(
                      "w-full rounded-xl border bg-background pl-10 pr-3.5 py-2.5 text-sm outline-none rx-transition focus:ring-1",
                      touched.confirmPassword && validation.errors.confirmPassword
                        ? "border-destructive focus:border-destructive focus:ring-destructive"
                        : "border-border focus:border-primary focus:ring-primary"
                    )}
                  />
                </div>
                {touched.confirmPassword && validation.errors.confirmPassword && (
                  <p className="mt-1 text-[11px] text-destructive">{validation.errors.confirmPassword}</p>
                )}
              </div>
            </div>

            {/* Society Hierarchy Section */}
            <div className="rounded-2xl border bg-muted/20 p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-foreground">
                <Home size={15} className="text-primary" />
                <span>Verified Society & Household Unit</span>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {/* Society Select */}
                <div>
                  <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">
                    Society
                  </label>
                  <select
                    value={societyId}
                    onChange={(e) => handleSocietyChange(e.target.value)}
                    className="w-full rounded-xl border bg-background px-3 py-2 text-xs font-medium outline-none focus:border-primary"
                  >
                    {verifiedSocieties.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tower Select */}
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

                {/* Flat Number Input */}
                <div>
                  <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">
                    Flat / Unit <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={flatNumber}
                    onChange={(e) => {
                      setFlatNumber(e.target.value);
                      if (formError) setFormError(null);
                    }}
                    onBlur={() => markTouched("flatNumber")}
                    placeholder={selectedSociety.flatFormatDescription.split(",")[0].replace("e.g., ", "")}
                    className={cn(
                      "w-full rounded-xl border bg-background px-3 py-2 text-xs font-medium outline-none focus:border-primary",
                      touched.flatNumber && validation.errors.flatNumber
                        ? "border-destructive focus:border-destructive"
                        : "border-border"
                    )}
                  />
                  {touched.flatNumber && validation.errors.flatNumber && (
                    <p className="mt-1 text-[10px] text-destructive">{validation.errors.flatNumber}</p>
                  )}
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <Info size={12} className="shrink-0 text-primary" />
                <span>
                  Format hint: {selectedSociety.flatFormatDescription}. If this flat is already registered, you will be
                  added to its household pending verification.
                </span>
              </p>
            </div>

            {/* Requested Household Role */}
            <div>
              <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-1.5">
                Your Relationship to the Flat
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: "flat_owner", label: "Flat Owner", desc: "I own this flat" },
                  { value: "tenant", label: "Tenant", desc: "I rent this flat" },
                  { value: "resident", label: "Family Member", desc: "I live here" }
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setRole(opt.value as PlatformRole)}
                    className={cn(
                      "p-3 rounded-xl border text-left rx-transition",
                      role === opt.value
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border bg-background hover:bg-muted/40"
                    )}
                  >
                    <p className="text-xs font-bold text-foreground">{opt.label}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Profile Photo (Optional) */}
            <div>
              <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-1.5">
                Profile Photo (Optional)
              </label>
              <div className="flex items-center gap-4">
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt="Preview"
                    className="h-12 w-12 rounded-full object-cover border-2 border-primary"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground border">
                    <User size={20} />
                  </div>
                )}
                <label className="cursor-pointer inline-flex items-center gap-2 rounded-xl border bg-card px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-muted rx-transition">
                  <Upload size={14} />
                  <span>Upload Photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </label>
                {photoPreview && (
                  <button
                    type="button"
                    onClick={() => setPhotoPreview(null)}
                    className="text-xs text-destructive hover:underline"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>

            {/* Submission Button */}
            <div className="pt-2">
              <Button
                type="submit"
                disabled={isSubmitting || !validation.isValid}
                className="w-full py-3 text-sm font-bold"
              >
                {isSubmitting ? "Creating Account & Linking Household…" : "Register Resident Account"}
              </Button>
            </div>

            <div className="text-center text-xs text-muted-foreground border-t pt-4">
              Already have an account?{" "}
              <Link href="/login" className="font-bold text-primary hover:underline">
                Sign In to ResolveX
              </Link>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
