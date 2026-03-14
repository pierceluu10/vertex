"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// ─── Types ───────────────────────────────────────────────
interface GameQuestion {
  question: string;
  correctAnswer: string;
  wrongAnswer: string;
}

interface PipeState {
  x: number;
  gap1Top: number;
  gap2Top: number;
  correctGap: 1 | 2;
  question: GameQuestion;
  passed: boolean;
  scored: boolean;
}

interface FlappyQuizProps {
  topic?: string;
  childAge?: number;
  onClose: () => void;
}

// ─── Constants ───────────────────────────────────────────
const GRAVITY = 0.35;
const FLAP_FORCE = -6.5;
const PIPE_WIDTH = 75;
const GAP_HEIGHT = 88;
const MID_SOLID = 68;
const PIPE_SPEED = 2.2;
const PIPE_INTERVAL = 280;
const BIRD_RADIUS = 14;
const GROUND_HEIGHT = 40;
const BIRD_X = 90;

// ─── Colors ──────────────────────────────────────────────
const C = {
  bg: "#f4efe5",
  cream: "#f8f3e8",
  pipe: "#2c2720",
  pipeEdge: "#1a1610",
  pink: "#c8416a",
  pinkSoft: "rgba(200,65,106,0.12)",
  green: "#5a9e76",
  greenSoft: "rgba(90,158,118,0.12)",
  red: "#b86460",
  redSoft: "rgba(184,100,96,0.12)",
  text: "#1e1a12",
  muted: "#8a7f6e",
  muted2: "#afa598",
  ground: "#e5dfd1",
  groundLine: "#d5cfc1",
};

// ─── Question Generation ─────────────────────────────────
function ri(a: number, b: number): number {
  return Math.floor(Math.random() * (b - a + 1)) + a;
}

function genWrong(correct: number): number {
  const offsets = [-3, -2, -1, 1, 2, 3, -5, 5];
  let wrong: number;
  let attempts = 0;
  do {
    wrong = correct + offsets[ri(0, offsets.length - 1)];
    attempts++;
  } while ((wrong === correct || wrong < 0) && attempts < 20);
  if (wrong === correct) wrong = correct + 1;
  if (wrong < 0) wrong = correct + ri(1, 3);
  return wrong;
}

function generatePool(topic: string, age: number): GameQuestion[] {
  const pool: GameQuestion[] = [];
  const t = topic.toLowerCase();

  const doAdd = t.includes("add") || t.includes("mix") || t === "";
  const doSub = t.includes("sub") || t.includes("mix") || t === "";
  const doMul = t.includes("mult") || t.includes("times") || t.includes("mix") || t === "";
  const doDiv = t.includes("div") || t.includes("mix") || t === "";
  const doFrac = t.includes("frac");
  const doAlg = t.includes("alg") || t.includes("variable");

  // If topic doesn't match any, do mixed
  const doMixed = !doAdd && !doSub && !doMul && !doDiv && !doFrac && !doAlg;

  function addQ(question: string, correct: number) {
    pool.push({ question, correctAnswer: String(correct), wrongAnswer: String(genWrong(correct)) });
  }

  const rng: [number, number] = age <= 7 ? [1, 10] : age <= 10 ? [5, 30] : [10, 50];
  const mulRng: [number, number] = age <= 7 ? [1, 5] : age <= 10 ? [2, 12] : [3, 15];

  for (let i = 0; i < 15; i++) {
    if (doAdd || doMixed) {
      const a = ri(...rng), b = ri(...rng);
      addQ(`${a} + ${b}`, a + b);
    }
    if (doSub || doMixed) {
      let a = ri(...rng), b = ri(...rng);
      if (b > a) [a, b] = [b, a];
      addQ(`${a} - ${b}`, a - b);
    }
    if (doMul || doMixed) {
      const a = ri(...mulRng), b = ri(...mulRng);
      addQ(`${a} × ${b}`, a * b);
    }
    if (doDiv || doMixed) {
      const b = ri(...mulRng), ans = ri(1, mulRng[1]);
      addQ(`${b * ans} ÷ ${b}`, ans);
    }
    if (doFrac) {
      const d = ri(2, 8), n1 = ri(1, d - 1), n2 = ri(1, d - 1);
      addQ(`${n1}/${d} + ${n2}/${d}`, n1 + n2);
      // Display: answer is numerator, denominator shown in question
    }
    if (doAlg) {
      const x = ri(1, 12), b = ri(1, 10);
      addQ(`x + ${b} = ${x + b}`, x);
    }
  }

  // Shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = ri(0, i);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  return pool;
}

