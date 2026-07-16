'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, FileText, PlusCircle, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { LoadingCardGrid, LoadingTable } from '@/components/shared/loading-skeleton';
import { getDashboardStats, getJoinedSessions } from '@/lib/queries';
import { formatDateTime, getProcedureLabel, isTodayIso } from '@/lib/utils';
import { PatientSessionJoined } from '@/lib/types';
import { useAppState } from '@/components/app-provider';
import { useLocale } from '@/hooks/use-locale';

export function DashboardPage() {
  const { t } = useLocale();
  const { dataVersion, role } = useAppState();
  const [loading, setLoading] = useState(true);
  const [todayItems, setTodayItems] = useState<PatientSessionJoined[]>([]);
  const [stats, setStats] = useState({ todayTotalPatients: 0, completedToday: 0, waitingNow: 0, monthTotal: 0 });

  useEffect(() => {
    setLoading(true);
    const timer = window.setTimeout(() => {
      const joined = getJoinedSessions()
        .filter((item) => isTodayIso(item.session.scheduledAt))
        .sort((a, b) => new Date(a.session.scheduledAt).getTime() - new Date(b.session.scheduledAt).getTime());
      setTodayItems(joined);
      setStats(getDashboardStats());
      setLoading(false);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [dataVersion]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t.dashboard.eyebrow}
        title={t.dashboard.title}
        description={t.dashboard.description}
        actions={
          <>
            {(role === 'secretary' || role === 'admin') && (
              <Link href="/patients/new" className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90">
                <PlusCircle className="mr-2 h-4 w-4" />
                {t.dashboard.newPatient}
              </Link>
            )}
            <Link href="/patients" className="inline-flex h-10 items-center justify-center rounded-xl border border-card-border bg-card px-4 text-sm font-medium text-foreground transition hover:bg-muted">
              <Users className="mr-2 h-4 w-4" />
              {t.dashboard.viewAll}
            </Link>
            {(role === 'doctor' || role === 'admin') && (
              <Link href="/reports" className="inline-flex h-10 items-center justify-center rounded-xl border border-card-border bg-card px-4 text-sm font-medium text-foreground transition hover:bg-muted">
                <FileText className="mr-2 h-4 w-4" />
                {t.reports.title}
              </Link>
            )}
          </>
        }
      />

      {loading ? (
        <LoadingCardGrid />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: t.dashboard.todayTotalPatients, value: stats.todayTotalPatients },
            { label: t.dashboard.completedToday, value: stats.completedToday },
            { label: t.dashboard.waitingNow, value: stats.waitingNow },
            { label: t.dashboard.monthTotal, value: stats.monthTotal },
          ].map((item) => (
            <Card key={item.label}>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">{item.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold text-foreground">{item.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t.dashboard.todayProcedureList}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingTable />
          ) : todayItems.length === 0 ? (
            <EmptyState
              icon={<CalendarPlaceholder />}
              title={t.dashboard.noProcedures}
              description={t.dashboard.noProceduresDesc}
              action={
                (role === 'secretary' || role === 'admin') ? (
                  <Link href="/patients/new" className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90">
                    {t.dashboard.registerPatient}
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.dashboard.time}</TableHead>
                    <TableHead>{t.dashboard.patientName}</TableHead>
                    <TableHead>{t.dashboard.code}</TableHead>
                    <TableHead>{t.dashboard.procedure}</TableHead>
                    <TableHead>{t.dashboard.doctor}</TableHead>
                    <TableHead>{t.common.status}</TableHead>
                    <TableHead>{t.common.actions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {todayItems.map((item) => (
                    <TableRow key={item.session.id}>
                      <TableCell>{formatDateTime(item.session.scheduledAt, 'p')}</TableCell>
                      <TableCell className="font-medium">{item.patient.fullName}</TableCell>
                      <TableCell>{item.patient.patientCode}</TableCell>
                      <TableCell>{getProcedureLabel(item.session.procedureType)}</TableCell>
                      <TableCell>{item.session.doctorName}</TableCell>
                      <TableCell>
                        <StatusBadge status={item.session.status} />
                      </TableCell>
                      <TableCell>
                        <Link href={`/patients/${item.session.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                          {t.common.open}
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CalendarPlaceholder() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-8 w-8">
      <rect x="6" y="10" width="36" height="30" rx="6" fill="currentColor" fillOpacity="0.1" stroke="currentColor" strokeWidth="2" />
      <path d="M6 18H42" stroke="currentColor" strokeWidth="2" />
      <path d="M16 6V14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M32 6V14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="17" cy="27" r="2" fill="currentColor" />
      <circle cx="24" cy="27" r="2" fill="currentColor" />
      <circle cx="31" cy="27" r="2" fill="currentColor" />
    </svg>
  );
}
