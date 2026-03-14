import { NextResponse } from "next/server";
import { createClientFromRequest, createServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const authClient = createClientFromRequest(request);
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServiceClient();
  const { data: buckets } = await supabase.storage.listBuckets();
  if (buckets?.some((b) => b.name === "avatars")) {
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabase.storage.createBucket("avatars", { public: true });
  if (error && !error.message.includes("already exists")) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
