import React from 'react';
import Link from 'next/link';
import { PiggyBank } from 'lucide-react';
import { useTranslation } from 'next-i18next';
import { Button } from '~/components/ui/button';

interface BudgetEmptyStateProps {
  groupId: number;
}

export const BudgetEmptyState: React.FC<BudgetEmptyStateProps> = ({ groupId }) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center py-16">
      <PiggyBank className="mb-4 h-16 w-16 text-gray-500" />
      <h3 className="mb-2 text-lg font-medium">{t('budget.empty_state.title')}</h3>
      <p className="mb-6 text-center text-sm text-gray-400">
        {t('budget.empty_state.description')}
      </p>
      <Link href={`/groups/${groupId}/budget/new`}>
        <Button>{t('budget.create_budget')}</Button>
      </Link>
    </div>
  );
};