// ─── Component ───────────────────────────────────────────
export function FlappyQuiz({ topic = "", childAge = 8, onClose }: FlappyQuizProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);

  const [screen, setScreen] = useState<"start" | "playing" | "gameover">("start");
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lives, setLives] = useState(3);
  const [stats, setStats] = useState({ score: 0, bestStreak: 0, correct: 0, total: 0 });

  // Mutable game state (avoids re-renders during gameplay)
  const g = useRef({
    bird: { y: 0, vel: 0 },
    pipes: [] as PipeState[],
    score: 0,
    streak: 0,
    bestStreak: 0,
    lives: 3,
    correct: 0,
    total: 0,
    pool: [] as GameQuestion[],
    poolIdx: 0,
    frame: 0,
    canvasW: 800,
    canvasH: 500,
    groundScroll: 0,
    flash: 0, // positive=correct(green), negative=wrong(red)
    playing: false,
    invincible: 0, // frames of invincibility after hit
  });

  const nextQuestion = useCallback((): GameQuestion => {
    const state = g.current;
    if (state.pool.length === 0) state.pool = generatePool(topic, childAge);
    const q = state.pool[state.poolIdx % state.pool.length];
    state.poolIdx++;
    return q;
  }, [topic, childAge]);

  const startGame = useCallback(() => {
    const state = g.current;
    state.pool = generatePool(topic, childAge);
    state.poolIdx = 0;
    state.bird = { y: state.canvasH / 2, vel: 0 };
    state.pipes = [];
    state.score = 0;
    state.streak = 0;
    state.bestStreak = 0;
    state.lives = 3;
    state.correct = 0;
    state.total = 0;
    state.frame = 0;
    state.flash = 0;
    state.invincible = 0;
    state.playing = true;

    setScore(0);
    setStreak(0);
    setLives(3);
    setScreen("playing");
  }, [topic, childAge]);

  const endGame = useCallback(() => {
    const state = g.current;
    state.playing = false;
    setStats({
      score: state.score,
      bestStreak: state.bestStreak,
      correct: state.correct,
      total: state.total,
    });
    setScreen("gameover");
  }, []);

  const flap = useCallback(() => {
    if (!g.current.playing) return;
    g.current.bird.vel = FLAP_FORCE;
  }, []);

  // ─── Game Loop ───────────────────────────────────────
  const gameLoop = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const s = g.current;
    if (!s.playing) return;

    const W = s.canvasW;
    const H = s.canvasH;
    const playH = H - GROUND_HEIGHT;

    // ── Update ──
    s.frame++;

    // Bird physics
    s.bird.vel += GRAVITY;
    s.bird.y += s.bird.vel;

    // Ceiling / floor
    if (s.bird.y - BIRD_RADIUS < 0) {
      s.bird.y = BIRD_RADIUS;
      s.bird.vel = 0;
    }
    if (s.bird.y + BIRD_RADIUS > playH) {
      s.bird.y = playH - BIRD_RADIUS;
      s.lives--;
      setLives(s.lives);
      if (s.lives <= 0) { endGame(); return; }
      s.bird.vel = FLAP_FORCE;
      s.invincible = 40;
      s.flash = -8;
    }

    // Spawn pipes
    const lastPipe = s.pipes[s.pipes.length - 1];
    if (!lastPipe || lastPipe.x < W - PIPE_INTERVAL) {
      const minGap1 = 45;
      const maxGap1 = playH - GAP_HEIGHT - MID_SOLID - GAP_HEIGHT - 45;
      const gap1Top = ri(minGap1, Math.max(minGap1, maxGap1));
      const gap2Top = gap1Top + GAP_HEIGHT + MID_SOLID;
      const q = nextQuestion();
      s.pipes.push({
        x: W + 20,
        gap1Top,
        gap2Top,
        correctGap: ri(1, 2) as 1 | 2,
        question: q,
        passed: false,
        scored: false,
      });
    }

    // Move pipes + collision
    if (s.invincible > 0) s.invincible--;

    for (let i = s.pipes.length - 1; i >= 0; i--) {
      const p = s.pipes[i];
      p.x -= PIPE_SPEED;

      // Remove off-screen
      if (p.x + PIPE_WIDTH < -10) {
        s.pipes.splice(i, 1);
        continue;
      }

      // Collision check
      const birdLeft = BIRD_X - BIRD_RADIUS;
      const birdRight = BIRD_X + BIRD_RADIUS;
      const birdTop = s.bird.y - BIRD_RADIUS;
      const birdBot = s.bird.y + BIRD_RADIUS;

      if (birdRight > p.x && birdLeft < p.x + PIPE_WIDTH) {
        const inGap1 = birdTop > p.gap1Top && birdBot < p.gap1Top + GAP_HEIGHT;
        const inGap2 = birdTop > p.gap2Top && birdBot < p.gap2Top + GAP_HEIGHT;

        if (!inGap1 && !inGap2 && s.invincible <= 0) {
          // Hit pipe wall
          s.lives--;
          s.streak = 0;
          setLives(s.lives);
          setStreak(0);
          s.flash = -8;
          if (s.lives <= 0) { endGame(); return; }
          s.invincible = 40;
          s.bird.vel = FLAP_FORCE * 0.7;
        }
      }

      // Score when bird passes pipe center
      if (!p.scored && BIRD_X > p.x + PIPE_WIDTH / 2) {
        p.scored = true;
        s.total++;
        const birdCenter = s.bird.y;
        const inGap1 = birdCenter > p.gap1Top && birdCenter < p.gap1Top + GAP_HEIGHT;
        const wasCorrectGap = inGap1 ? p.correctGap === 1 : p.correctGap === 2;

        if (wasCorrectGap) {
          s.streak++;
          if (s.streak > s.bestStreak) s.bestStreak = s.streak;
          const points = 10 * Math.min(s.streak, 5);
          s.score += points;
          s.correct++;
          s.flash = 10;
          setScore(s.score);
          setStreak(s.streak);
        } else {
          s.streak = 0;
          s.flash = -8;
          setStreak(0);
        }
      }
    }

    if (s.flash > 0) s.flash--;
    if (s.flash < 0) s.flash++;
    s.groundScroll = (s.groundScroll + PIPE_SPEED) % 20;

    // ── Draw ──
    // Background
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);

    // Flash overlay
    if (s.flash > 0) {
      ctx.fillStyle = `rgba(90,158,118,${Math.abs(s.flash) * 0.02})`;
      ctx.fillRect(0, 0, W, H);
    } else if (s.flash < 0) {
      ctx.fillStyle = `rgba(184,100,96,${Math.abs(s.flash) * 0.025})`;
      ctx.fillRect(0, 0, W, H);
    }

    // Ground
    ctx.fillStyle = C.ground;
    ctx.fillRect(0, playH, W, GROUND_HEIGHT);
    ctx.strokeStyle = C.groundLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, playH);
    ctx.lineTo(W, playH);
    ctx.stroke();
    // Ground dashes
    ctx.strokeStyle = C.muted2;
    ctx.lineWidth = 1;
    for (let gx = -s.groundScroll; gx < W; gx += 20) {
      ctx.beginPath();
      ctx.moveTo(gx, playH + 8);
      ctx.lineTo(gx + 10, playH + 8);
      ctx.stroke();
    }

    // Pipes
    for (const p of s.pipes) {
      const px = p.x;
      const pw = PIPE_WIDTH;
      const g1t = p.gap1Top;
      const g1b = g1t + GAP_HEIGHT;
      const g2t = p.gap2Top;
      const g2b = g2t + GAP_HEIGHT;

      // Top solid
      ctx.fillStyle = C.pipe;
      ctx.fillRect(px, 0, pw, g1t);
      // Middle solid
      ctx.fillRect(px, g1b, pw, g2t - g1b);
      // Bottom solid
      ctx.fillRect(px, g2b, pw, playH - g2b);

      // Pipe edges (cap lines)
      ctx.fillStyle = C.pipeEdge;
      ctx.fillRect(px - 3, g1t - 4, pw + 6, 4);
      ctx.fillRect(px - 3, g1b, pw + 6, 4);
      ctx.fillRect(px - 3, g2t - 4, pw + 6, 4);
      ctx.fillRect(px - 3, g2b, pw + 6, 4);

      // Answer labels in gaps
      const correctAns = p.question.correctAnswer;
      const wrongAns = p.question.wrongAnswer;
      const gap1Ans = p.correctGap === 1 ? correctAns : wrongAns;
      const gap2Ans = p.correctGap === 2 ? correctAns : wrongAns;

      ctx.font = "bold 20px Calibri, Trebuchet MS, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Gap 1 label
      ctx.fillStyle = C.cream;
      const g1cx = px + pw / 2, g1cy = g1t + GAP_HEIGHT / 2;
      ctx.beginPath();
      ctx.roundRect(g1cx - 22, g1cy - 14, 44, 28, 4);
      ctx.fill();
      ctx.fillStyle = C.text;
      ctx.fillText(gap1Ans, g1cx, g1cy + 1);

      // Gap 2 label
      ctx.fillStyle = C.cream;
      const g2cx = px + pw / 2, g2cy = g2t + GAP_HEIGHT / 2;
      ctx.beginPath();
      ctx.roundRect(g2cx - 22, g2cy - 14, 44, 28, 4);
      ctx.fill();
      ctx.fillStyle = C.text;
      ctx.fillText(gap2Ans, g2cx, g2cy + 1);

      // Question text above pipe (when pipe is on screen)
      if (px > 50 && px < W - 50) {
        ctx.font = "16px Calibri, Trebuchet MS, sans-serif";
        ctx.fillStyle = C.pink;
        ctx.fillText(p.question.question + " = ?", px + pw / 2, 28);
      }
    }

    // Bird
    const by = s.bird.y;
    const blink = s.invincible > 0 && s.frame % 6 < 3;
    if (!blink) {
      // Body
      ctx.fillStyle = C.pink;
      ctx.beginPath();
      ctx.arc(BIRD_X, by, BIRD_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      // Wing
      const wingY = by + Math.sin(s.frame * 0.3) * 3;
      ctx.fillStyle = "#b03458";
      ctx.beginPath();
      ctx.ellipse(BIRD_X - 6, wingY, 10, 6, -0.2, 0, Math.PI * 2);
      ctx.fill();

      // Eye
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(BIRD_X + 5, by - 4, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = C.text;
      ctx.beginPath();
      ctx.arc(BIRD_X + 6.5, by - 4, 2.2, 0, Math.PI * 2);
      ctx.fill();

      // Beak
      ctx.fillStyle = "#e8a020";
      ctx.beginPath();
      ctx.moveTo(BIRD_X + BIRD_RADIUS, by);
      ctx.lineTo(BIRD_X + BIRD_RADIUS + 8, by + 2);
      ctx.lineTo(BIRD_X + BIRD_RADIUS, by + 5);
      ctx.closePath();
      ctx.fill();
    }

    animRef.current = requestAnimationFrame(gameLoop);
  }, [endGame, nextQuestion]);

  // ─── Start / stop loop ─────────────────────────────
  useEffect(() => {
    if (screen === "playing") {
      animRef.current = requestAnimationFrame(gameLoop);
    }
    return () => cancelAnimationFrame(animRef.current);
  }, [screen, gameLoop]);

  // ─── Resize canvas ─────────────────────────────────
  useEffect(() => {
    const resize = () => {
      const el = containerRef.current;
      const cv = canvasRef.current;
      if (!el || !cv) return;
      const w = el.clientWidth;
      const h = el.clientHeight;
      cv.width = w;
      cv.height = h;
      g.current.canvasW = w;
      g.current.canvasH = h;
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // ─── Input handlers ────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        if (screen === "start") startGame();
        else if (screen === "playing") flap();
        else if (screen === "gameover") startGame();
      }
      if (e.code === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen, startGame, flap, onClose]);

  const handleCanvasClick = () => {
    if (screen === "start") startGame();
    else if (screen === "playing") flap();
  };

  // ─── Render ────────────────────────────────────────
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9000,
        background: "rgba(26,22,16,0.85)", display: "flex",
        flexDirection: "column", fontFamily: "'Calibri','Trebuchet MS',sans-serif",
      }}
    >
      {/* HUD */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "12px 24px", background: "rgba(248,243,232,0.97)",
        borderBottom: "1px solid rgba(55,45,25,0.10)", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div>
            <span style={{ fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: C.muted }}>Score</span>
            <div style={{ fontSize: 28, fontWeight: 300, color: C.pink }}>{score}</div>
          </div>
          <div>
            <span style={{ fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: C.muted }}>Streak</span>
            <div style={{ fontSize: 28, fontWeight: 300, color: streak >= 3 ? C.green : C.text }}>{streak}x</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", gap: 6 }}>
            {[0, 1, 2].map(i => (
              <span key={i} style={{
                fontSize: 22,
                opacity: i < lives ? 1 : 0.2,
                filter: i < lives ? "none" : "grayscale(1)",
              }}>
                {i < lives ? "\u2764" : "\u2661"}
              </span>
            ))}
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "1px solid rgba(55,45,25,0.15)",
              borderRadius: 3, padding: "6px 14px", cursor: "pointer",
              fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase",
              color: C.muted,
            }}
          >
            Close
          </button>
        </div>
      </div>

      {/* Game canvas */}
      <div ref={containerRef} style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          style={{ display: "block", width: "100%", height: "100%", cursor: "pointer" }}
        />

        {/* Start screen overlay */}
        {screen === "start" && (
          <div style={{
            position: "absolute", inset: 0, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            background: "rgba(244,239,229,0.95)",
          }}>
            <div style={{
              fontSize: 10, letterSpacing: "0.3em", textTransform: "uppercase",
              color: C.pink, marginBottom: 16,
            }}>Vertex</div>
            <h2 style={{ fontSize: 42, fontWeight: 300, color: C.text, marginBottom: 8 }}>
              Flappy <span style={{ color: C.pink, fontStyle: "italic" }}>Quiz</span>
            </h2>
            <p style={{ fontSize: 13, color: C.muted, marginBottom: 8, textAlign: "center", maxWidth: 340, lineHeight: 1.7 }}>
              Fly through the gap with the <strong style={{ color: C.green }}>correct answer</strong>.<br/>
              Avoid the wrong answer and the pipes!
            </p>
            <p style={{ fontSize: 11, color: C.muted2, marginBottom: 32 }}>
              {topic ? `Topic: ${topic}` : "Mixed math questions"}
            </p>
            <button
              onClick={startGame}
              style={{
                padding: "14px 40px", border: "1.5px solid " + C.pink,
                background: C.pink, color: "#fff", borderRadius: 3,
                fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase",
                cursor: "pointer", transition: "all 0.2s",
              }}
            >
              Start Game
            </button>
            <p style={{ fontSize: 11, color: C.muted2, marginTop: 16 }}>
              Press Space or tap to flap
            </p>
          </div>
        )}

        {/* Game over overlay */}
        {screen === "gameover" && (
          <div style={{
            position: "absolute", inset: 0, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            background: "rgba(244,239,229,0.95)",
          }}>
            <div style={{
              fontSize: 10, letterSpacing: "0.3em", textTransform: "uppercase",
              color: C.pink, marginBottom: 16,
            }}>Game Over</div>
            <h2 style={{ fontSize: 48, fontWeight: 300, color: C.text, marginBottom: 32 }}>
              {stats.score} <span style={{ fontSize: 18, color: C.muted }}>points</span>
            </h2>

            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 32,
              marginBottom: 40, textAlign: "center",
            }}>
              <div>
                <div style={{ fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: C.muted, marginBottom: 6 }}>Correct</div>
                <div style={{ fontSize: 28, fontWeight: 300, color: C.green }}>{stats.correct}/{stats.total}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: C.muted, marginBottom: 6 }}>Best Streak</div>
                <div style={{ fontSize: 28, fontWeight: 300, color: C.pink }}>{stats.bestStreak}x</div>
              </div>
              <div>
                <div style={{ fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: C.muted, marginBottom: 6 }}>Accuracy</div>
                <div style={{ fontSize: 28, fontWeight: 300, color: C.text }}>
                  {stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0}%
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={startGame}
                style={{
                  padding: "14px 32px", border: "1.5px solid " + C.pink,
                  background: C.pink, color: "#fff", borderRadius: 3,
                  fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase",
                  cursor: "pointer",
                }}
              >
                Play Again
              </button>
              <button
                onClick={onClose}
                style={{
                  padding: "14px 32px", border: "1.5px solid rgba(55,45,25,0.15)",
                  background: "transparent", color: C.text, borderRadius: 3,
                  fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase",
                  cursor: "pointer",
                }}
              >
                Back to Lesson
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
