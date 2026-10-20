import type { SeedPayload } from "@resolvex/utils";
import { buildSeedPayload } from "@resolvex/utils";

type Listener<T> = (data: T) => void;

class ReactiveDataStore {
  private payload: SeedPayload = buildSeedPayload();
  private listeners: Record<string, Set<Listener<any>>> = {};

  constructor() {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("resolvex_demo_store_v1");
        if (saved) {
          const parsed = JSON.parse(saved);
          this.payload = { ...this.payload, ...parsed };
        }
      } catch (e) {
        // ignore parse error
      }
    }
  }

  private persist() {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("resolvex_demo_store_v1", JSON.stringify(this.payload));
      } catch (e) {
        // quota exceeded
      }
    }
  }

  public subscribe<T = any>(collectionKey: keyof SeedPayload, callback: Listener<T>): () => void {
    if (!this.listeners[collectionKey]) {
      this.listeners[collectionKey] = new Set();
    }
    this.listeners[collectionKey].add(callback);

    // Initial immediate invocation
    const data = Object.values(this.payload[collectionKey]) as unknown as T;
    callback(data);

    return () => {
      this.listeners[collectionKey]?.delete(callback);
    };
  }

  public notify(collectionKey: keyof SeedPayload) {
    if (this.listeners[collectionKey]) {
      const data = Object.values(this.payload[collectionKey]);
      this.listeners[collectionKey].forEach((cb) => cb(data));
    }
    this.persist();
  }

  // Flexible Getters supporting both getDoc("users", id) and getDoc<UserProfile>("users", id)
  public getCollection<T = any>(collectionKey: keyof SeedPayload): T[] {
    return Object.values(this.payload[collectionKey]) as unknown as T[];
  }

  public getDoc<T = any>(collectionKey: keyof SeedPayload, id: string): T | undefined {
    return (this.payload[collectionKey] as Record<string, any>)[id] as T | undefined;
  }

  // Setters
  public setDoc<T = any>(collectionKey: keyof SeedPayload, doc: T): T {
    const id = (doc as any).id || (doc as any).uid;
    if (!id) throw new Error("Document must have id or uid");
    (this.payload[collectionKey] as Record<string, any>)[id] = doc;
    this.notify(collectionKey);
    return doc;
  }

  public updateDoc<T = any>(
    collectionKey: keyof SeedPayload,
    id: string,
    updates: Record<string, any>
  ): T | undefined {
    const existing = (this.payload[collectionKey] as Record<string, any>)[id];
    if (!existing) return undefined;
    const updated = { ...existing, ...updates };
    (this.payload[collectionKey] as Record<string, any>)[id] = updated;
    this.notify(collectionKey);
    return updated as T;
  }

  public deleteDoc(collectionKey: keyof SeedPayload, id: string): boolean {
    if ((this.payload[collectionKey] as Record<string, any>)[id]) {
      delete (this.payload[collectionKey] as Record<string, any>)[id];
      this.notify(collectionKey);
      return true;
    }
    return false;
  }

  public resetToDefault() {
    this.payload = buildSeedPayload();
    if (typeof window !== "undefined") {
      localStorage.removeItem("resolvex_demo_store_v1");
    }
    Object.keys(this.listeners).forEach((key) => {
      this.notify(key as any);
    });
  }
}

export const reactiveStore = new ReactiveDataStore();
