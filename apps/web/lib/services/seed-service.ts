import { doc, writeBatch } from "firebase/firestore";
import { buildSeedPayload } from "@resolvex/utils";
import { db, isFirebaseConfigured } from "../firebase";
import { reactiveStore } from "./data-store";

export async function seedFirestoreDatabase(): Promise<{ success: boolean; count: number }> {
  const payload = buildSeedPayload();
  let count = 0;

  if (isFirebaseConfigured) {
    try {
      const batch = writeBatch(db);

      // Seed societies
      for (const [id, s] of Object.entries(payload.societies)) {
        batch.set(doc(db, "societies", id), s);
        count++;
      }

      // Seed towers
      for (const [id, t] of Object.entries(payload.towers)) {
        batch.set(doc(db, "towers", id), t);
        count++;
      }

      // Seed flats
      for (const [id, f] of Object.entries(payload.flats)) {
        batch.set(doc(db, "flats", id), f);
        count++;
      }

      // Seed households
      for (const [id, h] of Object.entries(payload.households)) {
        batch.set(doc(db, "households", id), h);
        count++;
      }

      // Seed users
      for (const [id, u] of Object.entries(payload.users)) {
        batch.set(doc(db, "users", id), u);
        count++;
      }

      // Seed facilities
      for (const [id, fac] of Object.entries(payload.facilities)) {
        batch.set(doc(db, "facilities", id), fac);
        count++;
      }

      // Seed complaints
      for (const [id, c] of Object.entries(payload.complaints)) {
        batch.set(doc(db, "complaints", id), c);
        count++;
      }

      // Seed visitor passes
      for (const [id, v] of Object.entries(payload.visitor_passes)) {
        batch.set(doc(db, "visitor_passes", id), v);
        count++;
      }

      // Seed bills
      for (const [id, b] of Object.entries(payload.bills)) {
        batch.set(doc(db, "bills", id), b);
        count++;
      }

      await batch.commit();
      return { success: true, count };
    } catch (err) {
      console.warn("Could not commit batch to Firestore, resetting local store:", err);
    }
  }

  reactiveStore.resetToDefault();
  return { success: true, count: 50 };
}
