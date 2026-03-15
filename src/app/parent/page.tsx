"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle, LogOut, Video } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Parent } from "@/types";
import { VertexLogo } from "@/components/vertex/vertex-logo";
import "@/styles/vertex.css";

export default function ParentProfilePage() {
  const router = useRouter();
  const supabase = createClient();
  const [parent, setParent] = useState<Parent | null>(null);
  const [tutorReady, setTutorReady] = useState(false);
  const tutorName = process.env.NEXT_PUBLIC_TUTOR_AVATAR_NAME || "Tutor";

  const loadData = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { data: parentData } = await supabase.from("parents").select("*").eq("id", user.id).single();
    if (parentData) {
      setParent(parentData);
    }

    try {
      const tutorRes = await fetch(`/api/student/tutor?parentId=${user.id}`);
      const tutorData = await tutorRes.json().catch(() => ({}));
      setTutorReady(Boolean(tutorData.tutor?.liveTutorEnabled));
    } catch {
      setTutorReady(false);
    }
  }, [router, supabase]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f4efe5",
        color: "#1e1a12",
        fontFamily: "'Calibri', 'Trebuchet MS', sans-serif",
      }}
    >
      <header
        style={{
          borderBottom: "1px solid rgba(55,45,25,0.10)",
          padding: "20px 48px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "rgba(248,243,232,0.95)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <button
            onClick={() => router.push("/dashboard/parent")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "none",
              border: "none",
              color: "#8a7f6e",
              fontSize: 11,
              cursor: "pointer",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            <ArrowLeft size={14} /> Dashboard
          </button>
          <div style={{ width: 1, height: 24, background: "rgba(55,45,25,0.10)" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <VertexLogo href="/" height={48} className="vtx-parent-sidebar-logo" />
            <div>
              <div style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: "#8a7f6e" }}>
                Parent Dashboard
              </div>
              <div style={{ fontSize: 14, color: "#6f6659", marginTop: 4 }}>
                Tutor Avatar
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={handleSignOut}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "none",
            border: "1px solid rgba(55,45,25,0.10)",
            borderRadius: 3,
            padding: "10px 16px",
            color: "#8a7f6e",
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          <LogOut size={14} /> Sign Out
        </button>
      </header>

      <main style={{ maxWidth: 980, margin: "0 auto", padding: "40px 24px 64px" }}>
        <section
          style={{
            padding: "32px 28px",
            background: "#f8f3e8",
            border: "1px solid rgba(55,45,25,0.10)",
            borderRadius: 4,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 6,
                background: "rgba(158,107,117,0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Video size={18} style={{ color: "#c8416a" }} />
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 600 }}>Tutor Avatar</div>
              <p style={{ fontSize: 13, color: "#8a7f6e", marginTop: 4 }}>
                {tutorName} is the live tutor your child sees during sessions.
              </p>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(260px, 320px) 1fr",
              gap: 20,
              alignItems: "stretch",
            }}
          >
            <div
              style={{
                minHeight: 300,
                borderRadius: 18,
                overflow: "hidden",
                background: "#1d2431",
                border: "1px solid rgba(55,45,25,0.08)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: 28,
                color: "#fff6eb",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: 118,
                  height: 118,
                  borderRadius: "50%",
                  display: "grid",
                  placeItems: "center",
                  background: "rgba(255,255,255,0.12)",
                  border: "1px solid rgba(255,255,255,0.18)",
                  fontSize: 40,
                  fontWeight: 700,
                  marginBottom: 18,
                }}
              >
                {tutorName.charAt(0).toUpperCase()}
              </div>
              <div style={{ fontSize: 26, fontWeight: 600, marginBottom: 8 }}>{tutorName}</div>
              <div style={{ fontSize: 13, lineHeight: 1.65, color: "rgba(255,246,235,0.8)" }}>
                Ready to greet students and guide them through their next math session.
              </div>
            </div>

            <div style={{ display: "grid", gap: 14 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "14px 16px",
                  background: tutorReady ? "rgba(92,124,106,0.10)" : "rgba(200,65,106,0.06)",
                  borderRadius: 4,
                  border: tutorReady
                    ? "1px solid rgba(92,124,106,0.18)"
                    : "1px solid rgba(200,65,106,0.16)",
                  color: tutorReady ? "#5c7c6a" : "#8a243f",
                }}
              >
                <CheckCircle size={16} />
                <span style={{ fontSize: 13 }}>
                  {tutorReady
                    ? `${tutorName} is ready for live sessions.`
                    : `${tutorName} still needs to be connected before live sessions can start.`}
                </span>
              </div>

              <div
                style={{
                  padding: "20px 18px",
                  background: "rgba(255,255,255,0.48)",
                  borderRadius: 4,
                  border: "1px solid rgba(55,45,25,0.08)",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: "#8a7f6e",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    marginBottom: 8,
                  }}
                >
                  Session Flow
                </div>
                <div style={{ display: "grid", gap: 10, fontSize: 14, lineHeight: 1.6, color: "#3d3126" }}>
                  <div>
                    <strong>1.</strong> Create an access code for each student.
                  </div>
                  <div>
                    <strong>2.</strong> Add learning settings and homework from that student&apos;s code card.
                  </div>
                  <div>
                    <strong>3.</strong> The student signs in and meets {tutorName} live.
                  </div>
                </div>
              </div>

              <div
                style={{
                  padding: "20px 18px",
                  background: "rgba(255,255,255,0.48)",
                  borderRadius: 4,
                  border: "1px solid rgba(55,45,25,0.08)",
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Current setup</div>
                <p style={{ fontSize: 13, color: "#6f6659", lineHeight: 1.65, margin: 0 }}>
                  {parent?.name ? `${parent.name.split(" ")[0]}'s tutor profile is active.` : "Your tutor profile is active."}
                  {" "}Use the access code settings in the dashboard to personalize each student&apos;s learning experience.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
