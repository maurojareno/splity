import React from 'react';
import Link from 'next/link';
import { useTranslationWithUtils } from '~/hooks/useTranslationWithUtils';
import { Progress } from '~/components/ui/progress';

interface EnvelopeCardProps {
  id: string;
  name: string;
  icon?: string | null;
  color?: string | null;
  allocatedAmount: bigint;
  spent: bigint;
  remaining: bigint;
  currency: string;
  groupId: number;
}

export const EnvelopeCard: React.FC<EnvelopeCardProps> = ({
  id,
  name,
  icon,
  color,
  allocatedAmount,
  spent,
  remaining,
  currency,
  groupId,
}) => {
  const { getCurrencyHelpersCached } = useTranslationWithUtils();
  const { toUIString } = getCurrencyHelpersCached(currency);

  const spentPercent = allocatedAmount > 0n ? Number((spent * 100n) / allocatedAmount) : 0;

  const isOverBudget = remaining < 0n;

  return (
    <Link href={`/groups/${groupId}/budget/envelope/${id}`}>
      <div className="cursor-pointer rounded-lg border p-3 transition-colors hover:border-gray-600">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon && <span className="text-lg">{icon}</span>}
            <span className="font-medium">{name}</span>
          </div>
          <span
            className={isOverBudget ? 'text-sm font-medium text-red-500' : 'text-sm text-gray-400'}
          >
            {toUIString(remaining)}
          </span>
        </div>

        <Progress
          value={spentPercent}
          className="mb-1.5 h-2"
          indicatorClassName={color ? undefined : undefined}
          style={color ? ({ '--envelope-color': color } as React.CSSProperties) : undefined}
        />

        <div className="flex justify-between text-xs text-gray-500">
          <span>{toUIString(spent)}</span>
          <span>{toUIString(allocatedAmount)}</span>
        </div>
      </div>
    </Link>
  );
};
