"use client";

import { useState, useCallback, useEffect } from "react";

const HINTS: Record<string, (a: number, b: number) => string> = {
  "+": (a, b) => `Start at ${a} and count up ${b} steps.`,
  "-": (a, b) => `Start at ${a} and take away ${b}.`,
  "\u00d7": (a, b) => `Picture ${a} groups with ${b} objects each.`,
};

function ri(a: number, b: number) {
  return Math.floor(Math.random() * (b - a + 1)) + a;
}

interface Question {
  num1: number;
  num2: number;
  op: string;
  correct: number;
  choices: number[];
  hint: string;
}

function generateQuestion(diff: number): Question {
  const OPS = ["+", "-", "\u00d7"];
  const r: [number, number] = diff === 1 ? [2, 9] : diff === 2 ? [4, 15] : [6, 20];
  let a = ri(...r), b = ri(...r);
  const op = OPS[diff === 1 ? ri(0, 1) : ri(0, 2)];
  if (op === "-" && b > a) [a, b] = [b, a];
  const correct = op === "+" ? a + b : op === "-" ? a - b : a * b;
  const hint = HINTS[op](a, b);

  const choices = [correct];
  let t = 0;
  while (choices.length < 4 && t++ < 60) {
    const w = correct + ri(-9, 9);
    if (w !== correct && w >= 0 && !choices.includes(w)) choices.push(w);
  }
  choices.sort(() => Math.random() - 0.5);

  return { num1: a, num2: b, op, correct, choices, hint };
}

export function MathQuiz() {
  const [diff, setDiff] = useState(1);
  const [score, setScore] = useState(0);
  const [qCnt, setQCnt] = useState(0);
  const [streak, setStreak] = useState(0);
  const [question, setQuestion] = useState<Question>(() => generateQuestion(1));
  const [answered, setAnswered] = useState(false);
  const [results, setResults] = useState<Record<number, "correct" | "wrong">>({});
  const [displayAnswer, setDisplayAnswer] = useState<string>("?");

  const nextQuestion = useCallback((d?: number) => {
    setQuestion(generateQuestion(d ?? diff));
    setAnswered(false);
    setResults({});
    setDisplayAnswer("?");
  }, [diff]);

  useEffect(() => {
    nextQuestion(diff);
  }, [diff, nextQuestion]);

  const handleAnswer = (val: number, idx: number) => {
    if (answered) return;
    setAnswered(true);
    setQCnt(c => c + 1);

    if (val === question.correct) {
      setResults({ [idx]: "correct" });
      setScore(s => s + diff * 10);
      setStreak(s => Math.min(s + 1, 5));
      setDisplayAnswer(String(val));
    } else {
      const correctIdx = question.choices.indexOf(question.correct);
      setResults({ [idx]: "wrong", [correctIdx]: "correct" });
      setStreak(0);
    }

    setTimeout(() => nextQuestion(), 880);
  };

  const handleDiff = (d: number) => {
    setDiff(d);
  };

  return (
    <div className="vtx-section-wrap">
      <section className="vtx-math-section">
        <div className="vtx-section-header">
          <h2>Practice,<br/><em>perfected</em></h2>
          <p>Adaptive exercises that adjust to your child&apos;s pace. Instant feedback, zero frustration.</p>
        </div>
        <div className="vtx-math-arena">
          <div className="vtx-math-arena-top">
            <span className="vtx-mode-label">Math &middot; Adaptive Mode</span>
            <div className="vtx-difficulty-dots">
              {[1, 2, 3].map(d => (
                <span key={d} className={d === diff ? "active" : ""} onClick={() => handleDiff(d)} />
              ))}
            </div>
          </div>
          <div className="vtx-math-display">
            <div className="vtx-math-question-area">
              <div className="vtx-question-box">
                <div className="vtx-q-label">Solve for the missing number</div>
                <div className="vtx-question-text">
                  <span>{question.num1}</span>
                  <span className="op">{question.op}</span>
                  <span>{question.num2}</span>
                  <span className="op">=</span>
                  <span className="blank">{displayAnswer}</span>
                </div>
              </div>
              <div className="vtx-answer-row">
                {question.choices.map((c, i) => (
                  <button
                    key={i}
                    className={`vtx-ans-btn ${results[i] || ""}`}
                    onClick={() => handleAnswer(c, i)}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div className="vtx-math-sidebar">
              <div>
                <div className="vtx-stat-label">Score</div>
                <div className="vtx-stat-value pink">{score}</div>
              </div>
              <div>
                <div className="vtx-stat-label">Questions</div>
                <div className="vtx-stat-value">{qCnt}</div>
                <div className="vtx-progress-track">
                  <div className="vtx-progress-fill" style={{ width: `${Math.min(qCnt * 10, 100)}%` }} />
                </div>
              </div>
              <div>
                <div className="vtx-stat-label">Streak</div>
                <div className="vtx-streak-row">
                  {[0, 1, 2, 3, 4].map(i => (
                    <span key={i} className={`vtx-streak-dot ${i < streak ? "lit" : ""}`} />
                  ))}
                </div>
              </div>
              <button className="vtx-next-btn" onClick={() => nextQuestion()}>Next &rarr;</button>
            </div>
          </div>
          <div className="vtx-ai-hint">
            <span className="vtx-ai-pill">AI Hint</span>
            <p>{question.hint}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
