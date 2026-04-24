import { ChevronLeft, History, PlusIcon, Settings } from 'lucide-react';
import { type GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { BudgetEmptyState } from '~/components/Budget/BudgetEmptyState';
import { BudgetHistoryDrawer } from '~/components/Budget/BudgetHistoryDrawer';
import { BudgetOverview } from '~/components/Budget/BudgetOverview';
import { EnvelopeGrid } from '~/components/Budget/EnvelopeGrid';
import { AddChargeDrawer } from '~/components/Budget/AddChargeDrawer';
import MainLayout from '~/components/Layout/MainLayout';
import { Button } from '~/components/ui/button';
import { useTranslationWithUtils } from '~/hooks/useTranslationWithUtils';
import { type NextPageWithUser } from '~/types';
import { api } from '~/utils/api';
import { customServerSideTranslations } from '~/utils/i18n/server';

const BudgetPage: NextPageWithUser = () => {
  const { t } = useTranslationWithUtils();
  const router = useRouter();
  const groupId = parseInt(router.query.groupId as string);
  const budgetId = Array.isArray(router.query.id) ? router.query.id[0] : router.query.id;

  const activeQuery = api.budget.getActive.useQuery({ groupId }, { enabled: !budgetId });
  const byIdQuery = api.budget.getById.useQuery(
    { groupId, budgetId: budgetId ?? '' },
    { enabled: Boolean(budgetId), retry: false },
  );
  const utils = api.useUtils();

  // Redirect to base budget page if the given id is not found or forbidden
  useEffect(() => {
    if (byIdQuery.error) {
      void router.replace(`/groups/${groupId}/budget`);
    }
  }, [byIdQuery.error, groupId, router]);

  const budget = budgetId ? byIdQuery.data : activeQuery.data;
  const isLoading = budgetId ? byIdQuery.isPending : activeQuery.isPending;
  const isArchived = budget?.isActive === false;

  return (
    <>
      <Head>
        <title>
          {t('budget.title')} | {t('group_details.title')}
        </title>
      </Head>
      <MainLayout
        title={
          <div className="flex items-center">
            <Button
              variant="ghost"
              onClick={() => router.replace(`/groups/${groupId}`)}
              className="mr-2 p-0"
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <p className="text-lg">{t('budget.title')}</p>
          </div>
        }
        actions={
          budget && !isArchived ? (
            <div className="flex gap-2">
              <Link href={`/groups/${groupId}/budget/new?edit=${budget.id}`}>
                <Settings className="h-5 w-5 text-gray-400" />
              </Link>
            </div>
          ) : undefined
        }
        loading={isLoading}
      >
        {!budget ? (
          <BudgetEmptyState groupId={groupId} />
        ) : (
          <div>
            {isArchived && (
              <div className="mb-4 flex items-center gap-2 rounded border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm">
                <span className="flex-1 text-yellow-700 dark:text-yellow-300">
                  {t('budget.viewing_archived')}
                </span>
                <Link
                  href={`/groups/${groupId}/budget`}
                  className="text-primary shrink-0 font-medium underline-offset-2 hover:underline"
                >
                  {t('budget.view_current')}
                </Link>
              </div>
            )}

            <BudgetOverview
              name={budget.name}
              currency={budget.currency}
              totalAmount={budget.totalAmount}
              totalSpent={budget.totalSpent}
              totalAllocated={budget.totalAllocated}
              unallocated={budget.unallocated}
              periodStart={budget.periodStart}
              periodEnd={budget.periodEnd}
            />

            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">{t('budget.envelopes')}</h3>
              <div className="flex items-center gap-1">
                <BudgetHistoryDrawer
                  groupId={groupId}
                  trigger={
                    <Button size="icon" variant="ghost" aria-label={t('budget.budget_history')}>
                      <History className="h-4 w-4" />
                    </Button>
                  }
                />
                {!isArchived && (
                  <Link href={`/groups/${groupId}/budget/new`}>
                    <Button size="sm" variant="outline" className="gap-1">
                      <PlusIcon className="h-4 w-4" />
                      {t('budget.new_budget')}
                    </Button>
                  </Link>
                )}
              </div>
            </div>

            <EnvelopeGrid
              envelopes={budget.envelopes}
              currency={budget.currency}
              groupId={groupId}
            />

            {!isArchived && budget.envelopes.length > 0 && (
              <div className="mt-4">
                <AddChargeDrawer
                  envelopeId={budget.envelopes[0]!.id}
                  envelopeName={budget.envelopes[0]!.name}
                  currency={budget.currency}
                  onSuccess={() => utils.budget.getActive.invalidate({ groupId })}
                >
                  <Button className="w-full gap-2">
                    <PlusIcon className="h-4 w-4" />
                    {t('budget.quick_add_charge')}
                  </Button>
                </AddChargeDrawer>
              </div>
            )}
          </div>
        )}
      </MainLayout>
    </>
  );
};

BudgetPage.auth = true;

export default BudgetPage;

export const getServerSideProps: GetServerSideProps = async (context) => ({
  props: {
    ...(await customServerSideTranslations(context.locale, ['common', 'currencies'])),
  },
});
