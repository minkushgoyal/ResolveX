"use client";

import { create } from "zustand";
import type { PlatformRole } from "@resolvex/types";

interface SessionState {
  activeRole: PlatformRole;
  setActiveRole: (role: PlatformRole) => void;
  theme: "light" | "dark";
  toggleTheme: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  activeRole: "resident",
  setActiveRole: (role) => set({ activeRole: role }),
  theme: "light",
  toggleTheme: () => set((state) => ({ theme: state.theme === "light" ? "dark" : "light" }))
}));
