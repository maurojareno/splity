import { ChevronLeft, PlusIcon, Trash2 } from 'lucide-react';
import { type GetServerSideProps } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import React, { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { CurrencyPicker } from '~/components/AddExpense/CurrencyPicker';
import MainLayout from '~/components/Layout/MainLayout';
import { Button } from '~/components/ui/button';
import { CurrencyInput } from '~/components/ui/currency-input';
import { Input } from '~/components/ui/input';
import { type CurrencyCode } from '~/lib/currency';
import { useTranslationWithUtils } from '~/hooks/useTranslationWithUtils';
import { type NextPageWithUser } from '~/types';
import { api } from '~/utils/api';
import { customServerSideTranslations } from '~/utils/i18n/server';

interface EnvelopeFormData {
  name: string;
  allocatedAmountStr: string;
  allocatedAmount: bigint;
  icon: string;
  color: string;
}

const ENVELOPE_PRESETS = [
  { icon: '\u{1F3E0}', name: '' },
  { icon: '\u{1F6D2}', name: '' },
  { icon: '\u{1F697}', name: '' },
  { icon: '\u{1F3AD}', name: '' },
  { icon: '\u{1F436}', name: '' },
  { icon: '\u{1F4A1}', name: '' },
  { icon: '\u{1F4B0}', name: '' },
  { icon: '\u{2764}\u{FE0F}', name: '' },
];

const NewBudgetPage: NextPageWithUser = () => {
  const { t, getCurrencyHelpersCached } = useTranslationWithUtils();
  const router = useRouter();
  const groupId = parseInt(router.query.groupId as string);
  const editId = router.query.edit as string | undefined;

  const groupDetailQuery = api.group.getGroupDetails.useQuery({ groupId });
  const editBudgetQuery = api.budget.getActive.useQuery({ groupId }, { enabled: Boolean(editId) });

  const createBudgetMutation = api.budget.create.useMutation();
  const updateBudgetMutation = api.budget.update.useMutation();

  const defaultCurrency = groupDetailQuery.data?.defaultCurrency ?? 'EUR';

  const [name, setName] = useState('');
  const [totalAmountStr, setTotalAmountStr] = useState('');
  const [totalAmount, setTotalAmount] = useState(0n);
  const [currency, setCurrency] = useState(defaultCurrency);
  const currencyHelpers = getCurrencyHelpersCached(currency);
  const [periodStart, setPeriodStart] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]!;
  });
  const [periodEnd, setPeriodEnd] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]!;
  });

  const [envelopes, setEnvelopes] = useState<EnvelopeFormData[]>([
    { name: '', allocatedAmountStr: '', allocatedAmount: 0n, icon: '\u{1F3E0}', color: '' },
  ]);

  // Populate form when editing
  React.useEffect(() => {
    if (editBudgetQuery.data && editId) {
      const b = editBudgetQuery.data;
      setName(b.name);
      setTotalAmount(b.totalAmount);
      setTotalAmountStr(currencyHelpers.toUIString(b.totalAmount, false, true));
      setCurrency(b.currency);
      setPeriodStart(b.periodStart.toISOString().split('T')[0]!);
      setPeriodEnd(b.periodEnd.toISOString().split('T')[0]!);
      setEnvelopes(
        b.envelopes.map((e) => ({
          name: e.name,
          allocatedAmountStr: currencyHelpers.toUIString(e.allocatedAmount, false, true),
          allocatedAmount: e.allocatedAmount,
          icon: e.icon ?? '',
          color: e.color ?? '',
        })),
      );
    }
  }, [editBudgetQuery.data, editId, currencyHelpers]);

  React.useEffect(() => {
    if (groupDetailQuery.data?.defaultCurrency) {
      setCurrency(groupDetailQuery.data.defaultCurrency);
    }
  }, [groupDetailQuery.data?.defaultCurrency]);

  const envelopeSum = envelopes.reduce((sum, e) => sum + e.allocatedAmount, 0n);
  const unallocated = totalAmount - envelopeSum;
  const isOverAllocated = envelopeSum > totalAmount && totalAmount > 0n;

  const addEnvelope = useCallback(() => {
    setEnvelopes((prev) => [
      ...prev,
      { name: '', allocatedAmountStr: '', allocatedAmount: 0n, icon: '', color: '' },
    ]);
  }, []);

  const removeEnvelope = useCallback((index: number) => {
    setEnvelopes((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateEnvelope = useCallback((index: number, field: keyof EnvelopeFormData, value: any) => {
    setEnvelopes((prev) => prev.map((e, i) => (i === index ? { ...e, [field]: value } : e)));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!name || totalAmount <= 0n) {
      return;
    }

    const validEnvelopes = envelopes.filter((e) => e.name && e.allocatedAmount > 0n);

    try {
      if (editId) {
        await updateBudgetMutation.mutateAsync({
          groupId,
          budgetId: editId,
          name,
          totalAmount,
          periodStart: new Date(periodStart),
          periodEnd: new Date(periodEnd),
        });
        toast.success(t('budget.budget_updated'));
      } else {
        await createBudgetMutation.mutateAsync({
          groupId,
          name,
          totalAmount,
          currency,
          periodStart: new Date(periodStart),
          periodEnd: new Date(periodEnd),
          envelopes: validEnvelopes.map((e) => ({
            name: e.name,
            allocatedAmount: e.allocatedAmount,
            icon: e.icon || undefined,
            color: e.color || undefined,
          })),
        });
        toast.success(t('budget.budget_created'));
      }

      router.push(`/groups/${groupId}/budget`).catch(console.error);
    } catch (error) {
      console.error(error);
      toast.error(t('errors.something_went_wrong'));
    }
  }, [
    name,
    totalAmount,
    currency,
    periodStart,
    periodEnd,
    envelopes,
    groupId,
    editId,
    createBudgetMutation,
    updateBudgetMutation,
    router,
    t,
  ]);

  const setThisMonth = useCallback(() => {
    const now = new Date();
    setPeriodStart(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]!);
    setPeriodEnd(new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]!);
  }, []);

  return (
    <>
      <Head>
        <title>
          {editId ? t('budget.edit_budget') : t('budget.create_budget')} | {t('budget.title')}
        </title>
      </Head>
      <MainLayout
        title={
          <div className="flex items-center">
            <Button variant="ghost" onClick={() => router.back()} className="mr-2 p-0">
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <p className="text-lg">
              {editId ? t('budget.edit_budget') : t('budget.create_budget')}
            </p>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm text-gray-400">{t('budget.budget_name')}</label>
            <Input
              placeholder={t('budget.budget_name_placeholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-gray-400">{t('budget.total_amount')}</label>
            <div className="flex gap-2">
              <CurrencyPicker
                currentCurrency={currency as CurrencyCode}
                onCurrencyPick={(c) => setCurrency(c)}
              />
              <CurrencyInput
                placeholder={t('expense_details.add_expense_details.amount_placeholder')}
                currency={currency}
                strValue={totalAmountStr}
                onValueChange={({ strValue, bigIntValue }) => {
                  if (strValue !== undefined) {
                    setTotalAmountStr(strValue);
                  }
                  if (bigIntValue !== undefined) {
                    setTotalAmount(bigIntValue);
                  }
                }}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-sm text-gray-400">{t('budget.period_start')}</label>
              <Input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-sm text-gray-400">{t('budget.period_end')}</label>
              <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
            </div>
            <Button variant="outline" size="sm" className="mt-6" onClick={setThisMonth}>
              {t('budget.this_month')}
            </Button>
          </div>

          {!editId && (
            <>
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium">{t('budget.envelopes')}</label>
                  {totalAmount > 0n && (
                    <span
                      className={`text-sm ${isOverAllocated ? 'text-red-500' : 'text-gray-400'}`}
                    >
                      {t('budget.unallocated')}: {currencyHelpers.toUIString(unallocated)}
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-3">
                  {envelopes.map((envelope, index) => (
                    <div key={index} className="flex items-start gap-2 rounded-lg border p-3">
                      <div className="flex flex-wrap items-center gap-1">
                        {ENVELOPE_PRESETS.map((preset) => (
                          <button
                            key={preset.icon}
                            type="button"
                            onClick={() => updateEnvelope(index, 'icon', preset.icon)}
                            className={`rounded p-1 text-lg ${
                              envelope.icon === preset.icon
                                ? 'bg-primary/20 ring-primary ring-1'
                                : 'hover:bg-gray-800'
                            }`}
                          >
                            {preset.icon}
                          </button>
                        ))}
                      </div>
                      <div className="flex flex-1 flex-col gap-2">
                        <Input
                          placeholder={t('budget.envelope_name_placeholder')}
                          value={envelope.name}
                          onChange={(e) => updateEnvelope(index, 'name', e.target.value)}
                        />
                        <CurrencyInput
                          placeholder={t('budget.allocated_amount')}
                          currency={currency}
                          strValue={envelope.allocatedAmountStr}
                          onValueChange={({ strValue, bigIntValue }) => {
                            if (strValue !== undefined) {
                              updateEnvelope(index, 'allocatedAmountStr', strValue);
                            }
                            if (bigIntValue !== undefined) {
                              updateEnvelope(index, 'allocatedAmount', bigIntValue);
                            }
                          }}
                        />
                      </div>
                      {envelopes.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-1 text-red-500 hover:text-red-400"
                          onClick={() => removeEnvelope(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                <Button variant="outline" className="mt-3 w-full gap-2" onClick={addEnvelope}>
                  <PlusIcon className="h-4 w-4" />
                  {t('budget.add_envelope')}
                </Button>
              </div>
            </>
          )}

          <Button
            className="mt-4"
            onClick={handleSubmit}
            disabled={
              !name ||
              totalAmount <= 0n ||
              isOverAllocated ||
              createBudgetMutation.isPending ||
              updateBudgetMutation.isPending
            }
            loading={createBudgetMutation.isPending || updateBudgetMutation.isPending}
          >
            {editId ? t('actions.save') : t('budget.create_budget')}
          </Button>
        </div>
      </MainLayout>
    </>
  );
};

NewBudgetPage.auth = true;

export default NewBudgetPage;

export const getServerSideProps: GetServerSideProps = async (context) => ({
  props: {
    ...(await customServerSideTranslations(context.locale, ['common', 'currencies'])),
  },
});
