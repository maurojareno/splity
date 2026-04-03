import React from 'react';
import { useTranslationWithUtils } from '~/hooks/useTranslationWithUtils';
import { Progress } from '~/components/ui/progress';

interface BudgetOverviewProps {
  name: string;
  currency: string;
  totalAmount: bigint;
  totalSpent: bigint;
  totalAllocated: bigint;
  unallocated: bigint;
  periodStart: Date;
  periodEnd: Date;
}

export const BudgetOverview: React.FC<BudgetOverviewProps> = ({
  name,
  currency,
  totalAmount,
  totalSpent,
  totalAllocated,
  unallocated,
  periodStart,
  periodEnd,
}) => {
  const { t, toUIDate, getCurrencyHelpersCached } = useTranslationWithUtils();
  const { toUIString } = getCurrencyHelpersCached(currency);

  const spentPercent = totalAmount > 0n ? Number((totalSpent * 100n) / totalAmount) : 0;

  return (
    <div className="mb-6 rounded-lg border p-4">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{name}</h2>
        <span className="text-sm text-gray-400">
          {toUIDate(periodStart)} - {toUIDate(periodEnd)}
        </span>
      </div>

      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-2xl font-bold">{toUIString(totalSpent)}</span>
        <span className="text-sm text-gray-400">
          {t('budget.of')} {toUIString(totalAmount)}
        </span>
      </div>

      <Progress value={spentPercent} className="mb-3 h-3" />

      <div className="flex justify-between text-xs text-gray-400">
        <span>
          {t('budget.remaining')}: {toUIString(totalAmount - totalSpent)}
        </span>
        {unallocated > 0n && (
          <span>
            {t('budget.unallocated')}: {toUIString(unallocated)}
          </span>
        )}
      </div>
    </div>
  );
};
