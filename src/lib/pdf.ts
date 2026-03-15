import { PDFParse } from "pdf-parse";
import type { DocumentChunk } from "@/types";

const CHUNK_SIZE = 1500;
const CHUNK_OVERLAP = 200;

export async function extractTextFromPdf(
  buffer: Buffer
): Promise<{ text: string; chunks: DocumentChunk[] }> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await parser.getText();
  const text = result.text || "";
  const chunks = chunkText(text);
  return { text, chunks };
}

function chunkText(text: string): DocumentChunk[] {
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
    position = chunkEnd - CHUNK_OVERLAP;
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
