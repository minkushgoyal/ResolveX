import type { ComplaintCategory, StaffDepartment } from "@resolvex/types";
import { assetQRCodes, commonLocations } from "./demo-data";

export interface ResolvedQRLocation {
  token: string;
  societyId: string;
  towerId?: string;
  assetId?: string;
  locationLabel: string;
  category: ComplaintCategory;
  department: StaffDepartment;
  description?: string;
}

const QR_LOOKUP_MAP: Record<string, ResolvedQRLocation> = {
  "QR-AJX-TA-LIFT1": {
    token: "QR-AJX-TA-LIFT1",
    societyId: "soc-ajanta-genx",
    towerId: "tower-a",
    assetId: "fac-lift-ta1",
    locationLabel: "Tower A Lift 1 (Passenger Core)",
    category: "lift",
    department: "lift",
    description: "Schindler Passenger Lift A1 Core"
  },
  "QR-AJX-TB-LIFT2": {
    token: "QR-AJX-TB-LIFT2",
    societyId: "soc-ajanta-genx",
    towerId: "tower-b",
    assetId: "fac-lift-tb2",
    locationLabel: "Tower B Service Lift 2",
    category: "lift",
    department: "lift",
    description: "Tower B Service Elevator - B1 to 22nd Floor"
  },
  "QR-AJX-POOL-01": {
    token: "QR-AJX-POOL-01",
    societyId: "soc-ajanta-genx",
    assetId: "fac-pool-deck",
    locationLabel: "Clubhouse Swimming Pool Deck",
    category: "common_area",
    department: "housekeeping",
    description: "Clubhouse Pool and Filtration Deck"
  },
  "QR-AJX-ELEC-TA": {
    token: "QR-AJX-ELEC-TA",
    societyId: "soc-ajanta-genx",
    towerId: "tower-a",
    assetId: "fac-elec-substation",
    locationLabel: "Tower A Electrical Substation Room",
    category: "electrical",
    department: "electrical",
    description: "Main HT Substation & Distribution Panel"
  },
  "QR-AJX-GYM-01": {
    token: "QR-AJX-GYM-01",
    societyId: "soc-ajanta-genx",
    locationLabel: "Central Health & Fitness Gym",
    category: "common_area",
    department: "general_maintenance",
    description: "Clubhouse 2nd Floor Gym"
  },
  "QR-AJX-GATE-1": {
    token: "QR-AJX-GATE-1",
    societyId: "soc-ajanta-genx",
    locationLabel: "Main Entrance Security Gate 1",
    category: "security",
    department: "security",
    description: "Gate 1 Vehicle Boom Barrier & Intercom"
  },
  "QR-AJX-WATER-TA": {
    token: "QR-AJX-WATER-TA",
    societyId: "soc-ajanta-genx",
    towerId: "tower-a",
    assetId: "fac-water-tank",
    locationLabel: "Tower A Overhead Water Tank & Pump",
    category: "water_supply",
    department: "plumbing",
    description: "Hydro-pneumatic booster pump & tank"
  }
};

/**
 * Resolves a QR code token into an asset, location label, category, and department
 */
export function resolveQRCode(token: string): ResolvedQRLocation | null {
  const normalized = token.trim().toUpperCase();
  if (QR_LOOKUP_MAP[normalized]) {
    return QR_LOOKUP_MAP[normalized];
  }

  // Fallback check against predefined common locations
  const commonLoc = commonLocations.find((c) => c.qrCodeToken.toUpperCase() === normalized);
  if (commonLoc) {
    return {
      token: commonLoc.qrCodeToken,
      societyId: "soc-ajanta-genx",
      towerId: commonLoc.towerId,
      locationLabel: commonLoc.name,
      category: commonLoc.category === "lift" ? "lift" : commonLoc.category === "electrical" ? "electrical" : commonLoc.category === "water_supply" ? "water_supply" : "common_area",
      department: commonLoc.category === "lift" ? "lift" : commonLoc.category === "electrical" ? "electrical" : "general_maintenance",
      description: commonLoc.buildingOrArea
    };
  }

  // Fallback check against asset QR codes
  const assetQR = assetQRCodes.find((a) => a.code.toUpperCase() === normalized);
  if (assetQR) {
    return {
      token: assetQR.code,
      societyId: assetQR.societyId,
      towerId: assetQR.towerId,
      locationLabel: assetQR.locationName,
      category: assetQR.category === "lift" ? "lift" : "common_area",
      department: assetQR.category === "lift" ? "lift" : "general_maintenance",
      description: assetQR.description
    };
  }

  return null;
}

export const availableQRCodes = Object.values(QR_LOOKUP_MAP);
