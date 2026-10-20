import type { Society, Tower } from "@resolvex/types";
import { demoSociety, towers as demoTowers } from "./demo-data";

export interface VerifiedSocietyRegistryItem extends Society {
  towers: Tower[];
  flatFormatDescription: string;
}

export const verifiedSocieties: VerifiedSocietyRegistryItem[] = [
  {
    ...demoSociety,
    towers: demoTowers,
    flatFormatDescription: "e.g., A-1204, B-804, C-302"
  },
  {
    id: "soc-green-valley",
    name: "Green Valley Heights",
    tagline: "Eco-conscious living with modern amenities.",
    address: "Plot 12, Expressway Zone, Greater Noida",
    city: "Greater Noida",
    createdAt: "2026-08-01T09:00:00.000Z",
    settings: {
      approvalRequiredForJoin: true,
      tenantsCanViewBills: false,
      directoryPhoneVisibleByDefault: false,
      complaintEscalationHours: {
        notifyManager: 24,
        increasePriority: 48,
        notifyAdmin: 72
      }
    },
    towers: [
      { id: "tower-1", societyId: "soc-green-valley", name: "Tower 1", floors: 18 },
      { id: "tower-2", societyId: "soc-green-valley", name: "Tower 2", floors: 18 }
    ],
    flatFormatDescription: "e.g., T1-402, T2-901"
  },
  {
    id: "soc-grand-arch",
    name: "The Grand Arch Residency",
    tagline: "Signature high-rise living and luxury governance.",
    address: "Golf Course Extension, Sector 58, Gurugram",
    city: "Gurugram",
    createdAt: "2026-08-01T09:00:00.000Z",
    settings: {
      approvalRequiredForJoin: true,
      tenantsCanViewBills: true,
      directoryPhoneVisibleByDefault: false,
      complaintEscalationHours: {
        notifyManager: 24,
        increasePriority: 48,
        notifyAdmin: 72
      }
    },
    towers: [
      { id: "tower-east", societyId: "soc-grand-arch", name: "Tower East", floors: 28 },
      { id: "tower-west", societyId: "soc-grand-arch", name: "Tower West", floors: 28 }
    ],
    flatFormatDescription: "e.g., E-1401, W-2204"
  }
];

export interface SocietyHierarchyValidationResult {
  valid: boolean;
  error?: string;
  society?: VerifiedSocietyRegistryItem;
  tower?: Tower;
  sanitizedFlatId?: string;
}

/**
 * Validates that society exists, is active, tower belongs to society, and flat is plausible
 */
export function validateSocietyTowerFlat(
  societyId: string,
  towerId: string,
  flatNumber: string
): SocietyHierarchyValidationResult {
  if (!societyId) {
    return { valid: false, error: "Please select a verified society." };
  }

  const society = verifiedSocieties.find((s) => s.id === societyId);
  if (!society) {
    return { valid: false, error: "The selected society is not recognized in the verified registry." };
  }

  if (!towerId) {
    return { valid: false, error: "Please select a tower." };
  }

  const tower = society.towers.find((t) => t.id === towerId);
  if (!tower) {
    return { valid: false, error: `The selected tower does not belong to ${society.name}.` };
  }

  const cleanFlat = flatNumber.trim().toUpperCase();
  if (!cleanFlat || cleanFlat.length < 2) {
    return { valid: false, error: "Please enter a valid flat or unit number (e.g. A-1204)." };
  }

  // Generate standardized flatId: e.g. "flat-a-1204"
  const sanitizedFlatId = `flat-${towerId.replace("tower-", "")}-${cleanFlat.replace(/[^A-Z0-9]/gi, "").toLowerCase()}`;

  return {
    valid: true,
    society,
    tower,
    sanitizedFlatId
  };
}

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const INDIAN_PHONE_REGEX = /^(\+91[\-\s]?)?[6-9]\d{9}$/;

export interface FieldValidationErrors {
  fullName?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
  societyId?: string;
  towerId?: string;
  flatNumber?: string;
}

/**
 * Field-level validation for user registration
 */
export function validateRegistrationFields(values: {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  societyId: string;
  towerId: string;
  flatNumber: string;
}): { isValid: boolean; errors: FieldValidationErrors } {
  const errors: FieldValidationErrors = {};

  // Full Name: >= 2 characters
  if (!values.fullName.trim() || values.fullName.trim().length < 2) {
    errors.fullName = "Full name must be at least 2 characters.";
  }

  // Email: valid format
  if (!values.email.trim() || !EMAIL_REGEX.test(values.email.trim())) {
    errors.email = "Please enter a valid email address.";
  }

  // Phone: valid Indian phone number format
  const cleanPhone = values.phone.trim().replace(/\s+/g, "");
  if (!cleanPhone || !INDIAN_PHONE_REGEX.test(cleanPhone)) {
    errors.phone = "Please enter a valid 10-digit Indian phone number.";
  }

  // Password: >= 8 chars, at least 1 letter and 1 number
  if (!values.password || values.password.length < 8) {
    errors.password = "Password must be at least 8 characters.";
  } else if (!/[A-Za-z]/.test(values.password)) {
    errors.password = "Password must contain at least one letter.";
  } else if (!/\d/.test(values.password)) {
    errors.password = "Password must contain at least one number.";
  }

  // Confirm Password: match
  if (values.password !== values.confirmPassword) {
    errors.confirmPassword = "Passwords do not match.";
  }

  // Society hierarchy
  const hierarchyCheck = validateSocietyTowerFlat(values.societyId, values.towerId, values.flatNumber);
  if (!hierarchyCheck.valid) {
    if (!values.societyId) errors.societyId = hierarchyCheck.error;
    else if (!values.towerId) errors.towerId = hierarchyCheck.error;
    else errors.flatNumber = hierarchyCheck.error;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Maps raw Firebase authentication errors to user-friendly copy
 */
export function mapFirebaseErrorToMessage(error: any): string {
  const code: string = error?.code || error?.message || "";

  switch (code) {
    case "auth/user-not-found":
    case "auth/invalid-credential":
      return "Account not found or credentials incorrect. Please check your details or create an account.";
    case "auth/wrong-password":
      return "Incorrect password. Please try again or use forgot password.";
    case "auth/email-already-in-use":
      return "An account with this email address already exists. Please sign in instead.";
    case "auth/invalid-email":
      return "The email address is invalid. Please check the spelling.";
    case "auth/weak-password":
      return "The password is too weak. Please use at least 8 characters with letters and numbers.";
    case "auth/too-many-requests":
      return "Too many failed attempts. Access to this account has been temporarily disabled. Please reset your password or try again later.";
    case "auth/user-disabled":
      return "This account has been disabled by society administration. Please contact support.";
    case "auth/network-request-failed":
      return "Network connection issue. Please check your internet and try again.";
    case "auth/popup-closed-by-user":
      return "Google sign-in was cancelled before completion.";
    default:
      if (error?.message && !error.message.includes("Firebase:") && !error.message.includes("auth/")) {
        return error.message;
      }
      return "Authentication error. Please verify your credentials and try again.";
  }
}
