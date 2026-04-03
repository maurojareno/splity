import { ChevronLeft, PlusIcon, Settings } from 'lucide-react';
import { type GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { BudgetEmptyState } from '~/components/Budget/BudgetEmptyState';
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

  const budgetQuery = api.budget.getActive.useQuery({ groupId });
  const utils = api.useUtils();

  const budget = budgetQuery.data;

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
          budget && (
            <div className="flex gap-2">
              <Link href={`/groups/${groupId}/budget/new?edit=${budget.id}`}>
                <Settings className="h-5 w-5 text-gray-400" />
              </Link>
            </div>
          )
        }
        loading={budgetQuery.isPending}
      >
        {!budget ? (
          <BudgetEmptyState groupId={groupId} />
        ) : (
          <div>
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
              <Link href={`/groups/${groupId}/budget/new`}>
                <Button size="sm" variant="outline" className="gap-1">
                  <PlusIcon className="h-4 w-4" />
                  {t('budget.new_budget')}
                </Button>
              </Link>
            </div>

            <EnvelopeGrid
              envelopes={budget.envelopes}
              currency={budget.currency}
              groupId={groupId}
            />

            {budget.envelopes.length > 0 && (
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
