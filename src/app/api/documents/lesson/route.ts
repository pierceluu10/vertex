import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { generateLessonPlanFromText } from "@/lib/lesson-plan";

export async function POST(request: Request) {
  try {
    const { documentId } = await request.json();

    if (!documentId) {
      return NextResponse.json({ error: "Missing documentId" }, { status: 400 });
    }

    const authClient = await createClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createServiceClient();

    // Fetch the document
    const { data: doc, error: docError } = await supabase
      .from("uploaded_documents")
      .select("*")
      .eq("id", documentId)
      .eq("parent_id", user.id)
      .single();

    if (docError || !doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (!doc.extracted_text) {
      return NextResponse.json({ error: "No text extracted from this document" }, { status: 400 });
    }

    // Fetch parent info for child details
    const { data: parent } = await supabase
      .from("parents")
      .select("child_name, grade_level")
      .eq("id", user.id)
      .single();

    const childName = parent?.child_name || "the student";
    const gradeLevel = parent?.grade_level || "elementary";

    const lesson = await generateLessonPlanFromText(doc.extracted_text, {
      childName,
      gradeLevel,
    });

    if (!lesson) {
      return NextResponse.json({ error: "Failed to generate lesson content" }, { status: 502 });
    }

    // Save lesson plan to the document
    const { error: updateError } = await supabase
      .from("uploaded_documents")
      .update({ lesson_plan: lesson })
      .eq("id", documentId);

    if (updateError) {
      console.error("[documents/lesson] Failed to save lesson:", updateError);
      return NextResponse.json({ error: "Failed to save lesson" }, { status: 500 });
    }

    return NextResponse.json({ lesson });
  } catch (error) {
    console.error("[documents/lesson] Error:", error);
    return NextResponse.json({ error: "Failed to generate lesson" }, { status: 500 });
  }
}
