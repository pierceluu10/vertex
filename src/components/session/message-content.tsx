"use client";

import React, { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

interface MessageContentProps {
  content: string;
}

/** Renders **bold** and *italic* in a text string as React nodes. */
function renderInlineFormatting(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  // Process **bold** first (greedy), then *italic* (single asterisk, content without *)
  let remaining = text;
  let key = 0;
  while (remaining.length > 0) {
    const boldMatch = remaining.match(/^\*\*(.+?)\*\*/s);
    const italicMatch = remaining.match(/^\*([^*]+)\*/);
    if (boldMatch) {
      out.push(<strong key={key++}>{boldMatch[1]}</strong>);
      remaining = remaining.slice(boldMatch[0].length);
    } else if (italicMatch) {
      out.push(<em key={key++}>{italicMatch[1]}</em>);
      remaining = remaining.slice(italicMatch[0].length);
    } else {
      const nextBold = remaining.indexOf("**");
      const nextItalic = remaining.indexOf("*");
      let sliceEnd: number;
      if (nextBold === -1 && nextItalic === -1) {
        sliceEnd = remaining.length;
      } else if (nextBold === -1) {
        sliceEnd = nextItalic;
      } else if (nextItalic === -1) {
        sliceEnd = nextBold;
      } else {
        sliceEnd = Math.min(nextBold, nextItalic);
      }
      out.push(remaining.slice(0, sliceEnd));
      remaining = remaining.slice(sliceEnd);
    }
  }
  return out;
}

type Segment =
  | { type: "text"; value: string }
  | { type: "math-block"; value: string }
  | { type: "math-inline"; value: string };

function parseSegments(text: string): Segment[] {
  const segments: Segment[] = [];
  // Match $$...$$ (block) then $...$ (inline), non-greedy
  const regex = /(\$\$[\s\S]*?\$\$|\$(?!\$)(?:[^$\\]|\\.)*\$)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    const raw = match[0];
    if (raw.startsWith("$$")) {
      segments.push({ type: "math-block", value: raw.slice(2, -2).trim() });
    } else {
      segments.push({ type: "math-inline", value: raw.slice(1, -1).trim() });
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }
  return segments;
}

function renderLatex(latex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      trust: true,
    });
  } catch {
    return latex;
  }
}

export function MessageContent({ content }: MessageContentProps) {
  const segments = useMemo(() => parseSegments(content), [content]);

  return (
    <span className="text-sm leading-relaxed">
      {segments.map((seg, i) => {
        if (seg.type === "math-block") {
          return (
            <span
              key={i}
              className="block my-2 text-center overflow-x-auto"
              dangerouslySetInnerHTML={{ __html: renderLatex(seg.value, true) }}
            />
          );
        }
        if (seg.type === "math-inline") {
          return (
            <span
              key={i}
              dangerouslySetInnerHTML={{ __html: renderLatex(seg.value, false) }}
            />
          );
        }
        // Plain text — render **bold** and *italic*
        return (
          <span key={i} className="whitespace-pre-wrap">
            {renderInlineFormatting(seg.value)}
          </span>
        );
      })}
    </span>
  );
}
