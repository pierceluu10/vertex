import { NextResponse } from "next/server";
import { openai, buildTutorSystemPrompt } from "@/lib/openai";
import { createServiceClient } from "@/lib/supabase/server";
import { loadTutorContext } from "@/lib/tutor-context";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      sessionId,
      kidSessionId,
      parentId,
      message,
      messageType,
      childName,
      childAge,
      documentContext,
      adaptiveState,
      recentMessages,
      persistMessages = true,
    } = body;

    const supabase = await createServiceClient();
    const learningConfig = await loadTutorContext(supabase, { sessionId, kidSessionId, parentId });
    const resolvedChildName =
      (typeof childName === "string" && childName.trim()) ||
      learningConfig.childName ||
      "student";
    const resolvedChildAge =
      typeof childAge === "number" && childAge > 0
        ? childAge
        : learningConfig.childAge || 10;

    if (persistMessages && sessionId) {
      await supabase.from("messages").insert({
        session_id: sessionId,
        role: "user",
        content: message,
        message_type: messageType || "chat",
      });
    }

    const systemPrompt = buildTutorSystemPrompt({
      childName: resolvedChildName,
      childAge: resolvedChildAge,
      grade: learningConfig.gradeLevel || undefined,
      learningPace: learningConfig.learningPace || undefined,
      mathTopics: learningConfig.mathTopics,
      learningGoals: learningConfig.learningGoals || undefined,
      documentContext: documentContext || undefined,
      adaptiveState,
    });

    const chatMessages = [
      { role: "system" as const, content: systemPrompt },
      ...(recentMessages || []).map(
        (m: { role: string; content: string }) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })
      ),
      { role: "user" as const, content: message },
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: chatMessages,
      max_tokens: 1200,
      temperature: 0.7,
    });

    const responseContent =
      completion.choices[0]?.message?.content || "I'm not sure how to help with that. Can you try asking differently?";

    if (persistMessages && sessionId) {
      await supabase.from("messages").insert({
        session_id: sessionId,
        role: "assistant",
        content: responseContent,
        message_type: messageType || "chat",
      });
    }

    // Check if response contains quiz answer validation
    const hasCorrectIndicator =
      responseContent.toLowerCase().includes("correct") ||
      responseContent.toLowerCase().includes("right") ||
      responseContent.toLowerCase().includes("great job");
    const hasIncorrectIndicator =
      responseContent.toLowerCase().includes("not quite") ||
      responseContent.toLowerCase().includes("try again") ||
      responseContent.toLowerCase().includes("almost");

    let isCorrect: boolean | undefined;
    if (messageType === "quiz" && (hasCorrectIndicator || hasIncorrectIndicator)) {
      isCorrect = hasCorrectIndicator && !hasIncorrectIndicator;
    }

    return NextResponse.json({
      content: responseContent,
      messageType,
      isCorrect,
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Failed to generate response" },
      { status: 500 }
    );
  }
}
