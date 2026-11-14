"use client";

import { useEffect, useRef, useState } from "react";
import { useAdmin } from "./AdminContext";

export default function AdminMenu() {
  const { admin, configured, login, logout } = useAdmin();
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  if (admin) {
    return (
      <div className="admin-menu">
        <span className="admin-badge">Admin mode</span>
        <button type="button" className="admin-link" onClick={() => logout()}>
          Log out
        </button>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const err = await login(username, password);
    setBusy(false);
    if (err) setError(err);
    else {
      setPassword("");
      setOpen(false);
    }
  };

  return (
    <div className="admin-menu" ref={boxRef}>
      <button type="button" className="admin-link" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        Admin login
      </button>
      {open && (
        <form className="admin-pop" onSubmit={submit}>
          <label htmlFor="admin-user">Username</label>
          <input
            id="admin-user"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={!configured || busy}
          />
          <label htmlFor="admin-pw">Password</label>
          <input
            id="admin-pw"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={!configured || busy}
          />
          {!configured && <p className="admin-err">Admin login isn&apos;t set up yet.</p>}
          {error && <p className="admin-err">{error}</p>}
          <button type="submit" className="btn-gold" disabled={!configured || busy || !password || !username}>
            {busy ? "Checking…" : "Log in"}
          </button>
        </form>
      )}
    </div>
  );
}
