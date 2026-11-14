"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

interface AdminState {
  admin: boolean;
  configured: boolean;
  login: (password: string) => Promise<string | null>; // returns an error message or null
  logout: () => Promise<void>;
}

const Ctx = createContext<AdminState>({
  admin: false,
  configured: false,
  login: async () => "Not available",
  logout: async () => {},
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

  const login = useCallback(async (password: string) => {
    try {
      const r = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const d = await r.json();
      if (!r.ok) return d.error || "Login failed.";
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

  return <Ctx.Provider value={{ admin, configured, login, logout }}>{children}</Ctx.Provider>;
}

export const useAdmin = () => useContext(Ctx);
