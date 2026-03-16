import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { openai, buildReportPrompt } from "@/lib/openai";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;
const resendFrom = process.env.RESEND_FROM_EMAIL || "Vertex <onboarding@resend.dev>";

export async function POST(request: Request) {
  try {
    const { sessionId } = await request.json();
    const supabase = await createServiceClient();

    // Fetch session data
    const { data: session } = await supabase
      .from("tutoring_sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    let childName = "Your child";
    let parentId: string | null = null;
    let childId: string | null = session.child_id ?? null;

    if (session.kid_session_id) {
      const { data: kidSession } = await supabase
        .from("kids_sessions")
        .select("parent_id, child_name")
        .eq("id", session.kid_session_id)
        .maybeSingle();

      if (kidSession) {
        parentId = kidSession.parent_id;
        childName = kidSession.child_name?.trim() || childName;
      }
    }

    if (!childId && session.document_id) {
      const { data: document } = await supabase
        .from("uploaded_documents")
        .select("child_id, parent_id")
        .eq("id", session.document_id)
        .maybeSingle();

      if (document) {
        childId = document.child_id ?? null;
        parentId = parentId ?? document.parent_id ?? null;
      }
    }

    if (!parentId && session.child_id) {
      const { data: child } = await supabase
        .from("children")
        .select("parent_id, name")
        .eq("id", session.child_id)
        .maybeSingle();

      if (child) {
        parentId = child.parent_id;
        childName = child.name?.trim() || childName;
      }
    }

    if (!parentId && childId) {
      const { data: child } = await supabase
        .from("children")
        .select("id, parent_id, name")
        .eq("id", childId)
        .maybeSingle();

      if (child) {
        parentId = child.parent_id;
        childName = child.name?.trim() || childName;
      }
    }

    if (!parentId && session.kid_session_id) {
      const { data: fallbackKidSession } = await supabase
        .from("kids_sessions")
        .select("parent_id, child_name")
        .eq("id", session.kid_session_id)
        .maybeSingle();

      if (fallbackKidSession) {
        parentId = fallbackKidSession.parent_id;
        childName = fallbackKidSession.child_name?.trim() || childName;
      }
    }

    if (!parentId) {
      return NextResponse.json({ error: "Parent not found for session" }, { status: 404 });
    }

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
        .eq("id", parentId)
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
    const quizAccuracy = quizAttempts.length > 0
      ? Math.round((quizCorrect / quizAttempts.length) * 100)
      : null;

    const topicsMentioned = messages
      .filter((m: { role: string }) => m.role === "assistant")
      .map((m: { content: string }) => m.content)
      .join(" ");

    const struggles = quizAttempts
      .filter((q: { is_correct?: boolean; topic?: string }) => !q.is_correct && q.topic)
      .map((q: { topic?: string }) => q.topic as string);

    // Generate report via OpenAI
    const reportPrompt = buildReportPrompt({
      childName,
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
    const learnedHighlights = extractLearnedHighlights(messages, topicsCovered);
    // Save report
    const { data: report } = await supabase
      .from("parent_reports")
      .insert({
        session_id: sessionId,
        parent_id: parentId,
        summary,
        topics_covered: topicsCovered,
        struggles,
        focus_summary: {
          total_focus_events: focusEvents.length,
          total_distraction_time_ms: totalDistractionMs,
          focus_score: focusScore,
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
          accuracy: quizAccuracy,
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
          from: resendFrom,
          to: parent.email,
          subject: `${childName}'s lesson recap`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #1f6feb; padding: 20px; border-radius: 16px 16px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 22px;">Vertex lesson recap</h1>
                <p style="color: rgba(255,255,255,0.82); margin: 8px 0 0;">${childName}'s session summary</p>
              </div>
              <div style="padding: 24px; background: #f8fbff; border-radius: 0 0 16px 16px; border: 1px solid #dbeafe;">
                <div style="display: inline-block; padding: 8px 14px; border-radius: 999px; background: #e0f2fe; color: #0c4a6e; font-weight: 700; font-size: 14px; margin-bottom: 16px;">
                  Focus meter: ${focusScore}%
                </div>
                <p style="margin: 0 0 12px; line-height: 1.6; color: #334155;">${briefContentNote}</p>
                <div style="margin: 0 0 16px; padding: 16px; border-radius: 14px; background: white; border: 1px solid #dbeafe;">
                  <p style="margin: 0 0 8px; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #64748b; font-weight: 700;">
                    What was learned
                  </p>
                  <ul style="margin: 0; padding-left: 18px; color: #334155; line-height: 1.7;">
                    ${learnedHighlights.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
                  </ul>
                </div>
                ${struggles.length > 0 ? `
                  <div style="margin: 0 0 16px; padding: 16px; border-radius: 14px; background: #fff7ed; border: 1px solid #fed7aa;">
                    <p style="margin: 0 0 8px; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #9a3412; font-weight: 700;">
                      Keep practicing
                    </p>
                    <p style="margin: 0; color: #7c2d12; line-height: 1.6;">${escapeHtml([...new Set(struggles)].slice(0, 3).map(toTitleCase).join(", "))}</p>
                  </div>
                ` : ""}
                <div style="padding: 16px; border-radius: 14px; background: #eff6ff; border: 1px solid #bfdbfe;">
                  <p style="margin: 0 0 8px; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #1d4ed8; font-weight: 700;">
                    Parent summary
                  </p>
                  <p style="margin: 0; color: #1e3a8a; line-height: 1.7;">${escapeHtml(summary)}</p>
                </div>
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

function extractLearnedHighlights(messages: Array<{ role?: string; content?: string }>, topics: string[]) {
  const assistantMessages = messages
    .filter((message) => message.role === "assistant")
    .map((message) => message.content?.replace(/\s+/g, " ").trim())
    .filter(Boolean) as string[];

  const highlights = assistantMessages
    .flatMap((message) => message.split(/(?<=[.!?])\s+/))
    .map((sentence) => sentence.replace(/\$[^$]+\$/g, "").trim())
    .filter((sentence) => sentence.length > 24)
    .filter((sentence) => !sentence.toLowerCase().includes("quiz"))
    .slice(0, 3);

  if (highlights.length > 0) {
    return highlights;
  }

  if (topics.length > 0) {
    return topics.slice(0, 3).map((topic) => `Practiced ${toTitleCase(topic)} during the lesson.`);
  }

  return ["Worked through the key homework ideas discussed during the session."];
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
