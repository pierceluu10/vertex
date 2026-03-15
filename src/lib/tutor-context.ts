import type { createServiceClient } from "@/lib/supabase/server";

type ServiceSupabase = Awaited<ReturnType<typeof createServiceClient>>;

export type TutorContext = {
  parentId: string | null;
  parentName: string | null;
  childName: string | null;
  childAge: number | null;
  gradeLevel: string | null;
  learningPace: "slow" | "medium" | "fast" | null;
  mathTopics: string[];
  documentContext: string | null;
};

export async function loadTutorContext(
  supabase: ServiceSupabase,
  params: {
    sessionId?: string | null;
    kidSessionId?: string | null;
    parentId?: string | null;
    documentId?: string | null;
  }
): Promise<TutorContext> {
  const context: TutorContext = {
    parentId: params.parentId ?? null,
    parentName: null,
    childName: null,
    childAge: null,
    gradeLevel: null,
    learningPace: null,
    mathTopics: [],
    documentContext: null,
  };

  let resolvedKidSessionId = params.kidSessionId ?? null;
  let resolvedDocumentId = params.documentId ?? null;

  if (params.sessionId) {
    let tutoringSession:
      | { child_id: string | null; kid_session_id?: string | null; document_id: string | null }
      | null = null;

    const initialLookup = await supabase
      .from("tutoring_sessions")
      .select("child_id, kid_session_id, document_id")
      .eq("id", params.sessionId)
      .maybeSingle();

    if (initialLookup.error && initialLookup.error.message.includes("kid_session_id")) {
      const fallbackLookup = await supabase
        .from("tutoring_sessions")
        .select("child_id, document_id")
        .eq("id", params.sessionId)
        .maybeSingle();

      tutoringSession = fallbackLookup.data
        ? {
            child_id: fallbackLookup.data.child_id,
            document_id: fallbackLookup.data.document_id,
          }
        : null;
    } else {
      tutoringSession = initialLookup.data
        ? {
            child_id: initialLookup.data.child_id,
            kid_session_id: initialLookup.data.kid_session_id ?? null,
            document_id: initialLookup.data.document_id,
          }
        : null;
    }

    if (tutoringSession?.document_id) {
      resolvedDocumentId = resolvedDocumentId ?? tutoringSession.document_id;
    }

    if (tutoringSession?.kid_session_id) {
      resolvedKidSessionId = resolvedKidSessionId ?? tutoringSession.kid_session_id;
    }

    if (tutoringSession?.child_id) {
      const { data: child } = await supabase
        .from("children")
        .select("parent_id, name, age, grade")
        .eq("id", tutoringSession.child_id)
        .maybeSingle();

      if (child) {
        context.parentId = context.parentId ?? child.parent_id;
        context.childName = child.name;
        context.childAge = child.age;
        context.gradeLevel = child.grade || null;
      }
    }
  }

  if (resolvedKidSessionId) {
    const { data: kidSession } = await supabase
      .from("kids_sessions")
      .select("parent_id, child_name, code_used")
      .eq("id", resolvedKidSessionId)
      .maybeSingle();

    if (kidSession) {
      context.parentId = context.parentId ?? kidSession.parent_id;
      context.childName = context.childName ?? kidSession.child_name ?? null;

      if (kidSession.code_used) {
        const { data: accessCode } = await supabase
          .from("access_codes")
          .select("child_age, grade_level")
          .eq("code", kidSession.code_used)
          .maybeSingle();

        if (accessCode) {
          context.childAge = context.childAge ?? accessCode.child_age ?? null;
          context.gradeLevel = context.gradeLevel ?? accessCode.grade_level ?? null;
        }
      }
    }
  }

  if (resolvedDocumentId) {
    const { data: document } = await supabase
      .from("uploaded_documents")
      .select("extracted_text")
      .eq("id", resolvedDocumentId)
      .maybeSingle();

    if (document?.extracted_text) {
      context.documentContext = document.extracted_text.slice(0, 4000);
    }
  }

  if (!context.parentId) {
    return context;
  }

  const { data: parent } = await supabase
    .from("parents")
    .select("name, child_name, grade_level, math_topics, learning_pace")
    .eq("id", context.parentId)
    .maybeSingle();

  if (!parent) {
    return context;
  }

  return {
    ...context,
    parentName: parent.name,
    childName: context.childName ?? parent.child_name ?? null,
    gradeLevel: context.gradeLevel ?? parent.grade_level ?? null,
    learningPace: parent.learning_pace || null,
    mathTopics: parent.math_topics || [],
  };
}
