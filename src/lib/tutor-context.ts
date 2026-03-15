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
  learningGoals: string | null;
  documentContext: string | null;
  lessonPlan: Record<string, unknown> | null;
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
    learningGoals: null,
    documentContext: null,
    lessonPlan: null,
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
        let accessCode:
          | {
              child_age?: number | null;
              grade_level?: string | null;
              math_topics?: string[] | null;
              learning_pace?: "slow" | "medium" | "fast" | null;
              learning_goals?: string | null;
            }
          | null = null;

        const accessCodeLookup = await supabase
          .from("access_codes")
          .select("child_age, grade_level, math_topics, learning_pace, learning_goals")
          .eq("code", kidSession.code_used)
          .maybeSingle();

        if (
          accessCodeLookup.error &&
          (accessCodeLookup.error.message.includes("learning_goals") ||
            accessCodeLookup.error.message.includes("learning_pace") ||
            accessCodeLookup.error.message.includes("math_topics"))
        ) {
          const fallbackLookup = await supabase
            .from("access_codes")
            .select("child_age, grade_level")
            .eq("code", kidSession.code_used)
            .maybeSingle();

          accessCode = fallbackLookup.data
            ? {
                child_age: fallbackLookup.data.child_age,
                grade_level: fallbackLookup.data.grade_level,
              }
            : null;
        } else {
          accessCode = accessCodeLookup.data ?? null;
        }

        if (accessCode) {
          context.childAge = context.childAge ?? accessCode.child_age ?? null;
          context.gradeLevel = context.gradeLevel ?? accessCode.grade_level ?? null;
          context.learningPace = context.learningPace ?? accessCode.learning_pace ?? null;
          context.learningGoals = context.learningGoals ?? accessCode.learning_goals ?? null;
          context.mathTopics = accessCode.math_topics?.length ? accessCode.math_topics : context.mathTopics;
        }
      }
    }
  }

  if (resolvedDocumentId) {
    const { data: document } = await supabase
      .from("uploaded_documents")
      .select("extracted_text, lesson_plan")
      .eq("id", resolvedDocumentId)
      .maybeSingle();

    if (document?.extracted_text) {
      context.documentContext = document.extracted_text.slice(0, 4000);
    }
    if (document?.lesson_plan) {
      context.lessonPlan = document.lesson_plan as Record<string, unknown>;
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

  const mergedMathTopics = Array.from(
    new Set([...(context.mathTopics || []), ...(parent.math_topics || [])].filter(Boolean))
  );

  return {
    ...context,
    parentName: parent.name,
    childName: context.childName ?? parent.child_name ?? null,
    gradeLevel: context.gradeLevel ?? parent.grade_level ?? null,
    learningPace: context.learningPace ?? (parent.learning_pace || null),
    mathTopics: mergedMathTopics,
  };
}
