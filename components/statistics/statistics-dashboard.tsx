'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { useAppState } from '@/components/app-provider';
import { getReports, getSessions } from '@/lib/queries';
import { getProcedureLabel } from '@/lib/utils';
import { useLocale } from '@/hooks/use-locale';

const palette = ['#0F766E', '#2563EB', '#CA8A04', '#DC2626', '#7C3AED', '#0891B2'];

export function StatisticsDashboard() {
  const { t } = useLocale();
  const { dataVersion } = useAppState();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [sessions, setSessions] = useState(getSessions());
  const [reports, setReports] = useState(getReports());

  useEffect(() => {
    setSessions(getSessions());
    setReports(getReports());
  }, [dataVersion]);

  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      const date = new Date(session.scheduledAt);
      const matchesFrom = !fromDate || date >= new Date(fromDate);
      const matchesTo = !toDate || date <= new Date(`${toDate}T23:59:59`);
      return matchesFrom && matchesTo;
    });
  }, [fromDate, sessions, toDate]);

  const filteredReports = useMemo(() => reports.filter((report) => filteredSessions.some((session) => session.id === report.sessionId)), [filteredSessions, reports]);

  const summary = useMemo(() => {
    const totalPatients = new Set(filteredSessions.map((session) => session.patientId)).size;
    const totalProcedures = filteredSessions.length;
    const biopsyRate = filteredReports.length ? Math.round((filteredReports.filter((report) => report.biopsy).length / filteredReports.length) * 100) : 0;
    return { totalPatients, totalProcedures, biopsyRate };
  }, [filteredReports, filteredSessions]);

  const proceduresPerMonth = useMemo(() => {
    const map = new Map<string, number>();
    filteredSessions.forEach((session) => {
      const key = new Date(session.scheduledAt).toLocaleString('en-US', { month: 'short', year: 'numeric' });
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [filteredSessions]);

  const procedureBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    filteredSessions.forEach((session) => {
      const key = getProcedureLabel(session.procedureType);
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [filteredSessions]);

  const proceduresPerDoctor = useMemo(() => {
    const map = new Map<string, number>();
    filteredSessions.forEach((session) => {
      map.set(session.doctorName, (map.get(session.doctorName) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [filteredSessions]);

  const commonDiagnoses = useMemo(() => {
    const map = new Map<string, number>();
    filteredReports.forEach((report) => {
      report.diagnosis.forEach((diagnosis) => {
        map.set(diagnosis, (map.get(diagnosis) ?? 0) + 1);
      });
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [filteredReports]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t.statistics.eyebrow}
        title={t.statistics.title}
        description={t.statistics.description}
      />

      <Card>
        <CardHeader>
          <CardTitle>{t.statistics.dateRange}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label={t.statistics.totalPatients} value={summary.totalPatients} />
        <StatCard label={t.statistics.totalProcedures} value={summary.totalProcedures} />
        <StatCard label={t.statistics.biopsyRate} value={`${summary.biopsyRate}%`} />
      </div>

      {filteredSessions.length === 0 ? (
        <EmptyState icon={<ChartIcon />} title={t.statistics.noData} description={t.statistics.noDataDesc} />
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <ChartCard title={t.statistics.proceduresPerMonth}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={proceduresPerMonth}>
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#0F766E" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title={t.statistics.breakdownByType}>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={procedureBreakdown} dataKey="value" nameKey="name" innerRadius={70} outerRadius={110} paddingAngle={4}>
                  {procedureBreakdown.map((entry, index) => (
                    <Cell key={entry.name} fill={palette[index % palette.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title={t.statistics.proceduresPerDoctor}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={proceduresPerDoctor} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={90} />
                <Tooltip />
                <Bar dataKey="value" fill="#2563EB" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title={t.statistics.commonDiagnoses}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={commonDiagnoses} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={140} />
                <Tooltip />
                <Bar dataKey="value" fill="#CA8A04" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function ChartIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-8 w-8">
      <rect x="8" y="10" width="32" height="28" rx="6" fill="#CCFBF1" stroke="#0F766E" strokeWidth="2" />
      <path d="M16 31V24" stroke="#0F766E" strokeWidth="3" strokeLinecap="round" />
      <path d="M24 31V18" stroke="#0F766E" strokeWidth="3" strokeLinecap="round" />
      <path d="M32 31V21" stroke="#0F766E" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
