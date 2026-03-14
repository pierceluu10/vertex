"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, ArrowLeft, Check } from "lucide-react";

type Step = "child" | "preferences" | "complete";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("child");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [childName, setChildName] = useState("");
  const [childAge, setChildAge] = useState("");
  const [childGrade, setChildGrade] = useState("");
  const [preferredPace, setPreferredPace] = useState("normal");

  async function handleSubmit() {
    setLoading(true);
    setError(null);

    const res = await fetch("/api/onboarding/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        childName,
        childAge,
        childGrade,
        preferredPace,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      setLoading(false);
      return;
    }

    setStep("complete");
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-violet-50/40 to-violet-100/30 flex items-center justify-center px-4">
      <motion.div
        className="w-full max-w-lg"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="text-center mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-violet-800 flex items-center justify-center shadow-lg shadow-violet-500/25 mx-auto mb-4">
            <svg
              viewBox="0 0 24 24"
              className="w-6 h-6 text-white"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 3L2 20h20L12 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            {step === "complete" ? "You're all set!" : "Set up your child's profile"}
          </h1>
          {step !== "complete" && (
            <div className="flex justify-center gap-2 mt-4">
              {["child", "preferences"].map((s, i) => (
                <div
                  key={s}
                  className={`h-1.5 w-12 rounded-full transition-colors ${
                    s === step || (step === "preferences" && i === 0)
                      ? "bg-violet-600"
                      : "bg-violet-200"
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-violet-100/50 p-8 shadow-xl shadow-violet-100/20">
          <AnimatePresence mode="wait">
            {step === "child" && (
              <motion.div
                key="child"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="childName">Child&apos;s Name</Label>
                  <Input
                    id="childName"
                    placeholder="What's your child's name?"
                    value={childName}
                    onChange={(e) => setChildName(e.target.value)}
                    required
                    className="rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="childAge">Age</Label>
                  <Input
                    id="childAge"
                    type="number"
                    min={3}
                    max={14}
                    placeholder="How old are they?"
                    value={childAge}
                    onChange={(e) => setChildAge(e.target.value)}
                    required
                    className="rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="childGrade">Grade (optional)</Label>
                  <Input
                    id="childGrade"
                    placeholder="e.g. 3rd grade"
                    value={childGrade}
                    onChange={(e) => setChildGrade(e.target.value)}
                    className="rounded-xl"
                  />
                </div>

                <Button
                  onClick={() => setStep("preferences")}
                  disabled={!childName || !childAge}
                  className="w-full bg-violet-600 hover:bg-violet-700 text-white rounded-xl h-11 mt-2"
                >
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </motion.div>
            )}

            {step === "preferences" && (
              <motion.div
                key="preferences"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="space-y-3">
                  <Label>Learning Pace</Label>
                  <p className="text-sm text-muted-foreground">
                    How fast does {childName || "your child"} usually work through problems?
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { value: "slow", label: "Steady", emoji: "🐢" },
                      { value: "normal", label: "Balanced", emoji: "🚶" },
                      { value: "fast", label: "Quick", emoji: "🚀" },
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setPreferredPace(option.value)}
                        className={`p-4 rounded-xl border-2 text-center transition-all ${
                          preferredPace === option.value
                            ? "border-violet-600 bg-violet-50"
                            : "border-violet-100 hover:border-violet-200"
                        }`}
                      >
                        <span className="text-2xl block mb-1">{option.emoji}</span>
                        <span className="text-sm font-medium">{option.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {error && (
                  <p className="text-sm text-red-500 bg-red-50 rounded-lg p-3">
                    {error}
                  </p>
                )}

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setStep("child")}
                    className="rounded-xl"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="flex-1 bg-violet-600 hover:bg-violet-700 text-white rounded-xl h-11"
                  >
                    {loading ? "Setting up..." : "Complete Setup"}
                    <Check className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            )}

            {step === "complete" && (
              <motion.div
                key="complete"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-4"
              >
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-xl font-semibold mb-2">
                  {childName}&apos;s profile is ready!
                </h2>
                <p className="text-muted-foreground mb-6">
                  Head to your dashboard to upload homework and start a tutoring session.
                </p>
                <Button
                  onClick={() => router.push("/dashboard")}
                  className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl px-8"
                >
                  Go to Dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
