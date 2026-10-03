"use client";
import { useState } from "react";
import { Alert } from "./ui";
import type { State, SetFn } from "../data/mock";

export default function Auth({ S, set }: { S: State; set: SetFn }) {
  const [v, setV] = useState("in");
  const [em, setEm] = useState("chamari@waypoint.lk");
  const [pw, setPw] = useState("waypoint");
  const [bad, setBad] = useState(false);
  const signIn = () => (em && pw === "waypoint" ? set({ signed: true, expired: false, route: "home" }) : setBad(true));
  return (
    <div style={{ width: "100%" }}><div className="sig card">
      <div className="logo" style={{ padding: 0 }}>Waypoint</div><div className="role" style={{ padding: "0 0 12px" }}>STORE MANAGER</div>
      {v === "in" && (<>
        <h2>{S.expired ? "Your session has expired" : "Welcome back"}</h2>
        {S.expired && <p className="m">Your draft order is saved on this device.</p>}
        {bad && <Alert k="e" t="Email or password is incorrect" />}
        <label>Work email<input type="email" value={em} onChange={(e) => setEm(e.target.value)} /></label><br /><br />
        <label>Password<input type="password" value={pw} onChange={(e) => setPw(e.target.value)} /></label>
        <p><label><input type="checkbox" defaultChecked /> Keep me signed in</label></p>
        <button className="p" style={{ width: "100%" }} onClick={signIn}>Sign in</button>
        <p><a href="#" onClick={(e) => { e.preventDefault(); setV("reset"); }}>Forgot password</a></p>
      </>)}
      {v === "reset" && (<>
        <h2>Reset your password</h2><label>Work email<input type="email" /></label><br /><br />
        <button className="p" style={{ width: "100%" }} onClick={() => setV("sent")}>Send reset link</button>
        <p><a href="#" onClick={(e) => { e.preventDefault(); setV("in"); }}>Back to sign in</a></p>
      </>)}
      {v === "sent" && (<><h2>Check your email</h2><p className="m">If an account exists, a reset link is on its way (simulated).</p><button className="p" onClick={() => setV("in")}>Back to sign in</button></>)}
    </div></div>
  );
}
