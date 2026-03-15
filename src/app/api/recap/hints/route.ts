import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";

const openai = new OpenAI();

/**
 * POST /api/recap/hints
 * Generates encouraging practice hints for weak topics.
 * Caches on the session record so refreshing doesn't regenerate.
 */
export async function POST(request: Request) {
  try {
    const { sessionId, weakTopics } = (await request.json()) as {
      sessionId: string;
      weakTopics: string[];
    };

    if (!sessionId || !weakTopics?.length) {
      return NextResponse.json({ hints: {} });
    }

    const supabase = await createClient();

    // Check cache first
    const { data: session } = await supabase
      .from("tutoring_sessions")
      .select("session_summary")
      .eq("id", sessionId)
      .single();

    // Use session_summary field to cache hints (we'll store as JSON at the end)
    const existingSummary = session?.session_summary;
    if (existingSummary) {
      try {
        const parsed = JSON.parse(existingSummary);
        if (parsed?.recapHints) {
          return NextResponse.json({ hints: parsed.recapHints, cached: true });
        }
      } catch {
        // Not JSON, that's fine — it's a regular summary
      }
    }

    // Generate hints
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.7,
      max_tokens: 500,
      messages: [
        {
          role: "system",
          content:
            "You help children practice math. For each topic listed, write one short, encouraging sentence telling the child what to practice next. Be warm and age-appropriate. Return as JSON: {\"topic1\": \"hint1\", \"topic2\": \"hint2\"}. Only return the JSON, nothing else.",
        },
        {
          role: "user",
          content: `Topics to practice: ${weakTopics.join(", ")}`,
        },
      ],
    });

    const text = completion.choices[0]?.message?.content?.trim() ?? "{}";
    let hints: Record<string, string> = {};
    try {
      hints = JSON.parse(text);
    } catch {
      // Fallback: generic hints
      for (const topic of weakTopics) {
        hints[topic] = `Keep practicing ${topic} — you're getting better every day!`;
      }
    }

    // Cache on session record
    const cacheData = existingSummary
      ? JSON.stringify({ summary: existingSummary, recapHints: hints })
      : JSON.stringify({ recapHints: hints });

    await supabase
      .from("tutoring_sessions")
      .update({ session_summary: cacheData })
      .eq("id", sessionId);

    return NextResponse.json({ hints, cached: false });
  } catch (error) {
    console.error("Recap hints error:", error);
    return NextResponse.json({ hints: {} });
  }
}
