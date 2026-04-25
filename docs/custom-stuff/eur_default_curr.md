# Plan: EUR as Default Currency, USD Second

## Context

The user's primary currency is EUR. Currently the app defaults to USD everywhere — in the database schema fallbacks, the currency picker ordering, the addStore initial state, and various fallback values throughout the codebase. The goal is to make EUR the default and ensure it appears first in all currency pickers, with USD second, then everything else alphabetically.

## Approach: Centralized Constant + Sort Utility

Add a `DEFAULT_CURRENCY` constant and a `getSortedCurrencies()` helper in `src/lib/currency.ts`, then replace all hardcoded `'USD'` defaults with the constant. The `CURRENCIES` object itself stays untouched (no risky reordering of 178 entries).

**NOT changing:**

- `prisma/schema.prisma` — would require a DB migration for no functional benefit (app always sends an explicit value)
- `src/server/api/services/currencyRateService.ts:142` — `intermediateBase: 'USD'` is a technical API constraint (Frankfurter uses EUR as base, USD as intermediate for cross-rates), not a user-facing default
- `src/dummies/userGenerator.ts` — intentional weighted distribution for seed data
- Test files — they use `'USD'` as explicit test data, not as "the default"

## Changes

### 1. `src/lib/currency.ts` — Add constants and utility

```ts
export const DEFAULT_CURRENCY: CurrencyCode = 'EUR';

const PREFERRED_ORDER: CurrencyCode[] = ['EUR', 'USD'];

export function getSortedCurrencies<T extends { code: string }>(currencies: T[]): T[] {
  return [...currencies].sort((a, b) => {
    const aIdx = PREFERRED_ORDER.indexOf(a.code as CurrencyCode);
    const bIdx = PREFERRED_ORDER.indexOf(b.code as CurrencyCode);
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    if (aIdx !== -1) return -1;
    if (bIdx !== -1) return 1;
    return a.code.localeCompare(b.code);
  });
}
```

Update `parseCurrencyCode` fallback from `'USD'` to `DEFAULT_CURRENCY`.

### 2. `src/components/AddExpense/CurrencyPicker.tsx`

- Import `DEFAULT_CURRENCY`, `getSortedCurrencies`
- Change default param: `currentCurrency = DEFAULT_CURRENCY`
- Sort items before passing to GeneralPicker: `getSortedCurrencies(Object.values(...))`

### 3. `src/store/addStore.ts:82`

- Import `DEFAULT_CURRENCY`
- Change `currency: 'USD'` → `currency: DEFAULT_CURRENCY`

### 4. `src/utils/numbers.ts:5,10`

- Import `DEFAULT_CURRENCY`
- Change both `'USD'` fallbacks → `DEFAULT_CURRENCY`

### 5. `src/server/api/routers/group.ts:19`

- Import `DEFAULT_CURRENCY`
- Change `input.currency ?? 'USD'` → `input.currency ?? DEFAULT_CURRENCY`

### 6. `src/components/Expense/ConvertibleBalance.tsx:140`

- Import `DEFAULT_CURRENCY`
- Change `currency="USD"` → `currency={DEFAULT_CURRENCY}`

### 7. `src/pages/recurring.tsx:109`

- Import `DEFAULT_CURRENCY`
- Change `?? 'USD'` → `?? DEFAULT_CURRENCY`

### 8. `src/server/api/services/notificationService.ts:86`

- Import `DEFAULT_CURRENCY`
- Change `'USD'` fallback → `DEFAULT_CURRENCY`

### 9. `src/server/api/services/splitService.ts:418`

- Import `DEFAULT_CURRENCY`
- Change `'USD'` fallback → `DEFAULT_CURRENCY`

### 10. `src/server/api/services/bankTransactions/plaid.ts:210`

- Import `DEFAULT_CURRENCY`
- Change `|| 'USD'` → `|| DEFAULT_CURRENCY`

### 11. (Optional) Dummy user objects — zero functional impact

- `src/components/AddExpense/UserInput.tsx:64` — `currency: DEFAULT_CURRENCY`
- `src/components/AddExpense/SelectUserOrGroup.tsx:58` — `currency: DEFAULT_CURRENCY`

## Verification

1. `pnpm lint` — ensure no lint errors
2. `pnpm test` — ensure existing tests pass
3. Manual check: open a currency picker in dev — EUR should appear first, USD second, rest alphabetical
4. Create a new group without specifying currency — should default to EUR
5. Verify `parseCurrencyCode('invalid')` returns `'EUR'`

## Risk Assessment

- **Existing users**: No impact. Their DB stores an explicit currency code (e.g. `'USD'`). `parseCurrencyCode('USD')` still returns `'USD'` — the fallback only triggers for invalid codes.
- **New users before setting preference**: Prisma schema still defaults to `'USD'` in DB. The app-level default of EUR only matters for UI initial states and fallbacks for invalid values.
- **Picker ordering**: `getSortedCurrencies` creates a new sorted array without mutating the source object.
