import { NextResponse } from "next/server";
import { openai, buildQuizPrompt } from "@/lib/openai";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionId, childId, topic, childAge, difficulty, documentContext } =
      body;

    const supabase = await createServiceClient();

    const prompt = buildQuizPrompt({
      topic: topic || "general math",
      childAge: childAge || 8,
      difficulty: difficulty || "medium",
      documentContext,
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 300,
      temperature: 0.8,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: "No quiz generated" },
        { status: 500 }
      );
    }

    const quiz = JSON.parse(content);

    // Store quiz attempt
    await supabase.from("quiz_attempts").insert({
      session_id: sessionId,
      child_id: childId,
      question: quiz.question,
      correct_answer: quiz.correct_answer,
      topic: topic || "general math",
    });

    return NextResponse.json({
      question: quiz.question,
      hint: quiz.hint,
      explanation: quiz.explanation,
      correct_answer: quiz.correct_answer,
    });
  } catch (error) {
    console.error("Quiz API error:", error);
    return NextResponse.json(
      { error: "Failed to generate quiz" },
      { status: 500 }
    );
  }
}
