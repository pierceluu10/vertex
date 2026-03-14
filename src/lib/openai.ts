import OpenAI from "openai";

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export function buildTutorSystemPrompt(context: {
  childName: string;
  childAge: number;
  grade?: string;
  documentContext?: string;
  adaptiveState?: {
    shouldSimplify: boolean;
    currentTone: string;
    currentDifficulty: string;
  };
  recentMistakes?: string[];
  sessionSummary?: string;
}) {
  const {
    childName,
    childAge,
    grade,
    documentContext,
    adaptiveState,
    recentMistakes,
    sessionSummary,
  } = context;

  const difficultyInstruction = adaptiveState?.shouldSimplify
    ? "The child is struggling. Use very simple language. Break things into tiny steps. Be extra encouraging."
    : adaptiveState?.currentDifficulty === "hard"
    ? "The child is doing well. You can introduce slightly more challenging questions."
    : "Keep explanations at grade level.";

  const toneInstruction =
    adaptiveState?.currentTone === "supportive"
      ? "Be extra warm, patient, and encouraging. The child needs support right now."
      : "Be friendly, warm, and encouraging.";

  return `You are a kind, patient math tutor helping ${childName}, who is ${childAge} years old${grade ? ` and in ${grade}` : ""}.

CORE RULES:
- Use simple, age-appropriate language for a ${childAge}-year-old
- Be warm, encouraging, and never make the child feel bad about mistakes
- Keep responses short and focused — no walls of text
- Use emojis sparingly to be friendly (1-2 per message max)
- When explaining, use concrete examples the child can relate to
- If the child seems confused, break the problem into smaller steps
- Celebrate correct answers with genuine enthusiasm
- Never give the full answer directly — guide the child to discover it

${difficultyInstruction}
${toneInstruction}

${
  documentContext
    ? `HOMEWORK CONTEXT (ground your answers in this material):
${documentContext}`
    : ""
}

${
  recentMistakes?.length
    ? `RECENT MISTAKES (be mindful of these topics):
${recentMistakes.join("\n")}`
    : ""
}

${sessionSummary ? `SESSION SO FAR: ${sessionSummary}` : ""}

CAPABILITIES:
- You can explain math concepts step by step
- You can give hints without revealing the answer
- You can create simple quiz questions
- When a math visualization would help, include a JSON block tagged with [JSXGRAPH] containing the graph configuration
- When you want to quiz the child, format your question clearly and end with [QUIZ]

JSXGRAPH FORMAT (when visuals help):
[JSXGRAPH]{"type":"numberline","min":0,"max":10,"points":[3,7],"label":"Adding 3 + 4"}[/JSXGRAPH]
[JSXGRAPH]{"type":"shapes","shapes":[{"shape":"circle","count":5},{"shape":"circle","count":3}],"label":"5 + 3"}[/JSXGRAPH]
[JSXGRAPH]{"type":"fraction","numerator":1,"denominator":4,"label":"One quarter"}[/JSXGRAPH]`;
}

export function buildQuizPrompt(context: {
  topic: string;
  childAge: number;
  difficulty: string;
  documentContext?: string;
}) {
  return `Generate a single age-appropriate math quiz question for a ${context.childAge}-year-old about "${context.topic}".
Difficulty: ${context.difficulty}

${context.documentContext ? `Base the question on this material:\n${context.documentContext}` : ""}

Respond with JSON:
{
  "question": "the question text in simple, friendly language",
  "correct_answer": "the correct answer",
  "hint": "a helpful hint if the child is stuck",
  "explanation": "a simple explanation of the answer"
}`;
}

export function buildReportPrompt(context: {
  childName: string;
  sessionDuration: string;
  messageCount: number;
  topicsCovered: string[];
  quizResults: { correct: number; total: number };
  focusSummary: { distractions: number; totalDistractedTime: string };
  struggles: string[];
}) {
  return `Generate a concise, warm parent report for a tutoring session.

Child: ${context.childName}
Duration: ${context.sessionDuration}
Messages exchanged: ${context.messageCount}
Topics covered: ${context.topicsCovered.join(", ") || "General practice"}
Quiz performance: ${context.quizResults.correct}/${context.quizResults.total} correct
Focus: ${context.focusSummary.distractions} distraction events, ${context.focusSummary.totalDistractedTime} total distracted time
Areas of difficulty: ${context.struggles.join(", ") || "None noted"}

Write a brief, encouraging summary for the parent with:
1. What was studied (2-3 sentences)
2. How the child performed
3. Focus/attention notes
4. Suggested next practice areas

Keep it warm and positive. Use plain language.`;
}
