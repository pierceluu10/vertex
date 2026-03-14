import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const { kidSessionId, parentId, homeworkContext } = await request.json();

    const supabase = await createServiceClient();

    // Get parent config for personalized questions
    let gradeLevel = "";
    let mathTopics: string[] = [];
    if (parentId) {
      const { data: parent } = await supabase
        .from("parents")
        .select("grade_level, math_topics")
        .eq("id", parentId)
        .single();
      if (parent) {
        gradeLevel = parent.grade_level || "";
        mathTopics = parent.math_topics || [];
      }
    }

    const prompt = `Generate 5 math quiz questions for a student${gradeLevel ? ` in ${gradeLevel}` : ""}.
${mathTopics.length ? `Focus on these topics: ${mathTopics.join(", ")}` : ""}
${homeworkContext ? `\nBase questions on this homework material:\n${homeworkContext.slice(0, 2000)}` : ""}

Return JSON with this exact structure:
{
  "questions": [
    {
      "index": 0,
      "question": "the question text",
      "type": "multiple_choice",
      "options": ["option A", "option B", "option C", "option D"],
      "correct_answer": "the correct option text exactly as in options"
    }
  ]
}

Mix question types: some multiple_choice (with 4 options), some open (type: "open", no options field).
Make questions age-appropriate, clear, and progressively harder.
For open questions, correct_answer should be the simplest form of the answer.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1500,
      temperature: 0.8,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: "Failed to generate quiz" }, { status: 500 });
    }

    const parsed = JSON.parse(content);
    const questions = parsed.questions || [];

    // Save quiz to database
    if (kidSessionId) {
      await supabase.from("quizzes").insert({
        parent_id: parentId || null,
        kid_session_id: kidSessionId,
        questions,
      });
    }

    return NextResponse.json({ questions });
  } catch (error) {
    console.error("Student quiz error:", error);
    return NextResponse.json({ error: "Failed to generate quiz" }, { status: 500 });
  }
}
