"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Lightbulb, HelpCircle, ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { ParentAvatar } from "@/components/session/parent-avatar";
import { MathVisual, type MathVisualConfig } from "@/components/session/math-visual";
import { MessageContent } from "@/components/session/message-content";
import { useAttention } from "@/hooks/use-attention";
import { getInterventionMessage } from "@/lib/attention";
import type { Message, Child, AdaptiveState } from "@/types";
import { createInitialAdaptiveState, handleCorrectAnswer, handleIncorrectAnswer, handleDistraction } from "@/lib/adaptive";

/** Parse multiple-choice options from quiz message text (e.g. "1. Option A" or "A. Option A"). */
function parseQuizChoices(content: string): { label: string; text: string }[] | null {
  const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const options: { label: string; text: string }[] = [];
  for (const line of lines) {
    const numbered = line.match(/^\s*(\d+)[.)]\s*(.+)$/);
    const lettered = line.match(/^\s*([A-Da-d])[.)]\s*(.+)$/);
    if (numbered) {
      options.push({ label: numbered[1], text: `${numbered[1]}. ${numbered[2].trim()}` });
    } else if (lettered) {
      const letter = lettered[1].toUpperCase();
      options.push({ label: letter, text: `${letter}. ${lettered[2].trim()}` });
    }
  }
  return options.length >= 2 ? options : null;
}

function QuizReplyForm({
  onSend,
  disabled,
  placeholder,
  choices,
}: {
  onSend: (text: string) => void;
  disabled: boolean;
  placeholder: string;
  choices?: { label: string; text: string }[] | null;
}) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!disabled && !choices?.length) inputRef.current?.focus();
  }, [disabled, choices?.length]);

  if (choices && choices.length > 0) {
    return (
      <div className="mt-3 pt-3 border-t border-violet-200/60">
        <p className="text-xs font-medium text-violet-600 mb-2">Choose an answer:</p>
        <div className="flex flex-col gap-2">
          {choices.map((choice, i) => (
            <Button
              key={i}
              type="button"
              variant="outline"
              disabled={disabled}
              className="h-auto min-h-9 py-2 px-3 justify-start text-left font-normal bg-white border-violet-200 hover:bg-violet-50 hover:border-violet-300 text-foreground rounded-lg"
              onClick={() => onSend(choice.text)}
            >
              {choice.text}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <form
      className="mt-3 pt-3 border-t border-violet-200/60 flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = value.trim();
        if (!trimmed || disabled) return;
        onSend(trimmed);
        setValue("");
      }}
    >
      <Input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1 h-9 rounded-lg bg-white border-violet-200 text-sm focus-visible:ring-violet-400"
      />
      <Button
        type="submit"
        size="sm"
        disabled={disabled || !value.trim()}
        className="h-9 bg-violet-600 hover:bg-violet-700 text-white rounded-lg px-3 shrink-0"
      >
        Submit
      </Button>
    </form>
  );
}

interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  type: "chat" | "quiz" | "hint" | "reminder";
  jsxGraph?: unknown;
}

