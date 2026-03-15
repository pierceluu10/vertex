import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { uploadProcessedDocument } from "@/lib/document-upload";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const childId = formData.get("childId") as string;
    const accessCodeId = formData.get("accessCodeId") as string;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Auth check via cookies
    const authClient = await createClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Service client bypasses RLS for storage + DB writes
    const supabase = await createServiceClient();
    let childContext: { childName?: string | null; childAge?: number | null; gradeLevel?: string | null } = {};
    let resolvedChildId = childId || null;

    if (!resolvedChildId && accessCodeId) {
      const { data: accessCode } = await supabase
        .from("access_codes")
        .select("id, child_name, child_age, grade_level")
        .eq("id", accessCodeId)
        .eq("parent_id", user.id)
        .single();

      if (!accessCode) {
        return NextResponse.json({ error: "Invalid access code" }, { status: 400 });
      }

      const { data: existingChild } = await supabase
        .from("children")
        .select("id")
        .eq("parent_id", user.id)
        .eq("name", accessCode.child_name || "")
        .maybeSingle();

      if (existingChild?.id) {
        resolvedChildId = existingChild.id;
      } else {
        const { data: createdChild, error: childError } = await supabase
          .from("children")
          .insert({
            parent_id: user.id,
            name: accessCode.child_name || "Student",
            age: accessCode.child_age || 10,
            grade: accessCode.grade_level || null,
          })
          .select("id")
          .single();

        if (childError) {
          console.error("Child create for upload error:", childError);
          return NextResponse.json({ error: "Failed to link upload to student" }, { status: 500 });
        }

        resolvedChildId = createdChild.id;
      }
    }

    // Ensure parent row exists (catches users who signed up before the column-name fix)
    const { data: existingParent } = await supabase
      .from("parents")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (!existingParent) {
      const { error: parentError } = await supabase.from("parents").insert({
        id: user.id,
        email: user.email ?? "",
        name: (user.user_metadata?.full_name as string) || user.email?.split("@")[0] || "Parent",
      });
      if (parentError) {
        console.error("Parent auto-create error:", parentError);
        return NextResponse.json(
          { error: "Could not verify parent profile. Please try again." },
          { status: 500 }
        );
      }
    }

    if (resolvedChildId) {
      const { data: child } = await supabase
        .from("children")
        .select("name, age, grade")
        .eq("id", resolvedChildId)
        .eq("parent_id", user.id)
        .maybeSingle();

      if (child) {
        childContext = {
          childName: child.name,
          childAge: child.age,
          gradeLevel: child.grade,
        };
      }
    }

    try {
      const { document } = await uploadProcessedDocument({
        supabase,
        file,
        storagePath: `${user.id}/${Date.now()}-${file.name}`,
        parentId: user.id,
        childId: resolvedChildId,
        childName: childContext.childName,
        childAge: childContext.childAge,
        gradeLevel: childContext.gradeLevel,
      });

      return NextResponse.json({ document });
    } catch (error) {
      console.error("Document upload pipeline error:", error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Failed to upload file" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}
