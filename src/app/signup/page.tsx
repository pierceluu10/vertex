"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import "@/styles/vertex.css";
import { createClient } from "@/lib/supabase/client";

const topicOptions = [
  "Addition", "Subtraction", "Multiplication", "Division",
  "Fractions", "Decimals", "Geometry", "Algebra",
  "Word Problems", "Measurement", "Time", "Money",
];

const stepStyles = {
  border: "1.5px solid rgba(55,45,25,0.10)",
  selectedBorder: "#c8416a",
  selectedBg: "rgba(200,65,106,0.06)",
  selectedColor: "#c8416a",
  defaultColor: "#1a1610",
  font: "'Calibri', 'Trebuchet MS', sans-serif",
};

export default function SignUpPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1: parent account
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Step 2: child info
  const [childName, setChildName] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [mathTopics, setMathTopics] = useState<string[]>([]);
  const [learningPace, setLearningPace] = useState<"slow" | "medium" | "fast">("medium");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleTopic(topic: string) {
    setMathTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    );
  }

  function handleStep1(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStep(2);
  }

  async function handleStep2Submit(e: React.FormEvent) {
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

    if (!data.user) {
      setError("Something went wrong. Please try again.");
      setLoading(false);
      return;
    }

    const { error: profileError } = await supabase.from("parents").insert({
      id: data.user.id,
      email,
      name,
      child_name: childName || null,
      grade_level: gradeLevel || null,
      math_topics: mathTopics,
      learning_pace: learningPace,
    });

    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }

    try {
      await fetch("/api/access-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childName: childName || null }),
      });
    } catch {
      // Non-blocking
    }

    router.push("/dashboard");
    setLoading(false);
  }

  return (
    <div className="vtx-auth-page">
      <div className="vtx-auth-card">
        <Link href="/" className="vtx-auth-logo">Vertex</Link>

        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <span style={{ fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--vtx-muted, #8a7f6e)" }}>
            Step {step} of 2
          </span>
        </div>

        {step === 1 && (
          <>
            <h1>Create your account</h1>
            <p className="vtx-auth-sub">Your name, email, and password</p>
            <div className="vtx-auth-form">
              <form onSubmit={handleStep1}>
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
                {error && <div className="vtx-auth-error">{error}</div>}
                <button type="submit" className="vtx-auth-btn">Continue</button>
              </form>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h1>About your child</h1>
            <p className="vtx-auth-sub">We&apos;ll use this to personalize their experience</p>
            <div className="vtx-auth-form">
              <form onSubmit={handleStep2Submit}>
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
                          border: `1.5px solid ${mathTopics.includes(topic) ? stepStyles.selectedBorder : stepStyles.border}`,
                          background: mathTopics.includes(topic) ? stepStyles.selectedBg : "transparent",
                          color: mathTopics.includes(topic) ? stepStyles.selectedColor : stepStyles.defaultColor,
                          cursor: "pointer", transition: "all 0.2s",
                          fontFamily: stepStyles.font,
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
                      { value: "slow" as const, label: "Slow & Steady" },
                      { value: "medium" as const, label: "Balanced" },
                      { value: "fast" as const, label: "Quick" },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setLearningPace(opt.value)}
                        style={{
                          padding: "10px 8px", fontSize: 12, borderRadius: 3,
                          border: `1.5px solid ${learningPace === opt.value ? stepStyles.selectedBorder : stepStyles.border}`,
                          background: learningPace === opt.value ? stepStyles.selectedBg : "transparent",
                          color: learningPace === opt.value ? stepStyles.selectedColor : stepStyles.defaultColor,
                          cursor: "pointer", transition: "all 0.2s",
                          fontFamily: stepStyles.font,
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                {error && <div className="vtx-auth-error">{error}</div>}
                <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    style={{
                      flex: 1, padding: 14, border: "1.5px solid var(--vtx-border)", background: "transparent",
                      color: "var(--vtx-muted)", fontFamily: stepStyles.font, fontSize: 11, letterSpacing: "0.2em",
                      textTransform: "uppercase", borderRadius: 3, cursor: "pointer",
                    }}
                  >
                    Back
                  </button>
                  <button type="submit" disabled={loading} className="vtx-auth-btn" style={{ flex: 1 }}>
                    {loading ? "Creating account..." : "Create Account"}
                  </button>
                </div>
              </form>
            </div>
          </>
        )}

        <p className="vtx-auth-link">
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
