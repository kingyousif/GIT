'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, SlidersHorizontal } from 'lucide-react';
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
import { getPatients, getSessions, getReportsForSession } from '@/lib/queries';
import { Patient, ProcedureSession } from '@/lib/types';
import { formatDateTime, getProcedureLabel } from '@/lib/utils';
import { useLocale } from '@/hooks/use-locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

const pageSize = 15;

type SortKey = 'patientCode' | 'fullName' | 'age' | 'gender' | 'phone' | 'address' | 'sessionsCount';

interface PatientWithSessions {
  patient: Patient;
  sessions: ProcedureSession[];
  lastSessionDate: string | null;
  lastProcedure: string | null;
}

export function PatientsTablePage() {
  const { t } = useLocale();
  const router = useRouter();
  const { dataVersion, settings } = useAppState();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PatientWithSessions[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  
  // Filters
  const [search, setSearch] = useState('');
  const [procedureType, setProcedureType] = useState('all');
  const [status, setStatus] = useState<'all' | ProcedureSession['status']>('all');
  const [doctor, setDoctor] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  
  // Sort & Page
  const [sortKey, setSortKey] = useState<SortKey>('fullName');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    const timer = window.setTimeout(() => {
      const patients = getPatients();
      const sessions = getSessions();
      
      const mapped: PatientWithSessions[] = patients.map((patient) => {
        const patientSessions = sessions
          .filter((s) => s.patientId === patient.id)
          .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());
        
        return {
          patient,
          sessions: patientSessions,
          lastSessionDate: patientSessions[0]?.scheduledAt || null,
          lastProcedure: patientSessions[0]?.procedureType || null,
        };
      });

      setRows(mapped);
      setLoading(false);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [dataVersion]);

  // If selected patient disappears or is filtered out, we deselect
  const selectedRow = useMemo(() => {
    return rows.find((r) => r.patient.id === selectedPatientId) || null;
  }, [rows, selectedPatientId]);

  const filtered = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const result = rows.filter((item) => {
      const matchesSearch =
        !normalizedSearch ||
        item.patient.fullName.toLowerCase().includes(normalizedSearch) ||
        item.patient.patientCode.toLowerCase().includes(normalizedSearch) ||
        item.patient.phone.toLowerCase().includes(normalizedSearch);
      
      const matchesProcedure =
        procedureType === 'all' ||
        item.sessions.some((s) => s.procedureType === procedureType);
        
      const matchesStatus =
        status === 'all' ||
        item.sessions.some((s) => s.status === status);
        
      const matchesDoctor =
        doctor === 'all' ||
        item.sessions.some((s) => s.doctorName === doctor);
        
      const matchesFrom =
        !fromDate ||
        item.sessions.some((s) => new Date(s.scheduledAt) >= new Date(fromDate));
        
      const matchesTo =
        !toDate ||
        item.sessions.some((s) => new Date(s.scheduledAt) <= new Date(`${toDate}T23:59:59`));
        
      return matchesSearch && matchesProcedure && matchesStatus && matchesDoctor && matchesFrom && matchesTo;
    });

    result.sort((a, b) => {
      const aValue =
        sortKey === 'patientCode'
          ? a.patient.patientCode
          : sortKey === 'fullName'
            ? a.patient.fullName
            : sortKey === 'age'
              ? a.patient.age
              : sortKey === 'gender'
                ? a.patient.gender
                : sortKey === 'phone'
                  ? a.patient.phone
                  : sortKey === 'address'
                    ? (a.patient.address || '')
                    : a.sessions.length;

      const bValue =
        sortKey === 'patientCode'
          ? b.patient.patientCode
          : sortKey === 'fullName'
            ? b.patient.fullName
            : sortKey === 'age'
              ? b.patient.age
              : sortKey === 'gender'
                ? b.patient.gender
                : sortKey === 'phone'
                  ? b.patient.phone
                  : sortKey === 'address'
                    ? (b.patient.address || '')
                    : b.sessions.length;

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [doctor, fromDate, procedureType, rows, search, sortDirection, sortKey, status, toDate]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [search, procedureType, status, doctor, fromDate, toDate]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDirection('asc');
  };

  const handlePatientClick = (patientId: string) => {
    setSelectedPatientId(patientId);
    setModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t.patientsTable.eyebrow}
        title={t.patientsTable.title}
        description={t.patientsTable.description}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-primary" />
            {t.patientsTable.searchFilters}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <div className="space-y-2 xl:col-span-2">
            <Label>{t.common.search}</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder={t.patientsTable.searchPlaceholder} value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t.dashboard.procedure}</Label>
            <Select value={procedureType} onValueChange={setProcedureType}>
              <SelectItem value="all">{t.patientsTable.allProcedures}</SelectItem>
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
              <SelectItem value="all">{t.patientsTable.allStatuses}</SelectItem>
              <SelectItem value="waiting">{t.statuses.waiting}</SelectItem>
              <SelectItem value="in-progress">{t.statuses.inProgress}</SelectItem>
              <SelectItem value="completed">{t.statuses.completed}</SelectItem>
              <SelectItem value="cancelled">{t.statuses.cancelled}</SelectItem>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t.dashboard.doctor}</Label>
            <Select value={doctor} onValueChange={setDoctor}>
              <SelectItem value="all">{t.patientsTable.allDoctors}</SelectItem>
              {settings?.doctors.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t.patientsTable.fromDate}</Label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t.patientsTable.toDate}</Label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex justify-between items-center">
            <span>{t.patientsTable.title || 'Patients'}</span>
            <span className="text-sm font-normal text-muted-foreground">
              Click any patient to view their associated procedure sessions.
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingTable />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<UsersIcon />}
              title="No patients found"
              description="No patients match your active search or filter criteria."
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <button type="button" className="font-semibold hover:underline" onClick={() => toggleSort('patientCode')}>
                          {t.dashboard.code || 'Code'}
                        </button>
                      </TableHead>
                      <TableHead>
                        <button type="button" className="font-semibold hover:underline" onClick={() => toggleSort('fullName')}>
                          {t.common.name || 'Name'}
                        </button>
                      </TableHead>
                      <TableHead>
                        <button type="button" className="font-semibold hover:underline" onClick={() => toggleSort('age')}>
                          {t.patientsTable.age || 'Age'}
                        </button>
                      </TableHead>
                      <TableHead>
                        <button type="button" className="font-semibold hover:underline" onClick={() => toggleSort('gender')}>
                          Gender
                        </button>
                      </TableHead>
                      <TableHead>
                        <button type="button" className="font-semibold hover:underline" onClick={() => toggleSort('phone')}>
                          Phone
                        </button>
                      </TableHead>
                      <TableHead>
                        <button type="button" className="font-semibold hover:underline" onClick={() => toggleSort('address')}>
                          Address
                        </button>
                      </TableHead>
                      <TableHead>
                        <button type="button" className="font-semibold hover:underline" onClick={() => toggleSort('sessionsCount')}>
                          Sessions
                        </button>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.map((item) => {
                      const isSelected = item.patient.id === selectedPatientId;
                      return (
                        <TableRow
                          key={item.patient.id}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted/50'
                          }`}
                          onClick={() => handlePatientClick(item.patient.id)}
                        >
                          <TableCell className="font-medium">{item.patient.patientCode}</TableCell>
                          <TableCell className="font-medium text-primary">{item.patient.fullName}</TableCell>
                          <TableCell>{item.patient.age}</TableCell>
                          <TableCell className="capitalize">{item.patient.gender}</TableCell>
                          <TableCell>{item.patient.phone}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{item.patient.address || '-'}</TableCell>
                          <TableCell className="font-semibold">{item.sessions.length}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
                <p className="text-sm text-muted-foreground">
                  {t.common.showing || 'Showing'} {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, filtered.length)} {t.common.of || 'of'} {filtered.length} patients
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page === 1}>
                    {t.common.previous || 'Previous'}
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {t.common.page || 'Page'} {page} / {totalPages}
                  </span>
                  <Button variant="outline" onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} disabled={page === totalPages}>
                    {t.common.next || 'Next'}
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Selected Patient Sessions Dialog Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-3xl">
          {selectedRow && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl text-primary font-semibold">
                  Procedure Sessions for {selectedRow.patient.fullName}
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  Patient Code: <span className="font-medium text-foreground">{selectedRow.patient.patientCode}</span> • 
                  Phone: <span className="font-medium text-foreground">{selectedRow.patient.phone}</span> • 
                  Gender: <span className="font-medium text-foreground capitalize">{selectedRow.patient.gender}</span>
                </DialogDescription>
              </DialogHeader>

              <div className="mt-4">
                {selectedRow.sessions.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No procedure sessions found for this patient.</p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-card-border bg-card">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead>Procedure</TableHead>
                          <TableHead>Assigned Doctor</TableHead>
                          <TableHead>Scheduled Date & Time</TableHead>
                          <TableHead>Reports</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedRow.sessions.map((session) => {
                          const reportsCount = getReportsForSession(session.id).length;
                          return (
                            <TableRow
                              key={session.id}
                              className="cursor-pointer hover:bg-muted/50 transition-colors"
                              onClick={() => {
                                setModalOpen(false);
                                router.push(`/patients/${session.id}`);
                              }}
                            >
                              <TableCell className="font-medium text-primary">{getProcedureLabel(session.procedureType)}</TableCell>
                              <TableCell>{session.doctorName}</TableCell>
                              <TableCell>{formatDateTime(session.scheduledAt)}</TableCell>
                              <TableCell className="font-medium text-muted-foreground">
                                {reportsCount} {reportsCount === 1 ? 'Report' : 'Reports'}
                              </TableCell>
                              <TableCell>
                                <StatusBadge status={session.status} />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              <DialogFooter className="mt-6 flex justify-end">
                <Button variant="outline" onClick={() => setModalOpen(false)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UsersIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-8 w-8">
      <circle cx="18" cy="17" r="6" fill="#CCFBF1" stroke="#0F766E" strokeWidth="2" />
      <circle cx="31" cy="19" r="5" fill="#DBEAFE" stroke="#2563EB" strokeWidth="2" />
      <path d="M8 38C8 32.4772 12.4772 28 18 28H19C24.5228 28 29 32.4772 29 38V40H8V38Z" fill="#CCFBF1" stroke="#0F766E" strokeWidth="2" />
      <path d="M26 40V38.5C26 34.9101 28.9101 32 32.5 32C36.0899 32 39 34.9101 39 38.5V40" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
