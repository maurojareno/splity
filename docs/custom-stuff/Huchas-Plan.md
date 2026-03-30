# Plan: Fork SplitPro + Huchas + Modernización

> Complejidad: **L** (large) | Archivos estimados: 30-40 | Fases: 4
> Dependencias: SplitPro repo, PostgreSQL, Docker
> Fecha: 2026-03-28 | Actualizado: 2026-03-30

## Contexto

Forkear SplitPro (app open source de expense splitting tipo Splitwise) para:
1. Agregar un sistema de presupuestos con huchas/sobres (envelope budgeting) compartido entre usuarios de un grupo
2. Modernizar el stack: App Router, Better Auth, últimas versiones de todas las libs

La app final combina dos conceptos que hoy no existen juntos en open source:
- **Splitting**: quién pagó qué, quién debe a quién (ya existe en SplitPro)
- **Huchas**: presupuesto mensual con categorías que se van vaciando (nuevo)

### Estrategia: Valor primero, modernización después

1. **FASE 0** — Levantar la app tal cual está, sin cambios
2. **FASE 1** — Agregar Huchas sobre el stack actual (Pages Router + NextAuth)
3. **FASE 2** — Modernización: App Router + Better Auth + últimas versiones de libs
4. **FASE 3** — Polish, tests y deploy

**Razonamiento**: El backend de Huchas (Prisma models, tRPC routers) es agnóstico del router y auth. Solo las pages UI (~3-4 archivos) se reescriben en la migración a App Router. Es un tradeoff aceptable para poder usar la feature cuanto antes.

## Stack actual de SplitPro (heredado)

- Next.js 15 (**Pages Router** — se migrará a App Router en FASE 2)
- tRPC 11 + Zod + SuperJSON (API type-safe, BigInt serialization)
- Prisma 6 + PostgreSQL (multi-schema: public, cron)
- NextAuth 4 (se migrará a Better Auth en FASE 2)
- Tailwind 4 + shadcn/ui (new-york style) + Lucide icons
- React Hook Form + Zod resolver
- Zustand (state), Sonner (toasts)
- Serwist (PWA + Push Notifications)
- Docker Compose
- oxlint + Prettier (semi, single quote, 100 chars)

## Stack objetivo (FASE 2+)

- Next.js latest (**App Router**)
- Better Auth (reemplaza NextAuth)
- Todas las libs en últimas versiones (Prisma, tRPC, Zod, i18n, etc.)
- i18n compatible con App Router (next-intl o similar, reemplaza next-i18next)

---

## FASE 0: Setup del Fork

### Paso 1: Forkear y levantar SplitPro localmente

**Qué**: Fork del repo `oss-apps/split-pro`, clonar, configurar entorno local.

**Cómo**:
```bash
# Fork en GitHub, luego:
git clone https://github.com/TU_USUARIO/split-pro.git
cd split-pro
cp .env.example .env
# Editar .env con credenciales locales
docker compose -f docker/dev/compose.yml up -d  # levanta PG
pnpm install
pnpm db:dev
pnpm dev
```

**Verificación**:
- [ ] App corre en `localhost:3000`
- [ ] Login con al menos un provider OAuth funciona
- [ ] Se puede crear un grupo y agregar un gasto
- [ ] Done

### Paso 2: Limpiar y personalizar el fork

**Qué**: Renombrar branding, limpiar references a SplitPro, crear rama de desarrollo.

**Cómo**:
- Crear rama `git checkout -b feature/huchas`
- Actualizar `package.json` con nombre del proyecto
- Actualizar meta tags y títulos en layout
- Opcional: cambiar favicon y logo

**Verificación**:
- [ ] App corre con nuevo nombre/branding
- [ ] Rama de desarrollo creada
- [ ] Done

---

## FASE 1: Presupuestos con Huchas (Envelope Budgeting)

> Se implementa sobre el stack actual (Pages Router + NextAuth) siguiendo los patterns existentes del codebase.

