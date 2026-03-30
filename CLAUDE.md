# Splity

Fork de SplitPro — expense splitting app self-hosted.

## Stack (current → target)

**Current** (FASE 0-1):
- Next.js 15 (Pages Router — migra a App Router en FASE 2)
- NextAuth 4 (migra a Better Auth en FASE 2)
- tRPC 11 + Zod + SuperJSON (BigInt serialization)
- Prisma 6 + PostgreSQL (multi-schema: public, cron)
- Tailwind 4 + shadcn/ui (new-york style) + Lucide icons
- React Hook Form + Zod resolver
- Zustand (state), Sonner (toasts), Serwist (PWA)
- oxlint + Prettier (semi, single quote, 100 chars)

**Target** (FASE 2+):
- Next.js latest (App Router)
- Better Auth
- All libs at latest versions

## Commands

- `pnpm d` — full setup (install + docker + migrate + dev)
- `pnpm dev` — dev server (Turbopack)
- `pnpm lint` — oxlint --type-aware
- `pnpm test` — Jest
- `pnpm db:studio` — Prisma Studio
- `pnpm db:dev` — run migrations
- `pnpm db:seed` — deterministic seed

## Architecture

- Pages Router: `src/pages/` (migra a App Router `app/` en FASE 2)
- tRPC routers: `src/server/api/routers/` (expense, group, user, bankTransactions)
- tRPC setup: `src/server/api/trpc.ts` (publicProcedure, protectedProcedure, groupProcedure)
- Auth: `src/server/auth.ts` (NextAuth + custom adapter)
- DB: `prisma/schema.prisma` (BigInt for money, all amounts in centavos)
- Components: `src/components/` (ui/ for shadcn primitives)
- State: `src/store/` (Zustand: addStore, appStore, currencyPreferenceStore)
- Types: `src/types/` + `src/types.ts`
- Env validation: `src/env.ts` (@t3-oss/env-nextjs)

## Path Aliases

- `~/` → `./src/` (preferred)
- `@/` → `./`

## Conventions

- Money: BigInt (centavos). NEVER use float for currency.
- IDs: User/Group are `Int` (autoincrement). New entities use `String @default(cuid())`. Expense uses UUID.
- Naming: camelCase for fields, PascalCase for models/components, kebab-case for routes
- Forms: React Hook Form + Zod schema + shadcn Form components
- Auth protection: `protectedProcedure` (tRPC), `useSession({ required: true })` (client), `getServerAuthSessionForSSG` (SSR)
- Group access: use `groupProcedure` (auto-validates membership)
- Translations: i18next with 13+ locales in `public/locales/`
- Pre-commit: Prettier + oxlint + tsgo --noEmit (Husky)

## Gotchas

- PWA (Serwist) disabled in dev (incompatible with Turbopack)
- pg_cron extension required for recurring transactions
- Custom NextAuth adapter strips non-standard fields from Keycloak/GitLab
- Seed data is deterministic — same output every run
- Worktrees need unique POSTGRES_PORT, POSTGRES_DB, POSTGRES_CONTAINER_NAME
