"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { VertexLogo } from "@/components/vertex/vertex-logo";
import "@/styles/vertex.css";

export default function StudentEntryPage() {
  const router = useRouter();
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  function handleDigit(index: number, value: string) {
    if (!/^\d?$/.test(value)) return;
    const next = [...code];
    next[index] = value;
    setCode(next);
    setError(null);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === "Enter") {
      handleSubmit();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setCode(pasted.split(""));
      inputRefs.current[5]?.focus();
    }
  }

  async function handleSubmit() {
    const fullCode = code.join("");
    if (fullCode.length !== 6) {
      setError("Please enter all 6 digits");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/student/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: fullCode }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        const msg = data.error || "Invalid code. Please try again.";
        const debug = typeof data.debug !== "undefined" ? ` (${JSON.stringify(data.debug)})` : "";
        setError(msg + debug);
        setLoading(false);
        return;
      }

      localStorage.setItem("vertex_kid_session", JSON.stringify(data.kidSession));
      localStorage.setItem("vertex_kid_session_id", data.kidSession.id);

      router.push("/dashboard/kid");
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="vtx-auth-page vtx-kid-ui">
      <div className="vtx-auth-page-logo">
        <VertexLogo href="/" height={56} className="vtx-auth-logo" />
      </div>
      <motion.div
        className="vtx-auth-card"
        style={{ textAlign: "center" }}
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      >
        <h1>Enter Your Code</h1>
        <p className="vtx-auth-sub">Ask your parent for your 6-digit access code</p>

        <div className="vtx-auth-form">
          <motion.div
            style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 24 }}
            onPaste={handlePaste}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35, delay: 0.15 }}
          >
            {code.map((digit, i) => (
              <motion.input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleDigit(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                autoFocus={i === 0}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: 0.2 + i * 0.04 }}
                style={{
                  width: 52, height: 64, textAlign: "center",
                  fontSize: 28, fontWeight: 300,
                  border: "1.5px solid rgba(55,45,25,0.12)", borderRadius: 4,
                  background: "#f4efe5", color: "#1a1610", outline: "none",
                  transition: "border-color 0.2s",
                }}
                onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = "#c8416a"; }}
                onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = "rgba(55,45,25,0.12)"; }}
              />
            ))}
          </motion.div>

          {error && <div className="vtx-auth-error">{error}</div>}

          <button
            onClick={handleSubmit}
            disabled={loading || code.join("").length !== 6}
            className="vtx-auth-btn"
          >
            {loading ? "Checking..." : "Let's Go!"}
          </button>
        </div>

        <p className="vtx-auth-link">
          Are you a parent?{" "}
          <Link href="/login">Sign in here</Link>
        </p>
      </motion.div>
    </div>
  );
}