### Paso 3: Diseñar modelo de datos

**Qué**: Agregar tablas de Prisma para Budget y Envelope.

**Cómo**: Agregar al `prisma/schema.prisma`:

```prisma
// Un presupuesto mensual asociado a un grupo
model Budget {
  id          String   @id @default(cuid())
  groupId     Int                                    // ← Int (Group.id es Int autoincrement)
  group       Group    @relation(fields: [groupId], references: [id], onDelete: Cascade)
  name        String   // ej: "Presupuesto Marzo 2026"
  totalAmount BigInt   // monto total en centavos
  currency    String   @default("EUR")
  periodStart DateTime // inicio del período
  periodEnd   DateTime // fin del período
  isActive    Boolean  @default(true)
  createdBy   Int                                    // ← Int (User.id es Int autoincrement)
  creator     User     @relation(fields: [createdBy], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  envelopes   Envelope[]

  @@index([groupId])
  @@index([groupId, isActive])
  @@schema("public")
}

// Una hucha/sobre dentro de un presupuesto
model Envelope {
  id             String   @id @default(cuid())
  budgetId       String
  budget         Budget   @relation(fields: [budgetId], references: [id], onDelete: Cascade)
  name           String   // ej: "Alquiler", "Comida", "Perro"
  allocatedAmount BigInt  // monto asignado en centavos
  color          String?  // color para UI (hex)
  icon           String?  // emoji o icon name
  sortOrder      Int      @default(0)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  charges        EnvelopeCharge[]

  @@index([budgetId])
  @@schema("public")
}

// Cargo contra una hucha (vinculado opcionalmente a un expense de splitting)
model EnvelopeCharge {
  id          String   @id @default(cuid())
  envelopeId  String
  envelope    Envelope @relation(fields: [envelopeId], references: [id], onDelete: Cascade)
  amount      BigInt   // monto en centavos
  description String
  date        DateTime @default(now())
  createdBy   Int                                    // ← Int (User.id es Int autoincrement)
  creator     User     @relation(fields: [createdBy], references: [id])
  expenseId   String?  @db.Uuid                      // ← UUID (Expense.id es UUID)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([envelopeId])
  @@index([envelopeId, date])
  @@schema("public")
}
```

**Decisiones de diseño**:
- `Budget` pertenece a un `Group` → los mismos participantes del grupo ven el presupuesto
- `EnvelopeCharge` es independiente de `Expense` → podés cargar gastos a la hucha sin que sea un gasto compartido/split
- `expenseId` opcional permite vincular un gasto split con una hucha
- Montos en `BigInt` (centavos) para consistencia con SplitPro
- Un grupo puede tener múltiples budgets (uno activo por período)
- **IDs**: `User.id` y `Group.id` son `Int` (autoincrement), nuevas entidades usan `String @default(cuid())`, `Expense.id` es UUID
- **Schema**: Todos los modelos llevan `@@schema("public")` (el codebase usa multi-schema con PostgreSQL)

**Verificación**:
- [ ] `prisma migrate dev --name add_budget_envelopes` sin errores
- [ ] `prisma generate` genera tipos correctos
- [ ] Prisma Studio muestra las nuevas tablas
- [ ] Done

### Paso 4: Crear tRPC router para Budget

**Qué**: Endpoints CRUD para presupuestos.

**Cómo**: Crear `src/server/api/routers/budget.ts` siguiendo el patrón de los routers existentes.

> **NOTA**: Usar `groupProcedure` para queries/mutations que necesiten validar membresía al grupo (auto-verifica que el usuario pertenece al grupo). Usar `protectedProcedure` solo para endpoints que no son grupo-específicos.

