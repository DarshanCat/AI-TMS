"use client";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const DOMAIN = process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN || "vijayspheroidals.com";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function register() {
    setMsg(null);
    if (!email.trim().toLowerCase().endsWith("@" + DOMAIN)) {
      setMsg({ ok: false, t: `Only @${DOMAIN} accounts can register.` }); return;
    }
    if (pw.length < 6) { setMsg({ ok: false, t: "Password must be at least 6 characters." }); return; }
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email: email.trim(), password: pw, options: { data: { full_name: name } },
    });
    setBusy(false);
    setMsg(error ? { ok: false, t: error.message }
                 : { ok: true, t: "Account created. You can sign in now." });
  }

  return (
    <div style={{ maxWidth: 360, margin: "12vh auto", fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 24, fontWeight: 800 }}>Create account</h1>
      <p style={{ color: "#5b636e", marginBottom: 20 }}>Company email required.</p>
      <input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)}
        style={{ width: "100%", padding: 11, marginBottom: 10, border: "1px solid #c7cdd4", borderRadius: 6 }} />
      <input placeholder={`you@${DOMAIN}`} value={email} onChange={(e) => setEmail(e.target.value)}
        style={{ width: "100%", padding: 11, marginBottom: 10, border: "1px solid #c7cdd4", borderRadius: 6 }} />
      <input type="password" placeholder="Password (min 6)" value={pw} onChange={(e) => setPw(e.target.value)}
        style={{ width: "100%", padding: 11, marginBottom: 12, border: "1px solid #c7cdd4", borderRadius: 6 }} />
      {msg && <div style={{ color: msg.ok ? "#2e7d5b" : "#c0392b", fontSize: 13, marginBottom: 10 }}>{msg.t}</div>}
      <button onClick={register} disabled={busy}
        style={{ width: "100%", padding: 12, background: "#1e4e5c", color: "#fff", border: "none", borderRadius: 6, fontWeight: 700 }}>
        {busy ? "Creating..." : "Create account"}
      </button>
      <p style={{ fontSize: 13, marginTop: 14 }}>Have an account? <Link href="/login">Sign in</Link></p>
    </div>
  );
}