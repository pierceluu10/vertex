"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft, ChevronDown, ChevronUp, Eye, EyeOff, Send, CheckCircle,
  XCircle, Lightbulb, MessageCircle, X, BookOpen, Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import "@/styles/vertex.css";

interface WorkedExample {
  problem: string;
  steps: string[];
  answer: string;
}

interface LessonSection {
  heading: string;
  content: string;
  examples: WorkedExample[];
}

interface PracticeProblem {
  id: number;
  question: string;
  hint: string;
  solution: string;
  answer: string;
}

interface Lesson {
  title: string;
  overview: string;
  sections: LessonSection[];
  practiceProblems: PracticeProblem[];
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

function LessonContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const documentId = searchParams.get("documentId");
  const kidSessionId = searchParams.get("kidSessionId");
  const parentId = searchParams.get("parentId");

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [documentText, setDocumentText] = useState<string>("");

  // Section collapse state
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());
  // Example visibility state
  const [visibleExamples, setVisibleExamples] = useState<Set<string>>(new Set());

  // Practice problems state
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState<Record<number, boolean>>({});
  const [showSolution, setShowSolution] = useState<Record<number, boolean>>({});
  const [showHint, setShowHint] = useState<Record<number, boolean>>({});

  // Chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  // Kid session for context
  const [childName, setChildName] = useState("student");

  useEffect(() => {
    const stored = localStorage.getItem("vertex_kid_session");
    if (stored) {
      try {
        const session = JSON.parse(stored);
        if (session.child_name) setChildName(session.child_name);
      } catch { /* ignore */ }
    }
    if (documentId) loadLesson();
    else setError("No document selected");
  }, []);

  async function loadLesson() {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: doc } = await supabase
        .from("uploaded_documents")
        .select("extracted_text, file_name")
        .eq("id", documentId)
        .single();

      if (!doc?.extracted_text) {
        setError("Could not read document content. The PDF may not have extractable text.");
        setLoading(false);
        return;
      }

      setDocumentText(doc.extracted_text);

      const res = await fetch("/api/lesson/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentText: doc.extracted_text,
          childName,
          childAge: 10,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate lesson");
      if (!data.lesson) throw new Error("No lesson returned");

      setLesson(data.lesson);
      // Expand all sections by default
      setExpandedSections(new Set(data.lesson.sections.map((_: LessonSection, i: number) => i)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load lesson");
    }
    setLoading(false);
  }

  function toggleSection(index: number) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function toggleExample(key: string) {
    setVisibleExamples((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleSubmitAnswer(problemId: number) {
    setSubmitted((prev) => ({ ...prev, [problemId]: true }));
  }

  function isCorrect(problemId: number): boolean | null {
    if (!submitted[problemId] || !lesson) return null;
    const problem = lesson.practiceProblems.find((p) => p.id === problemId);
    if (!problem) return null;
    const userAnswer = (answers[problemId] || "").trim().toLowerCase();
    const correctAnswer = problem.answer.trim().toLowerCase();
    // Flexible matching: check if the core answer is contained
    return userAnswer === correctAnswer ||
      correctAnswer.includes(userAnswer) ||
      userAnswer.includes(correctAnswer);
  }

  // Chat functions
  async function sendChatMessage() {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    setChatLoading(true);

    const newUserMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: userMsg,
    };
    setChatMessages((prev) => [...prev, newUserMsg]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: null,
          message: userMsg,
          messageType: "chat",
          childName,
          childAge: 10,
          documentContext: documentText.slice(0, 4000),
          adaptiveState: { shouldSimplify: false, currentTone: "encouraging", currentDifficulty: "medium" },
          recentMessages: chatMessages.slice(-8).map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await res.json();
      if (data.content) {
        setChatMessages((prev) => [...prev, {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: data.content,
        }]);
      }
    } catch {
      setChatMessages((prev) => [...prev, {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: "Oops, something went wrong. Try asking again!",
      }]);
    }
    setChatLoading(false);
    chatInputRef.current?.focus();
  }

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  function askAboutProblem(question: string) {
    setChatOpen(true);
    setChatInput(`Help me with this problem: ${question}`);
    setTimeout(() => chatInputRef.current?.focus(), 100);
  }

  // Render LaTeX-like content (simple replacement for display)
  function renderContent(text: string) {
    // Split by $$ (block) and $ (inline) for visual distinction
    return text.split("\n").map((line, i) => (
      <p key={i} style={{ margin: "6px 0", lineHeight: 1.7 }}>
        {line || "\u00A0"}
      </p>
    ));
  }

  if (loading) {
    return (
      <div style={{
        height: "100vh", display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", background: "#fef7ee",
        fontFamily: "'Calibri', 'Trebuchet MS', sans-serif",
      }}>
        <Loader2 size={40} style={{ color: "#c8416a", animation: "spin 1s linear infinite" }} />
        <p style={{ marginTop: 16, fontSize: 16, color: "#8a7f6e" }}>
          Creating your lesson...
        </p>
        <p style={{ marginTop: 8, fontSize: 12, color: "#b0a898" }}>
          Analyzing your homework and building interactive examples
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        height: "100vh", display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", background: "#fef7ee",
        fontFamily: "'Calibri', 'Trebuchet MS', sans-serif",
      }}>
        <XCircle size={40} style={{ color: "#c8416a", marginBottom: 12 }} />
        <p style={{ fontSize: 14, color: "#8a7f6e", maxWidth: 320, textAlign: "center" }}>{error}</p>
        <button onClick={() => router.back()} style={{
          marginTop: 20, padding: "10px 24px", background: "#c8416a", color: "#fff",
          border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13,
        }}>
          Go Back
        </button>
      </div>
    );
  }

  if (!lesson) return null;

  return (
    <div className="vtx-kid-ui" style={{
      minHeight: "100vh", background: "#fef7ee",
      color: "#1e1a12",
    }}>
      {/* Header */}
      <header style={{
        position: "sticky", top: 0, zIndex: 20,
        padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "rgba(254,247,238,0.95)", backdropFilter: "blur(10px)",
        borderBottom: "1px solid rgba(0,0,0,0.05)",
      }}>
        <button onClick={() => router.back()} style={{
          display: "flex", alignItems: "center", gap: 6, background: "none",
          border: "none", color: "#8a7f6e", fontSize: 13, cursor: "pointer",
        }}>
          <ArrowLeft size={16} /> Back
        </button>
        <button
          onClick={() => setChatOpen(!chatOpen)}
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "8px 16px",
            background: chatOpen ? "#c8416a" : "transparent",
            color: chatOpen ? "#fff" : "#c8416a",
            border: `1.5px solid ${chatOpen ? "#c8416a" : "rgba(158,107,117,0.3)"}`,
            borderRadius: 8, fontSize: 12, cursor: "pointer", transition: "all 0.2s",
          }}
        >
          <MessageCircle size={14} /> {chatOpen ? "Close Chat" : "Ask for Help"}
        </button>
      </header>

      <div style={{ display: "flex", maxWidth: 1200, margin: "0 auto" }}>
        {/* Main lesson content */}
        <main style={{
          flex: 1, padding: "32px 24px 100px", maxWidth: 720,
          margin: chatOpen ? "0" : "0 auto",
        }}>
          {/* Title & Overview */}
          <div style={{ marginBottom: 32 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px",
              background: "rgba(200,65,106,0.08)", borderRadius: 4, marginBottom: 12,
              fontSize: 11, color: "#c8416a", letterSpacing: "0.1em", textTransform: "uppercase",
            }}>
              <BookOpen size={12} /> Lesson
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 400, marginBottom: 8, lineHeight: 1.3 }}>
              {lesson.title}
            </h1>
            <p style={{ fontSize: 15, color: "#8a7f6e", lineHeight: 1.6 }}>
              {lesson.overview}
            </p>
          </div>

          {/* Lesson Sections */}
          {lesson.sections.map((section, sIdx) => (
            <div key={sIdx} style={{
              marginBottom: 24, background: "#fff", borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.06)", overflow: "hidden",
            }}>
              {/* Section header */}
              <button
                onClick={() => toggleSection(sIdx)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "18px 24px", background: "none", border: "none", cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%", background: "rgba(200,65,106,0.08)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 600, color: "#c8416a",
                  }}>
                    {sIdx + 1}
                  </div>
                  <span style={{ fontSize: 17, fontWeight: 500 }}>{section.heading}</span>
                </div>
                {expandedSections.has(sIdx) ? <ChevronUp size={18} color="#8a7f6e" /> : <ChevronDown size={18} color="#8a7f6e" />}
              </button>

              {expandedSections.has(sIdx) && (
                <div style={{ padding: "0 24px 24px" }}>
                  {/* Section content */}
                  <div style={{ fontSize: 14, color: "#3a3428", lineHeight: 1.75, marginBottom: 20 }}>
                    {renderContent(section.content)}
                  </div>

                  {/* Worked examples */}
                  {section.examples.map((ex, eIdx) => {
                    const key = `${sIdx}-${eIdx}`;
                    const isVisible = visibleExamples.has(key);
                    return (
                      <div key={eIdx} style={{
                        padding: "16px 20px", background: "rgba(200,65,106,0.03)",
                        borderRadius: 10, border: "1px solid rgba(200,65,106,0.1)",
                        marginBottom: 12,
                      }}>
                        <div style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          marginBottom: 12,
                        }}>
                          <span style={{
                            fontSize: 11, fontWeight: 600, color: "#c8416a",
                            letterSpacing: "0.1em", textTransform: "uppercase",
                          }}>
                            Example {eIdx + 1}
                          </span>
                          <button
                            onClick={() => toggleExample(key)}
                            style={{
                              display: "flex", alignItems: "center", gap: 4,
                              background: "none", border: "none", color: "#c8416a",
                              fontSize: 11, cursor: "pointer",
                            }}
                          >
                            {isVisible ? <EyeOff size={12} /> : <Eye size={12} />}
                            {isVisible ? "Hide Steps" : "Show Steps"}
                          </button>
                        </div>

                        <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 8, lineHeight: 1.6 }}>
                          {ex.problem}
                        </p>

                        {isVisible && (
                          <>
                            <div style={{
                              borderLeft: "3px solid rgba(200,65,106,0.2)", paddingLeft: 16,
                              marginTop: 12,
                            }}>
                              {ex.steps.map((step, si) => (
                                <p key={si} style={{
                                  fontSize: 13, color: "#4a4238", margin: "8px 0",
                                  lineHeight: 1.7,
                                }}>
                                  {step}
                                </p>
                              ))}
                            </div>
                            <div style={{
                              marginTop: 12, padding: "10px 16px", background: "rgba(92,124,106,0.06)",
                              borderRadius: 6, border: "1px solid rgba(92,124,106,0.15)",
                            }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: "#5c7c6a" }}>
                                Answer: {ex.answer}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}

          {/* Practice Problems */}
          <div style={{ marginTop: 40, marginBottom: 40 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 10, marginBottom: 20,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%", background: "rgba(200,65,106,0.08)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Lightbulb size={16} style={{ color: "#c8416a" }} />
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 400 }}>Practice Problems</h2>
            </div>
            <p style={{ fontSize: 13, color: "#8a7f6e", marginBottom: 24 }}>
              Try solving these on your own! Submit your answer, then check the full solution.
            </p>

            {lesson.practiceProblems.map((problem) => {
              const correct = isCorrect(problem.id);
              return (
                <div key={problem.id} style={{
                  marginBottom: 16, background: "#fff", borderRadius: 12,
                  border: `1.5px solid ${
                    correct === true ? "rgba(92,124,106,0.3)" :
                    correct === false ? "rgba(200,65,106,0.3)" :
                    "rgba(0,0,0,0.06)"
                  }`,
                  overflow: "hidden",
                }}>
                  <div style={{ padding: "20px 24px" }}>
                    {/* Problem number & question */}
                    <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                        background: correct === true ? "rgba(92,124,106,0.1)" :
                                   correct === false ? "rgba(200,65,106,0.08)" :
                                   "rgba(0,0,0,0.04)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 13, fontWeight: 600,
                        color: correct === true ? "#5c7c6a" :
                               correct === false ? "#c8416a" : "#8a7f6e",
                      }}>
                        {correct === true ? <CheckCircle size={16} /> :
                         correct === false ? <XCircle size={16} /> :
                         problem.id}
                      </div>
                      <p style={{ fontSize: 15, lineHeight: 1.65, flex: 1 }}>
                        {problem.question}
                      </p>
                    </div>

                    {/* Answer input */}
                    {!submitted[problem.id] && (
                      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                        <input
                          value={answers[problem.id] || ""}
                          onChange={(e) => setAnswers((prev) => ({ ...prev, [problem.id]: e.target.value }))}
                          placeholder="Type your answer..."
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && answers[problem.id]?.trim()) handleSubmitAnswer(problem.id);
                          }}
                          style={{
                            flex: 1, padding: "10px 14px", border: "1.5px solid rgba(0,0,0,0.08)",
                            borderRadius: 8, fontSize: 14, outline: "none", background: "#fef7ee",
                            fontFamily: "'Calibri', 'Trebuchet MS', sans-serif",
                          }}
                        />
                        <button
                          onClick={() => handleSubmitAnswer(problem.id)}
                          disabled={!answers[problem.id]?.trim()}
                          style={{
                            padding: "10px 18px", background: "#c8416a", color: "#fff",
                            border: "none", borderRadius: 8, fontSize: 12, cursor: "pointer",
                            opacity: answers[problem.id]?.trim() ? 1 : 0.4,
                            letterSpacing: "0.05em",
                          }}
                        >
                          Submit
                        </button>
                      </div>
                    )}

                    {/* Result feedback */}
                    {submitted[problem.id] && (
                      <div style={{
                        padding: "10px 16px", borderRadius: 8, marginBottom: 8,
                        background: correct ? "rgba(92,124,106,0.06)" : "rgba(200,65,106,0.04)",
                        border: `1px solid ${correct ? "rgba(92,124,106,0.15)" : "rgba(200,65,106,0.12)"}`,
                      }}>
                        <span style={{
                          fontSize: 13, fontWeight: 500,
                          color: correct ? "#5c7c6a" : "#c8416a",
                        }}>
                          {correct
                            ? "Correct! Great job!"
                            : `Not quite. You answered: "${answers[problem.id]}"`}
                        </span>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {!showHint[problem.id] && !submitted[problem.id] && (
                        <button
                          onClick={() => setShowHint((prev) => ({ ...prev, [problem.id]: true }))}
                          style={{
                            display: "flex", alignItems: "center", gap: 4, padding: "6px 12px",
                            background: "rgba(166,124,74,0.06)", border: "1px solid rgba(166,124,74,0.15)",
                            borderRadius: 6, color: "#a67c4a", fontSize: 11, cursor: "pointer",
                          }}
                        >
                          <Lightbulb size={11} /> Show Hint
                        </button>
                      )}
                      {submitted[problem.id] && (
                        <button
                          onClick={() => setShowSolution((prev) => ({ ...prev, [problem.id]: !prev[problem.id] }))}
                          style={{
                            display: "flex", alignItems: "center", gap: 4, padding: "6px 12px",
                            background: showSolution[problem.id] ? "rgba(200,65,106,0.06)" : "transparent",
                            border: "1px solid rgba(158,107,117,0.2)",
                            borderRadius: 6, color: "#c8416a", fontSize: 11, cursor: "pointer",
                          }}
                        >
                          {showSolution[problem.id] ? <EyeOff size={11} /> : <Eye size={11} />}
                          {showSolution[problem.id] ? "Hide Solution" : "Show Solution"}
                        </button>
                      )}
                      <button
                        onClick={() => askAboutProblem(problem.question)}
                        style={{
                          display: "flex", alignItems: "center", gap: 4, padding: "6px 12px",
                          background: "transparent", border: "1px solid rgba(0,0,0,0.08)",
                          borderRadius: 6, color: "#8a7f6e", fontSize: 11, cursor: "pointer",
                        }}
                      >
                        <MessageCircle size={11} /> Ask AI
                      </button>
                    </div>

                    {/* Hint */}
                    {showHint[problem.id] && (
                      <div style={{
                        marginTop: 12, padding: "10px 16px", borderRadius: 8,
                        background: "rgba(166,124,74,0.04)", border: "1px solid rgba(166,124,74,0.12)",
                      }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: "#a67c4a", display: "block", marginBottom: 4 }}>
                          Hint:
                        </span>
                        <span style={{ fontSize: 13, color: "#4a4238", lineHeight: 1.6 }}>
                          {problem.hint}
                        </span>
                      </div>
                    )}

                    {/* Full solution */}
                    {showSolution[problem.id] && (
                      <div style={{
                        marginTop: 12, padding: "16px 20px", borderRadius: 8,
                        background: "rgba(92,124,106,0.03)", border: "1px solid rgba(92,124,106,0.12)",
                      }}>
                        <span style={{
                          fontSize: 11, fontWeight: 600, color: "#5c7c6a",
                          display: "block", marginBottom: 8, letterSpacing: "0.08em", textTransform: "uppercase",
                        }}>
                          Full Solution:
                        </span>
                        <div style={{ fontSize: 13, color: "#3a3428", lineHeight: 1.75 }}>
                          {renderContent(problem.solution)}
                        </div>
                        <div style={{
                          marginTop: 8, padding: "8px 12px", background: "rgba(92,124,106,0.08)",
                          borderRadius: 4, fontSize: 13, fontWeight: 600, color: "#5c7c6a",
                        }}>
                          Answer: {problem.answer}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </main>

        {/* Chat sidebar */}
        {chatOpen && (
          <aside style={{
            width: 360, borderLeft: "1px solid rgba(0,0,0,0.06)", background: "#fff",
            display: "flex", flexDirection: "column", height: "calc(100vh - 53px)",
            position: "sticky", top: 53,
          }}>
            <div style={{
              padding: "16px 20px", borderBottom: "1px solid rgba(0,0,0,0.05)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <MessageCircle size={16} style={{ color: "#c8416a" }} />
                <span style={{ fontSize: 14, fontWeight: 500 }}>AI Help</span>
              </div>
              <button onClick={() => setChatOpen(false)} style={{
                background: "none", border: "none", cursor: "pointer", color: "#8a7f6e",
              }}>
                <X size={16} />
              </button>
            </div>

            {chatMessages.length === 0 && (
              <div style={{
                flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", padding: 24, textAlign: "center",
              }}>
                <MessageCircle size={32} style={{ color: "rgba(200,65,106,0.2)", marginBottom: 12 }} />
                <p style={{ fontSize: 13, color: "#8a7f6e", maxWidth: 200 }}>
                  Ask me anything about the lesson or a problem you&apos;re stuck on!
                </p>
              </div>
            )}

            <div ref={chatScrollRef} style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
              {chatMessages.map((msg) => (
                <div key={msg.id} style={{
                  display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                  marginBottom: 10,
                }}>
                  <div style={{
                    maxWidth: "85%", padding: "10px 14px", borderRadius: 10, fontSize: 13, lineHeight: 1.6,
                    ...(msg.role === "user"
                      ? { background: "#c8416a", color: "#fff", borderBottomRightRadius: 3 }
                      : { background: "#f4f0ea", borderBottomLeftRadius: 3 }),
                  }}>
                    <span style={{ whiteSpace: "pre-wrap" }}>{msg.content}</span>
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 10 }}>
                  <div style={{
                    background: "#f4f0ea", borderRadius: 10, padding: "10px 14px",
                    display: "flex", gap: 4,
                  }}>
                    {[0, 1, 2].map((i) => (
                      <div key={i} style={{
                        width: 5, height: 5, borderRadius: "50%", background: "#c8416a",
                        animation: `vtxBounce 0.6s ease infinite ${i * 0.15}s`,
                      }} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(0,0,0,0.05)" }}>
              <form onSubmit={(e) => { e.preventDefault(); sendChatMessage(); }} style={{
                display: "flex", gap: 6,
              }}>
                <input
                  ref={chatInputRef}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask a question..."
                  disabled={chatLoading}
                  style={{
                    flex: 1, padding: "10px 12px", border: "1.5px solid rgba(0,0,0,0.08)",
                    borderRadius: 8, fontSize: 13, outline: "none", background: "#fef7ee",
                    fontFamily: "'Calibri', 'Trebuchet MS', sans-serif",
                  }}
                />
                <button type="submit" disabled={chatLoading || !chatInput.trim()} style={{
                  padding: "10px 14px", background: "#c8416a", color: "#fff", border: "none",
                  borderRadius: 8, cursor: "pointer", opacity: chatLoading || !chatInput.trim() ? 0.4 : 1,
                }}>
                  <Send size={14} />
                </button>
              </form>
            </div>
          </aside>
        )}
      </div>

      <style>{`@keyframes vtxBounce { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-5px) } }`}</style>
    </div>
  );
}

export default function LessonPage() {
  return (
    <Suspense fallback={
      <div style={{
        height: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "#fef7ee",
      }}>
        <p style={{ color: "#8a7f6e" }}>Loading...</p>
      </div>
    }>
      <LessonContent />
    </Suspense>
  );
}