```typescript
import { createTRPCRouter, groupProcedure, protectedProcedure } from '~/server/api/trpc';
import { z } from 'zod';

export const budgetRouter = createTRPCRouter({
  // Crear un presupuesto para un grupo
  create: groupProcedure
    .input(z.object({
      groupId: z.number(),                     // ← z.number() (Group.id es Int)
      name: z.string().min(1).max(200),
      totalAmount: z.bigint().positive(),       // ← z.bigint() para BigInt
      currency: z.string().default("EUR"),
      periodStart: z.date(),
      periodEnd: z.date(),
      envelopes: z.array(z.object({
        name: z.string().min(1).max(200),
        allocatedAmount: z.bigint().positive(),
        color: z.string().max(7).optional(),
        icon: z.string().max(10).optional(),
      })),
    }))
    .mutation(async ({ ctx, input }) => { ... }),

  // Obtener presupuesto activo de un grupo
  getActive: groupProcedure
    .input(z.object({ groupId: z.number() }))
    .query(async ({ ctx, input }) => { ... }),

  // Obtener historial de presupuestos de un grupo
  getByGroup: groupProcedure
    .input(z.object({ groupId: z.number() }))
    .query(async ({ ctx, input }) => { ... }),

  // Actualizar presupuesto (nombre, montos, fechas)
  update: protectedProcedure
    .input(z.object({ ... }))
    .mutation(async ({ ctx, input }) => { ... }),

  // Cerrar presupuesto actual y crear el del siguiente período
  rollover: protectedProcedure
    .input(z.object({
      budgetId: z.string(),
      carryOver: z.boolean().default(false), // arrastrar sobrante
    }))
    .mutation(async ({ ctx, input }) => { ... }),
})
```

**Verificación**:
- [ ] TypeScript compila sin errores
- [ ] Cada procedure tiene validación Zod de input
- [ ] Procedures verifican que el usuario pertenece al grupo
- [ ] Done

### Paso 5: Crear tRPC router para Envelope

**Qué**: Endpoints para gestionar huchas y sus cargos.

**Cómo**: Crear `src/server/api/routers/envelope.ts`:

```typescript
import { createTRPCRouter, protectedProcedure } from '~/server/api/trpc';
import { z } from 'zod';

export const envelopeRouter = createTRPCRouter({
  // Agregar hucha a un presupuesto existente
  create: protectedProcedure
    .input(z.object({
      budgetId: z.string(),
      name: z.string().min(1).max(200),
      allocatedAmount: z.bigint().positive(),
      color: z.string().max(7).optional(),
      icon: z.string().max(10).optional(),
    }))
    .mutation(async ({ ctx, input }) => { ... }),

  // Actualizar hucha (nombre, monto asignado)
  update: protectedProcedure
    .input(z.object({ ... }))
    .mutation(async ({ ctx, input }) => { ... }),

  // Eliminar hucha (reasignar cargos?)
  delete: protectedProcedure
    .input(z.object({ envelopeId: z.string() }))
    .mutation(async ({ ctx, input }) => { ... }),

  // Cargar gasto a una hucha
  charge: protectedProcedure
    .input(z.object({
      envelopeId: z.string(),
      amount: z.bigint().positive(),
      description: z.string().min(1).max(500),
      date: z.date().optional(),
      expenseId: z.string().optional(), // vincular a expense de split
    }))
    .mutation(async ({ ctx, input }) => { ... }),

  // Eliminar un cargo
  deleteCharge: protectedProcedure
    .input(z.object({ chargeId: z.string() }))
    .mutation(async ({ ctx, input }) => { ... }),

  // Obtener resumen de una hucha (asignado, gastado, restante)
  getSummary: protectedProcedure
    .input(z.object({ envelopeId: z.string() }))
    .query(async ({ ctx, input }) => { ... }),

  // Obtener historial de cargos de una hucha
  getCharges: protectedProcedure
    .input(z.object({
      envelopeId: z.string(),
      cursor: z.string().optional(),
      limit: z.number().default(20),
    }))
    .query(async ({ ctx, input }) => { ... }),

  // Reordenar huchas
  reorder: protectedProcedure
    .input(z.object({
      budgetId: z.string(),
      envelopeIds: z.array(z.string()),
    }))
    .mutation(async ({ ctx, input }) => { ... }),
})
```

