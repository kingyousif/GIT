'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, PlusCircle, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectItem } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { LoadingTable } from '@/components/shared/loading-skeleton';
import { useAppState } from '@/components/app-provider';
import { getJoinedSessions } from '@/lib/queries';
import { PatientSessionJoined } from '@/lib/types';
import { formatDateTime, getProcedureLabel } from '@/lib/utils';
import { useLocale } from '@/hooks/use-locale';

type DateFilter = 'today' | 'upcoming' | 'past' | 'all';

export function AppointmentsPage() {
  const { t } = useLocale();
  const { dataVersion, settings, role } = useAppState();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PatientSessionJoined[]>([]);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [doctor, setDoctor] = useState('all');

  useEffect(() => {
    setLoading(true);
    const timer = window.setTimeout(() => {
      setRows(getJoinedSessions());
      setLoading(false);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [dataVersion]);

  const filtered = useMemo(() => {
    const now = new Date();
    const todayStr = now.toDateString();
    const term = search.trim().toLowerCase();

    return rows
      .filter((item) => {
        const matchesSearch =
          !term ||
          item.patient.fullName.toLowerCase().includes(term) ||
          item.patient.patientCode.toLowerCase().includes(term);
        const matchesDoctor = doctor === 'all' || item.session.doctorName === doctor;

        const sessionDate = new Date(item.session.scheduledAt);
        let matchesDate = true;
        if (dateFilter === 'today') {
          matchesDate = sessionDate.toDateString() === todayStr;
        } else if (dateFilter === 'upcoming') {
          matchesDate = sessionDate > now;
        } else if (dateFilter === 'past') {
          matchesDate = sessionDate < now && sessionDate.toDateString() !== todayStr;
        }

        return matchesSearch && matchesDoctor && matchesDate;
      })
      .sort((a, b) => new Date(a.session.scheduledAt).getTime() - new Date(b.session.scheduledAt).getTime());
  }, [rows, search, dateFilter, doctor]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t.appointments.eyebrow}
        title={t.appointments.title}
        description={t.appointments.description}
        actions={
          (role === 'secretary' || role === 'admin') ? (
            <Link
              href="/patients/new"
              className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90"
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              {t.appointments.newAppointment}
            </Link>
          ) : undefined
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            {t.appointments.filters}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2 xl:col-span-2">
            <Label>{t.common.search}</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder={t.appointments.searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t.appointments.dateFilter}</Label>
            <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilter)}>
              <SelectItem value="today">{t.appointments.today}</SelectItem>
              <SelectItem value="upcoming">{t.appointments.upcoming}</SelectItem>
              <SelectItem value="past">{t.appointments.past}</SelectItem>
              <SelectItem value="all">{t.common.all}</SelectItem>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t.dashboard.doctor}</Label>
            <Select value={doctor} onValueChange={setDoctor}>
              <SelectItem value="all">{t.patientsTable.allDoctors}</SelectItem>
              {settings?.doctors.map((d) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.appointments.list}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingTable />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<CalendarDays className="h-8 w-8" />}
              title={t.appointments.noAppointments}
              description={t.appointments.noAppointmentsDesc}
              action={
                (role === 'secretary' || role === 'admin') ? (
                  <Link
                    href="/patients/new"
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90"
                  >
                    {t.appointments.newAppointment}
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((item) => (
                    <TableRow
                      key={item.session.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => window.location.href = `/patients/${item.session.id}`}
                    >
                      <TableCell className="whitespace-nowrap">{formatDateTime(item.session.scheduledAt)}</TableCell>
                      <TableCell className="font-medium">{item.patient.fullName}</TableCell>
                      <TableCell>{item.patient.patientCode}</TableCell>
                      <TableCell>{getProcedureLabel(item.session.procedureType)}</TableCell>
                      <TableCell>{item.session.doctorName}</TableCell>
                      <TableCell>
                        <StatusBadge status={item.session.status} />
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
