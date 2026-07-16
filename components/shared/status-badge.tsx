'use client';

import { Badge } from '@/components/ui/badge';
import { getStatusMeta } from '@/lib/utils';
import { ProcedureSession } from '@/lib/types';
import { useLocale } from '@/hooks/use-locale';

const STATUS_LABEL_KEYS: Record<string, 'waiting' | 'inProgress' | 'completed' | 'cancelled'> = {
  waiting: 'waiting',
  'in-progress': 'inProgress',
  completed: 'completed',
  cancelled: 'cancelled',
};

export function StatusBadge({ status }: { status: ProcedureSession['status'] }) {
  const { t } = useLocale();
  const meta = getStatusMeta(status);
  const label = t.statuses[STATUS_LABEL_KEYS[status] ?? 'waiting'] || meta.label;
  return <Badge className={meta.className}>{label}</Badge>;
}
