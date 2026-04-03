import React, { useCallback, useState } from 'react';
import { useTranslation } from 'next-i18next';
import { toast } from 'sonner';
import { AppDrawer } from '~/components/ui/drawer';
import { CurrencyInput } from '~/components/ui/currency-input';
import { Input } from '~/components/ui/input';
import { Button } from '~/components/ui/button';
import { api } from '~/utils/api';

interface AddChargeDrawerProps {
  envelopeId: string;
  envelopeName: string;
  currency: string;
  children: React.ReactNode;
  onSuccess?: () => void;
}

export const AddChargeDrawer: React.FC<AddChargeDrawerProps> = ({
  envelopeId,
  envelopeName,
  currency,
  children,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [amountStr, setAmountStr] = useState('');
  const [amount, setAmount] = useState(0n);
  const [description, setDescription] = useState('');

  const chargeMutation = api.envelope.charge.useMutation();

  const handleSubmit = useCallback(async () => {
    if (!amount || amount <= 0n || !description) {
      return;
    }

    try {
      await chargeMutation.mutateAsync({
        envelopeId,
        amount,
        description,
      });
      toast.success(t('budget.charge_added'));
      setAmountStr('');
      setAmount(0n);
      setDescription('');
      setOpen(false);
      onSuccess?.();
    } catch (error) {
      console.error(error);
      toast.error(t('errors.something_went_wrong'));
    }
  }, [amount, description, envelopeId, chargeMutation, t, onSuccess]);

  return (
    <AppDrawer
      trigger={children}
      title={`${t('budget.add_charge_to')} ${envelopeName}`}
      open={open}
      onOpenChange={setOpen}
    >
      <div className="flex flex-col gap-4">
        <Input
          placeholder={t('budget.charge_description_placeholder')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          autoFocus
        />
        <CurrencyInput
          placeholder={t('expense_details.add_expense_details.amount_placeholder')}
          currency={currency}
          strValue={amountStr}
          onValueChange={({ strValue, bigIntValue }) => {
            if (strValue !== undefined) {
              setAmountStr(strValue);
            }
            if (bigIntValue !== undefined) {
              setAmount(bigIntValue);
            }
          }}
        />
        <Button
          onClick={handleSubmit}
          disabled={chargeMutation.isPending || !amount || !description}
          loading={chargeMutation.isPending}
        >
          {t('actions.save')}
        </Button>
      </div>
    </AppDrawer>
  );
};
