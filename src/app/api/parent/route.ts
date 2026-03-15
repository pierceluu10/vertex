import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const updates: Record<string, unknown> = {};

    if (typeof body.name === "string" && body.name.trim()) {
      updates.name = body.name.trim();
    }
    if (body.child_name !== undefined) {
      updates.child_name = body.child_name === null || body.child_name === "" ? null : String(body.child_name).trim();
    }
    if (body.grade_level !== undefined) {
      updates.grade_level = body.grade_level === null || body.grade_level === "" ? null : String(body.grade_level).trim();
    }
    if (Array.isArray(body.math_topics)) {
      updates.math_topics = body.math_topics.filter((t: unknown) => typeof t === "string");
    }
    if (body.learning_pace === "slow" || body.learning_pace === "medium" || body.learning_pace === "fast") {
      updates.learning_pace = body.learning_pace;
    }
    if (typeof body.notification_realtime === "boolean") {
      updates.notification_realtime = body.notification_realtime;
    }
    if (typeof body.notification_daily === "boolean") {
      updates.notification_daily = body.notification_daily;
    }
    if (typeof body.notification_daily_time === "string") {
      updates.notification_daily_time = body.notification_daily_time;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("parents")
      .update(updates)
      .eq("id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Parent update error:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (e) {
    console.error("Parent PATCH error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
