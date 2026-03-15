import { openai } from "@/lib/openai";

type LessonPlanContext = {
  childName?: string | null;
  childAge?: number | null;
  gradeLevel?: string | null;
};

export async function generateLessonPlanFromText(
  documentText: string,
  context: LessonPlanContext = {}
): Promise<Record<string, unknown> | null> {
  const trimmed = documentText.trim();
  if (!trimmed) return null;

  const childName = context.childName || "the student";
  const childAge = context.childAge ?? 10;
  const gradeLevel = context.gradeLevel || "elementary";

  const prompt = `You are an expert math tutor creating a structured, interactive lesson for ${childName}, age ${childAge}, grade level: ${gradeLevel}.

Based on the following homework/textbook content, create a COMPLETE lesson that fully covers every topic in the document. Return ONLY valid JSON (no markdown fences).

HOMEWORK/TEXTBOOK CONTENT:
${trimmed.slice(0, 12000)}

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
- Each section MUST have an interactiveChallenge
- Include 5-8 practice problems at the end, ordered easy to hard
- Use LaTeX for ALL math
- Use simple, encouraging, age-appropriate language
- Make examples relatable
- Practice problems should test the concepts taught in the sections
- For gameConfig, generate 8-12 quick multiple-choice math questions based on lesson content
- The lesson should feel like it was made specifically for this document, not generic`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 6000,
    temperature: 0.7,
  });

  const raw = completion.choices[0]?.message?.content || "";
  const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    console.error("[lesson-plan] Failed to parse GPT response:", raw.slice(0, 500));
    return null;
  }
}
