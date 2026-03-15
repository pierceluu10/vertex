"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function KidOnboardingPage() {
  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem("vertex_kid_session");
    if (!stored) {
      router.replace("/student");
      return;
    }
    router.replace("/dashboard/kid");
  }, [router]);

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#f4efe5", fontFamily: "'Calibri', 'Trebuchet MS', sans-serif", color: "#8a7f6e", fontSize: 14,
    }}>
      Redirecting...
    </div>
  );
}
