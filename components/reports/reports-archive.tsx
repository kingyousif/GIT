'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectItem } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/shared/empty-state';
import { LoadingTable } from '@/components/shared/loading-skeleton';
import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { useAppState } from '@/components/app-provider';
import { exportAllData, getJoinedSessions, getReports } from '@/lib/queries';
import { downloadJson, formatDateTime, getProcedureLabel } from '@/lib/utils';
import { useLocale } from '@/hooks/use-locale';

export function ReportsArchive() {
  const { t } = useLocale();
  const { dataVersion, settings } = useAppState();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ReturnType<typeof getJoinedSessions>>([]);
  const [search, setSearch] = useState('');
  const [doctor, setDoctor] = useState('all');
  const [procedure, setProcedure] = useState('all');
  const [status, setStatus] = useState<'all' | 'draft' | 'final'>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  useEffect(() => {
    setLoading(true);
    const timer = window.setTimeout(() => {
      const reports = getReports();
      const joined = getJoinedSessions().filter((item) => reports.some((report) => report.sessionId === item.session.id));
      setRows(joined);
      setLoading(false);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [dataVersion]);

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    return rows.filter((item) => {
      const diagnosisText = item.report?.diagnosis.join(' ').toLowerCase() ?? '';
      const matchesSearch = !term || item.patient.fullName.toLowerCase().includes(term) || diagnosisText.includes(term);
      const matchesDoctor = doctor === 'all' || item.session.doctorName === doctor;
      const matchesProcedure = procedure === 'all' || item.session.procedureType === procedure;
      const matchesStatus = status === 'all' || item.report?.status === status;
      const date = new Date(item.session.scheduledAt);
      const matchesFrom = !fromDate || date >= new Date(fromDate);
      const matchesTo = !toDate || date <= new Date(`${toDate}T23:59:59`);
      return matchesSearch && matchesDoctor && matchesProcedure && matchesStatus && matchesFrom && matchesTo;
    });
  }, [doctor, fromDate, procedure, rows, search, status, toDate]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t.reports.eyebrow}
        title={t.reports.title}
        description={t.reports.description}
        actions={
          <Button variant="outline" onClick={async () => downloadJson('endo-backup.json', await exportAllData())}>
            <Download className="h-4 w-4" /> {t.reports.exportJson}
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>{t.reports.filters}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <div className="space-y-2 xl:col-span-2">
            <Label>{t.common.search}</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input className="pl-9" placeholder={t.reports.searchPlaceholder} value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t.dashboard.doctor}</Label>
            <Select value={doctor} onValueChange={setDoctor}>
              <SelectItem value="all">{t.reports.allDoctors}</SelectItem>
              {settings?.doctors.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t.dashboard.procedure}</Label>
            <Select value={procedure} onValueChange={setProcedure}>
              <SelectItem value="all">{t.reports.allProcedures}</SelectItem>
              {settings?.procedures.map((proc) => (
                <SelectItem key={proc.id} value={proc.id}>
                  {proc.label}
                </SelectItem>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t.common.status}</Label>
            <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
              <SelectItem value="all">{t.common.all}</SelectItem>
              <SelectItem value="draft">{t.reports.draft}</SelectItem>
              <SelectItem value="final">{t.reports.final}</SelectItem>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t.common.from}</Label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t.common.to}</Label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.reports.archivedReports}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingTable />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Search className="h-8 w-8" />}
              title={t.reports.noReports}
              description={t.reports.noReportsDesc}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.common.date}</TableHead>
                    <TableHead>{t.reports.patient}</TableHead>
                    <TableHead>{t.dashboard.procedure}</TableHead>
                    <TableHead>{t.dashboard.doctor}</TableHead>
                    <TableHead>{t.reports.diagnosis}</TableHead>
                    <TableHead>{t.common.status}</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((item) => (
                    <TableRow key={item.session.id}>
                      <TableCell>{formatDateTime(item.session.scheduledAt)}</TableCell>
                      <TableCell className="font-medium">{item.patient.fullName}</TableCell>
                      <TableCell>{getProcedureLabel(item.session.procedureType)}</TableCell>
                      <TableCell>{item.session.doctorName}</TableCell>
                      <TableCell>{item.report?.diagnosis.join(', ') || '—'}</TableCell>
                      <TableCell>
                        <Badge variant={item.report?.status === 'final' ? 'success' : 'warning'}>{item.report?.status ?? '—'}</Badge>
                      </TableCell>
                      <TableCell>
                        <Link href={`/patients/${item.session.id}?tab=report`} className="text-sm font-medium text-primary">
                          {t.reports.viewEdit}
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
