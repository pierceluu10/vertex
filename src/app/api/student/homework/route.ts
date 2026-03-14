import { NextResponse, NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { extractTextFromPdf } from "@/lib/pdf";

export async function GET(request: NextRequest) {
  try {
    const parentId = request.nextUrl.searchParams.get("parentId");
    if (!parentId) {
      return NextResponse.json({ error: "Missing parentId" }, { status: 400 });
    }

    const supabase = await createServiceClient();

    const { data: documents } = await supabase
      .from("uploaded_documents")
      .select("*")
      .eq("parent_id", parentId)
      .order("uploaded_at", { ascending: false })
      .limit(20);

    return NextResponse.json({ documents: documents || [] });
  } catch (error) {
    console.error("Student homework GET error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const kidSessionId = formData.get("kidSessionId") as string;
    const parentId = formData.get("parentId") as string;

    if (!file || !parentId) {
      return NextResponse.json({ error: "Missing file or parentId" }, { status: 400 });
    }

    const supabase = await createServiceClient();

    const fileName = `kid/${kidSessionId || "anon"}/${Date.now()}-${file.name}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("documents")
      .upload(fileName, buffer, { contentType: "application/pdf" });

    if (uploadError) {
      return NextResponse.json({ error: "Upload failed: " + uploadError.message }, { status: 500 });
    }

    const { data: { publicUrl } } = supabase.storage.from("documents").getPublicUrl(uploadData.path);

    let extractedText = "";
    let chunks = null;
    try {
      const result = await extractTextFromPdf(buffer);
      extractedText = result.text;
      chunks = result.chunks;
    } catch { /* ignore */ }

    const { data: doc } = await supabase
      .from("uploaded_documents")
      .insert({
        parent_id: parentId,
        kid_session_id: kidSessionId || null,
        file_name: file.name,
        file_url: publicUrl,
        extracted_text: extractedText,
        chunks,
      })
      .select()
      .single();

    // Also insert into homework table
    await supabase.from("homework").insert({
      parent_id: parentId,
      kid_session_id: kidSessionId || null,
      file_url: publicUrl,
      parsed_text: extractedText,
    });

    return NextResponse.json({ document: doc });
  } catch (error) {
    console.error("Student homework POST error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
