# NetTopo AI

**AI-powered network topology designer & planner** for network engineers and CS students.
Describe a network in **Arabic or English**, upload a diagram, or build it manually -- and get a
professional topology diagram plus a complete IP / subnetting / VLAN / routing / security plan.

> أداة لتصميم وتخطيط شبكات الحاسوب بالذكاء الاصطناعي. اوصف الشبكة بالعربي او الانجليزي،
> ارفع صورة للرسمة، او ابنيها يدوياً — واحصل على داياجرام احترافي + خطة IP و VLAN و Routing كاملة.

---

## Tech stack (100% free / open-source)

| Layer | Choice |
|------|--------|
| Framework | Next.js 14 (App Router) + TypeScript |
| UI | Tailwind CSS + shadcn/ui + Framer Motion |
| Diagrams | React Flow (interactive) + Mermaid (text) |
| Auth | Clerk (free tier) |
| DB / ORM | Supabase Postgres + Prisma |
| AI | Gemini -> Hugging Face -> Ollama -> rule-based fallback |
| OCR | tesseract.js (English + Arabic) |
| Export | html-to-image + jsPDF (client-side) |
| Tests | Vitest |

The AI layer is optional: with **no API keys**, the deterministic rule engine still parses
descriptions and produces a full plan, so the app always works.

---

## Quick start

```bash
# 1) install
npm install

# 2) configure environment
cp .env.example .env        # then fill in the values (see below)

# 3) database (Supabase)
npm run db:push             # or: npm run db:migrate

# 4) run
npm run dev                 # http://localhost:3000
```

### Required environment variables

See `.env.example`. Minimum to boot:

- `DATABASE_URL` + `DIRECT_URL` -- from Supabase (Project Settings -> Database).
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY` -- from Clerk.

Optional (better AI parsing): `GEMINI_API_KEY`, `HUGGINGFACE_API_KEY`, `OLLAMA_BASE_URL`.

---

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start dev server |
| `npm run build` | `prisma generate` + production build |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm test` | Run Vitest unit + route tests |
| `npm run db:push` | Push Prisma schema to the DB |
| `npm run db:studio` | Open Prisma Studio |

---

## Project structure

```
app/
  (marketing)/page.tsx        Landing page
  (auth)/sign-in, sign-up     Clerk auth pages
  (app)/dashboard             Projects list
  (app)/prompt                Describe in natural language
  (app)/upload                Image -> OCR -> topology
  (app)/editor/[projectId]    Manual drag/add editor
  (app)/result/[projectId]    Diagram + Mermaid + plan tabs
  (app)/export/[projectId]    PNG / PDF / JSON export
  api/                        Route handlers (projects, ai, topology, upload, export)
components/
  ui/                         shadcn primitives
  shared/                     navbar, sidebar, logo, theme
  topology/                   React Flow canvas, custom node, palette, Mermaid view
lib/
  network-engine/             parser, ip-planner, vlan-planner, routing, security, builder, planner
  ai/                         provider chain (Gemini/HF/Ollama) + normalization
  validators/                 zod schemas
  auth.ts, db/prisma.ts, api/handler.ts
prisma/schema.prisma          User, Project, Topology, Device, Connection, NetworkPlan
tests/                        Vitest specs
```

---

## How it works

1. **Input** -- prompt text, OCR text from an image, or manually added devices.
2. **Parse** -- `lib/ai` tries each configured LLM, then falls back to `ruleParse` (EN + AR keywords/numbers).
3. **Build** -- `topology-builder` expands `{type,count}` into labeled devices and infers a hierarchical wiring + layout.
4. **Plan** -- `planner` computes VLANs, VLSM subnets, routing protocol (STATIC vs OSPF), and security notes.
5. **Render** -- React Flow diagram + Mermaid text + a structured plan, all exportable.

---

## Deploy (free)

1. Push this repo to GitHub.
2. Import it on **Vercel** (free Hobby plan).
3. Add the same environment variables in the Vercel project settings.
4. Set the build command to `npm run build` (Prisma generates during build).
5. Deploy. Add your Vercel domain to Clerk's allowed origins.

See the companion Notion runbook for a click-by-click guide.
