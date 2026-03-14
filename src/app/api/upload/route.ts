import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractTextFromPdf } from "@/lib/pdf";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const childId = formData.get("childId") as string;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const fileName = `${user.id}/${Date.now()}-${file.name}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("documents")
      .upload(fileName, buffer, {
        contentType: "application/pdf",
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload file" },
        { status: 500 }
      );
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("documents").getPublicUrl(uploadData.path);

    // Extract text from PDF
    let extractedText = "";
    let chunks = null;
    try {
      const result = await extractTextFromPdf(buffer);
      extractedText = result.text;
      chunks = result.chunks;
    } catch (err) {
      console.error("PDF parsing error:", err);
    }

    // Store document record
    const { data: doc, error: docError } = await supabase
      .from("uploaded_documents")
      .insert({
        parent_id: user.id,
        child_id: childId || null,
        file_name: file.name,
        file_url: publicUrl,
        extracted_text: extractedText,
        chunks,
      })
      .select()
      .single();

    if (docError) {
      console.error("Document insert error:", docError);
      return NextResponse.json(
        { error: "Failed to save document" },
        { status: 500 }
      );
    }

    return NextResponse.json({ document: doc });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}
