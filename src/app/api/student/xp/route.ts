import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const { kidSessionId, xp } = await request.json();

    if (!kidSessionId || typeof xp !== "number") {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    const supabase = await createServiceClient();

    const { data: session } = await supabase
      .from("kids_sessions")
      .select("xp_points")
      .eq("id", kidSessionId)
      .single();

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const { error } = await supabase
      .from("kids_sessions")
      .update({ xp_points: (session.xp_points || 0) + xp })
      .eq("id", kidSessionId);

    if (error) {
      return NextResponse.json({ error: "Failed to update XP" }, { status: 500 });
    }

    return NextResponse.json({ success: true, newTotal: (session.xp_points || 0) + xp });
  } catch (error) {
    console.error("XP update error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