export default function SessionPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;
  const supabase = createClient();

  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [childName, setChildName] = useState("");
  const [childAge, setChildAge] = useState(8);
  const [parentName, setParentName] = useState("");
  const [documentContext, setDocumentContext] = useState<string | null>(null);
  const [adaptiveState, setAdaptiveState] = useState<AdaptiveState>(
    createInitialAdaptiveState()
  );
  const [isSpeaking, setIsSpeaking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleIntervention = useCallback(
    (type: string) => {
      if (!childName) return;
      const message = getInterventionMessage(type, childName);
      setMessages((prev) => [
        ...prev,
        {
          id: `intervention-${Date.now()}`,
          role: "assistant",
          content: message,
          type: "reminder",
        },
      ]);

      if (type === "simplify_and_checkin") {
        setAdaptiveState((prev) => handleDistraction(prev));
      }

      setIsSpeaking(true);
      setTimeout(() => setIsSpeaking(false), 3000);
    },
    [childName]
  );

  const attention = useAttention(sessionId, handleIntervention);

  useEffect(() => {
    async function loadSession() {
      const { data: session } = await supabase
        .from("tutoring_sessions")
        .select("*, children(*)")
        .eq("id", sessionId)
        .single();

      if (!session) {
        router.push("/dashboard");
        return;
      }

      const child = session.children as unknown as Child;
      setChildName(child.name);
      setChildAge(child.age);

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: parent } = await supabase
          .from("parents")
          .select("full_name")
          .eq("id", user.id)
          .single();
        if (parent) setParentName(parent.full_name);
      }

      if (session.document_id) {
        const { data: doc } = await supabase
          .from("uploaded_documents")
          .select("extracted_text")
          .eq("id", session.document_id)
          .single();
        if (doc?.extracted_text) {
          setDocumentContext(doc.extracted_text.slice(0, 4000));
        }
      }

      const { data: existingMessages } = await supabase
        .from("messages")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });

      if (existingMessages && existingMessages.length > 0) {
        setMessages(
          existingMessages
            .filter((m: Message) => m.role !== "system")
            .map((m: Message) => ({
              id: m.id,
              role: m.role as "user" | "assistant",
              content: m.content,
              type: m.message_type as "chat" | "quiz" | "hint" | "reminder",
            }))
        );
      } else {
        const greeting: DisplayMessage = {
          id: "greeting",
          role: "assistant",
          content: `Hi ${child.name}! 😊 I'm here to help you with your math. What would you like to work on today?`,
          type: "chat",
        };
        setMessages([greeting]);
      }
    }

    loadSession();
  }, [sessionId, supabase, router]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  function parseJsxGraph(content: string): { cleanContent: string; graphs: unknown[] } {
    const graphs: unknown[] = [];
    const cleanContent = content.replace(
      /\[JSXGRAPH\]([\s\S]*?)\[\/JSXGRAPH\]/g,
      (_, json) => {
        try {
          graphs.push(JSON.parse(json.trim()));
        } catch {
          // ignore malformed
        }
        return "";
      }
    );
    return { cleanContent: cleanContent.trim(), graphs };
  }

  async function sendMessage(text: string, type: "chat" | "quiz" | "hint" = "chat") {
    if (!text.trim() || loading) return;
    setLoading(true);
    setInput("");

    const userMsg: DisplayMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      type,
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          message: text,
          messageType: type,
          childName,
          childAge,
          documentContext,
          adaptiveState,
          recentMessages: messages.slice(-10).map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await res.json();

      if (data.content) {
        const { cleanContent, graphs } = parseJsxGraph(data.content);

        const assistantMsg: DisplayMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: cleanContent,
          type: data.messageType || "chat",
          jsxGraph: graphs.length > 0 ? graphs : undefined,
        };
        setMessages((prev) => [...prev, assistantMsg]);

        setIsSpeaking(true);
        setTimeout(() => setIsSpeaking(false), 3000);

        if (data.isCorrect !== undefined) {
          setAdaptiveState((prev) =>
            data.isCorrect ? handleCorrectAnswer(prev) : handleIncorrectAnswer(prev)
          );
        }
      }
    } catch (err) {
      console.error("Chat error:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: "Oops, something went wrong. Try again!",
          type: "chat",
        },
      ]);
    }

    setLoading(false);
    inputRef.current?.focus();
  }

  async function endSession() {
    await supabase
      .from("tutoring_sessions")
      .update({ status: "completed", ended_at: new Date().toISOString(), focus_score_avg: attention.score })
      .eq("id", sessionId);

    try {
      await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
    } catch {
      // Report generation is non-blocking
    }

    router.push("/dashboard");
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-violet-50/30 to-white">
      {/* Session Header */}
      <header className="border-b border-violet-100/50 bg-white/80 backdrop-blur-sm px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={endSession}
            className="text-muted-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            End
          </Button>
          <div>
            <h1 className="font-semibold text-sm">
              {childName}&apos;s Study Session
            </h1>
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  attention.focusLevel === "high"
                    ? "bg-green-500"
                    : attention.focusLevel === "medium"
                    ? "bg-yellow-500"
                    : "bg-red-500"
                }`}
              />
              <span className="text-xs text-muted-foreground">
                Focus: {attention.score}%
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => sendMessage("Give me a hint for what we're working on", "hint")}
            className="text-violet-600 border-violet-200 rounded-lg text-xs"
          >
            <Lightbulb className="h-3 w-3 mr-1" />
            Hint
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => sendMessage("Quiz me on what we've been studying", "quiz")}
            className="text-violet-600 border-violet-200 rounded-lg text-xs"
          >
            <Sparkles className="h-3 w-3 mr-1" />
            Quiz Me
          </Button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Chat area */}
        <div className="flex-1 flex flex-col min-h-0">
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-4"
          >
            <div className="max-w-2xl mx-auto space-y-4">
              <AnimatePresence>
                {messages.map((msg, idx) => {
                  const isQuizUnanswered =
                    msg.role === "assistant" &&
                    msg.type === "quiz" &&
                    messages[idx + 1]?.role !== "user";
                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${
                        msg.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                          msg.role === "user"
                            ? "bg-violet-600 text-white rounded-br-sm"
                            : msg.type === "reminder"
                            ? "bg-yellow-50 border border-yellow-200 text-yellow-900 rounded-bl-sm"
                            : msg.type === "quiz"
                            ? "bg-violet-50 border border-violet-200 text-foreground rounded-bl-sm"
                            : "bg-white border border-violet-100/50 text-foreground shadow-sm rounded-bl-sm"
                        }`}
                      >
                        {msg.type === "quiz" && (
                          <div className="flex items-center gap-1 mb-1">
                            <Sparkles className="h-3 w-3 text-violet-500" />
                            <span className="text-xs font-medium text-violet-600">
                              Quiz
                            </span>
                          </div>
                        )}
                        {msg.type === "hint" && msg.role === "assistant" && (
                          <div className="flex items-center gap-1 mb-1">
                            <Lightbulb className="h-3 w-3 text-yellow-500" />
                            <span className="text-xs font-medium text-yellow-600">
                              Hint
                            </span>
                          </div>
                        )}
                        <MessageContent content={msg.content} />
                        {msg.jsxGraph
                          ? (msg.jsxGraph as MathVisualConfig[]).map((graph, i) => (
                              <MathVisual key={i} config={graph} />
                            ))
                          : null}
                        {isQuizUnanswered && (
                          <QuizReplyForm
                            onSend={sendMessage}
                            disabled={loading}
                            placeholder="Type your answer here..."
                            choices={parseQuizChoices(msg.content)}
                          />
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {loading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start"
                >
                  <div className="bg-white border border-violet-100/50 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          className="w-2 h-2 rounded-full bg-violet-400"
                          animate={{ y: [0, -6, 0] }}
                          transition={{
                            repeat: Infinity,
                            duration: 0.6,
                            delay: i * 0.15,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </div>

          {/* Input area */}
          <div className="border-t border-violet-100/50 bg-white/80 backdrop-blur-sm px-4 py-3 shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage(input);
              }}
              className="max-w-2xl mx-auto flex gap-2"
            >
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a question or type your answer..."
                disabled={loading}
                className="rounded-xl bg-violet-50/50 border-violet-200 focus-visible:ring-violet-400"
                autoFocus
              />
              <Button
                type="submit"
                disabled={loading || !input.trim()}
                className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl px-4 shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>

            <div className="max-w-2xl mx-auto mt-2 flex gap-2">
              <button
                onClick={() => sendMessage("I don't understand, can you explain differently?")}
                className="text-xs text-violet-500 hover:text-violet-700 bg-violet-50 px-3 py-1.5 rounded-lg transition-colors"
              >
                <HelpCircle className="h-3 w-3 inline mr-1" />
                I don&apos;t understand
              </button>
              <button
                onClick={() => sendMessage("Can you show me a picture or diagram?")}
                className="text-xs text-violet-500 hover:text-violet-700 bg-violet-50 px-3 py-1.5 rounded-lg transition-colors"
              >
                Show me a picture
              </button>
            </div>
          </div>
        </div>

        {/* Parent avatar sidebar */}
        <div className="w-28 border-l border-violet-100/50 bg-white/50 flex flex-col items-center py-6 gap-4 shrink-0">
          <ParentAvatar
            parentName={parentName || "Parent"}
            focusLevel={attention.focusLevel}
            isSpeaking={isSpeaking}
          />

          <div className="text-center">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
              Focus
            </div>
            <div
              className={`text-lg font-bold ${
                attention.focusLevel === "high"
                  ? "text-green-600"
                  : attention.focusLevel === "medium"
                  ? "text-yellow-600"
                  : "text-red-600"
              }`}
            >
              {attention.score}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

