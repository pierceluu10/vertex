import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { extractTextFromPdf } from "@/lib/pdf";
import { generateLessonPlanFromText } from "@/lib/lesson-plan";

export async function POST(request: Request) {
  try {
    const { documentId } = await request.json();
    if (!documentId) {
      return NextResponse.json({ error: "Missing documentId" }, { status: 400 });
    }

    const supabase = await createServiceClient();

    const { data: doc } = await supabase
      .from("uploaded_documents")
      .select("id, file_url, file_name, parent_id, child_id, extracted_text")
      .eq("id", documentId)
      .single();

    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Download the file from Supabase storage
    const fileUrl = doc.file_url;
    const res = await fetch(fileUrl);
    if (!res.ok) {
      return NextResponse.json({ error: "Failed to download file from storage" }, { status: 500 });
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Re-extract text
    const { text, chunks } = await extractTextFromPdf(buffer);

    if (!text || text.length < 10) {
      return NextResponse.json({ error: "Extraction returned empty text" }, { status: 500 });
    }

    // Update the document
    const { error: updateError } = await supabase
      .from("uploaded_documents")
      .update({ extracted_text: text, chunks })
      .eq("id", documentId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Generate lesson plan
    try {
      const lessonPlan = await generateLessonPlanFromText(text, {});
      if (lessonPlan) {
        await supabase
          .from("uploaded_documents")
          .update({ lesson_plan: lessonPlan })
          .eq("id", documentId);
      }
    } catch {
      // Non-critical
    }

    return NextResponse.json({
      success: true,
      extractedLength: text.length,
      chunkCount: chunks.length,
    });
  } catch (error) {
    console.error("Reparse error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Reparse failed" },
      { status: 500 },
    );
  }
}
