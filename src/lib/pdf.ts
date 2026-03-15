import { openai } from "@/lib/openai";
import type { DocumentChunk } from "@/types";

const CHUNK_SIZE = 1500;
const CHUNK_OVERLAP = 200;

/**
 * Extract text from a PDF by converting each page to an image
 * and sending it to GPT-4o vision. Works reliably in Next.js
 * without any native/worker dependencies.
 */
export async function extractTextFromPdf(
  buffer: Buffer
): Promise<{ text: string; chunks: DocumentChunk[] }> {
  const base64 = buffer.toString("base64");

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 4000,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Extract ALL text, math problems, instructions, and content from this PDF exactly as written. Preserve the structure (numbering, headings, line breaks). Output only the extracted text, nothing else.",
          },
          {
            type: "file",
            file: {
              filename: "document.pdf",
              file_data: `data:application/pdf;base64,${base64}`,
            },
          },
        ],
      },
    ],
  });

  const text = completion.choices[0]?.message?.content?.trim() || "";
  const chunks = chunkText(text);
  return { text, chunks };
}

function chunkText(text: string): DocumentChunk[] {
  if (!text) return [];
  const chunks: DocumentChunk[] = [];
  let index = 0;
  let position = 0;

  while (position < text.length) {
    const end = Math.min(position + CHUNK_SIZE, text.length);
    let chunkEnd = end;

    if (end < text.length) {
      const lastPeriod = text.lastIndexOf(".", end);
      const lastNewline = text.lastIndexOf("\n", end);
      const breakPoint = Math.max(lastPeriod, lastNewline);
      if (breakPoint > position) {
        chunkEnd = breakPoint + 1;
      }
    }

    chunks.push({
      index,
      text: text.slice(position, chunkEnd).trim(),
    });

    index++;
    const next = chunkEnd - CHUNK_OVERLAP;
    position = next <= position ? chunkEnd : next;
    if (position >= text.length) break;
  }

  return chunks;
}

export function findRelevantChunks(
  chunks: DocumentChunk[],
  query: string,
  topK: number = 3
): DocumentChunk[] {
  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);

  const scored = chunks.map((chunk) => {
    const chunkLower = chunk.text.toLowerCase();
    let score = 0;
    for (const term of queryTerms) {
      const occurrences = (chunkLower.match(new RegExp(term, "g")) || []).length;
      score += occurrences;
    }
    return { chunk, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).filter((s) => s.score > 0).map((s) => s.chunk);
}
