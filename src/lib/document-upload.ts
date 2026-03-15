import type { SupabaseClient } from "@supabase/supabase-js";
import { extractTextFromPdf } from "@/lib/pdf";
import { generateLessonPlanFromText } from "@/lib/lesson-plan";
import { openai } from "@/lib/openai";
import type { DocumentChunk } from "@/types";

type UploadDocumentParams = {
  supabase: SupabaseClient;
  file: File;
  storagePath: string;
  parentId: string;
  childId?: string | null;
  kidSessionId?: string | null;
  childName?: string | null;
  childAge?: number | null;
  gradeLevel?: string | null;
};

type ProcessedDocument = {
  extractedText: string;
  chunks: DocumentChunk[] | null;
};

export async function uploadProcessedDocument(params: UploadDocumentParams) {
  const buffer = Buffer.from(await params.file.arrayBuffer());

  const { data: uploadData, error: uploadError } = await params.supabase.storage
    .from("documents")
    .upload(params.storagePath, buffer, {
      contentType: params.file.type || "application/pdf",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Failed to upload file: ${uploadError.message}`);
  }

  const {
    data: { publicUrl },
  } = params.supabase.storage.from("documents").getPublicUrl(uploadData.path);

  const processed = await processDocument({
    buffer,
    file: params.file,
  });

  const insertPayload = {
    parent_id: params.parentId,
    child_id: params.childId || null,
    kid_session_id: params.kidSessionId || null,
    file_name: params.file.name,
    file_url: publicUrl,
    extracted_text: processed.extractedText,
    chunks: processed.chunks,
  };

  let { data: document, error: documentError } = await params.supabase
    .from("uploaded_documents")
    .insert(insertPayload)
    .select()
    .single();

  if (documentError && isMissingColumnError(documentError.message, "kid_session_id")) {
    const fallbackPayload = {
      parent_id: params.parentId,
      child_id: params.childId || null,
      file_name: params.file.name,
      file_url: publicUrl,
      extracted_text: processed.extractedText,
      chunks: processed.chunks,
    };

    const fallbackInsert = await params.supabase
      .from("uploaded_documents")
      .insert(fallbackPayload)
      .select()
      .single();

    document = fallbackInsert.data;
    documentError = fallbackInsert.error;
  }

  if (documentError) {
    throw new Error(`Failed to save document: ${documentError.message}`);
  }

  if (shouldGenerateLessonPlan(processed.extractedText)) {
    void updateLessonPlanBestEffort({
      supabase: params.supabase,
      documentId: document.id,
      extractedText: processed.extractedText,
      childName: params.childName,
      childAge: params.childAge,
      gradeLevel: params.gradeLevel,
    });
  }

  return {
    document,
    extractedText: processed.extractedText,
  };
}

function isMissingColumnError(message: string, column: string) {
  return message.includes(`Could not find the '${column}' column`);
}

async function processDocument({
  buffer,
  file,
}: {
  buffer: Buffer;
  file: File;
}): Promise<ProcessedDocument> {
  let extractedText = "";
  let chunks: DocumentChunk[] | null = null;

  try {
    if (isPdf(file)) {
      const result = await extractTextFromPdf(buffer);
      extractedText = result.text;
      chunks = result.chunks;
    } else if (file.type.startsWith("text/")) {
      extractedText = buffer.toString("utf-8");
    } else if (file.type.startsWith("image/")) {
      extractedText = await extractTextFromImage(buffer, file.type);
    } else {
      extractedText = `File uploaded: ${file.name} (${file.type || "unknown"})`;
    }
  } catch (error) {
    console.error("[document-upload] File parsing error:", error);
    extractedText = `Failed to parse file: ${file.name}`;
    chunks = null;
  }

  return {
    extractedText,
    chunks,
  };
}

function isPdf(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function shouldGenerateLessonPlan(text: string) {
  const trimmed = text.trim();
  return (
    trimmed.length >= 80 &&
    !trimmed.startsWith("Failed to parse file:") &&
    !trimmed.startsWith("File uploaded:")
  );
}

async function extractTextFromImage(buffer: Buffer, contentType: string) {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 1500,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Please extract all math problems, instructions, and text from this image exactly as written. If it's a worksheet, preserve the structure. Only output the extracted text, no conversational filler.",
          },
          {
            type: "image_url",
            image_url: {
              url: `data:${contentType};base64,${buffer.toString("base64")}`,
            },
          },
        ],
      },
    ],
  });

  return completion.choices[0]?.message?.content?.trim() || "";
}

async function updateLessonPlanBestEffort({
  supabase,
  documentId,
  extractedText,
  childName,
  childAge,
  gradeLevel,
}: {
  supabase: SupabaseClient;
  documentId: string;
  extractedText: string;
  childName?: string | null;
  childAge?: number | null;
  gradeLevel?: string | null;
}) {
  try {
    const lessonPlan = await generateLessonPlanFromText(extractedText, {
      childName,
      childAge,
      gradeLevel,
    });

    if (!lessonPlan) return;

    const { error } = await supabase
      .from("uploaded_documents")
      .update({ lesson_plan: lessonPlan })
      .eq("id", documentId);

    if (error) {
      console.error("[document-upload] Failed to save lesson plan:", error);
    }
  } catch (error) {
    console.error("[document-upload] Lesson plan generation failed:", error);
  }
}
