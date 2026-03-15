import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractTextFromPdf } from "@/lib/pdf";
import { openai } from "@/lib/openai";

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
        contentType: file.type || "application/octet-stream",
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

    // Extract text from PDF, Text, or Image
    let extractedText = "";
    let chunks = null;
    try {
      if (file.type === "application/pdf") {
        const result = await extractTextFromPdf(buffer);
        extractedText = result.text;
        chunks = result.chunks;
      } else if (file.type.startsWith("text/")) {
        extractedText = buffer.toString("utf-8");
      } else if (file.type.startsWith("image/")) {
        // Use GPT-4o Vision to extract text from images
        const base64Image = buffer.toString("base64");
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
                    url: `data:${file.type};base64,${base64Image}`,
                  },
                },
              ],
            },
          ],
        });
        extractedText = completion.choices[0]?.message?.content?.trim() || "";
      } else {
        // Fallback for other files (Word, etc) - in MVP we might just get a summary if we can't parse it
        extractedText = `File uploaded: ${file.name} (${file.type})`;
      }
    } catch (err) {
      console.error("File parsing error:", err);
      extractedText = `Failed to parse file: ${file.name}`;
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
