"use client";
import { createContext, useCallback, useContext, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { SignInError, signInMessages, type AuthUser, type DepotResponse } from "@waypoint/api-contracts";
import { currentSession, DEMO_EMAILS, loadDemoAccount, webSignIn, webSignOut } from "../../../lib/auth-client";
import Sidebar from "../../../app/components/Sidebar";
import Navbar from "../../../app/components/Navbar";
import { colomboToday, getFleet } from "../data/dispatcher";
import { Alert, LoadError, Loading, useLoad } from "./ui";
import "../dispatcher.css";

type Dispatcher = {
  user: AuthUser;
  depots: DepotResponse[];
  /** Selected depot and Colombo calendar date, shared by every Dispatcher page. */
  depotId: string;
  setDepotId: (id: string) => void;
  day: string;
  setDay: (day: string) => void;
  onExpired: () => void;
  signOut: () => Promise<void>;
};
const DispatcherContext = createContext<Dispatcher | null>(null);

export function useDispatcher(): Dispatcher {
  const value = useContext(DispatcherContext);
  if (!value) throw new Error("useDispatcher must be used inside DispatcherShell");
  return value;
}

/** Gate for /dispatcher: the httpOnly session cookie decides access, also after a reload. */
export default function DispatcherShell({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [expired, setExpired] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    currentSession("DISPATCHER").then((result) => {
      if (!active) return;
      if (result.status === "signed-in") setUser(result.user);
      else if (result.status === "expired") setExpired(true);
      else if (result.status !== "signed-out") setNotice(signInMessages[result.status]);
      setChecking(false);
    });
    return () => { active = false; };
  }, []);

  const onExpired = useCallback(() => { setUser(null); setExpired(true); }, []);
  const signOut = useCallback(async () => {
    await webSignOut();
    setUser(null);
    setExpired(false);
    setNotice(null);
  }, []);

  if (checking) return <div className="dx-signin"><Loading t="Checking your session…" /></div>;
  if (!user) {
    return <SignIn expired={expired} notice={notice} onSignedIn={(signedIn) => { setUser(signedIn); setExpired(false); setNotice(null); }} />;
  }
  return <Workspace key={user.id} user={user} onExpired={onExpired} signOut={signOut}>{children}</Workspace>;
}

function Workspace({ user, onExpired, signOut, children }: { user: AuthUser; onExpired: () => void; signOut: () => Promise<void>; children: ReactNode }) {
  const fleet = useLoad(() => getFleet(), onExpired);
  const [depotId, setDepotId] = useState("");
  const [day, setDay] = useState(() => colomboToday());
  const depots = fleet.data?.depots ?? [];
  const selected = depots.some((d) => d.id === depotId) ? depotId : depots[0]?.id ?? "";

  let body: ReactNode;
  if (fleet.loading) body = <Loading t="Loading your depots…" />;
  else if (fleet.error) body = <LoadError error={fleet.error} retry={fleet.reload} />;
  else if (!depots.length) body = <Alert k="w" t="No depot assigned">Ask an administrator to assign your depot before planning.</Alert>;
  else body = children;

  return (
    <DispatcherContext.Provider value={{ user, depots, depotId: selected, setDepotId, day, setDay, onExpired, signOut }}>
      <div className="app-layout">
        <Sidebar />
        <div className="main-layout">
          <Navbar />
          <main className="page">{body}</main>
        </div>
      </div>
    </DispatcherContext.Provider>
  );
}

function SignIn({ expired, notice, onSignedIn }: { expired: boolean; notice: string | null; onSignedIn: (user: AuthUser) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const demo = DEMO_EMAILS.DISPATCHER;
  // Demo stack only: the server returns the demo account; sign-in still goes through the API.
  const [demoAccount, setDemoAccount] = useState<{ email: string; password: string } | null>(null);
  useEffect(() => { loadDemoAccount("DISPATCHER").then(setDemoAccount); }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const user = await webSignIn(email.trim(), password, remember, "DISPATCHER");
      setPassword("");
      onSignedIn(user);
    } catch (err) {
      setError(err instanceof SignInError ? signInMessages[err.reason] : signInMessages.unavailable);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dx-signin">
      <div className="logo" style={{ padding: 0 }}>
        <div className="logo-icon">➤</div>
        <div><strong>Waypoint</strong><span>DISPATCHER</span></div>
      </div>
      <h1>{expired ? "Your session has expired" : "Sign in to dispatch"}</h1>
      <form onSubmit={submit}>
        {expired && <Alert k="w" t="Sign in again to continue." />}
        {notice && <Alert k="w" t={notice} />}
        {error && <Alert k="e" t={error} />}
        {demoAccount && (
          <Alert t="Demo account">
            <div>Email: <code>{demoAccount.email}</code></div>
            <div>Password: <code>{demoAccount.password}</code></div>
            <button type="button" className="dx-btn" style={{ marginTop: 8 }} onClick={() => { setEmail(demoAccount.email); setPassword(demoAccount.password); }}>Use demo account</button>
          </Alert>
        )}
        <label className="dx-field">Work email<input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="dx-field">Password<input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <label className="dx-muted"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Keep me signed in</label>
        <button className="dx-btn p" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        {demo && !demoAccount && <p className="dx-muted">Demo: <a href="#" onClick={(e) => { e.preventDefault(); setEmail(demo); }}>use {demo}</a> with the password set when the demo accounts were seeded.</p>}
      </form>
    </div>
  );
}