**Verificación**:
- [ ] TypeScript compila sin errores
- [ ] Cada procedure tiene validación Zod
- [ ] Al cargar gasto, se verifica que el monto no exceda lo asignado (warning, no bloqueo)
- [ ] Done

### Paso 6: Registrar routers en el app router

**Qué**: Integrar `budgetRouter` y `envelopeRouter` en el router principal de tRPC.

**Cómo**: Actualizar `src/server/api/root.ts`:
```typescript
import { budgetRouter } from './routers/budget';
import { envelopeRouter } from './routers/envelope';

export const appRouter = createTRPCRouter({
  // ... routers existentes (group, user, expense, bankTransactions)
  budget: budgetRouter,
  envelope: envelopeRouter,
});
```

**Verificación**:
- [ ] `pnpm build` sin errores
- [ ] Nuevos procedures accesibles desde el cliente tRPC
- [ ] Done

### Paso 7: UI — Vista de presupuesto del grupo

**Qué**: Crear la página principal de presupuesto dentro de un grupo.

**Cómo**: Crear ruta `src/pages/groups/[groupId]/budget/index.tsx`:

> Estas pages se reescribirán en App Router durante FASE 2. El backend (routers, models) NO cambia.

- Vista principal con:
  - Header: nombre del presupuesto, período, monto total
  - Barra de progreso general (gastado vs total)
  - Grid/lista de huchas, cada una mostrando:
    - Nombre + icono + color
    - Barra de progreso (gastado / asignado)
    - Monto restante
    - Botón "Agregar gasto"
  - Monto sin asignar (total - suma de huchas)
- FAB o botón para "Agregar gasto rápido" (seleccionar hucha + monto + descripción)
- Link a "Configurar presupuesto" (crear/editar huchas)

**Componentes a crear** (en `src/components/Budget/`):
- `BudgetOverview.tsx` — resumen general con barra de progreso
- `EnvelopeCard.tsx` — tarjeta individual de hucha
- `EnvelopeGrid.tsx` — grid de huchas
- `AddChargeDialog.tsx` — modal para agregar gasto a una hucha (usar `AppDrawer` pattern)
- `BudgetEmptyState.tsx` — estado vacío con CTA para crear presupuesto

> **NOTA**: Usar componentes existentes: `AppDrawer` para modals, `CurrencyInput` para montos, shadcn `Form`/`FormField` para formularios, `Button`/`Input`/`Select` de `src/components/ui/`. Los componentes en `src/components/Budget/` sobreviven la migración a App Router — solo cambian las pages.

**Verificación**:
- [ ] Página renderiza con datos del presupuesto activo
- [ ] Huchas muestran progreso correcto
- [ ] Estado vacío muestra CTA si no hay presupuesto
- [ ] Done

### Paso 8: UI — Crear/editar presupuesto

**Qué**: Formulario para crear un nuevo presupuesto con sus huchas.

**Cómo**: Crear `src/pages/groups/[groupId]/budget/new.tsx`:

- Formulario con:
  - Nombre del presupuesto
  - Monto total
  - Período (inicio - fin, con shortcut "este mes")
  - Lista dinámica de huchas:
    - Nombre, monto asignado, color, icono
    - Botón agregar/eliminar hucha
  - Validación: suma de huchas ≤ monto total
  - Indicador visual del monto "sin asignar"
- Formulario de edición reutiliza el mismo componente

**Verificación**:
- [ ] Se puede crear presupuesto con N huchas
- [ ] Validación impide que huchas sumen más que el total
- [ ] Edición carga datos existentes correctamente
- [ ] Done

### Paso 9: UI — Detalle de hucha con historial

**Qué**: Página de detalle de una hucha individual con historial de cargos.

**Cómo**: Crear `src/pages/groups/[groupId]/budget/envelope/[envelopeId].tsx`:

