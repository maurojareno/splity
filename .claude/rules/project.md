# Project Rules

- Currently a Pages Router project (`src/pages/`). Migration to App Router planned for FASE 2.
- All monetary amounts use BigInt (centavos). Never use float/number for money.
- User.id and Group.id are Int (autoincrement), NOT String.
- Expense.id is UUID (`@db.Uuid`), NOT cuid.
- tRPC routers go in `src/server/api/routers/`. Register in `src/server/api/root.ts`.
- Use `groupProcedure` for any tRPC procedure that needs group membership validation.
- Use `protectedProcedure` for auth-required endpoints.
- Forms: React Hook Form + Zod + shadcn Form/FormField pattern.
- UI components: use existing shadcn/ui primitives in `src/components/ui/`.
- Drawers/modals: use `AppDrawer` component pattern.
- Currency input: use existing `CurrencyInput` component.
- Import paths: use `~/` prefix (maps to `src/`).
- Env vars: add to `src/env.ts` schema AND `.env.example`.
