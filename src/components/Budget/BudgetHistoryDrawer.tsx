import { History } from 'lucide-react';
import { useCallback } from 'react';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import { toast } from 'sonner';
import { AppDrawer } from '~/components/ui/drawer';
import { Button } from '~/components/ui/button';
import { useTranslationWithUtils } from '~/hooks/useTranslationWithUtils';
import { api } from '~/utils/api';

interface BudgetHistoryDrawerProps {
  groupId: number;
  trigger?: React.ReactNode;
}

export const BudgetHistoryDrawer: React.FC<BudgetHistoryDrawerProps> = ({ groupId, trigger }) => {
  const { t } = useTranslation();
  const { toUIDate, getCurrencyHelpersCached } = useTranslationWithUtils();
  const router = useRouter();
  const utils = api.useUtils();

  const budgetsQuery = api.budget.getByGroup.useQuery({ groupId });
  const toggleActive = api.budget.toggleActive.useMutation({
    onSuccess: () => {
      toast.success(t('budget.budget_restored'));
      void utils.budget.getActive.invalidate({ groupId });
      void utils.budget.getByGroup.invalidate({ groupId });
      void utils.budget.getById.invalidate({ groupId });
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const budgets = budgetsQuery.data ?? [];
  const activeBudget = budgets.find((b) => b.isActive);
  const archivedBudgets = budgets.filter((b) => !b.isActive);

  const handleNavigate = useCallback(
    (budgetId: string, isActive: boolean) => {
      if (isActive) {
        void router.push(`/groups/${groupId}/budget`);
      } else {
        void router.push(`/groups/${groupId}/budget?id=${budgetId}`);
      }
    },
    [groupId, router],
  );

  const drawerTrigger = trigger ?? (
    <Button size="icon" variant="ghost" aria-label={t('budget.budget_history')}>
      <History className="h-4 w-4" />
    </Button>
  );

  return (
    <AppDrawer trigger={drawerTrigger} title={t('budget.budget_history')}>
      <div className="space-y-2 pb-4">
        {budgets.length === 0 && !budgetsQuery.isPending && (
          <p className="py-8 text-center text-sm text-gray-400">{t('budget.no_budgets_found')}</p>
        )}

        {activeBudget && (
          <BudgetHistoryItem
            budget={activeBudget}
            onNavigate={handleNavigate}
            toUIDate={toUIDate}
            getCurrencyHelpersCached={getCurrencyHelpersCached}
            t={t}
            isCurrentlyViewing={!router.query.id}
            onDuplicate={() =>
              void router.push(`/groups/${groupId}/budget/new?copyFrom=${activeBudget.id}`)
            }
          />
        )}

        {archivedBudgets.length > 0 && (
          <>
            {activeBudget && <div className="my-3 border-t" />}
            {archivedBudgets.map((budget) => (
              <BudgetHistoryItem
                key={budget.id}
                budget={budget}
                onNavigate={handleNavigate}
                toUIDate={toUIDate}
                getCurrencyHelpersCached={getCurrencyHelpersCached}
                t={t}
                onRestore={() => toggleActive.mutate({ groupId, budgetId: budget.id })}
                isRestoring={
                  toggleActive.isPending && toggleActive.variables?.budgetId === budget.id
                }
                isCurrentlyViewing={router.query.id === budget.id}
                onDuplicate={() =>
                  void router.push(`/groups/${groupId}/budget/new?copyFrom=${budget.id}`)
                }
              />
            ))}
          </>
        )}
      </div>
    </AppDrawer>
  );
};

interface BudgetHistoryItemProps {
  budget: {
    id: string;
    name: string;
    isActive: boolean;
    currency: string;
    totalAmount: bigint;
    totalSpent: bigint;
    envelopeCount: number;
    periodStart: Date;
    periodEnd: Date;
  };
  onNavigate: (id: string, isActive: boolean) => void;
  onRestore?: () => void;
  isRestoring?: boolean;
  onDuplicate?: () => void;
  isCurrentlyViewing: boolean;
  toUIDate: (date: Date) => string;
  getCurrencyHelpersCached: (currency: string) => { toUIString: (amount: bigint) => string };
  t: (key: string, opts?: Record<string, unknown>) => string;
}

const BudgetHistoryItem: React.FC<BudgetHistoryItemProps> = ({
  budget,
  onNavigate,
  onRestore,
  isRestoring,
  onDuplicate,
  isCurrentlyViewing,
  toUIDate,
  getCurrencyHelpersCached,
  t,
}) => {
  const { toUIString } = getCurrencyHelpersCached(budget.currency);

  return (
    <div
      className={`rounded-lg border p-3 transition-colors ${
        isCurrentlyViewing ? 'border-primary/50 bg-primary/5' : 'hover:bg-muted/50'
      }`}
    >
      <button className="w-full text-left" onClick={() => onNavigate(budget.id, budget.isActive)}>
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="truncate font-medium">{budget.name}</span>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
              budget.isActive ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
            }`}
          >
            {budget.isActive ? t('budget.active') : t('budget.archived')}
          </span>
        </div>

        <div className="text-muted-foreground mb-1 text-xs">
          {toUIDate(budget.periodStart)} — {toUIDate(budget.periodEnd)}
        </div>

        <div className="flex items-center justify-between text-sm">
          <span>
            {toUIString(budget.totalSpent)}{' '}
            <span className="text-muted-foreground text-xs">
              / {toUIString(budget.totalAmount)}
            </span>
          </span>
          <span className="text-muted-foreground text-xs">
            {t('budget.envelopes_count', { count: budget.envelopeCount })}
          </span>
        </div>
      </button>

      {(onRestore ?? onDuplicate) && (
        <div className="mt-2 flex justify-end gap-2">
          {onRestore && (
            <Button size="sm" variant="outline" onClick={onRestore} disabled={isRestoring}>
              {t('budget.restore_budget')}
            </Button>
          )}
          {onDuplicate && (
            <Button size="sm" variant="outline" onClick={onDuplicate}>
              {t('budget.duplicate')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