- Header con nombre, barra de progreso grande, monto restante
- Lista cronológica de cargos (quién, cuánto, descripción, fecha)
- Si el cargo está vinculado a un expense, link al expense
- Botón agregar cargo
- Estadísticas simples: gasto diario promedio, proyección a fin de mes

**Verificación**:
- [ ] Historial muestra todos los cargos ordenados por fecha
- [ ] Link a expense funciona si existe
- [ ] Barra de progreso refleja los cargos correctamente
- [ ] Done

### Paso 10: Integrar huchas con gastos de splitting (opcional pero valioso)

**Qué**: Al crear un gasto (expense) en un grupo, permitir asignarlo opcionalmente a una hucha.

**Cómo**:
- Modificar el formulario de crear expense para agregar un selector de hucha (dropdown)
- Si se selecciona una hucha, al guardar el expense también crear un `EnvelopeCharge` vinculado
- En el detalle del expense, mostrar a qué hucha está asignado
- Al eliminar un expense, eliminar el charge asociado

**Verificación**:
- [ ] Formulario de expense muestra selector de huchas (solo si el grupo tiene presupuesto activo)
- [ ] Gasto se descuenta de la hucha correctamente
- [ ] Eliminar expense elimina el charge de la hucha
- [ ] Done

### Paso 11: Navegación y acceso

**Qué**: Integrar la sección de presupuesto en la navegación del grupo.

**Cómo**:
- Agregar tab/link "Presupuesto" en la navegación del grupo (junto a Gastos, Balances, etc.)
- Badge con monto restante total o warning si alguna hucha está agotada
- Notificaciones opcionales cuando una hucha llega al 80% y 100%

**Verificación**:
- [ ] Tab "Presupuesto" visible en la nav del grupo
- [ ] Badge funciona correctamente
- [ ] Navegación entre presupuesto ↔ gastos ↔ balances fluye bien
- [ ] Done

---

## FASE 2: Modernización del Stack

> Se hace DESPUÉS de tener Huchas funcionando. El objetivo es modernizar todo de una vez.

### Paso 12: Migrar a App Router

**Qué**: Migrar toda la app de Pages Router (`src/pages/`) a App Router (`app/`).

**Cómo**:
- Crear estructura `app/` con layouts, pages, loading states
- Migrar páginas existentes una a una:
  - `src/pages/home.tsx` → `app/(main)/home/page.tsx`
  - `src/pages/groups/[groupId]/...` → `app/(main)/groups/[groupId]/...`
  - `src/pages/api/...` → Route Handlers en `app/api/...`
  - Pages de Huchas → `app/(main)/groups/[groupId]/budget/...`
- Reemplazar `getServerSideProps` → Server Components o `use server`
- Reemplazar `useSession` → server-side session checks donde sea posible
- Actualizar i18n: reemplazar `next-i18next` por solución compatible con App Router (next-intl o similar)
- Eliminar `src/pages/` cuando la migración esté completa

**Verificación**:
- [ ] Todas las rutas funcionan en App Router
- [ ] No queda nada en `src/pages/` (excepto posiblemente `_document` si es necesario)
- [ ] i18n funciona correctamente con el nuevo setup
- [ ] Done

### Paso 13: Migrar NextAuth → Better Auth

**Qué**: Reemplazar NextAuth por Better Auth.

**Cómo**:
```bash
pnpm add better-auth
pnpm add -D @better-auth/cli
```

- Generar schema de Better Auth:
  ```bash
  npx @better-auth/cli generate --config ./src/server/auth.ts
  ```
- Como NO hay usuarios existentes (fork limpio), hacer `prisma migrate reset` y crear schema limpio
- Crear `src/server/auth.ts` con config de Better Auth:
  ```typescript
  import { betterAuth } from "better-auth";
  import { prismaAdapter } from "better-auth/adapters/prisma";

  export const auth = betterAuth({
    database: prismaAdapter(prisma, { provider: "postgresql" }),
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
  });
  ```
