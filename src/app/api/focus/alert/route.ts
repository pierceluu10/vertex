import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function POST(request: Request) {
  try {
    const { sessionId, focusScore, consecutiveLowChecks } = await request.json();

    if (!sessionId || consecutiveLowChecks < 2) {
      return NextResponse.json({ skipped: true });
    }

    if (!resend) {
      return NextResponse.json({ skipped: true, reason: "Resend not configured" });
    }

    const supabase = await createServiceClient();

    // Find parent for this session
    const { data: session } = await supabase
      .from("tutoring_sessions")
      .select("kid_session_id, child_id")
      .eq("id", sessionId)
      .single();

    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    let parentEmail = "";
    let childName = "your child";

    if (session.kid_session_id) {
      const { data: kidSession } = await supabase
        .from("kids_sessions")
        .select("parent_id, child_name")
        .eq("id", session.kid_session_id)
        .single();

      if (kidSession) {
        childName = kidSession.child_name || "your child";
        const { data: parent } = await supabase
          .from("parents")
          .select("email, notification_realtime")
          .eq("id", kidSession.parent_id)
          .single();

        if (parent?.notification_realtime && parent.email) {
          parentEmail = parent.email;
        }
      }
    } else if (session.child_id) {
      const { data: child } = await supabase
        .from("children")
        .select("name, parent_id")
        .eq("id", session.child_id)
        .single();

      if (child) {
        childName = child.name;
        const { data: parent } = await supabase
          .from("parents")
          .select("email, notification_realtime")
          .eq("id", child.parent_id)
          .single();

        if (parent?.notification_realtime && parent.email) {
          parentEmail = parent.email;
        }
      }
    }

    if (!parentEmail) {
      return NextResponse.json({ skipped: true, reason: "No parent email or alerts disabled" });
    }

    await resend.emails.send({
      from: "Vertex <onboarding@resend.dev>",
      to: parentEmail,
      subject: `${childName}'s focus has dropped`,
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #c8416a; margin-bottom: 16px;">Focus Alert</h2>
          <p style="color: #374151; line-height: 1.6;">
            ${childName}'s focus score has dropped to <strong>${focusScore}%</strong> during their current study session.
            This has been low for ${consecutiveLowChecks} consecutive checks.
          </p>
          <p style="color: #6b7280; font-size: 14px; margin-top: 16px;">
            The tutor is adjusting to keep them engaged. You may want to check in.
          </p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
          <p style="color: #9ca3af; font-size: 12px;">Sent by Vertex — AI Math Tutoring</p>
        </div>
      `,
    });

    return NextResponse.json({ sent: true });
  } catch (error) {
    console.error("Focus alert error:", error);
    return NextResponse.json({ error: "Failed to send alert" }, { status: 500 });
  }
}
