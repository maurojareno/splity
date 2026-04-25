# Budget Copy & Templates

## Context

Creating a new budget requires manually adding all envelopes from scratch. When you have 20+ envelopes, this is extremely tedious. The feature adds two ways to pre-fill the create budget form:

1. **Copy from previous budget** — pre-fills envelopes (name, icon, color, allocatedAmount), totalAmount, and currency from any existing budget
2. **Use a template** — pre-built envelope configurations with translated names and zero amounts

No new Prisma models or tRPC endpoints needed — `getByGroup` (list) and `getById` (full data) already exist.

---

## Files to Modify/Create

| File                                             | Action | Purpose                                                        |
| ------------------------------------------------ | ------ | -------------------------------------------------------------- |
| `src/lib/budget-templates.ts`                    | CREATE | Hardcoded template definitions                                 |
| `src/components/Budget/BudgetCopyDrawer.tsx`     | CREATE | Drawer to pick a budget to copy from                           |
| `src/components/Budget/BudgetTemplateDrawer.tsx` | CREATE | Drawer to pick a template                                      |
| `src/pages/groups/[groupId]/budget/new.tsx`      | MODIFY | Add "Start from" section, query param `?copyFrom`, apply logic |
| `src/components/Budget/BudgetHistoryDrawer.tsx`  | MODIFY | Add "Duplicate" button on each budget item                     |
| `public/locales/*/common.json` (22 locales)      | MODIFY | New translation keys                                           |

---

## Implementation Steps

### Step 1: `src/lib/budget-templates.ts` (new)

Define 3 templates (Personal, Family, Student). Each template has:

- `id`, `nameKey` (i18n), `descriptionKey` (i18n)
- `envelopes[]` with `nameKey` (i18n), `icon` (emoji)

Envelope names use i18n keys that get resolved via `t()` when the user selects a template — the database stores the translated string (e.g., "Alquiler"), not the key.

Templates:

- **Personal** (7 envelopes): Rent, Groceries, Transport, Utilities, Entertainment, Health, Savings
- **Family** (10 envelopes): + Kids, Education, Pets
- **Student** (5 envelopes): Rent, Groceries, Transport, Education, Entertainment

### Step 2: `src/components/Budget/BudgetCopyDrawer.tsx` (new)

Follows the exact same pattern as `BudgetHistoryDrawer.tsx`:

- Props: `groupId`, `trigger` (ReactNode), `onSelect(budgetId: string)`
- Uses `AppDrawer` with `api.budget.getByGroup.useQuery()`
- Renders each budget as a tappable card (name, date range, envelope count, total)
- On tap -> calls `onSelect(budgetId)`, closes drawer via `AppDrawerClose`

~80 lines, structurally mirrors `BudgetHistoryDrawer` but simplified (select only, no restore/active logic).

### Step 3: `src/components/Budget/BudgetTemplateDrawer.tsx` (new)

- Props: `trigger` (ReactNode), `onSelect(template: BudgetTemplate)`
- Uses `AppDrawer`, renders template cards
- Each card shows: template name, description, envelope names with icons as preview
- On tap -> calls `onSelect(template)`, closes drawer

~70 lines.

### Step 4: Modify `src/pages/groups/[groupId]/budget/new.tsx`

**a) New imports**: `Copy`, `LayoutTemplate` from lucide; the 3 new components/modules.

**b) Query param**: `const copyFromId = router.query.copyFrom as string | undefined`

**c) Conditional query**: `api.budget.getById.useQuery(...)` enabled only when `copyFromId` present and not in edit mode.

**d) State**: `const [sourceSelected, setSourceSelected] = useState(Boolean(copyFromId))`

**e) Two new callbacks**:

- `applyCopiedBudget(budget)` — sets totalAmount, totalAmountStr, currency, and maps envelopes into `EnvelopeFormData[]`
- `applyTemplate(template)` — maps template envelope nameKeys through `t()`, sets envelopes with 0n amounts

**f) `handleCopySelect(budgetId)`** — uses `utils.budget.getById.fetch()` to imperatively fetch (no page reload), then calls `applyCopiedBudget`.

**g) `useEffect` for `copyFromId`** — auto-applies when navigating with `?copyFrom=` from BudgetHistoryDrawer.

**h) New JSX section** — between date pickers and envelope section, only in create mode when `!sourceSelected`:

```
+-----------------------------------+
|  Start from...                    |
|  [Copy previous]  [Template]      |
|       or start from scratch       |
+-----------------------------------+
```

Two buttons side-by-side opening the respective drawers. Small "or start from scratch" link below that dismisses the section.

Once a source is selected (or dismissed), the section hides and the envelope section shows as normal (pre-filled or empty).

### Step 5: Modify `BudgetHistoryDrawer.tsx`

Add `onDuplicate` prop to `BudgetHistoryItem`. Render a "Duplicate" button next to "Restore" (for archived) or standalone (for active). The parent wires it to navigate to `/groups/[groupId]/budget/new?copyFrom=<budgetId>`.

### Step 6: Translations (22 locales)

New keys under `budget`:

```json
"start_from": "Start from...",
"copy_previous": "Copy previous budget",
"use_template": "Use a template",
"or_start_scratch": "or start from scratch",
"select_budget_to_copy": "Select a budget to copy",
"duplicate": "Duplicate",
"templates": {
  "personal": { "name": "Personal", "description": "Basic personal budget" },
  "family": { "name": "Family", "description": "Family household budget" },
  "student": { "name": "Student", "description": "Simple student budget" },
  "envelopes": {
    "rent": "Rent",
    "groceries": "Groceries",
    "transport": "Transport",
    "utilities": "Utilities",
    "entertainment": "Entertainment",
    "savings": "Savings",
    "health": "Health",
    "kids": "Kids",
    "education": "Education",
    "pets": "Pets"
  }
}
```

Add English first, then translate to all 22 locales.

---

## Key Design Decisions

1. **Inline fetch for copy** — when picking a budget from the copy drawer on the create page, use `utils.budget.getById.fetch()` imperatively instead of navigating to `?copyFrom=`. Avoids page reload. The URL param path is only for navigation from BudgetHistoryDrawer.

2. **Template names are i18n keys resolved at selection time** — database stores translated strings, not keys.

3. **"Start from" section visibility** — only shows in create mode when no source selected. Dismisses after selection or explicit "start from scratch". Prevents accidental overwrites.

4. **Copy includes amounts** — the user's primary pain is recreating structure AND amounts. They can adjust individual amounts after copying.

5. **No new backend endpoints** — everything is already available via existing queries.

---

## Verification

1. Navigate to `/groups/[groupId]/budget/new` — should see "Start from..." section
2. Click "Copy previous budget" — drawer opens with budget list
3. Select a budget — form pre-fills with envelopes, amounts, currency
4. Verify envelopes can be edited/added/removed after pre-fill
5. Click "Use a template" — drawer opens with 3 template cards
6. Select a template — envelopes pre-fill with translated names and 0 amounts
7. Click "or start from scratch" — section dismisses, empty envelope shown
8. From budget history drawer, click "Duplicate" — navigates to `/budget/new?copyFrom=id` with pre-filled form
9. Submit a pre-filled budget — creates successfully with correct data
10. Test in different locales (en, es-AR) — template names translate correctly
