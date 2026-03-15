# Vertex — AI Math Tutoring

A full-stack AI math tutoring web app built with Next.js. Parents set up accounts and configure learning preferences; kids enter a 6-digit access code to start learning with an AI tutor powered by OpenAI and a Simli avatar delivered through LiveKit.

## Tech Stack

- **Framework:** Next.js 16 App Router, TypeScript, Tailwind CSS
- **UI:** Shadcn UI components + custom Vertex design system
- **Auth & DB:** Supabase (Auth + PostgreSQL + Storage)
- **AI:** OpenAI for tutoring, quizzes, and real-time voice tutoring
- **Avatar:** Simli rendered through a LiveKit room
- **Email:** Resend for parent notifications
- **Attention:** Real-time focus tracking (tab visibility, mouse activity, webcam face detection)

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

Copy `.env.example` to `.env.local` and fill in your keys:

```bash
cp .env.example .env.local
```

### 3. Set up Supabase

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Run `supabase/schema.sql` in the SQL editor
3. Go to Storage → create a bucket named `documents` (set to public)
4. In Auth → Settings, disable "Confirm email" for development

### 4. Run the dev server

```bash
npm run dev
```

### 5. Start the live tutor stack

The Tina avatar uses a local LiveKit dev server plus a Python agent worker.

```bash
livekit-server --dev
python3 -m venv .venv
source .venv/bin/activate
pip install -r agents/requirements.txt
npm run agent:simli
```

Open [http://localhost:3000](http://localhost:3000).

## Architecture

### Routes

| Route | Who | Description |
|---|---|---|
| `/` | Public | Landing page |
| `/signup` | Public | Parent registration (name, email, password, child info, math topics, pace) |
| `/login` | Public | Parent login |
| `/student` | Public | Kid code entry (6-digit access code) |
| `/onboarding` | Parent | Post-signup child profile setup |
| `/dashboard/parent` | Parent | Data-heavy dashboard: Overview, Progress, Homework, Reports, Settings |
| `/dashboard/kid` | Kid | Fun dashboard: Home, Homework, Quiz, Ask Tutor (bottom nav) |
| `/kid/onboarding` | Kid | Avatar picker (choose tutor character) |
| `/session/[id]` | Parent | Tutoring session (parent flow) |
| `/session/kid` | Kid | Tutoring session (kid flow with Tina in a LiveKit room) |
| `/session/kid/recap` | Kid | Post-session recap (XP earned, focus score) |
| `/parent` | Parent | Parent profile (Tina status, homework upload, settings) |
| `/mission` | Public | About page |

### Database Tables

- **`parents`** — Parent accounts with learning config (grade, math topics, pace)
- **`access_codes`** — 6-digit codes parents generate for kids
- **`kids_sessions`** — Kid "accounts" (created via code entry), streak/XP tracking
- **`children`** — Per-child profiles linked to parents
- **`learning_profiles`** — Learning pace, difficulty, topics per child
- **`uploaded_documents`** — Homework PDFs with extracted text
- **`homework`** — Homework records
- **`tutoring_sessions`** — Chat-based tutoring sessions
- **`messages`** — Chat messages (user/assistant/system)
- **`sessions`** — Focus tracking sessions
- **`quizzes`** — Structured quiz records (5 questions, answers, scores)
- **`quiz_attempts`** — Individual question attempts
- **`focus_events`** — Distraction events (tab blur, inactive, face absent)
- **`parent_reports`** — AI-generated session summaries sent to parents

### Key Features

**Parent Flow:**
- Sign up with child info, math topics, and learning pace
- Auto-generated 6-digit access codes (one per child)
- Dashboard with session history, focus charts, homework management
- Reports sent via email (Resend) after each session
- Live tutor status page for the Tina avatar workflow

**Kid Flow:**
- Enter 6-digit code → start learning
- Fun dashboard with streak (Duolingo-style) and XP system
- Upload homework PDFs → AI parses and creates study material
- Chat with AI tutor (GPT-4o) with LaTeX math, JSXGraph diagrams
- Talk to Tina in real time through LiveKit + Simli
- Take quizzes (5 questions, multiple choice + open) based on homework
- Session recap with XP earned and focus score

**Attention Engine:**
- Tab visibility tracking
- Mouse inactivity detection
- Webcam face detection (MediaPipe)
- Focus score 0-100 updated every 30s
- Policy engine: gentle reminders → quiz mode → simplified content → parent email alert
- Real-time email to parent when focus drops below 50 for 2+ consecutive checks

**AI Features:**
- Dynamic system prompts based on parent config (grade, topics, pace)
- LaTeX math rendering (KaTeX)
- Interactive diagrams (JSXGraph: graphs, number lines, shapes, fractions, geometry, bar/pie charts)
- Adaptive difficulty (harder after 3 correct, easier after 2 incorrect)
- Quiz generation from homework content
