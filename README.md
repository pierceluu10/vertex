# Vertex

AI-powered tutoring platform for children under 12, where a parent's voice and presence guides the learning experience.

## Stack

- **Next.js 16** (App Router) + TypeScript
- **TailwindCSS** + **shadcn/ui**
- **Framer Motion** for animations
- **Supabase** for auth, database, and file storage
- **OpenAI API** (GPT-4o) for tutoring, quizzes, and reports
- **JSXGraph** for interactive math visuals
- **Resend** for parent email reports
- **HeyGen** for parent avatar (architecture ready)

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/your-org/vertex.git
cd vertex
npm install
```

### 2. Set up environment variables

Copy `.env.example` to `.env.local` and fill in your keys:

```bash
cp .env.example .env.local
```

Required:
- `NEXT_PUBLIC_SUPABASE_URL` — Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (server-side only)
- `OPENAI_API_KEY` — OpenAI API key
- `HEYGEN_API_KEY` — HeyGen API key
- `RESEND_API_KEY` — Resend API key for email reports

### 3. Set up Supabase

1. Create a new Supabase project
2. Run the SQL in `supabase/schema.sql` in the SQL editor
3. Create a storage bucket called `documents` (public)

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Architecture

```
src/
├── app/              # Next.js App Router pages & API routes
│   ├── page.tsx      # Landing page
│   ├── login/        # Auth
│   ├── signup/
│   ├── onboarding/   # Parent onboarding flow
│   ├── dashboard/    # Parent dashboard
│   ├── session/[id]/ # Child tutoring session
│   └── api/          # Route handlers (chat, quiz, upload, report, focus, heygen)
├── components/       # React components
│   ├── ui/           # shadcn/ui primitives
│   ├── landing/      # Landing page components
│   └── session/      # Tutoring session components
├── hooks/            # Custom React hooks (attention engine)
├── lib/              # Utilities and service clients
│   ├── supabase/     # Supabase client/server/middleware
│   ├── openai.ts     # OpenAI client + prompt builders
│   ├── pdf.ts        # PDF parsing + chunking
│   ├── attention.ts  # Focus scoring + intervention policy
│   └── adaptive.ts   # Adaptive difficulty engine
└── types/            # Shared TypeScript types
```

## Core Features

1. **Parent Avatar Tutor** — Parent presence in the corner of the session
2. **PDF-Grounded Tutoring** — Upload homework, get answers based on the actual worksheet
3. **Attention Engine** — Real-time focus detection via tab visibility, activity, and inactivity
4. **Policy Engine** — Graduated interventions (gentle reminder → quiz → simplify)
5. **Adaptive Difficulty** — Auto-adjusts based on correct/incorrect streaks
6. **Quiz Mode** — AI-generated age-appropriate quiz questions
7. **Interactive Math Visuals** — JSXGraph number lines, shapes, fractions
8. **Parent Reports** — Session summaries sent via email
