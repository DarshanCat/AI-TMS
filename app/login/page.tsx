"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setErr(""); setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    router.push("/dashboard"); router.refresh();
  }

  return (
    <div style={{ maxWidth: 360, margin: "12vh auto", fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 24, fontWeight: 800 }}>AI-TMS</h1>
      <p style={{ color: "#5b636e", marginBottom: 20 }}>Sign in with your company account.</p>
      <input placeholder="you@vijayspheroidals.com" value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ width: "100%", padding: 11, marginBottom: 10, border: "1px solid #c7cdd4", borderRadius: 6 }} />
      <input type="password" placeholder="Password" value={pw}
        onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && signIn()}
        style={{ width: "100%", padding: 11, marginBottom: 12, border: "1px solid #c7cdd4", borderRadius: 6 }} />
      {err && <div style={{ color: "#c0392b", fontSize: 13, marginBottom: 10 }}>{err}</div>}
      <button onClick={signIn} disabled={busy || !email || !pw}
        style={{ width: "100%", padding: 12, background: "#1e4e5c", color: "#fff", border: "none", borderRadius: 6, fontWeight: 700 }}>
        {busy ? "Signing in..." : "Sign in"}
      </button>
      <p style={{ fontSize: 13, marginTop: 14 }}>No account? <Link href="/register">Create one</Link></p>
    </div>
  );
}