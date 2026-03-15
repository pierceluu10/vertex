import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { openai, buildReportPrompt } from "@/lib/openai";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export async function POST(request: Request) {
  try {
    const { sessionId } = await request.json();
    const supabase = await createServiceClient();

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
    const focusScore = session.focus_score_avg != null
      ? Math.round(session.focus_score_avg)
      : Math.max(60, 100 - focusEvents.length * 4);

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
    const topicsCovered = extractTopics(topicsMentioned);
    const briefContentNote = buildBriefContentNote(topicsCovered, messages);

    // Save report
    const { data: report } = await supabase
      .from("parent_reports")
      .insert({
        session_id: sessionId,
        parent_id: child.parent_id,
        summary,
        topics_covered: topicsCovered,
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
          subject: `${child.name}'s lesson recap`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #1f6feb; padding: 20px; border-radius: 16px 16px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 22px;">Vertex lesson recap</h1>
                <p style="color: rgba(255,255,255,0.82); margin: 8px 0 0;">${child.name}'s session summary</p>
              </div>
              <div style="padding: 24px; background: #f8fbff; border-radius: 0 0 16px 16px; border: 1px solid #dbeafe;">
                <div style="display: inline-block; padding: 8px 14px; border-radius: 999px; background: #e0f2fe; color: #0c4a6e; font-weight: 700; font-size: 14px; margin-bottom: 16px;">
                  Focus meter: ${focusScore}%
                </div>
                <p style="margin: 0 0 12px; line-height: 1.6; color: #334155;">${briefContentNote}</p>
                <p style="margin: 0; font-size: 13px; color: #64748b;">
                  ${durationMins} min lesson${topicsCovered.length ? ` • Topics: ${topicsCovered.join(", ")}` : ""}
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

function buildBriefContentNote(topics: string[], messages: Array<{ role?: string; content?: string }>) {
  if (topics.length > 0) {
    const formattedTopics = topics.slice(0, 3).map((topic) => toTitleCase(topic));
    if (formattedTopics.length === 1) {
      return `We worked on ${formattedTopics[0]} today and kept the lesson focused on the main homework concepts.`;
    }

    return `We covered ${formattedTopics.join(", ")} today and reviewed the main ideas from the lesson together.`;
  }

  const assistantText = messages
    .filter((message) => message.role === "assistant")
    .map((message) => message.content?.trim())
    .filter(Boolean)
    .join(" ");

  if (assistantText) {
    return "We reviewed the lesson material together and practiced the main problems discussed during the session.";
  }

  return "We completed a short lesson and reviewed the key material covered in the session.";
}

function toTitleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
