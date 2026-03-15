"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { VertexLogo } from "@/components/vertex/vertex-logo";
import "@/styles/vertex.css";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard/parent");
    setLoading(false);
  }

  return (
    <div className="vtx-auth-page">
      <div className="vtx-auth-page-logo">
        <VertexLogo href="/" height={56} className="vtx-auth-logo" />
      </div>
      <motion.div
        className="vtx-auth-card"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      >
        <h1 style={{ fontSize: 32, fontWeight: 300, textAlign: "center", color: "var(--vtx-ink, #1a1610)", marginBottom: 8 }}>
          Welcome <em style={{ fontStyle: "italic", color: "var(--vtx-pink, #c8416a)" }}>back</em>
        </h1>
        <p className="vtx-auth-sub">Sign in to your parent account</p>

        <motion.div
          className="vtx-auth-form"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35, delay: 0.2 }}
        >
          <form onSubmit={handleSubmit}>
            <div className="vtx-field">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>

            <div className="vtx-field">
              <label htmlFor="password">Password</label>
              <input id="password" type="password" placeholder="Your password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>

            {error && <div className="vtx-auth-error">{error}</div>}

            <button type="submit" disabled={loading} className="vtx-auth-btn">
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </motion.div>

        <p className="vtx-auth-link">
          Don&apos;t have an account? <Link href="/signup">Sign up</Link>
        </p>

        <div style={{
          marginTop: 32, paddingTop: 24,
          borderTop: "1px solid rgba(55,45,25,0.10)", textAlign: "center",
        }}>
          <Link
            href="/student"
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "14px 28px", border: "1.5px solid rgba(55,45,25,0.15)",
              borderRadius: 3, background: "transparent", color: "#1a1610",
              fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase",
              textDecoration: "none", transition: "all 0.2s",
              fontFamily: "'Calibri', 'Trebuchet MS', sans-serif",
            }}
          >
            I&apos;m a Student
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
