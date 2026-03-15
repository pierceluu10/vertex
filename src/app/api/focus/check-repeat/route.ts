import { NextResponse } from "next/server";
import OpenAI from "openai";
import { cosineSimilarity } from "@/lib/content-confidence";

const openai = new OpenAI();

/**
 * POST /api/focus/check-repeat
 * Embeds the new question, computes cosine similarity against previous questions.
 * Returns whether it's a repeat (similarity > 0.85).
 */
export async function POST(request: Request) {
  try {
    const { newQuestion, previousQuestions } = (await request.json()) as {
      newQuestion: string;
      previousQuestions: string[];
    };

    if (!newQuestion || !previousQuestions?.length) {
      return NextResponse.json({ isRepeat: false, maxSimilarity: 0, repeatCount: 0 });
    }

    // Embed all questions in one batch
    const allTexts = [newQuestion, ...previousQuestions];
    const embeddingRes = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: allTexts,
    });

    const embeddings = embeddingRes.data.map((d) => d.embedding);
    const newEmb = embeddings[0];
    const prevEmbs = embeddings.slice(1);

    let maxSimilarity = 0;
    let repeatCount = 0;

    for (const prevEmb of prevEmbs) {
      const sim = cosineSimilarity(newEmb, prevEmb);
      if (sim > maxSimilarity) maxSimilarity = sim;
      if (sim > 0.85) repeatCount++;
    }

    return NextResponse.json({
      isRepeat: maxSimilarity > 0.85,
      maxSimilarity: Math.round(maxSimilarity * 1000) / 1000,
      repeatCount,
    });
  } catch (error) {
    console.error("Check repeat error:", error);
    return NextResponse.json({ isRepeat: false, maxSimilarity: 0, repeatCount: 0 });
  }
}
