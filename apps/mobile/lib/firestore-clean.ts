/**
 * Recursively cleans an object by omitting any undefined fields,
 * ensuring Firestore setDoc, addDoc, and updateDoc calls never fail
 * with "Unsupported field value: undefined".
 */
export function cleanFirestorePayload<T extends Record<string, any>>(obj: T): T {
  if (obj === null || obj === undefined || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) =>
        typeof item === "object" && item !== null && !(item instanceof Date)
          ? cleanFirestorePayload(item)
          : item
      ) as unknown as T;
  }

  const cleaned: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) {
      continue;
    }
    if (value !== null && typeof value === "object" && !(value instanceof Date)) {
      cleaned[key] = cleanFirestorePayload(value);
    } else {
      cleaned[key] = value;
    }
  }

  return cleaned as T;
}
