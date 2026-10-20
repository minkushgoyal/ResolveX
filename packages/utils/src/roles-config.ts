import type { PlatformRole } from "@resolvex/types";

export interface RoleNavItem {
  href: string;
  label: string;
  iconKey: string;
  badge?: string;
}

export interface RoleNavGroup {
  label: string;
  items: RoleNavItem[];
}

export const ROLE_NAV_GROUPS: Record<PlatformRole, RoleNavGroup[]> = {
  resident: [
    {
      label: "Overview",
      items: [
        { href: "/", label: "Home", iconKey: "home" }
      ]
    },
    {
      label: "My Society",
      items: [
        { href: "/complaints", label: "My Complaints", iconKey: "clipboard" },
        { href: "/community", label: "Notices & Feed", iconKey: "megaphone" },
        { href: "/community", label: "Community", iconKey: "community" },
        { href: "/community", label: "Events", iconKey: "calendar" }
      ]
    },
    {
      label: "My Household",
      items: [
        { href: "/households", label: "Household", iconKey: "household" },
        { href: "/households", label: "Visitors", iconKey: "user-check" }
      ]
    },
    {
      label: "Services",
      items: [
        { href: "/services", label: "Amenities", iconKey: "calendar" },
        { href: "/services", label: "Home Services", iconKey: "wrench" },
        { href: "/services", label: "Maintenance Bills", iconKey: "credit-card" }
      ]
    }
  ],

  flat_owner: [
    {
      label: "Overview",
      items: [
        { href: "/", label: "Owner Dashboard", iconKey: "layout" }
      ]
    },
    {
      label: "Property",
      items: [
        { href: "/households", label: "My Flat", iconKey: "home" },
        { href: "/households", label: "Household Members", iconKey: "household" },
        { href: "/households", label: "Resident Verifications", iconKey: "user-check" }
      ]
    },
    {
      label: "Operations",
      items: [
        { href: "/complaints", label: "Property Complaints", iconKey: "clipboard" },
        { href: "/households", label: "Visitor Passes", iconKey: "user-check" }
      ]
    },
    {
      label: "Finance",
      items: [
        { href: "/services", label: "Maintenance Bills", iconKey: "credit-card" },
        { href: "/services", label: "Payment History", iconKey: "file-text" }
      ]
    },
    {
      label: "Community",
      items: [
        { href: "/community", label: "Community", iconKey: "community" },
        { href: "/community", label: "Events & Polls", iconKey: "calendar" }
      ]
    }
  ],

  tenant: [
    {
      label: "Overview",
      items: [
        { href: "/", label: "Home", iconKey: "home" }
      ]
    },
    {
      label: "My Stay",
      items: [
        { href: "/complaints", label: "My Complaints", iconKey: "clipboard" },
        { href: "/households", label: "Visitor Passes", iconKey: "user-check" },
        { href: "/community", label: "Society Notices", iconKey: "megaphone" }
      ]
    },
    {
      label: "Community",
      items: [
        { href: "/community", label: "Community", iconKey: "community" },
        { href: "/community", label: "Events", iconKey: "calendar" }
      ]
    },
    {
      label: "Services",
      items: [
        { href: "/services", label: "Amenities", iconKey: "calendar" },
        { href: "/services", label: "Home Services", iconKey: "wrench" }
      ]
    }
  ],

  society_manager: [
    {
      label: "Command",
      items: [
        { href: "/admin", label: "Command Center", iconKey: "layout" }
      ]
    },
    {
      label: "Operations",
      items: [
        { href: "/complaints", label: "Complaints & Dispatch", iconKey: "clipboard" },
        { href: "/staff", label: "Staff & Workforce", iconKey: "user-check" },
        { href: "/facilities", label: "Facilities & Assets", iconKey: "cpu" },
        { href: "/households", label: "Households & Residents", iconKey: "household" }
      ]
    },
    {
      label: "Finance",
      items: [
        { href: "/services", label: "Maintenance & Billing", iconKey: "credit-card" },
        { href: "/admin?tab=billing", label: "Collections & Dues", iconKey: "file-text" }
      ]
    },
    {
      label: "Community",
      items: [
        { href: "/community", label: "Notices & Broadcasts", iconKey: "megaphone" },
        { href: "/community", label: "Events & Rallies", iconKey: "calendar" }
      ]
    },
    {
      label: "Administration",
      items: [
        { href: "/admin/verifications", label: "Registration Verification", iconKey: "user-check" },
        { href: "/admin?tab=sla", label: "Analytics & SLA Reports", iconKey: "layout" },
        { href: "/admin?tab=visitors", label: "Visitor Gate Management", iconKey: "user-check" }
      ]
    }
  ],

  society_admin: [
    {
      label: "Command",
      items: [
        { href: "/admin", label: "Admin Command Center", iconKey: "layout" }
      ]
    },
    {
      label: "Operations",
      items: [
        { href: "/complaints", label: "Complaints Triage", iconKey: "clipboard" },
        { href: "/staff", label: "Workforce", iconKey: "user-check" },
        { href: "/facilities", label: "Facilities", iconKey: "cpu" },
        { href: "/households", label: "Households & Properties", iconKey: "household" }
      ]
    },
    {
      label: "Finance",
      items: [
        { href: "/services", label: "Billing & Invoices", iconKey: "credit-card" },
        { href: "/admin?tab=billing", label: "Payments & Accounting", iconKey: "file-text" }
      ]
    },
    {
      label: "Administration",
      items: [
        { href: "/admin/verifications", label: "Registration Verification", iconKey: "user-check" },
        { href: "/admin?tab=users", label: "User Directory", iconKey: "user-check" },
        { href: "/admin?tab=sla", label: "SLA & Escalations", iconKey: "layout" },
        { href: "/admin?tab=permissions", label: "Roles & Permissions", iconKey: "shield" },
        { href: "/admin?tab=society", label: "Society Settings", iconKey: "building" },
        { href: "/admin?tab=audit", label: "Audit Logs", iconKey: "file-text" }
      ]
    }
  ],

  maintenance_staff: [
    {
      label: "My Work",
      items: [
        { href: "/", label: "Today's Queue", iconKey: "clipboard" },
        { href: "/complaints", label: "Assigned Work Orders", iconKey: "wrench" }
      ]
    },
    {
      label: "Operations",
      items: [
        { href: "/complaints", label: "All Complaints", iconKey: "clipboard" },
        { href: "/facilities", label: "Assigned Facilities", iconKey: "cpu" }
      ]
    },
    {
      label: "Account",
      items: [
        { href: "/staff", label: "Duty Status & Skills", iconKey: "user-check" }
      ]
    }
  ],

  security_guard: [
    {
      label: "Gate",
      items: [
        { href: "/", label: "Gate Dashboard", iconKey: "shield" },
        { href: "/households", label: "Resident Verification", iconKey: "user-check" }
      ]
    },
    {
      label: "Security Log",
      items: [
        { href: "/facilities", label: "CCTV & Gate Infrastructure", iconKey: "cpu" },
        { href: "/complaints", label: "Security Incident Logs", iconKey: "siren" }
      ]
    }
  ],

  service_provider: [
    {
      label: "Work",
      items: [
        { href: "/", label: "Assigned Requests", iconKey: "wrench" },
        { href: "/complaints", label: "Work Orders", iconKey: "clipboard" }
      ]
    },
    {
      label: "Profile",
      items: [
        { href: "/services", label: "Service Catalog & Rates", iconKey: "store" },
        { href: "/staff", label: "Ratings & Reviews", iconKey: "star" }
      ]
    }
  ],

  super_admin: [
    {
      label: "Platform",
      items: [
        { href: "/", label: "Platform Cloud Overview", iconKey: "layout" },
        { href: "/admin/verifications", label: "Registration Verification", iconKey: "user-check" },
        { href: "/admin", label: "Registered Societies", iconKey: "building" },
        { href: "/admin", label: "Global Users", iconKey: "household" }
      ]
    },
    {
      label: "Configuration",
      items: [
        { href: "/admin", label: "System Config & Roles", iconKey: "shield" },
        { href: "/facilities", label: "Infrastructure Telemetry", iconKey: "cpu" }
      ]
    },
    {
      label: "Monitoring",
      items: [
        { href: "/admin", label: "Audit Logs & Security", iconKey: "file-text" },
        { href: "/complaints", label: "Global Escalation Queue", iconKey: "siren" }
      ]
    }
  ]
};

export const ROLE_ROUTE_PERMISSIONS: Record<PlatformRole, string[]> = {
  resident: ["/", "/complaints", "/community", "/services", "/households"],
  flat_owner: ["/", "/complaints", "/community", "/services", "/households"],
  tenant: ["/", "/complaints", "/community", "/services", "/households"],
  society_manager: ["/", "/complaints", "/community", "/services", "/households", "/staff", "/facilities", "/admin", "/admin/verifications"],
  society_admin: ["/", "/complaints", "/community", "/services", "/households", "/staff", "/facilities", "/admin", "/admin/verifications"],
  maintenance_staff: ["/", "/complaints", "/facilities", "/staff"],
  security_guard: ["/", "/households", "/facilities", "/complaints"],
  service_provider: ["/", "/complaints", "/services", "/staff"],
  super_admin: ["/", "/complaints", "/community", "/services", "/households", "/staff", "/facilities", "/admin", "/admin/verifications"]
};
