import { NextResponse, NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { uploadProcessedDocument } from "@/lib/document-upload";

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
    const childContext = kidSessionId
      ? await loadKidContext(supabase, kidSessionId)
      : { childName: null, childAge: null, gradeLevel: null };

    const { document, extractedText } = await uploadProcessedDocument({
      supabase,
      file,
      storagePath: `kid/${kidSessionId || "anon"}/${Date.now()}-${file.name}`,
      parentId,
      kidSessionId: kidSessionId || null,
      childName: childContext.childName,
      childAge: childContext.childAge,
      gradeLevel: childContext.gradeLevel,
    });

    await supabase.from("homework").insert({
      parent_id: parentId,
      kid_session_id: kidSessionId || null,
      file_url: document.file_url,
      parsed_text: extractedText,
    });

    return NextResponse.json({ document });
  } catch (error) {
    console.error("Student homework POST error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

async function loadKidContext(supabase: Awaited<ReturnType<typeof createServiceClient>>, kidSessionId: string) {
  const { data: kidSession } = await supabase
    .from("kids_sessions")
    .select("child_name, code_used")
    .eq("id", kidSessionId)
    .maybeSingle();

  if (!kidSession) {
    return { childName: null, childAge: null, gradeLevel: null };
  }

  let childAge: number | null = null;
  let gradeLevel: string | null = null;

  if (kidSession.code_used) {
    const { data: accessCode } = await supabase
      .from("access_codes")
      .select("child_age, grade_level")
      .eq("code", kidSession.code_used)
      .maybeSingle();

    childAge = accessCode?.child_age ?? null;
    gradeLevel = accessCode?.grade_level ?? null;
  }

  return {
    childName: kidSession.child_name ?? null,
    childAge,
    gradeLevel,
  };
}
