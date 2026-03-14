"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import "@/styles/vertex.css";

const PRESET_AVATARS = [
  { id: "josh_lite3_20230714", name: "Josh", img: "👨‍🏫" },
  { id: "Wayne_20240711", name: "Wayne", img: "👨‍💼" },
  { id: "Angela-inblackskirt-20220820", name: "Angela", img: "👩‍🏫" },
  { id: "Kayla-incasualsuit-20220818", name: "Kayla", img: "👩‍💻" },
  { id: "Tyler-incasualsuit-20220721", name: "Tyler", img: "🧑‍🎓" },
  { id: "Anna_public_3_20240108", name: "Anna", img: "👩‍🔬" },
  { id: "Eric_public_pro2_20230608", name: "Eric", img: "🧑‍🏫" },
  { id: "Lily_public_pro1_20230614", name: "Lily", img: "👩‍🎨" },
  { id: "default", name: "Vertex Bot", img: "🤖" },
];

export default function KidOnboardingPage() {
  const router = useRouter();
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [kidSession, setKidSession] = useState<{ id: string; child_name: string | null } | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("vertex_kid_session");
    if (!stored) {
      router.push("/student");
      return;
    }
    setKidSession(JSON.parse(stored));
  }, [router]);

  async function handleConfirm() {
    if (!selectedAvatar || !kidSession) return;
    setLoading(true);

    try {
      const res = await fetch("/api/student/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kidSessionId: kidSession.id, avatarChoice: selectedAvatar }),
      });

      if (res.ok) {
        const updated = { ...kidSession, avatar_choice: selectedAvatar };
        localStorage.setItem("vertex_kid_session", JSON.stringify(updated));
        router.push("/dashboard/kid");
      }
    } catch {
      setLoading(false);
    }
  }

  return (
    <div className="vtx-auth-page">
      <div style={{ width: "100%", maxWidth: 600, textAlign: "center" }}>
        <div className="vtx-auth-logo" style={{ marginBottom: 32 }}>Vertex</div>
        <h1 style={{ fontSize: 28, fontWeight: 300, marginBottom: 8, color: "#1a1610" }}>
          Pick Your Tutor!
        </h1>
        <p style={{ fontSize: 13, color: "#8a7f6e", marginBottom: 40 }}>
          Choose who you want to learn with, {kidSession?.child_name || "friend"}!
        </p>

        <div style={{
          display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16,
          padding: "32px 28px", background: "#f8f3e8",
          border: "1px solid rgba(55,45,25,0.10)", borderRadius: 4,
        }}>
          {PRESET_AVATARS.map((avatar) => (
            <button
              key={avatar.id}
              onClick={() => setSelectedAvatar(avatar.id)}
              style={{
                padding: "20px 12px", border: `2px solid ${selectedAvatar === avatar.id ? "#c8416a" : "rgba(55,45,25,0.08)"}`,
                borderRadius: 8, background: selectedAvatar === avatar.id ? "rgba(200,65,106,0.06)" : "#f4efe5",
                cursor: "pointer", transition: "all 0.2s", textAlign: "center",
                transform: selectedAvatar === avatar.id ? "scale(1.05)" : "scale(1)",
              }}
            >
              <div style={{ fontSize: 48, marginBottom: 8 }}>{avatar.img}</div>
              <div style={{
                fontSize: 13, fontWeight: 500,
                color: selectedAvatar === avatar.id ? "#c8416a" : "#1a1610",
                fontFamily: "'Calibri', 'Trebuchet MS', sans-serif",
              }}>
                {avatar.name}
              </div>
            </button>
          ))}
        </div>

        <button
          onClick={handleConfirm}
          disabled={!selectedAvatar || loading}
          className="vtx-auth-btn"
          style={{
            width: "100%", maxWidth: 320, marginTop: 32,
            padding: "16px", fontSize: 13, letterSpacing: "0.15em",
            opacity: selectedAvatar ? 1 : 0.4,
          }}
        >
          {loading ? "Setting up..." : "Let's Start Learning!"}
        </button>
      </div>
    </div>
  );
}
