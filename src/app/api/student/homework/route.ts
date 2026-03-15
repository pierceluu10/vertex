import { NextResponse, NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

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
  void request;
  return NextResponse.json(
    { error: "Students cannot upload homework. Please ask a parent to upload PDFs." },
    { status: 403 }
  );
}
