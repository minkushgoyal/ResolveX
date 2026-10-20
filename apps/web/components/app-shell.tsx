"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  Building2,
  CalendarCheck,
  Check,
  CheckCheck,
  ChevronDown,
  ClipboardList,
  Cpu,
  CreditCard,
  FileText,
  Home,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  Lock,
  LogOut,
  Mail,
  Megaphone,
  MessageSquareText,
  Moon,
  QrCode,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Sparkles,
  Star,
  Store,
  Sun,
  UserCheck,
  UsersRound,
  Wrench,
  X
} from "lucide-react";
import { cn } from "@resolvex/ui";
import {
  assetQRCodes,
  complaints,
  demoSociety,
  facilities,
  households,
  marketplaceItems,
  notifications as demoNotifications,
  residents,
  roleLabels,
  ROLE_NAV_GROUPS,
  ROLE_ROUTE_PERMISSIONS,
  societyEvents,
  staff
} from "@resolvex/utils";
import type { AppNotification, PlatformRole } from "@resolvex/types";
import { useSessionStore } from "@/lib/store";
import { useAuth } from "@/lib/auth-context";
import { markAllAsRead as serviceMarkAllRead, subscribeNotifications } from "@/lib/services";
import { Button } from "./ui";

function getNavIcon(iconKey: string) {
  switch (iconKey) {
    case "home":
      return Home;
    case "layout":
      return LayoutDashboard;
    case "clipboard":
      return ClipboardList;
    case "wrench":
      return Wrench;
    case "cpu":
      return Cpu;
    case "household":
      return UsersRound;
    case "user-check":
      return UserCheck;
    case "community":
      return MessageSquareText;
    case "megaphone":
      return Megaphone;
    case "calendar":
      return CalendarCheck;
    case "store":
      return Store;
    case "credit-card":
      return CreditCard;
    case "file-text":
      return FileText;
    case "shield":
      return ShieldCheck;
    case "building":
      return Building2;
    case "siren":
      return Siren;
    case "star":
      return Star;
    default:
      return LayoutDashboard;
  }
}

// ─── Search data index ─────────────────────────────────────────────────────
type SearchResult = {
  id: string;
  type: "complaint" | "resident" | "household" | "staff" | "facility" | "marketplace" | "event";
  title: string;
  subtitle: string;
  href: string;
};

function buildSearchIndex(): SearchResult[] {
  return [
    ...complaints.map((c) => ({
      id: c.id,
      type: "complaint" as const,
      title: c.title,
      subtitle: `#${c.id} · ${c.location}`,
      href: "/complaints"
    })),
    ...residents.map((r) => ({
      id: r.id,
      type: "resident" as const,
      title: r.name,
      subtitle: `${r.householdRole} · Flat ${r.flatId?.replace("flat-", "").replace("-", " ").toUpperCase()}`,
      href: "/households"
    })),
    ...households.map((h) => ({
      id: h.id,
      type: "household" as const,
      title: h.displayName,
      subtitle: `Code: ${h.inviteCode} · ${h.memberIds.length} Members`,
      href: "/households"
    })),
    ...staff.map((s) => ({
      id: s.id,
      type: "staff" as const,
      title: s.name,
      subtitle: `${s.department ?? "Staff"} · ${s.availabilityStatus.replace("_", " ")}`,
      href: "/staff"
    })),
    ...facilities.map((f) => ({
      id: f.id,
      type: "facility" as const,
      title: f.name,
      subtitle: `${f.category} · ${f.location}`,
      href: "/facilities"
    })),
    ...marketplaceItems.map((m) => ({
      id: m.id,
      type: "marketplace" as const,
      title: m.title,
      subtitle: `₹${m.price.toLocaleString("en-IN")} · ${m.condition.replace("_", " ")}`,
      href: "/community"
    })),
    ...societyEvents.map((e) => ({
      id: e.id,
      type: "event" as const,
      title: e.title,
      subtitle: `${e.venue} · ${e.eventDate} · ${e.time}`,
      href: "/community"
    }))
  ];
}

const searchIndex = buildSearchIndex();

const typeLabels: Record<SearchResult["type"], string> = {
  complaint: "Complaint",
  resident: "Resident",
  household: "Household",
  staff: "Staff",
  facility: "Facility",
  marketplace: "Marketplace",
  event: "Event"
};

