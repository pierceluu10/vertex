import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";

export async function POST(request: Request) {
  try {
    const { documentText, childName, childAge } = await request.json();

    if (!documentText) {
      return NextResponse.json({ error: "No document text provided" }, { status: 400 });
    }

    const prompt = `You are an expert math tutor creating a structured lesson for ${childName || "a student"}, age ${childAge || 10}.

Based on the following homework/textbook content, create a complete, engaging lesson. Return ONLY valid JSON (no markdown fences).

HOMEWORK/TEXTBOOK CONTENT:
${documentText.slice(0, 6000)}

Return this exact JSON structure:
{
  "title": "Lesson title",
  "overview": "1-2 sentence overview of what this lesson covers",
  "sections": [
    {
      "heading": "Section title",
      "content": "Clear explanation using simple language. Use LaTeX for math: $x^2$, $$\\\\frac{a}{b}$$. Keep it engaging and age-appropriate.",
      "examples": [
        {
          "problem": "A worked example problem",
          "steps": ["Step 1: ...", "Step 2: ...", "Step 3: ..."],
          "answer": "The final answer"
        }
      ]
    }
  ],
  "practiceProblems": [
    {
      "id": 1,
      "question": "A practice problem for the student to solve",
      "hint": "A helpful hint without giving away the answer",
      "solution": "Full step-by-step solution with the final answer",
      "answer": "Just the final answer (for checking)"
    }
  ]
}

RULES:
- Create 2-4 lesson sections with clear explanations
- Each section should have 1-2 worked examples with step-by-step solutions
- Include 4-6 practice problems at the end, ordered easy to hard
- Use LaTeX for ALL math: $3 \\times 4 = 12$, $\\frac{1}{2}$, $\\sqrt{9}$
- Use simple, encouraging, age-appropriate language
- Make examples relatable (use real-world contexts like pizza slices, toys, etc.)
- Practice problems should test the concepts taught in the sections`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 4000,
      temperature: 0.7,
    });

    const raw = completion.choices[0]?.message?.content || "";

    // Strip markdown code fences if present
    const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

    let lesson;
    try {
      lesson = JSON.parse(cleaned);
    } catch {
      console.error("[lesson/generate] Failed to parse GPT response:", raw);
      return NextResponse.json({ error: "Failed to parse lesson content" }, { status: 502 });
    }

    return NextResponse.json({ lesson });
  } catch (error) {
    console.error("[lesson/generate] Error:", error);
    return NextResponse.json({ error: "Failed to generate lesson" }, { status: 500 });
  }
}
