"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import "@/styles/vertex.css";

type Step = "child" | "preferences" | "topics" | "complete";

const TOPIC_OPTIONS = [
  "Addition", "Subtraction", "Multiplication", "Division",
  "Fractions", "Decimals", "Geometry", "Algebra",
  "Word Problems", "Measurement", "Time", "Money",
  "Patterns", "Place Value", "Counting",
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("child");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [childName, setChildName] = useState("");
  const [childAge, setChildAge] = useState("");
  const [childGrade, setChildGrade] = useState("");
  const [preferredPace, setPreferredPace] = useState("normal");
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);

  function toggleTopic(topic: string) {
    setSelectedTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    );
  }

  async function handleSubmit() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          childName,
          childAge,
          childGrade,
          preferredPace,
          mathTopics: selectedTopics,
        }),
      });

      const result = await res.json();

      if (!res.ok || result.error) {
        setError(result.error || "Something went wrong");
        setLoading(false);
        return;
      }

      setStep("complete");
    } catch {
      setError("Something went wrong. Please try again.");
    }

    setLoading(false);
  }

  return (
    <div className="vtx-auth-page">
      <div className="vtx-auth-card">
        <div className="vtx-auth-logo">Vertex</div>
        <h1>{step === "complete" ? "You\u2019re all set!" : "Set up your child\u2019s profile"}</h1>

        {step !== "complete" && (
          <div style={{ display: "flex", justifyContent: "center", gap: 8, margin: "16px 0 32px" }}>
            {["child", "preferences", "topics"].map((s, i) => (
              <div
                key={s}
                style={{
                  height: 2, width: 40, borderRadius: 1,
                  background: ["child", "preferences", "topics"].indexOf(step) >= i ? "#c8416a" : "rgba(55,45,25,0.15)",
                  transition: "background 0.3s",
                }}
              />
            ))}
          </div>
        )}

        <div className="vtx-auth-form">
          {step === "child" && (
            <div>
              <div className="vtx-field">
                <label htmlFor="childName">Child&apos;s Name</label>
                <input id="childName" type="text" placeholder="What's your child's name?" value={childName} onChange={(e) => setChildName(e.target.value)} required />
              </div>
              <div className="vtx-field">
                <label htmlFor="childAge">Age</label>
                <input id="childAge" type="number" min={3} max={18} placeholder="How old are they?" value={childAge} onChange={(e) => setChildAge(e.target.value)} required />
              </div>
              <div className="vtx-field">
                <label htmlFor="childGrade">Grade Level</label>
                <input id="childGrade" type="text" placeholder="e.g. 3rd grade" value={childGrade} onChange={(e) => setChildGrade(e.target.value)} />
              </div>
              <button type="button" onClick={() => setStep("preferences")} disabled={!childName || !childAge} className="vtx-auth-btn">
                Continue &rarr;
              </button>
            </div>
          )}

          {step === "preferences" && (
            <div>
              <div className="vtx-field">
                <label>Learning Pace</label>
                <p style={{ fontSize: 13, color: "#8a7f6e", marginBottom: 16 }}>
                  How fast does {childName || "your child"} usually work through problems?
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  {[
                    { value: "slow", label: "Steady" },
                    { value: "normal", label: "Balanced" },
                    { value: "fast", label: "Quick" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setPreferredPace(option.value)}
                      style={{
                        padding: "18px 12px",
                        border: `1.5px solid ${preferredPace === option.value ? "#c8416a" : "rgba(55,45,25,0.10)"}`,
                        borderRadius: 3,
                        background: preferredPace === option.value ? "rgba(200,65,106,0.06)" : "transparent",
                        color: preferredPace === option.value ? "#c8416a" : "#1a1610",
                        fontFamily: "'Calibri', 'Trebuchet MS', sans-serif",
                        fontSize: 13, fontWeight: 400, letterSpacing: "0.08em",
                        cursor: "pointer", transition: "all 0.2s",
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                <button type="button" onClick={() => setStep("child")} style={{
                  padding: "14px 20px", border: "1.5px solid rgba(55,45,25,0.10)", borderRadius: 3,
                  background: "transparent", color: "#8a7f6e",
                  fontFamily: "'Calibri', 'Trebuchet MS', sans-serif", fontSize: 11,
                  letterSpacing: "0.2em", textTransform: "uppercase", cursor: "pointer",
                }}>
                  &larr; Back
                </button>
                <button type="button" onClick={() => setStep("topics")} className="vtx-auth-btn" style={{ flex: 1 }}>
                  Continue &rarr;
                </button>
              </div>
            </div>
          )}

          {step === "topics" && (
            <div>
              <div className="vtx-field">
                <label>Math Topics They Struggle With</label>
                <p style={{ fontSize: 13, color: "#8a7f6e", marginBottom: 16 }}>
                  Select any that apply — this helps us personalize tutoring
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {TOPIC_OPTIONS.map((topic) => (
                    <button
                      key={topic}
                      type="button"
                      onClick={() => toggleTopic(topic)}
                      style={{
                        padding: "8px 14px", fontSize: 13, borderRadius: 3,
                        border: `1.5px solid ${selectedTopics.includes(topic) ? "#c8416a" : "rgba(55,45,25,0.10)"}`,
                        background: selectedTopics.includes(topic) ? "rgba(200,65,106,0.06)" : "transparent",
                        color: selectedTopics.includes(topic) ? "#c8416a" : "#1a1610",
                        cursor: "pointer", transition: "all 0.2s",
                        fontFamily: "'Calibri', 'Trebuchet MS', sans-serif",
                      }}
                    >
                      {topic}
                    </button>
                  ))}
                </div>
              </div>

              {error && <div className="vtx-auth-error">{error}</div>}

              <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                <button type="button" onClick={() => setStep("preferences")} style={{
                  padding: "14px 20px", border: "1.5px solid rgba(55,45,25,0.10)", borderRadius: 3,
                  background: "transparent", color: "#8a7f6e",
                  fontFamily: "'Calibri', 'Trebuchet MS', sans-serif", fontSize: 11,
                  letterSpacing: "0.2em", textTransform: "uppercase", cursor: "pointer",
                }}>
                  &larr; Back
                </button>
                <button type="button" onClick={handleSubmit} disabled={loading} className="vtx-auth-btn" style={{ flex: 1 }}>
                  {loading ? "Setting up..." : "Complete Setup"}
                </button>
              </div>
            </div>
          )}

          {step === "complete" && (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{
                width: 56, height: 56, borderRadius: "50%", background: "rgba(90,158,118,.1)",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 20px", border: "1.5px solid rgba(90,158,118,.3)",
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3a7a52" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 300, marginBottom: 8, color: "#1a1610" }}>
                {childName}&apos;s profile is ready!
              </h2>
              <p style={{ fontSize: 13, color: "#8a7f6e", marginBottom: 28 }}>
                Head to your dashboard to start a tutoring session.
              </p>
              <button type="button" onClick={() => router.push("/dashboard/parent")} className="vtx-auth-btn">
                Go to Dashboard &rarr;
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
