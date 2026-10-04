"use client";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { SignInError, signInMessages, type AuthUser } from "@waypoint/api-contracts";
import { Alert } from "./ui";
import { DEMO_EMAILS, loadDemoAccount, webSignIn } from "@/lib/auth-client";

export default function Auth({ expired, onSignedIn, notice }: {
  expired: boolean; onSignedIn: (user: AuthUser) => void; notice?: string | null;
}) {
  const [v, setV] = useState("in");
  const [em, setEm] = useState("");
  const [pw, setPw] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const demo = DEMO_EMAILS.STORE_MANAGER;
  // Demo stack only: the server returns the demo account; sign-in still goes through the API.
  const [demoAccount, setDemoAccount] = useState<{ email: string; password: string } | null>(null);
  useEffect(() => { loadDemoAccount("STORE_MANAGER").then(setDemoAccount); }, []);

  const signIn = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const user = await webSignIn(em.trim(), pw, remember, "STORE_MANAGER");
      setPw("");
      onSignedIn(user);
    } catch (err) {
      setError(err instanceof SignInError ? signInMessages[err.reason] : signInMessages.unavailable);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ width: "100%" }}><div className="sig card">
      <div className="logo" style={{ padding: 0 }}>Waypoint</div><div className="role" style={{ padding: "0 0 12px" }}>STORE MANAGER</div>
      {v === "in" && (<form onSubmit={signIn}>
        <h2>{expired ? "Your session has expired" : "Welcome back"}</h2>
        {expired && <p className="m">Sign in again to continue.</p>}
        {notice && <Alert k="w" t={notice} />}
        {error && <Alert k="e" t={error} />}
        {demoAccount && (
          <Alert k="i" t="Demo account">
            <div>Email: <code>{demoAccount.email}</code></div>
            <div>Password: <code>{demoAccount.password}</code></div>
            <button type="button" style={{ marginTop: 8 }} onClick={() => { setEm(demoAccount.email); setPw(demoAccount.password); }}>Use demo account</button>
          </Alert>
        )}
        <label>Work email<input type="email" autoComplete="username" required value={em} onChange={(e) => setEm(e.target.value)} /></label><br /><br />
        <label>Password<input type="password" autoComplete="current-password" required value={pw} onChange={(e) => setPw(e.target.value)} /></label>
        <p><label><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Keep me signed in</label></p>
        <button className="p" style={{ width: "100%" }} type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        {demo && !demoAccount && <p className="m">Demo: <a href="#" onClick={(e) => { e.preventDefault(); setEm(demo); }}>use {demo}</a> with the password set when the demo accounts were seeded.</p>}
        <p><a href="#" onClick={(e) => { e.preventDefault(); setV("reset"); }}>Forgot password</a></p>
      </form>)}
      {v === "reset" && (<>
        <h2>Reset your password</h2>
        <p className="m">Password resets are not available in this app yet. Ask your Waypoint administrator to reset your password.</p>
        <p><a href="#" onClick={(e) => { e.preventDefault(); setV("in"); }}>Back to sign in</a></p>
      </>)}
    </div></div>
  );
}
