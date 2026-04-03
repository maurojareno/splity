import { faker } from '@faker-js/faker';
import type { DummyGroupInfo } from './groupGenerator';
import { CURRENCY_MULTIPLIERS, type DummyCurrencyCode } from './userGenerator';

const BUDGET_COUNT = 30;

const envelopeTemplates = [
  { icon: '\u{1F3E0}', name: 'Rent', pct: 0.35 },
  { icon: '\u{1F6D2}', name: 'Groceries', pct: 0.2 },
  { icon: '\u{1F697}', name: 'Transport', pct: 0.1 },
  { icon: '\u{1F3AD}', name: 'Entertainment', pct: 0.08 },
  { icon: '\u{1F436}', name: 'Pets', pct: 0.04 },
  { icon: '\u{1F4A1}', name: 'Utilities', pct: 0.08 },
  { icon: '\u{2764}\u{FE0F}', name: 'Health', pct: 0.05 },
  { icon: '\u{1F4DA}', name: 'Education', pct: 0.05 },
  { icon: '\u{1F4B0}', name: 'Savings', pct: 0.05 },
];

function toCentavos(amount: number, currency: DummyCurrencyCode): bigint {
  const multiplier = CURRENCY_MULTIPLIERS[currency] ?? 1;
  return BigInt(Math.round(amount * multiplier * 100));
}

export const generateBudgets = (groups: DummyGroupInfo[]) => {
  // Pick a subset of household-type groups for budgets
  const householdGroups = groups.filter((g) => g.type === 'household');
  const otherGroups = groups.filter((g) => g.type !== 'household');
  const eligibleGroups = [
    ...householdGroups.slice(0, Math.min(householdGroups.length, 20)),
    ...otherGroups.slice(0, Math.min(otherGroups.length, 10)),
  ].slice(0, BUDGET_COUNT);

  return eligibleGroups.map((group) => {
    const totalUsd = faker.number.int({ min: 1000, max: 8000 });
    const currency = group.defaultCurrency;
    const totalAmount = toCentavos(totalUsd, currency);

    // Use faker's reference date (2025-01-01) for determinism
    const refDate = faker.defaultRefDate();
    const periodStart = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
    const periodEnd = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0);

    const envelopeCount = faker.number.int({ min: 3, max: 7 });
    const selectedTemplates = faker.helpers.shuffle([...envelopeTemplates]).slice(0, envelopeCount);

    // Normalize percentages
    const totalPct = selectedTemplates.reduce((sum, t) => sum + t.pct, 0);
    const allocationPct = faker.number.float({ min: 0.7, max: 0.95 });

    const envelopes = selectedTemplates.map((template, i) => {
      const normalizedPct = (template.pct / totalPct) * allocationPct;
      const allocatedAmount = toCentavos(totalUsd * normalizedPct, currency);

      // Generate some charges
      const chargeCount = faker.number.int({ min: 0, max: 8 });
      const charges = Array.from({ length: chargeCount }, () => {
        const chargeAmountUsd = faker.number.int({
          min: 5,
          max: Math.max(10, Math.round((totalUsd * normalizedPct) / 3)),
        });
        return {
          amount: toCentavos(chargeAmountUsd, currency),
          description: faker.commerce.productName(),
          date: faker.date.between({ from: periodStart, to: periodEnd }),
          createdBy: faker.helpers.arrayElement(group.members).id,
        };
      });

      return {
        name: template.name,
        allocatedAmount,
        icon: template.icon,
        color: null as string | null,
        sortOrder: i,
        charges,
      };
    });

    return {
      groupId: group.id,
      name: `Budget ${periodStart.toLocaleString('en', { month: 'long', year: 'numeric' })}`,
      totalAmount,
      currency,
      periodStart,
      periodEnd,
      isActive: true,
      createdBy: faker.helpers.arrayElement(group.members).id,
      envelopes,
    };
  });
};

export type DummyBudgetInfo = ReturnType<typeof generateBudgets>[number];
