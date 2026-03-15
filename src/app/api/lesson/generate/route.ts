import { NextResponse } from "next/server";
import { generateLessonPlanFromText } from "@/lib/lesson-plan";

export async function POST(request: Request) {
  try {
    const { documentText, childName, childAge } = await request.json();

    if (!documentText) {
      return NextResponse.json({ error: "No document text provided" }, { status: 400 });
    }

    const lesson = await generateLessonPlanFromText(documentText, { childName, childAge });

    if (!lesson) {
      return NextResponse.json({ error: "Failed to parse lesson content" }, { status: 502 });
    }

    return NextResponse.json({ lesson });
  } catch (error) {
    console.error("[lesson/generate] Error:", error);
    return NextResponse.json({ error: "Failed to generate lesson" }, { status: 500 });
  }
}