- Crear route handler: `app/api/auth/[...all]/route.ts`
  ```typescript
  import { auth } from "~/server/auth";
  import { toNextJsHandler } from "better-auth/next-js";
  export const { POST, GET } = toNextJsHandler(auth);
  ```
- Crear auth client: `src/server/auth-client.ts`
  ```typescript
  import { createAuthClient } from "better-auth/react";
  export const authClient = createAuthClient({
    baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  });
  export const { signIn, signOut, useSession } = authClient;
  ```
- Actualizar todos los imports de `next-auth/react` → `~/server/auth-client`
- Actualizar tRPC context para usar Better Auth session
- Eliminar NextAuth: `pnpm remove next-auth @next-auth/prisma-adapter`

**Verificación**:
- [ ] Login con Google/provider funciona end-to-end
- [ ] Sesión persiste al recargar
- [ ] Logout funciona
- [ ] tRPC procedures protegidos verifican sesión correctamente
- [ ] No queda ningún import de `next-auth`
- [ ] Done

### Paso 14: Actualizar todas las dependencias

**Qué**: Llevar todas las libs a sus últimas versiones.

**Cómo**:
- `pnpm update --latest` (con cuidado, revisar breaking changes)
- Libs prioritarias:
  - Next.js → latest (builds más rápidos)
  - Prisma → latest
  - tRPC → latest
  - Zod → latest
  - React → latest
  - Tailwind → latest
  - i18n solution → latest
- Corregir breaking changes que surjan
- Corregir tipos TypeScript que cambien

**Verificación**:
- [ ] `pnpm build` sin errores
- [ ] `pnpm lint` sin errores
- [ ] `pnpm test` pasa
- [ ] Todas las features siguen funcionando (splitting + huchas)
- [ ] Done

---

## FASE 3: Polish y Deploy

### Paso 15: Tests

**Qué**: Tests para la lógica crítica de presupuestos.

**Cómo**:
- Tests unitarios para:
  - Cálculo de montos restantes
  - Validación de que huchas no excedan el total
  - Rollover de presupuesto
  - Vinculación expense ↔ charge
- Tests e2e para:
  - Flujo completo: crear presupuesto → agregar huchas → cargar gasto → ver balance
  - Crear expense con asignación a hucha

**Verificación**:
- [ ] Tests pasan
- [ ] Cobertura de lógica de cálculo de montos
- [ ] Done

### Paso 16: Dockerizar y deploy

**Qué**: Actualizar Docker setup para incluir todos los cambios.

**Cómo**:
- Verificar que `docker compose` levanta correctamente con las nuevas migraciones
- Actualizar `.env.example` con nuevas variables (Better Auth, etc.)
- Documentar setup en README

**Verificación**:
- [ ] `docker compose up` levanta la app completa desde cero
- [ ] Migraciones corren automáticamente
- [ ] README actualizado
- [ ] Done

---

## Verificación final

- [ ] `pnpm build` pasa sin errores
- [ ] `pnpm lint` pasa
- [ ] `pnpm test` pasa
- [ ] Auth con Better Auth funciona end-to-end
- [ ] Splitting de gastos funciona como antes (no se rompió nada)
- [ ] Presupuesto con huchas funciona: crear, cargar gastos, ver balance
- [ ] Vinculación expense ↔ hucha funciona
- [ ] App Router funciona correctamente en todas las rutas
- [ ] PWA sigue funcionando
- [ ] Docker Compose levanta correctamente
- [ ] No hay secrets hardcodeados
- [ ] No hay `any` types

---

## Notas y decisiones

### Modelo mental de las huchas

