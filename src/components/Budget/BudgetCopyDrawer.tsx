import { Copy } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'next-i18next';
import { AppDrawer } from '~/components/ui/drawer';
import { Button } from '~/components/ui/button';
import { useTranslationWithUtils } from '~/hooks/useTranslationWithUtils';
import { api } from '~/utils/api';

interface BudgetCopyDrawerProps {
  groupId: number;
  trigger?: React.ReactNode;
  onSelect: (budgetId: string) => void;
}

export const BudgetCopyDrawer: React.FC<BudgetCopyDrawerProps> = ({
  groupId,
  trigger,
  onSelect,
}) => {
  const { t } = useTranslation();
  const { toUIDate, getCurrencyHelpersCached } = useTranslationWithUtils();
  const [open, setOpen] = useState(false);

  const budgetsQuery = api.budget.getByGroup.useQuery({ groupId });
  const budgets = budgetsQuery.data ?? [];

  const drawerTrigger = trigger ?? (
    <Button size="icon" variant="ghost" aria-label={t('budget.copy_previous')}>
      <Copy className="h-4 w-4" />
    </Button>
  );

  return (
    <AppDrawer
      trigger={drawerTrigger}
      title={t('budget.select_budget_to_copy')}
      open={open}
      onOpenChange={setOpen}
    >
      <div className="space-y-2 pb-4">
        {budgets.length === 0 && !budgetsQuery.isPending && (
          <p className="py-8 text-center text-sm text-gray-400">{t('budget.no_budgets_found')}</p>
        )}
        {budgets.map((budget) => {
          const { toUIString } = getCurrencyHelpersCached(budget.currency);
          return (
            <button
              key={budget.id}
              className="hover:bg-muted/50 w-full rounded-lg border p-3 text-left transition-colors"
              onClick={() => {
                onSelect(budget.id);
                setOpen(false);
              }}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="truncate font-medium">{budget.name}</span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    budget.isActive
                      ? 'bg-primary/15 text-primary'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {budget.isActive ? t('budget.active') : t('budget.archived')}
                </span>
              </div>
              <div className="text-muted-foreground mb-1 text-xs">
                {toUIDate(budget.periodStart)} — {toUIDate(budget.periodEnd)}
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>{toUIString(budget.totalAmount)}</span>
                <span className="text-muted-foreground text-xs">
                  {t('budget.envelopes_count', { count: budget.envelopeCount })}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </AppDrawer>
  );
};
