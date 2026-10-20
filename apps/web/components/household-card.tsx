import { useState } from "react";
import {
  Building2,
  Crown,
  Eye,
  EyeOff,
  Home,
  MailPlus,
  ShieldCheck,
  UserCheck,
  UserMinus,
  Users
} from "lucide-react";
import { toast } from "sonner";
import { householdRoleLabels } from "@resolvex/utils";
import type { Household, HouseholdRole, UserProfile } from "@resolvex/types";
import { useAuth } from "@/lib/auth-context";
import { Badge, Button, Card } from "./ui";

interface HouseholdCardProps {
  household?: Household | null;
  members?: UserProfile[];
  onOpenInvite?: () => void;
  onRemoveMember?: (member: UserProfile) => Promise<void>;
  isOwner?: boolean;
}

export function HouseholdCard({
  household,
  members = [],
  onOpenInvite,
  onRemoveMember,
  isOwner = false
}: HouseholdCardProps) {
  const { userProfile } = useAuth();
  const [removingMember, setRemovingMember] = useState<UserProfile | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const displayHouseholdName =
    household?.displayName ||
    (userProfile?.flatId ? `Flat ${userProfile.flatId.replace(/^flat-[^-]+-/, "")} Household` : "My Household");
  const inviteCode = household?.inviteCode || "PENDING";
  const towerName = (household?.towerId || userProfile?.towerId || "tower-a")
    .replace("tower-", "Tower ")
    .toUpperCase();
  const flatName = (household?.flatId || userProfile?.flatId || "flat-a-1204")
    .replace(/^flat-[^-]+-/, "Flat ");

  async function handleConfirmRemove() {
    if (!removingMember) return;
    setIsRemoving(true);
    try {
      if (onRemoveMember) {
        await onRemoveMember(removingMember);
      } else {
        toast.success(`${removingMember.displayName || "Member"} removed from household.`);
      }
      setRemovingMember(null);
    } catch (err: any) {
      toast.error(err?.message || "Failed to remove member.");
    } finally {
      setIsRemoving(false);
    }
  }

  return (
    <Card className="overflow-hidden">
      {/* Hierarchy Banner */}
      <div className="border-b bg-muted/40 px-5 py-2.5 flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
        <span className="font-semibold text-foreground flex items-center gap-1">
          <Building2 size={13} className="text-primary" /> ResolveX Society
        </span>
        <span>→</span>
        <span>{towerName}</span>
        <span>→</span>
        <span className="font-medium text-foreground">{flatName}</span>
        <span>→</span>
        <span className="font-semibold text-primary">{displayHouseholdName}</span>
      </div>

      {/* Household header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b bg-card px-5 py-4 gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold tracking-tight">{displayHouseholdName}</h2>
            <Badge tone="blue">Multi-Resident Household</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Invite code: <span className="font-mono font-semibold text-foreground">{inviteCode}</span>
            {" · "}{members.length} registered member account{members.length === 1 ? "" : "s"}
            {household?.pendingRequestIds && household.pendingRequestIds.length > 0 && (
              <span className="ml-1.5 text-amber-600 dark:text-amber-400 font-semibold">
                · {household.pendingRequestIds.length} awaiting verification
              </span>
            )}
          </p>
        </div>
        {isOwner && onOpenInvite && (
          <Button size="sm" variant="outline" onClick={onOpenInvite}>
            <MailPlus size={14} />
            Invite Household Member
          </Button>
        )}
      </div>

      {/* Members grid */}
      {members.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">
          No registered household members found.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border">
          {members.map((member) => {
            const isPrimary = member.householdRole === "owner";
            const initials = (member.displayName || member.email || "U")
              .split(" ")
              .map((p) => p[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();

            return (
              <div key={member.uid} className="p-4 space-y-3.5 bg-card">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-sm">{member.displayName || "Resident"}</p>
                    <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-dashed">
                  <span className="text-muted-foreground">Household Role:</span>
                  <Badge
                    tone={
                      member.householdRole === "owner"
                        ? "blue"
                        : member.householdRole === "tenant"
                          ? "coral"
                          : "teal"
                    }
                  >
                    {member.householdRole ? householdRoleLabels[member.householdRole] || member.householdRole : "Resident"}
                  </Badge>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Verification:</span>
                  {member.status === "verified" ? (
                    <span className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                      <ShieldCheck size={12} />
                      Verified Resident
                    </span>
                  ) : (
                    <Badge tone="amber">Pending Approval</Badge>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Phone:</span>
                  <span className="font-mono text-foreground text-xs">
                    {member.phone || "Not specified"}
                  </span>
                </div>

                <div className="pt-2">
                  {isPrimary ? (
                    <div className="flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/40 rounded-lg">
                      <Crown size={13} className="text-amber-500" />
                      Primary Account Holder
                    </div>
                  ) : isOwner ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs text-danger hover:bg-danger/8"
                      onClick={() => setRemovingMember(member)}
                    >
                      <UserMinus size={13} />
                      Remove From Household
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Remove Confirmation Dialog */}
      {removingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rx-card-elevated p-5 space-y-4">
            <h4 className="font-bold text-base">Remove Member?</h4>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to remove{" "}
              <span className="font-semibold text-foreground">
                {removingMember.displayName || removingMember.email}
              </span>{" "}
              from this household? They will lose resident access to society amenities, gate passes, and complaints.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={isRemoving}
                onClick={() => setRemovingMember(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={isRemoving}
                onClick={handleConfirmRemove}
              >
                {isRemoving ? "Removing..." : "Remove Member"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
