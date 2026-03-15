import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { openai } from "@/lib/openai";

export async function POST(request: Request) {
  try {
    const { documentId } = await request.json();

    if (!documentId) {
      return NextResponse.json({ error: "Missing documentId" }, { status: 400 });
    }

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch the document
    const { data: doc, error: docError } = await supabase
      .from("uploaded_documents")
      .select("*")
      .eq("id", documentId)
      .eq("parent_id", user.id)
      .single();

    if (docError || !doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (!doc.extracted_text) {
      return NextResponse.json({ error: "No text extracted from this document" }, { status: 400 });
    }

    // Fetch parent info for child details
    const { data: parent } = await supabase
      .from("parents")
      .select("child_name, grade_level")
      .eq("id", user.id)
      .single();

    const childName = parent?.child_name || "the student";
    const gradeLevel = parent?.grade_level || "elementary";

    const prompt = `You are an expert math tutor creating a structured, interactive lesson for ${childName}, grade level: ${gradeLevel}.

Based on the following homework/textbook content, create a COMPLETE lesson that fully covers every topic in the document. Return ONLY valid JSON (no markdown fences).

HOMEWORK/TEXTBOOK CONTENT:
${doc.extracted_text.slice(0, 12000)}

Return this exact JSON structure:
{
  "title": "Lesson title that reflects the actual content",
  "overview": "2-3 sentence overview of what this lesson covers and why it matters",
  "sections": [
    {
      "heading": "Section title matching a topic from the document",
      "content": "Clear, engaging explanation using simple language. Use LaTeX for math: $x^2$, $$\\\\frac{a}{b}$$. Reference the actual problems and concepts from the document. Make it conversational and fun.",
      "examples": [
        {
          "problem": "A worked example DIRECTLY from or closely based on the document content",
          "steps": ["Step 1: ...", "Step 2: ...", "Step 3: ..."],
          "answer": "The final answer with LaTeX"
        }
      ],
      "interactiveChallenge": {
        "question": "A quick interactive question for the student to think about before moving on",
        "options": ["Option A", "Option B", "Option C", "Option D"],
        "correctIndex": 0,
        "explanation": "Why this is the correct answer"
      }
    }
  ],
  "practiceProblems": [
    {
      "id": 1,
      "question": "A practice problem based on the document content",
      "hint": "A helpful hint without giving away the answer",
      "solution": "Full step-by-step solution with LaTeX math and the final answer",
      "answer": "Just the final answer (for checking)"
    }
  ],
  "gameConfig": {
    "topic": "The main math topic (e.g. 'Fractions', 'Algebra', 'Geometry')",
    "questions": [
      {
        "question": "Quick math question from the lesson (keep short)",
        "options": ["A", "B", "C", "D"],
        "correctIndex": 0
      }
    ]
  }
}

RULES:
- Create 3-5 lesson sections that cover ALL the key topics from the document
- Each section MUST have 1-2 worked examples pulled directly from or inspired by the document
- Each section MUST have an interactiveChallenge — a quick multiple-choice question the student answers inline
- Include 5-8 practice problems at the end, ordered easy to hard
- Use LaTeX for ALL math: $3 \\times 4 = 12$, $\\frac{1}{2}$, $\\sqrt{9}$
- Use simple, encouraging, age-appropriate language
- Make examples relatable (use real-world contexts like pizza slices, toys, sports, etc.)
- Practice problems should test the concepts taught in the sections
- For gameConfig, generate 8-12 quick multiple-choice math questions based on lesson content (keep questions SHORT, max 60 chars)
- The lesson should feel like it was made specifically for this document, not generic`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 6000,
      temperature: 0.7,
    });

    const raw = completion.choices[0]?.message?.content || "";
    const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

    let lesson;
    try {
      lesson = JSON.parse(cleaned);
    } catch {
      console.error("[documents/lesson] Failed to parse GPT response:", raw.slice(0, 500));
      return NextResponse.json({ error: "Failed to parse lesson content" }, { status: 502 });
    }

    // Save lesson plan to the document
    const { error: updateError } = await supabase
      .from("uploaded_documents")
      .update({ lesson_plan: lesson })
      .eq("id", documentId);

    if (updateError) {
      console.error("[documents/lesson] Failed to save lesson:", updateError);
      return NextResponse.json({ error: "Failed to save lesson" }, { status: 500 });
    }

    return NextResponse.json({ lesson });
  } catch (error) {
    console.error("[documents/lesson] Error:", error);
    return NextResponse.json({ error: "Failed to generate lesson" }, { status: 500 });
  }
}
