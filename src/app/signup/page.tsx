"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import "@/styles/vertex.css";
import { createClient } from "@/lib/supabase/client";

export default function SignUpPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();

    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      const { error: profileError } = await supabase.from("parents").insert({
        id: data.user.id,
        full_name: fullName,
        email,
      });

      if (profileError) {
        console.error("Profile creation error:", profileError);
      }

      router.push("/onboarding");
    }

    setLoading(false);
  }

  return (
    <div className="vtx-auth-page">
      <div className="vtx-auth-card">
        <Link href="/" className="vtx-auth-logo">Vertex</Link>
        <h1>Create your account</h1>
        <p className="vtx-auth-sub">Set up your parent profile to get started</p>

        <div className="vtx-auth-form">
          <form onSubmit={handleSubmit}>
            <div className="vtx-field">
              <label htmlFor="name">Full Name</label>
              <input
                id="name"
                type="text"
                placeholder="Your name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            <div className="vtx-field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="vtx-field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            {error && <div className="vtx-auth-error">{error}</div>}

            <button type="submit" disabled={loading} className="vtx-auth-btn">
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>
        </div>

        <p className="vtx-auth-link">
          Already have an account?{" "}
          <Link href="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
