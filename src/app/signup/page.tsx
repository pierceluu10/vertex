"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import "@/styles/vertex.css";
import { createClient } from "@/lib/supabase/client";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [childName, setChildName] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [mathTopics, setMathTopics] = useState<string[]>([]);
  const [learningPace, setLearningPace] = useState("medium");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const topicOptions = [
    "Addition", "Subtraction", "Multiplication", "Division",
    "Fractions", "Decimals", "Geometry", "Algebra",
    "Word Problems", "Measurement", "Time", "Money",
  ];

  function toggleTopic(topic: string) {
    setMathTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();

    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });

    if (authError) {
      if (authError.message.toLowerCase().includes("rate limit")) {
        setError("Too many attempts. Please wait a minute and try again.");
      } else {
        setError(authError.message);
      }
      setLoading(false);
      return;
    }

    if (data.user) {
      const { error: profileError } = await supabase.from("parents").insert({
        id: data.user.id,
        email,
        name,
        child_name: childName || null,
        grade_level: gradeLevel || null,
        math_topics: mathTopics,
        learning_pace: learningPace as "slow" | "medium" | "fast",
      });

      if (profileError) {
        setError(profileError.message);
        setLoading(false);
        return;
      }

      // Auto-generate access code
      try {
        await fetch("/api/access-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ childName: childName || null }),
        });
      } catch {
        // Non-blocking
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
              <label htmlFor="name">Your Name</label>
              <input id="name" type="text" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>

            <div className="vtx-field">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>

            <div className="vtx-field">
              <label htmlFor="password">Password</label>
              <input id="password" type="password" placeholder="At least 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>

            <div className="vtx-field">
              <label htmlFor="childName">Child&apos;s Name</label>
              <input id="childName" type="text" placeholder="Your child's name" value={childName} onChange={(e) => setChildName(e.target.value)} />
            </div>

            <div className="vtx-field">
              <label htmlFor="grade">Grade Level</label>
              <input id="grade" type="text" placeholder="e.g. 3rd grade" value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} />
            </div>

            <div className="vtx-field">
              <label>Math Topics They Struggle With</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                {topicOptions.map((topic) => (
                  <button
                    key={topic}
                    type="button"
                    onClick={() => toggleTopic(topic)}
                    style={{
                      padding: "6px 12px", fontSize: 12, borderRadius: 3,
                      border: `1.5px solid ${mathTopics.includes(topic) ? "#c8416a" : "rgba(55,45,25,0.10)"}`,
                      background: mathTopics.includes(topic) ? "rgba(158,107,117,0.06)" : "transparent",
                      color: mathTopics.includes(topic) ? "#c8416a" : "#1a1610",
                      cursor: "pointer", transition: "all 0.2s",
                      fontFamily: "'Calibri', 'Trebuchet MS', sans-serif",
                    }}
                  >
                    {topic}
                  </button>
                ))}
              </div>
            </div>

            <div className="vtx-field">
              <label>Learning Pace</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 4 }}>
                {[
                  { value: "slow", label: "Slow & Steady" },
                  { value: "medium", label: "Balanced" },
                  { value: "fast", label: "Quick" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setLearningPace(opt.value)}
                    style={{
                      padding: "10px 8px", fontSize: 12, borderRadius: 3,
                      border: `1.5px solid ${learningPace === opt.value ? "#c8416a" : "rgba(55,45,25,0.10)"}`,
                      background: learningPace === opt.value ? "rgba(158,107,117,0.06)" : "transparent",
                      color: learningPace === opt.value ? "#c8416a" : "#1a1610",
                      cursor: "pointer", transition: "all 0.2s",
                      fontFamily: "'Calibri', 'Trebuchet MS', sans-serif",
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {error && <div className="vtx-auth-error">{error}</div>}

            <button type="submit" disabled={loading} className="vtx-auth-btn">
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>
        </div>

        <p className="vtx-auth-link">
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
