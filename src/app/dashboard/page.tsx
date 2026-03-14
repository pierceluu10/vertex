"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function DashboardRedirect() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        router.replace("/dashboard/parent");
      } else {
        router.replace("/login");
      }
    });
  }, [router]);

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#f4efe5", fontFamily: "'Calibri', 'Trebuchet MS', sans-serif", color: "#8a7f6e",
    }}>
      Redirecting...
    </div>
  );
}
