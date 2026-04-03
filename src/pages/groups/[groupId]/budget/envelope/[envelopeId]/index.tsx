import { ChevronLeft, PlusIcon, Trash2 } from 'lucide-react';
import { type GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useCallback } from 'react';
import { toast } from 'sonner';
import { AddChargeDrawer } from '~/components/Budget/AddChargeDrawer';
import MainLayout from '~/components/Layout/MainLayout';
import { EntityAvatar } from '~/components/ui/avatar';
import { Button } from '~/components/ui/button';
import { Progress } from '~/components/ui/progress';
import { SimpleConfirmationDialog } from '~/components/SimpleConfirmationDialog';
import { useTranslationWithUtils } from '~/hooks/useTranslationWithUtils';
import { type NextPageWithUser } from '~/types';
import { api } from '~/utils/api';
import { customServerSideTranslations } from '~/utils/i18n/server';

const EnvelopeDetailPage: NextPageWithUser = () => {
  const { t, toUIDate, getCurrencyHelpersCached, displayName } = useTranslationWithUtils();
  const router = useRouter();
  const groupId = parseInt(router.query.groupId as string);
  const envelopeId = router.query.envelopeId as string;

  const summaryQuery = api.envelope.getSummary.useQuery({ envelopeId });
  const chargesQuery = api.envelope.getCharges.useQuery({ envelopeId, limit: 50 });
  const deleteChargeMutation = api.envelope.deleteCharge.useMutation();
  const utils = api.useUtils();

  const summary = summaryQuery.data;
  const currency = summary?.currency ?? 'EUR';
  const { toUIString } = getCurrencyHelpersCached(currency);

  const spentPercent =
    summary && summary.allocatedAmount > 0n
      ? Number((summary.spent * 100n) / summary.allocatedAmount)
      : 0;

  const handleDeleteCharge = useCallback(
    async (chargeId: string) => {
      try {
        await deleteChargeMutation.mutateAsync({ chargeId });
        toast.success(t('budget.charge_deleted'));
        await Promise.all([
          utils.envelope.getSummary.invalidate({ envelopeId }),
          utils.envelope.getCharges.invalidate({ envelopeId }),
        ]);
      } catch (error) {
        console.error(error);
        toast.error(t('errors.something_went_wrong'));
      }
    },
    [deleteChargeMutation, envelopeId, utils, t],
  );

  const refreshData = useCallback(() => {
    utils.envelope.getSummary.invalidate({ envelopeId }).catch(console.error);
    utils.envelope.getCharges.invalidate({ envelopeId }).catch(console.error);
  }, [utils, envelopeId]);

  return (
    <>
      <Head>
        <title>
          {summary?.name ?? t('budget.envelope')} | {t('budget.title')}
        </title>
      </Head>
      <MainLayout
        title={
          <div className="flex items-center">
            <Button
              variant="ghost"
              onClick={() => router.replace(`/groups/${groupId}/budget`)}
              className="mr-2 p-0"
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <p className="text-lg">{summary?.name ?? t('budget.envelope')}</p>
          </div>
        }
        loading={summaryQuery.isPending}
      >
        {summary && (
          <div>
            {/* Summary header */}
            <div className="mb-6 rounded-lg border p-4">
              <div className="mb-3 flex items-baseline justify-between">
                <span className="text-2xl font-bold">{toUIString(summary.remaining)}</span>
                <span className="text-sm text-gray-400">{t('budget.remaining')}</span>
              </div>

              <Progress value={spentPercent} className="mb-3 h-4" />

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-400">{t('budget.spent')}</p>
                  <p className="font-medium">{toUIString(summary.spent)}</p>
                </div>
                <div>
                  <p className="text-gray-400">{t('budget.allocated')}</p>
                  <p className="font-medium">{toUIString(summary.allocatedAmount)}</p>
                </div>
                <div>
                  <p className="text-gray-400">{t('budget.daily_average')}</p>
                  <p className="font-medium">{toUIString(summary.dailyAverage)}</p>
                </div>
                <div>
                  <p className="text-gray-400">{t('budget.projected_total')}</p>
                  <p className="font-medium">{toUIString(summary.projectedTotal)}</p>
                </div>
              </div>
            </div>

            {/* Quick add charge */}
            <AddChargeDrawer
              envelopeId={envelopeId}
              envelopeName={summary.name}
              currency={currency}
              onSuccess={refreshData}
            >
              <Button className="mb-4 w-full gap-2">
                <PlusIcon className="h-4 w-4" />
                {t('budget.add_charge')}
              </Button>
            </AddChargeDrawer>

            {/* Charges list */}
            <h3 className="mb-3 font-semibold">{t('budget.charge_history')}</h3>
            {chargesQuery.data?.charges.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">{t('budget.no_charges_yet')}</p>
            ) : (
              <div className="flex flex-col gap-2">
                {chargesQuery.data?.charges.map((charge) => (
                  <div
                    key={charge.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <EntityAvatar entity={charge.creator} size={32} />
                      <div>
                        <p className="font-medium">{charge.description}</p>
                        <p className="text-xs text-gray-400">
                          {displayName(charge.creator)} &middot; {toUIDate(charge.date)}
                        </p>
                        {charge.expenseId && (
                          <Link
                            href={`/groups/${groupId}/expenses/${charge.expenseId}`}
                            className="text-primary text-xs hover:underline"
                          >
                            {t('budget.view_expense')}
                          </Link>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{toUIString(charge.amount)}</span>
                      <SimpleConfirmationDialog
                        title={t('budget.delete_charge_title')}
                        description={t('budget.delete_charge_description')}
                        hasPermission
                        onConfirm={() => handleDeleteCharge(charge.id)}
                        loading={deleteChargeMutation.isPending}
                        variant="destructive"
                      >
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </SimpleConfirmationDialog>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </MainLayout>
    </>
  );
};

EnvelopeDetailPage.auth = true;

export default EnvelopeDetailPage;

export const getServerSideProps: GetServerSideProps = async (context) => ({
  props: {
    ...(await customServerSideTranslations(context.locale, ['common', 'currencies'])),
  },
});
