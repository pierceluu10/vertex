import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI();

/**
 * POST /api/focus/evaluate-response
 * Sends kid's answer + question to GPT-4o to rate conceptual understanding 0–100.
 */
export async function POST(request: Request) {
  try {
    const { question, answer } = await request.json();

    if (!question || !answer) {
      return NextResponse.json({ score: 50 });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0,
      max_tokens: 10,
      messages: [
        {
          role: "system",
          content:
            "Given this math question and this student answer, rate the conceptual understanding from 0 to 100. Consider whether they understood the method not just got the right number. Return only the integer.",
        },
        {
          role: "user",
          content: `Question: ${question}\nStudent answer: ${answer}`,
        },
      ],
    });

    const text = completion.choices[0]?.message?.content?.trim() ?? "50";
    const score = Math.max(0, Math.min(100, parseInt(text, 10) || 50));

    return NextResponse.json({ score });
  } catch (error) {
    console.error("Evaluate response error:", error);
    return NextResponse.json({ score: 50 });
  }
}