```
Grupo "Casa con María"
├── Splitting (ya existe): quién pagó qué, neteo de deudas
│   ├── Expense: "Super Mercadona" - 85€ (pagó Juan)
│   ├── Expense: "Factura luz" - 120€ (pagó María)
│   └── Balance: Juan debe 17.50€ a María
│
└── Presupuesto Marzo 2026: 2.500€
    ├── 🏠 Alquiler: 700€ / 700€ asignado → 0€ restante
    ├── 🛒 Comida: 250€ / 300€ asignado → 50€ restante
    ├── 🐕 Perro: 35€ / 50€ asignado → 15€ restante
    ├── 🚗 Transporte: 80€ / 150€ asignado → 70€ restante
    ├── 🎭 Ocio: 45€ / 200€ asignado → 155€ restante
    └── 💰 Sin asignar: 1.100€
```

### Qué sobrevive la migración a App Router (FASE 2)

| Capa | Cambia? | Detalle |
|------|---------|---------|
| Prisma models | NO | Schema es independiente del router |
| tRPC routers | NO | Backend es agnóstico |
| Componentes (`src/components/Budget/`) | POCO | Solo ajustar imports si cambian |
| Pages (`src/pages/groups/.../budget/`) | SÍ | Se reescriben como `app/` pages |
| Auth hooks/calls | SÍ | Se migran a Better Auth |

### Cosas diferidas (v2)

- Gastos recurrentes automáticos en huchas (alquiler cada mes)
- Gráficos/reportes de evolución por hucha
- Rollover automático de presupuesto al cambiar de mes
- Presupuesto compartido entre múltiples cuentas bancarias
- Import de movimientos bancarios vía Open Banking
- Alertas push cuando una hucha se agota

### ¿Por qué `EnvelopeCharge` separado de `Expense`?

Un `Expense` en SplitPro es un gasto compartido entre personas con splitting.
Un `EnvelopeCharge` es un gasto contra un presupuesto.

No todos los gastos de presupuesto son compartidos (ej: "café para mí" sale de la hucha Ocio pero no se splitea). Y no todos los gastos compartidos van contra un presupuesto. Por eso son entidades separadas con un link opcional (`expenseId`).

---

## Vulnerabilidades Conocidas (Auditoría 2026-03-29)

Hallazgos de seguridad del codebase heredado que deben tenerse en cuenta durante el desarrollo:

### CRITICAL (fix antes de producción)

| # | Vulnerabilidad | Archivo | Impacto |
|---|---------------|---------|---------|
| 1 | **SQL Injection** via string interpolation en raw queries | `src/server/api/services/scheduleService.ts` | Ejecución arbitraria de SQL |
| 2 | **Authorization bypass** en `getExpenseDetails` — no verifica acceso del usuario | `src/server/api/routers/expense.ts` | Cualquier usuario autenticado puede ver cualquier expense |
| 3 | **Weak token generation** — usa `Math.random()` para tokens de verificación | `src/server/auth.ts` | Tokens brute-forceable en segundos |
| 4 | **Dangerous email account linking** habilitado en Google, Authentik, Keycloak | `src/server/auth.ts` | Account takeover via email |
| 5 | **Bug lógico en `validateEditExpensePermission`** — compara existencia en vez de ownership | `src/server/api/routers/expense.ts` | Bypass de autorización |

### HIGH

| # | Vulnerabilidad | Archivo |
|---|---------------|---------|
| 6 | `getUserDetails` expone datos de cualquier usuario sin verificación | `src/server/api/routers/user.ts` |
| 7 | `addMembers` acepta cualquier userId sin validación | `src/server/api/routers/group.ts` |
| 8 | No hay security headers (CSP, HSTS, X-Frame-Options) | `next.config.js` |
| 9 | TLS validation deshabilitada en dev | `src/server/mailer.ts` |
| 10 | Tokens logueados en console en dev | `src/server/mailer.ts` |

### Recomendación

- Fixear los 5 CRITICAL antes de cualquier deploy público
- Los issues de auth (#3, #4) se resuelven naturalmente en FASE 2 (Better Auth migration)
- Los issues de authorization (#2, #5, #6, #7) deben fixearse durante FASE 1 mientras se trabaja en esos routers