const SEARCH_CATEGORIES: Array<{ id: "all" | SearchResult["type"]; label: string }> = [
  { id: "all", label: "All" },
  { id: "complaint", label: "Complaints" },
  { id: "household", label: "Households" },
  { id: "resident", label: "Residents" },
  { id: "staff", label: "Staff" },
  { id: "facility", label: "Facilities" },
  { id: "event", label: "Events" },
  { id: "marketplace", label: "Marketplace" }
];

// ─── App Shell ─────────────────────────────────────────────────────────────
export function AppShell({
  children,
  mode = "resident"
}: {
  children: React.ReactNode;
  mode?: "resident" | "admin";
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useSessionStore();
  const {
    user,
    userProfile,
    activeRole,
    signOut,
    isFirebaseConfigured,
    loading,
    isEmailVerified
  } = useAuth();

  const isUnauthenticated = isFirebaseConfigured && !loading && !user;

  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchCategory, setSearchCategory] = useState<"all" | SearchResult["type"]>("all");
  const [notifList, setNotifList] = useState<AppNotification[]>(demoNotifications);
  const [selectedResultIdx, setSelectedResultIdx] = useState(0);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const roleRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifList.filter((n) => !n.read).length;

  const displayName = userProfile?.displayName || user?.displayName || user?.email?.split("@")[0] || "User";
  const userInitials = displayName
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "RX";
  const userFlat = userProfile?.flatId ? `Flat ${userProfile.flatId.replace("flat-", "").toUpperCase()}` : "";
  const userTower = userProfile?.towerId ? `Tower ${userProfile.towerId.replace("tower-", "").toUpperCase()}` : "";
  const userUnit = [userFlat, userTower].filter(Boolean).join(" · ") || roleLabels[activeRole];
  const userSociety = userProfile?.societyId === "soc-ajanta-genx" ? "Ajanta Gen-X" : (userProfile?.societyId || "ResolveX Society");

  const authorizedRoles: PlatformRole[] = userProfile?.platformRoles && userProfile.platformRoles.length > 0
    ? userProfile.platformRoles
    : [activeRole];
  const hasMultipleRoles = authorizedRoles.length > 1;

  const currentNavGroups = ROLE_NAV_GROUPS[activeRole] || ROLE_NAV_GROUPS.resident;
  const isPathAllowedForRole = (role: PlatformRole, path: string) => {
    const routes = ROLE_ROUTE_PERMISSIONS[role] || ["/"];
    return routes.some((route) => route === path || (route !== "/" && path.startsWith(route + "/")));
  };
  const isAuthorized = isPathAllowedForRole(activeRole, pathname) || authorizedRoles.some((r) => isPathAllowedForRole(r, pathname));
  const mobileNav = currentNavGroups.flatMap((g) => g.items).slice(0, 5);

  // Subscribe to notifications strictly for authenticated user
  useEffect(() => {
    if (loading) return;

    const targetUid = user?.uid || userProfile?.uid;
    if (!targetUid) {
      setNotifList(demoNotifications);
      return;
    }

    let isActive = true;
    const unsub = subscribeNotifications(targetUid, (list) => {
      if (isActive) {
        setNotifList(list);
      }
    });

    return () => {
      isActive = false;
      try {
        unsub();
      } catch (err) {
        console.warn("Notification listener cleanup error:", err);
      }
    };
  }, [loading, user?.uid, userProfile?.uid]);


  // Close dropdowns on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (roleRef.current && !roleRef.current.contains(e.target as Node)) {
        setRoleDropdownOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Global ⌘K / Ctrl+K for search
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setNotifOpen(false);
        setRoleDropdownOpen(false);
      }
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Focus search input when overlay opens
  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
      setSearchQuery("");
      setSearchCategory("all");
      setSelectedResultIdx(0);
    }
  }, [searchOpen]);

  // Filtered results
  const searchResults =
    searchQuery.trim().length < 2
      ? []
      : searchIndex
        .filter(
          (item) =>
            (searchCategory === "all" || item.type === searchCategory) &&
            (item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
              item.subtitle.toLowerCase().includes(searchQuery.toLowerCase()))
        )
        .slice(0, 10);

  function handleSearchKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedResultIdx((i) => Math.min(i + 1, Math.max(0, searchResults.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedResultIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && searchResults[selectedResultIdx]) {
      e.preventDefault();
      router.push(searchResults[selectedResultIdx].href);
      setSearchOpen(false);
    }
  }

  function simulateScan(code: string, locationName: string) {
    setQrModalOpen(false);
    router.push(`/complaints?qrCode=${code}&location=${encodeURIComponent(locationName)}`);
  }

  function handleSwitchAuthorizedRole(role: PlatformRole) {
    if (!authorizedRoles.includes(role)) return;
    useSessionStore.getState().setActiveRole(role);
    setRoleDropdownOpen(false);
    const targetAllowed = ROLE_ROUTE_PERMISSIONS[role] || ["/"];
    const isTargetAllowed = targetAllowed.some((r) => r === pathname || (r !== "/" && pathname.startsWith(r + "/")));
    if (!isTargetAllowed) {
      router.push("/");
    }
  }

  async function handleSignOut() {
    setUserMenuOpen(false);
    await signOut();
    router.push("/login");
  }

  async function markAllRead() {
    const targetUid = user?.uid || userProfile?.uid;
    if (!targetUid) return;
    await serviceMarkAllRead(targetUid);
    setNotifList((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  const isAdmin = activeRole.includes("admin") || activeRole.includes("manager");

  return (
    <div className={cn("min-h-screen bg-background", theme === "dark" && "dark")}>

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className="fixed left-0 top-0 hidden h-screen w-64 border-r bg-card xl:flex xl:flex-col">

        {/* Logo */}
        <div className="flex h-14 items-center gap-2.5 border-b px-5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles size={14} />
          </div>
          <span className="text-[15px] font-bold tracking-tight">ResolveX</span>
        </div>

        {/* Society / Org Info */}
        <div className="border-b px-5 py-3 bg-muted/10">
          <div className="flex items-center gap-2">
            <Building2 size={14} className="shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{userSociety}</p>
              <p className="text-xs text-muted-foreground truncate">{userUnit}</p>
            </div>
          </div>
        </div>

        {/* Role-Specific Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 scrollbar-none">
          {currentNavGroups.map((group) => (
            <div key={group.label} className="mb-5">
              <p className="mb-1.5 px-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground/60">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = pathname === item.href;
                  const Icon = getNavIcon(item.iconKey);
                  return (
                    <Link
                      key={`${item.href}-${item.label}`}
                      href={item.href}
                      className={cn(
                        "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium rx-transition",
                        active
                          ? "bg-primary/8 text-primary font-semibold border-l-2 border-primary ml-[-1px] pl-[9px]"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <Icon size={16} className={cn(!active && "opacity-70 group-hover:opacity-100")} />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User Identity Footer */}
        <div className="border-t p-3 bg-muted/20">
          <div className="flex items-center gap-3">
            {userProfile?.photoURL || user?.photoURL ? (
              <img
                src={userProfile?.photoURL || user?.photoURL || ""}
                alt={displayName}
                className="h-9 w-9 rounded-full object-cover border shrink-0"
              />
            ) : (
              <div className="h-9 w-9 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center border shrink-0">
                {userInitials}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-foreground truncate">{displayName}</p>
              <p className="text-[11px] text-muted-foreground truncate">{userUnit}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 truncate">
                  {userProfile?.status === "verified" ? "Verified" : (user ? "Active" : "Guest")}
                </span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <main className="xl:pl-64">

        {/* Top Header */}
        <header className="sticky top-0 z-20 flex h-14 items-center border-b bg-card/95 backdrop-blur-md px-4 md:px-6">
          <div className="flex w-full items-center gap-3">

            {/* Left — brand mark on smaller widths */}
            <div className="hidden md:flex xl:hidden items-center gap-2 shrink-0">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-primary-foreground">
                <Sparkles size={12} />
              </div>
              <span className="text-sm font-bold">ResolveX</span>
            </div>

            {/* Search trigger */}
            <button
              onClick={() => setSearchOpen(true)}
              className="hidden max-w-sm flex-1 items-center gap-2 rounded-lg border bg-muted/40 px-3 py-1.5 text-sm text-muted-foreground/70 hover:bg-muted rx-transition md:flex"
              aria-label="Open search"
            >
              <Search size={14} className="shrink-0" />
              <span className="flex-1 text-left">Search…</span>
              <kbd className="hidden rounded border border-border bg-background px-1.5 py-0.5 text-xs font-mono text-muted-foreground/60 sm:block">
                ⌘K
              </kbd>
            </button>

            {/* Right group */}
            <div className="ml-auto flex items-center gap-2">

              {/* User Identity Pill */}
              <div className="hidden lg:flex items-center gap-2 border-r pr-3 text-xs">
                <span className="font-bold text-foreground truncate max-w-[140px]">{displayName}</span>
                <span className="text-muted-foreground">({roleLabels[activeRole]})</span>
              </div>

              {/* QR Scan */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setQrModalOpen(true)}
                className="hidden gap-1.5 text-xs sm:inline-flex"
                aria-label="Scan location QR code"
              >
                <QrCode size={14} />
                Scan QR
              </Button>

              {/* Role badge / switcher */}
              {hasMultipleRoles ? (
                <div className="relative" ref={roleRef}>
                  <button
                    onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
                    className="flex items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1.5 text-xs font-semibold rx-transition hover:bg-muted"
                    aria-label="Switch active role"
                    aria-expanded={roleDropdownOpen}
                  >
                    <span
                      className={cn(
                        "inline-flex h-2 w-2 rounded-full shrink-0",
                        isAdmin ? "bg-teal-500" : activeRole === "maintenance_staff" ? "bg-amber-500" : activeRole === "security_guard" ? "bg-blue-500" : "bg-primary"
                      )}
                    />
                    <span>{roleLabels[activeRole]}</span>
                    <ChevronDown size={12} className="text-muted-foreground" />
                  </button>

                  {roleDropdownOpen && (
                    <div className="absolute right-0 z-50 mt-1.5 w-56 rounded-xl border bg-card p-1.5 shadow-soft">
                      <div className="px-2.5 py-1.5 border-b mb-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Switch Role
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Assigned to your profile
                        </p>
                      </div>
                      {authorizedRoles.map((role) => {
                        const isSelected = activeRole === role;
                        return (
                          <button
                            key={role}
                            onClick={() => handleSwitchAuthorizedRole(role)}
                            className={cn(
                              "flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left rx-transition hover:bg-muted text-xs",
                              isSelected ? "bg-primary/8 text-primary font-semibold" : "text-foreground"
                            )}
                          >
                            <span>{roleLabels[role]}</span>
                            {isSelected && <Check size={14} className="text-primary shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1.5 text-xs font-semibold">
                  <span
                    className={cn(
                      "inline-flex h-2 w-2 rounded-full shrink-0",
                      isAdmin ? "bg-teal-500" : activeRole === "maintenance_staff" ? "bg-amber-500" : activeRole === "security_guard" ? "bg-blue-500" : "bg-primary"
                    )}
                  />
                  <span>{roleLabels[activeRole]}</span>
                </div>
              )}

              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="flex h-8 w-8 items-center justify-center rounded-lg rx-transition hover:bg-muted"
                aria-label="Toggle theme"
              >
                {theme === "dark" ? (
                  <Sun size={16} className="text-amber-400" />
                ) : (
                  <Moon size={16} className="text-muted-foreground" />
                )}
              </button>

              {/* Notifications */}
              <div className="relative" ref={notifRef}>
                <button
                  onClick={() => setNotifOpen((v) => !v)}
                  className="relative flex h-8 w-8 items-center justify-center rounded-lg rx-transition hover:bg-muted"
                  aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
                >
                  <Bell size={16} className="text-muted-foreground" />
                  {unreadCount > 0 && (
                    <span className="absolute right-1.5 top-1.5 flex h-2 w-2 items-center justify-center rounded-full bg-danger ring-2 ring-card text-white text-[8px] font-bold" />
                  )}
                </button>

                {notifOpen && (
                  <div className="absolute right-0 z-50 mt-1.5 w-80 rounded-xl border bg-card shadow-soft">
                    <div className="flex items-center justify-between border-b px-4 py-3">
                      <div>
                        <h4 className="text-sm font-bold">Notifications</h4>
                        <p className="text-xs text-muted-foreground">{unreadCount} unread alerts</p>
                      </div>
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllRead}
                          className="flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <CheckCheck size={13} />
                          Mark all read
                        </button>
                      )}
                    </div>

                    <div className="max-h-72 divide-y overflow-y-auto">
                      {notifList.length === 0 ? (
                        <p className="px-4 py-6 text-center text-xs text-muted-foreground">No notifications</p>
                      ) : (
                        notifList.slice(0, 5).map((n) => (
                          <div
                            key={n.id}
                            className={cn(
                              "px-4 py-3 rx-transition hover:bg-muted/50",
                              !n.read && "bg-primary/5"
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-xs font-bold text-foreground leading-snug">{n.title}</p>
                              {!n.read && (
                                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary mt-1" />
                              )}
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed line-clamp-2">{n.body}</p>
                            <p className="mt-1 text-[10px] text-muted-foreground/60">{n.createdAt.split("T")[0]}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* User Avatar & Menu */}
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-1 focus:outline-none"
                  aria-label="User profile menu"
                >
                  {userProfile?.photoURL || user?.photoURL ? (
                    <img
                      src={userProfile?.photoURL || user?.photoURL || ""}
                      alt={displayName}
                      className="h-8 w-8 rounded-full object-cover border"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center border">
                      {userInitials}
                    </div>
                  )}
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 z-50 mt-1.5 w-56 rounded-xl border bg-card p-1.5 shadow-soft">
                    <div className="px-2.5 py-2 border-b mb-1">
                      <p className="text-xs font-bold truncate text-foreground">
                        {displayName}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {userProfile?.email || user?.email || ""}
                      </p>
                      <span className="inline-block mt-1 text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                        {roleLabels[activeRole]}
                      </span>
                    </div>

                    <Link
                      href="/login"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-foreground hover:bg-muted rx-transition"
                    >
                      <KeyRound size={14} className="text-muted-foreground" />
                      Switch Account / Login
                    </Link>

                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-danger hover:bg-danger/10 rx-transition"
                    >
                      <LogOut size={14} />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Email Verification Reminder Banner */}
        {isFirebaseConfigured && user && !isEmailVerified && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-xs text-amber-700 dark:text-amber-400 flex items-center justify-between">
            <div className="flex items-center gap-2 max-w-2xl">
              <Mail size={14} className="shrink-0 text-amber-600" />
              <span>
                Please verify your email address (<strong>{user.email}</strong>) to guarantee full account privileges.
              </span>
            </div>
            <Link href="/onboarding" className="font-bold underline hover:no-underline shrink-0 ml-4">
              Verify Account
            </Link>
          </div>
        )}

        {/* Page content with Route-Level Authorization Guard */}
        <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:px-8 pb-24 xl:pb-8">
          {isUnauthenticated ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4">
                <Lock size={28} />
              </div>
              <h2 className="text-xl font-bold tracking-tight text-foreground">Authentication Required</h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                You must be signed in to access ResolveX society operations and household dashboards.
              </p>
              <div className="mt-6 flex gap-3">
                <Link href="/login">
                  <Button className="gap-2">
                    <KeyRound size={16} />
                    <span>Sign In to ResolveX</span>
                  </Button>
                </Link>
                <Link href="/register">
                  <Button variant="outline">
                    Create Account
                  </Button>
                </Link>
              </div>
            </div>
          ) : userProfile?.status === "suspended" ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive mb-4">
                <ShieldAlert size={30} />
              </div>
              <h2 className="text-xl font-bold tracking-tight text-foreground">Account Suspended</h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Your society access has been suspended by the management committee. Please contact your society office or administrator for reinstatement.
              </p>
            </div>
          ) : isAuthorized ? (
            children
          ) : (
            <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 mb-4">
                <ShieldAlert size={30} />
              </div>
              <h2 className="text-xl font-bold tracking-tight text-foreground">Access Restricted</h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                The module <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{pathname}</code> is not accessible for the <strong>{roleLabels[activeRole]}</strong> role.
              </p>
              <div className="mt-6 flex gap-3">
                <Link href="/">
                  <Button>
                    Return to {roleLabels[activeRole]} Workspace
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Mobile bottom nav */}
        <nav className="fixed bottom-0 left-0 right-0 z-30 flex border-t bg-card/95 backdrop-blur-md xl:hidden">
          {mobileNav.map((item) => {
            const active = pathname === item.href;
            const Icon = getNavIcon(item.iconKey);
            return (
              <Link
                key={`${item.href}-${item.label}`}
                href={item.href}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 py-2 text-xs font-semibold rx-transition",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <div
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-md rx-transition",
                    active && "bg-primary/10"
                  )}
                >
                  <Icon size={17} />
                </div>
                <span className="truncate max-w-[65px] text-[10px]">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </main>

      {/* ── Command-Palette Search ───────────────────────────────────────── */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-xl border bg-card shadow-soft">
            {/* Search input */}
            <div className="flex items-center gap-3 border-b px-4 py-3">
              <Search size={16} className="shrink-0 text-muted-foreground" />
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedResultIdx(0);
                }}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search complaints, residents, staff, facilities…"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
              />
              <button
                onClick={() => setSearchOpen(false)}
                className="shrink-0 text-muted-foreground hover:text-foreground rx-transition"
                aria-label="Close search"
              >
                <X size={16} />
              </button>
            </div>

            {/* Category Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto border-b bg-muted/20 px-4 py-2 scrollbar-none">
              {SEARCH_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setSearchCategory(cat.id);
                    setSelectedResultIdx(0);
                  }}
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium rx-transition",
                    searchCategory === cat.id
                      ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                      : "bg-background text-muted-foreground border hover:bg-muted hover:text-foreground"
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Results */}
            {searchQuery.trim().length < 2 ? (
              <div className="px-4 py-3">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quick Navigation</p>
                <div className="space-y-1">
                  {currentNavGroups.flatMap((g) => g.items).slice(0, 6).map((item) => {
                    const Icon = getNavIcon(item.iconKey);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setSearchOpen(false)}
                        className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground rx-transition hover:bg-muted hover:text-foreground"
                      >
                        <Icon size={15} />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No results for <span className="font-semibold text-foreground">"{searchQuery}"</span>
                <p className="mt-1 text-xs">Try searching for a complaint, resident name, or facility</p>
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto py-1.5">
                {searchResults.map((result, idx) => (
                  <Link
                    key={result.id}
                    href={result.href}
                    onClick={() => setSearchOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-2.5 rx-transition",
                      idx === selectedResultIdx
                        ? "bg-primary/7 text-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-xs font-semibold text-muted-foreground">
                      {typeLabels[result.type]}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{result.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{result.subtitle}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* Footer hint */}
            <div className="flex items-center gap-4 border-t px-4 py-2 text-xs text-muted-foreground/60">
              <span><kbd className="font-mono">↑↓</kbd> navigate</span>
              <span><kbd className="font-mono">↵</kbd> open</span>
              <span><kbd className="font-mono">Esc</kbd> close</span>
            </div>
          </div>
        </div>
      )}

      {/* ── QR Modal ────────────────────────────────────────────────────── */}
      {qrModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rx-card-elevated overflow-hidden">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div className="flex items-center gap-2">
                <QrCode size={18} className="text-primary" />
                <h3 className="text-base font-bold">Scan Location QR Code</h3>
              </div>
              <button
                onClick={() => setQrModalOpen(false)}
                className="rounded-md p-1 rx-transition hover:bg-muted"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="border-b px-5 py-3">
              <p className="text-sm text-muted-foreground">
                Simulate scanning a QR code placed on a society asset or common area location.
              </p>
            </div>

            <div className="px-5 py-4 space-y-2">
              {assetQRCodes.map((qr) => (
                <div
                  key={qr.id}
                  className="flex items-center justify-between rounded-lg border bg-muted/30 px-3.5 py-3 rx-transition hover:bg-muted/60"
                >
                  <div>
                    <p className="text-sm font-semibold">{qr.locationName}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground font-mono">
                      {qr.code} · {qr.description}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => simulateScan(qr.code, qr.locationName)}
                  >
                    Scan
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
