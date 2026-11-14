"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

interface AdminState {
  admin: boolean;
  configured: boolean;
  login: (username: string, password: string) => Promise<string | null>; // returns an error message or null
  logout: () => Promise<void>;
  /** Called when the server says this browser isn't an admin after all. */
  markLoggedOut: () => void;
}

const Ctx = createContext<AdminState>({
  admin: false,
  configured: false,
  login: async () => "Not available",
  logout: async () => {},
  markLoggedOut: () => {},
});

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState(false);
  const [configured, setConfigured] = useState(false);

  useEffect(() => {
    fetch("/api/admin", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setAdmin(!!d.admin);
        setConfigured(!!d.configured);
      })
      .catch(() => {});
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    try {
      const r = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const d = await r.json();
      if (!r.ok) return d.error || "Login failed.";
      // Confirm the session cookie stuck before switching the UI to admin mode.
      const check = await fetch("/api/admin", { cache: "no-store" }).then((x) => x.json());
      if (!check.admin) return "Logged in, but your browser didn't keep the session. Allow cookies for this site and try again.";
      setAdmin(true);
      return null;
    } catch {
      return "Couldn't reach the server.";
    }
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/admin", { method: "DELETE" }).catch(() => {});
    setAdmin(false);
  }, []);

  const markLoggedOut = useCallback(() => setAdmin(false), []);

  return <Ctx.Provider value={{ admin, configured, login, logout, markLoggedOut }}>{children}</Ctx.Provider>;
}

export const useAdmin = () => useContext(Ctx);
