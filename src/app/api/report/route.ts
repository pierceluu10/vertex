import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { openai, buildReportPrompt } from "@/lib/openai";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export async function POST(request: Request) {
  try {
    const { sessionId } = await request.json();
    const supabase = await createClient();

    // Fetch session data
    const { data: session } = await supabase
      .from("tutoring_sessions")
      .select("*, children(*)")
      .eq("id", sessionId)
      .single();

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const child = session.children as { name: string; parent_id: string };

    // Fetch related data
    const [messagesRes, focusRes, quizRes, parentRes] = await Promise.all([
      supabase
        .from("messages")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at"),
      supabase
        .from("focus_events")
        .select("*")
        .eq("session_id", sessionId),
      supabase
        .from("quiz_attempts")
        .select("*")
        .eq("session_id", sessionId),
      supabase
        .from("parents")
        .select("*")
        .eq("id", child.parent_id)
        .single(),
    ]);

    const messages = messagesRes.data || [];
    const focusEvents = focusRes.data || [];
    const quizAttempts = quizRes.data || [];
    const parent = parentRes.data;

    // Calculate stats
    const startTime = new Date(session.started_at).getTime();
    const endTime = session.ended_at
      ? new Date(session.ended_at).getTime()
      : Date.now();
    const durationMs = endTime - startTime;
    const durationMins = Math.round(durationMs / 60000);

    const totalDistractionMs = focusEvents.reduce(
      (sum: number, e: { duration_ms?: number }) => sum + (e.duration_ms || 0),
      0
    );

    const quizCorrect = quizAttempts.filter(
      (q: { is_correct?: boolean }) => q.is_correct
    ).length;

    const topicsMentioned = messages
      .filter((m: { role: string }) => m.role === "assistant")
      .map((m: { content: string }) => m.content)
      .join(" ");

    const struggles = quizAttempts
      .filter((q: { is_correct?: boolean; topic?: string }) => !q.is_correct && q.topic)
      .map((q: { topic?: string }) => q.topic as string);

    // Generate report via OpenAI
    const reportPrompt = buildReportPrompt({
      childName: child.name,
      sessionDuration: `${durationMins} minutes`,
      messageCount: messages.length,
      topicsCovered: extractTopics(topicsMentioned),
      quizResults: { correct: quizCorrect, total: quizAttempts.length },
      focusSummary: {
        distractions: focusEvents.length,
        totalDistractedTime: `${Math.round(totalDistractionMs / 1000)} seconds`,
      },
      struggles,
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: reportPrompt }],
      max_tokens: 600,
      temperature: 0.5,
    });

    const summary = completion.choices[0]?.message?.content || "Session completed.";

    // Save report
    const { data: report } = await supabase
      .from("parent_reports")
      .insert({
        session_id: sessionId,
        parent_id: child.parent_id,
        summary,
        topics_covered: extractTopics(topicsMentioned),
        struggles,
        focus_summary: {
          total_focus_events: focusEvents.length,
          total_distraction_time_ms: totalDistractionMs,
          tab_blur_count: focusEvents.filter(
            (e: { event_type: string }) => e.event_type === "tab_blur"
          ).length,
          inactivity_count: focusEvents.filter(
            (e: { event_type: string }) => e.event_type === "inactive"
          ).length,
          interventions_triggered: focusEvents.filter(
            (e: { intervention: string | null }) => e.intervention
          ).length,
        },
        quiz_results: {
          total_questions: quizAttempts.length,
          correct: quizCorrect,
          incorrect: quizAttempts.length - quizCorrect,
          topics: [...new Set(quizAttempts.map((q: { topic?: string }) => q.topic).filter(Boolean))],
        },
        suggestions: summary,
      })
      .select()
      .single();

    // Send email if configured
    if (resend && parent?.email) {
      try {
        await resend.emails.send({
          from: "Vertex <onboarding@resend.dev>",
          to: parent.email,
          subject: `${child.name}'s Study Session Report`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #7c3aed, #6d28d9); padding: 24px; border-radius: 16px 16px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 24px;">Vertex Study Report</h1>
                <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0;">Session for ${child.name}</p>
              </div>
              <div style="padding: 24px; background: #faf5ff; border-radius: 0 0 16px 16px; border: 1px solid #e9d5ff;">
                <p style="white-space: pre-wrap; line-height: 1.6; color: #374151;">${summary}</p>
                <hr style="border: none; border-top: 1px solid #e9d5ff; margin: 16px 0;">
                <p style="font-size: 14px; color: #6b7280;">
                  Duration: ${durationMins} min | Messages: ${messages.length} | Focus events: ${focusEvents.length}
                </p>
              </div>
            </div>
          `,
        });

        if (report) {
          await supabase
            .from("parent_reports")
            .update({ sent_at: new Date().toISOString() })
            .eq("id", report.id);
        }
      } catch (emailErr) {
        console.error("Email send error:", emailErr);
      }
    }

    return NextResponse.json({ report, summary });
  } catch (error) {
    console.error("Report API error:", error);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}

function extractTopics(text: string): string[] {
  const mathTopics = [
    "addition", "subtraction", "multiplication", "division",
    "fractions", "decimals", "geometry", "algebra",
    "counting", "numbers", "word problems", "measurement",
    "time", "money", "patterns", "place value",
  ];
  return mathTopics.filter((topic) =>
    text.toLowerCase().includes(topic)
  );
}
