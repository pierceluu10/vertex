"use server";

import { createClient } from "@/lib/supabase/server";

export type CompleteSetupResult =
  | { success: true }
  | { success: false; error: string };

export async function completeOnboarding(formData: {
  childName: string;
  childAge: string;
  childGrade: string;
  preferredPace: string;
}): Promise<CompleteSetupResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const age = parseInt(formData.childAge, 10);
  if (Number.isNaN(age) || age < 3 || age > 14) {
    return { success: false, error: "Please enter a valid age (3–14)." };
  }

  const { data: child, error: childError } = await supabase
    .from("children")
    .insert({
      parent_id: user.id,
      name: formData.childName.trim(),
      age,
      grade: formData.childGrade.trim() || null,
    })
    .select()
    .single();

  if (childError) {
    return { success: false, error: childError.message };
  }

  const { error: profileError } = await supabase
    .from("learning_profiles")
    .insert({
      child_id: child.id,
      preferred_pace: formData.preferredPace,
    });

  if (profileError) {
    console.error("Profile error:", profileError);
    return { success: false, error: profileError.message };
  }

  return { success: true };
}
