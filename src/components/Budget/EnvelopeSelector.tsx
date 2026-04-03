import React from 'react';
import { useTranslation } from 'next-i18next';
import { PiggyBank } from 'lucide-react';
import { api } from '~/utils/api';
import { useTranslationWithUtils } from '~/hooks/useTranslationWithUtils';

interface EnvelopeSelectorProps {
  groupId: number | undefined;
  selectedEnvelopeId: string | null;
  onSelect: (envelopeId: string | null) => void;
}

export const EnvelopeSelector: React.FC<EnvelopeSelectorProps> = ({
  groupId,
  selectedEnvelopeId,
  onSelect,
}) => {
  const { t, getCurrencyHelpersCached } = useTranslationWithUtils();

  const budgetQuery = api.budget.getActive.useQuery(
    { groupId: groupId! },
    { enabled: Boolean(groupId) },
  );

  const budget = budgetQuery.data;

  if (!groupId || !budget || budget.envelopes.length === 0) {
    return null;
  }

  const { toUIString } = getCurrencyHelpersCached(budget.currency);

  return (
    <div className="flex items-center gap-2">
      <PiggyBank className="h-5 w-5 shrink-0 text-gray-400" />
      <select
        value={selectedEnvelopeId ?? ''}
        onChange={(e) => onSelect(e.target.value || null)}
        className="bg-background flex-1 rounded-md border px-3 py-2 text-sm"
      >
        <option value="">{t('budget.no_envelope')}</option>
        {budget.envelopes.map((envelope) => (
          <option key={envelope.id} value={envelope.id}>
            {envelope.icon ? `${envelope.icon} ` : ''}
            {envelope.name} ({toUIString(envelope.remaining)} {t('budget.remaining_short')})
          </option>
        ))}
      </select>
    </div>
  );
};
