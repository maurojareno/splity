import React from 'react';
import { EnvelopeCard } from './EnvelopeCard';

interface EnvelopeData {
  id: string;
  name: string;
  icon?: string | null;
  color?: string | null;
  allocatedAmount: bigint;
  spent: bigint;
  remaining: bigint;
}

interface EnvelopeGridProps {
  envelopes: EnvelopeData[];
  currency: string;
  groupId: number;
}

export const EnvelopeGrid: React.FC<EnvelopeGridProps> = ({ envelopes, currency, groupId }) => (
  <div className="grid gap-3 sm:grid-cols-2">
    {envelopes.map((envelope) => (
      <EnvelopeCard key={envelope.id} {...envelope} currency={currency} groupId={groupId} />
    ))}
  </div>
);
