'use client';

import { ShieldAlert } from 'lucide-react';
import { useAppState } from '@/components/app-provider';
import { EmptyState } from '@/components/shared/empty-state';
import { ROLE_META } from '@/lib/constants';
import { Role } from '@/lib/types';
import { useLocale } from '@/hooks/use-locale';

export function AccessGuard({
  allowed,
  children,
}: {
  allowed: Role[];
  children: React.ReactNode;
}) {
  const { t } = useLocale();
  const { role } = useAppState();

  if (!role || allowed.includes(role)) {
    return <>{children}</>;
  }

  return (
    <EmptyState
      icon={<ShieldAlert className="h-8 w-8" />}
      title={t.accessGuard.restricted}
      description={`${t.accessGuard.restrictedDesc} ${allowed.map((item) => ROLE_META[item].label).join(', ')}.`}
    />
  );
}
