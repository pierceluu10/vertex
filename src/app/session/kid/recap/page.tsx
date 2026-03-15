"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Target, MessageCircle, ArrowRight } from "lucide-react";
import "@/styles/vertex.css";

function RecapContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const score = parseInt(searchParams.get("score") || "0", 10);
  const messageCount = parseInt(searchParams.get("messages") || "0", 10);

  return (
    <div style={{
      minHeight: "100vh", background: "linear-gradient(180deg, #fef7ee 0%, #fdf2e6 100%)",
      fontFamily: "'Calibri', 'Trebuchet MS', sans-serif",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "40px 24px", textAlign: "center",
    }}>
      <h1 style={{ fontSize: 28, fontWeight: 300, marginBottom: 8, color: "#1a1610", lineHeight: 1.2 }}>
        Session complete
      </h1>
      <p style={{ fontSize: 13, color: "#8a7f6e", lineHeight: 1.7, marginBottom: 40 }}>
        Summary
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 400, width: "100%", marginBottom: 40 }}>
        <div style={{
          padding: "24px 16px", background: "#fff", borderRadius: 12,
          border: "1px solid rgba(0,0,0,0.06)",
        }}>
          <Target size={24} style={{ color: score >= 75 ? "#5a9e76" : "#c89020", marginBottom: 8 }} />
          <div style={{ fontSize: 28, fontWeight: 300, color: score >= 75 ? "#5a9e76" : "#c89020" }}>
            {score}%
          </div>
          <div style={{ fontSize: 11, color: "#8a7f6e", marginTop: 4 }}>Focus Score</div>
        </div>

        <div style={{
          padding: "24px 16px", background: "#fff", borderRadius: 12,
          border: "1px solid rgba(0,0,0,0.06)",
        }}>
          <MessageCircle size={24} style={{ color: "#9e6b75", marginBottom: 8 }} />
          <div style={{ fontSize: 28, fontWeight: 300, color: "#9e6b75" }}>
            {messageCount}
          </div>
          <div style={{ fontSize: 11, color: "#8a7f6e", marginTop: 4 }}>Messages</div>
        </div>
      </div>

      <button
        onClick={() => router.push("/dashboard/kid")}
        style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "16px 32px", background: "#9e6b75", color: "#fff",
          border: "none", borderRadius: 10, fontSize: 14, cursor: "pointer",
        }}
      >
        Back to Home <ArrowRight size={16} />
      </button>
    </div>
  );
}

export default function RecapPage() {
  return (
    <Suspense fallback={<div className="vtx-auth-page"><p style={{ color: "#8a7f6e" }}>Loading recap...</p></div>}>
      <RecapContent />
    </Suspense>
  );
}
